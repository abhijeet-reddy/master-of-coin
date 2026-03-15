use std::collections::HashMap;
use std::sync::Arc;

use bigdecimal::BigDecimal;
use chrono::Utc;
use diesel::prelude::*;
use uuid::Uuid;

use crate::DbPool;
use crate::errors::{ApiError, ApiResult};
use crate::models::account::Account;
use crate::models::debt_transaction_metadata::NewDebtTransactionMetadata;
use crate::models::person::NewPerson;
use crate::models::person_split_config::{NewPersonSplitConfig, PersonSplitConfig};
use crate::models::split_provider::SplitProvider as SplitProviderModel;
use crate::models::split_sync_record::{
    NewSplitSyncRecord, SplitSyncRecord, SyncStatus, UpdateSplitSyncRecord,
};
use crate::models::transaction::{NewTransaction, Transaction};
use crate::models::transaction_split::{NewTransactionSplit, TransactionSplit};
use crate::repositories;
use crate::repositories::split_sync_record::SplitSyncRecordRepository;
use crate::schema::{
    accounts, person_split_configs, split_providers, transaction_splits, transactions,
};
use crate::services::split_provider::{
    CreateExternalExpense, ExpenseUser, ExternalExpenseDetail, SplitProvider,
    UpdateExternalExpense, all_providers,
};
use crate::types::CurrencyCode;
use crate::utils::encryption;

/// Maximum number of retry attempts for failed syncs
const MAX_RETRY_COUNT: i32 = 5;

/// Service for syncing transaction splits to external split providers
#[derive(Clone)]
pub struct SplitSyncService {
    pool: DbPool,
    providers: Arc<HashMap<String, Arc<dyn SplitProvider>>>,
}

impl SplitSyncService {
    /// Create a new SplitSyncService with all available providers
    pub fn new(pool: DbPool) -> Self {
        Self {
            pool,
            providers: Arc::new(all_providers()),
        }
    }

    /// Sync when a split is deleted
    ///
    /// If no splits remain for a provider, delete the expense
    /// Otherwise, update the expense with remaining users
    pub async fn on_split_deleted(
        &self,
        transaction_id: Uuid,
        deleted_split_id: Uuid,
    ) -> ApiResult<()> {
        // Fetch remaining splits for this transaction
        let (transaction, splits_with_configs) =
            self.fetch_transaction_and_splits(transaction_id).await?;

        // Get sync records for the deleted split
        let deleted_sync_records =
            SplitSyncRecordRepository::find_by_split_id(&self.pool, deleted_split_id)?;

        // Group remaining splits by provider
        let grouped = self.group_splits_by_provider(splits_with_configs);

        // For each provider that had the deleted split
        for deleted_record in deleted_sync_records {
            let provider_id = deleted_record.split_provider_id;

            // Check if there are remaining splits for this provider
            if let Some(remaining_splits) = grouped.get(&provider_id) {
                // Update expense with remaining users
                if let Err(e) = self
                    .update_splits_group(&transaction, provider_id, remaining_splits.clone())
                    .await
                {
                    tracing::error!(
                        "Failed to update expense after split deletion for provider {}: {}",
                        provider_id,
                        e
                    );
                }
            } else {
                // No remaining splits for this provider, delete the expense
                if let Some(external_expense_id) = deleted_record.external_expense_id {
                    if let Err(e) = self.delete_expense(provider_id, &external_expense_id).await {
                        tracing::error!(
                            "Failed to delete expense {} from provider {}: {}",
                            external_expense_id,
                            provider_id,
                            e
                        );
                    }
                }
            }

            // Delete the sync record for the deleted split
            if let Err(e) = SplitSyncRecordRepository::delete(&self.pool, deleted_record.id) {
                tracing::error!("Failed to delete sync record {}: {}", deleted_record.id, e);
            }
        }

        Ok(())
    }

    /// Retry a failed sync
    pub async fn retry_failed_sync(&self, sync_record_id: Uuid) -> ApiResult<SplitSyncRecord> {
        let record = SplitSyncRecordRepository::find_by_id(&self.pool, sync_record_id)?
            .ok_or_else(|| ApiError::NotFound("Sync record not found".to_string()))?;

        let current_retry_count = record.retry_count;

        if current_retry_count >= MAX_RETRY_COUNT {
            return Err(ApiError::BadRequest(
                "Maximum retry count exceeded".to_string(),
            ));
        }

        // Fetch transaction and split
        let mut conn = self.pool.get().map_err(|e| {
            tracing::error!("Failed to get DB connection: {}", e);
            ApiError::Internal
        })?;
        let split = transaction_splits::table
            .find(record.transaction_split_id)
            .first::<TransactionSplit>(&mut conn)?;

        let provider_id = record.split_provider_id;

        let (transaction, splits_with_configs) = self
            .fetch_transaction_and_splits(split.transaction_id)
            .await?;

        // Group by provider and retry
        let grouped = self.group_splits_by_provider(splits_with_configs);

        if let Some(splits_group) = grouped.get(&provider_id) {
            self.sync_splits_group_with_retry_count(
                &transaction,
                provider_id,
                splits_group.clone(),
                current_retry_count + 1,
            )
            .await?;
        }

        // Fetch updated record
        let updated_record = SplitSyncRecordRepository::find_by_id(&self.pool, sync_record_id)?
            .ok_or_else(|| ApiError::NotFound("Sync record not found".to_string()))?;

        Ok(updated_record)
    }

    /// Fetch transaction and all its splits with person configs
    async fn fetch_transaction_and_splits(
        &self,
        transaction_id: Uuid,
    ) -> ApiResult<(
        Transaction,
        Vec<(TransactionSplit, Option<PersonSplitConfig>)>,
    )> {
        let mut conn = self.pool.get().map_err(|e| {
            tracing::error!("Failed to get DB connection: {}", e);
            ApiError::Internal
        })?;

        // Fetch transaction
        let transaction = transactions::table
            .find(transaction_id)
            .first::<Transaction>(&mut conn)?;

        // Fetch all splits with their person configs
        let splits_with_configs = transaction_splits::table
            .filter(transaction_splits::transaction_id.eq(transaction_id))
            .left_join(
                person_split_configs::table
                    .on(person_split_configs::person_id.eq(transaction_splits::person_id)),
            )
            .select((
                TransactionSplit::as_select(),
                person_split_configs::all_columns.nullable(),
            ))
            .load::<(TransactionSplit, Option<PersonSplitConfig>)>(&mut conn)?;

        Ok((transaction, splits_with_configs))
    }

    /// Group splits by their provider ID
    fn group_splits_by_provider(
        &self,
        splits_with_configs: Vec<(TransactionSplit, Option<PersonSplitConfig>)>,
    ) -> HashMap<Uuid, Vec<(TransactionSplit, PersonSplitConfig)>> {
        let mut grouped: HashMap<Uuid, Vec<(TransactionSplit, PersonSplitConfig)>> = HashMap::new();

        for (split, config_opt) in splits_with_configs {
            if let Some(config) = config_opt {
                grouped
                    .entry(config.split_provider_id)
                    .or_insert_with(Vec::new)
                    .push((split, config));
            }
        }

        grouped
    }

    /// Sync a group of splits to a provider (create expense)
    async fn sync_splits_group(
        &self,
        transaction: &Transaction,
        provider_id: Uuid,
        splits: Vec<(TransactionSplit, PersonSplitConfig)>,
    ) -> ApiResult<()> {
        self.sync_splits_group_with_retry_count(transaction, provider_id, splits, 0)
            .await
    }

    /// Sync a group of splits to a provider with a specific retry count
    async fn sync_splits_group_with_retry_count(
        &self,
        transaction: &Transaction,
        provider_id: Uuid,
        splits: Vec<(TransactionSplit, PersonSplitConfig)>,
        retry_count: i32,
    ) -> ApiResult<()> {
        // Fetch provider
        let mut conn = self.pool.get().map_err(|e| {
            tracing::error!("Failed to get DB connection: {}", e);
            ApiError::Internal
        })?;
        let provider_model = split_providers::table
            .find(provider_id)
            .first::<SplitProviderModel>(&mut conn)?;

        // Get provider implementation
        let provider = self
            .providers
            .get(&provider_model.provider_type)
            .ok_or_else(|| {
                ApiError::BadRequest(format!(
                    "Unknown provider type: {}",
                    provider_model.provider_type
                ))
            })?;

        // Decrypt credentials
        let encrypted = provider_model
            .credentials
            .get("encrypted")
            .and_then(|v| v.as_str())
            .ok_or_else(|| {
                ApiError::InternalWithMessage("Invalid credentials format".to_string())
            })?;

        let credentials = encryption::decrypt_credentials(encrypted).map_err(|e| {
            ApiError::InternalWithMessage(format!("Failed to decrypt credentials: {}", e))
        })?;

        // Get the payer's external user ID from the provider credentials
        // (the authenticated user who paid the full amount)
        let payer_external_id = extract_external_user_id(&credentials).ok_or_else(|| {
            ApiError::InternalWithMessage(
                "Missing external user ID in provider credentials".to_string(),
            )
        })?;

        // Fetch account to get currency code and type
        let account = accounts::table
            .find(transaction.account_id)
            .first::<Account>(&mut conn)?;

        // Build expense users — swap payer for DEBT account transactions
        let is_debt = account.account_type == crate::types::AccountType::Debt;
        let (users, expense_cost) = if is_debt {
            // Fetch debt metadata for full expense details
            let debt_meta = repositories::debt_transaction_metadata::find_by_transaction_id(
                &self.pool,
                transaction.id,
            )
            .await?;

            if let Some(meta) = debt_meta {
                if let Some(ref participants_json) = meta.expense_participants {
                    // Use full expense details from metadata
                    let participants: Vec<
                        crate::models::debt_transaction_metadata::ExpenseParticipantInput,
                    > = serde_json::from_value(participants_json.clone()).unwrap_or_default();
                    let cost = format!("{:.2}", meta.total_cost);
                    // Fix payer's paid_share to match total_cost (Splitwise requires sum(paid) == cost)
                    let users: Vec<ExpenseUser> = participants
                        .iter()
                        .map(|p| {
                            let is_payer = p.paid_share.parse::<f64>().unwrap_or(0.0) > 0.0;
                            ExpenseUser {
                                external_user_id: p.external_user_id.clone().unwrap_or_default(),
                                paid_share: if is_payer {
                                    cost.clone()
                                } else {
                                    "0.00".to_string()
                                },
                                owed_share: p.owed_share.clone(),
                            }
                        })
                        .collect();
                    (users, cost)
                } else {
                    // No participants — fall back to simple debt expense users
                    let users =
                        self.build_debt_expense_users(transaction, &splits, &payer_external_id)?;
                    (users, transaction.amount.abs().to_string())
                }
            } else {
                let users =
                    self.build_debt_expense_users(transaction, &splits, &payer_external_id)?;
                (users, transaction.amount.abs().to_string())
            }
        } else {
            let users = self.build_expense_users(transaction, &splits, &payer_external_id)?;
            (users, transaction.amount.abs().to_string())
        };

        // Create expense request
        let request = CreateExternalExpense {
            description: transaction.title.clone(),
            cost: expense_cost,
            currency_code: account.currency.as_str().to_string(),
            date: transaction.date,
            group_id: None, // TODO: Support groups
            users,
            notes: transaction.notes.clone(),
        };

        // Call provider to create expense
        match provider.create_expense(&credentials, request).await {
            Ok(result) => {
                // Upsert sync records for all splits in this group
                for (split, _) in splits {
                    self.upsert_sync_record(
                        split.id,
                        provider_id,
                        Some(result.external_expense_id.clone()),
                        SyncStatus::Synced,
                        None,
                        retry_count,
                    );
                }

                Ok(())
            }
            Err(e) => {
                // Upsert failed sync records
                for (split, _) in splits {
                    self.upsert_sync_record(
                        split.id,
                        provider_id,
                        None,
                        SyncStatus::Failed,
                        Some(e.to_string()),
                        retry_count,
                    );
                }

                Err(ApiError::External(format!(
                    "Failed to create expense: {}",
                    e
                )))
            }
        }
    }

    /// Update a group of splits on a provider (update expense)
    async fn update_splits_group(
        &self,
        transaction: &Transaction,
        provider_id: Uuid,
        splits: Vec<(TransactionSplit, PersonSplitConfig)>,
    ) -> ApiResult<()> {
        // Get existing sync record to find external expense ID
        let first_split_id = splits
            .first()
            .map(|(s, _)| s.id)
            .ok_or_else(|| ApiError::BadRequest("No splits provided for update".to_string()))?;

        let sync_record = SplitSyncRecordRepository::find_by_split_and_provider(
            &self.pool,
            first_split_id,
            provider_id,
        )?
        .ok_or_else(|| ApiError::NotFound("Sync record not found".to_string()))?;

        let external_expense_id = sync_record
            .external_expense_id
            .ok_or_else(|| ApiError::BadRequest("No external expense ID found".to_string()))?;

        // Fetch provider
        let mut conn = self.pool.get().map_err(|e| {
            tracing::error!("Failed to get DB connection: {}", e);
            ApiError::Internal
        })?;
        let provider_model = split_providers::table
            .find(provider_id)
            .first::<SplitProviderModel>(&mut conn)?;

        // Get provider implementation
        let provider = self
            .providers
            .get(&provider_model.provider_type)
            .ok_or_else(|| {
                ApiError::BadRequest(format!(
                    "Unknown provider type: {}",
                    provider_model.provider_type
                ))
            })?;

        // Decrypt credentials
        let encrypted = provider_model
            .credentials
            .get("encrypted")
            .and_then(|v| v.as_str())
            .ok_or_else(|| {
                ApiError::InternalWithMessage("Invalid credentials format".to_string())
            })?;

        let credentials = encryption::decrypt_credentials(encrypted).map_err(|e| {
            ApiError::InternalWithMessage(format!("Failed to decrypt credentials: {}", e))
        })?;

        // Get the payer's external user ID from the provider credentials
        let payer_external_id = extract_external_user_id(&credentials).ok_or_else(|| {
            ApiError::InternalWithMessage(
                "Missing external user ID in provider credentials".to_string(),
            )
        })?;

        // Fetch account to detect DEBT type
        let account = accounts::table
            .find(transaction.account_id)
            .first::<Account>(&mut conn)?;

        // Build expense users — swap payer for DEBT account transactions
        let is_debt = account.account_type == crate::types::AccountType::Debt;
        let (users, expense_cost) = if is_debt {
            // Fetch debt metadata for full expense details
            let debt_meta = repositories::debt_transaction_metadata::find_by_transaction_id(
                &self.pool,
                transaction.id,
            )
            .await?;

            if let Some(meta) = debt_meta {
                if let Some(ref participants_json) = meta.expense_participants {
                    let participants: Vec<
                        crate::models::debt_transaction_metadata::ExpenseParticipantInput,
                    > = serde_json::from_value(participants_json.clone()).unwrap_or_default();
                    let cost = format!("{:.2}", meta.total_cost);
                    // Fix payer's paid_share to match total_cost (Splitwise requires sum(paid) == cost)
                    let users: Vec<ExpenseUser> = participants
                        .iter()
                        .map(|p| {
                            let is_payer = p.paid_share.parse::<f64>().unwrap_or(0.0) > 0.0;
                            ExpenseUser {
                                external_user_id: p.external_user_id.clone().unwrap_or_default(),
                                paid_share: if is_payer {
                                    cost.clone()
                                } else {
                                    "0.00".to_string()
                                },
                                owed_share: p.owed_share.clone(),
                            }
                        })
                        .collect();
                    (users, cost)
                } else {
                    let users =
                        self.build_debt_expense_users(transaction, &splits, &payer_external_id)?;
                    (users, transaction.amount.abs().to_string())
                }
            } else {
                let users =
                    self.build_debt_expense_users(transaction, &splits, &payer_external_id)?;
                (users, transaction.amount.abs().to_string())
            }
        } else {
            let users = self.build_expense_users(transaction, &splits, &payer_external_id)?;
            (users, transaction.amount.abs().to_string())
        };

        // Create update request
        let request = UpdateExternalExpense {
            description: Some(transaction.title.clone()),
            cost: Some(expense_cost),
            date: Some(transaction.date),
            users: Some(users),
            notes: transaction.notes.clone(),
        };

        // Call provider to update expense
        match provider
            .update_expense(&credentials, &external_expense_id, request)
            .await
        {
            Ok(_) => {
                // Update all sync records for this provider
                for (split, _) in splits {
                    if let Ok(Some(record)) = SplitSyncRecordRepository::find_by_split_and_provider(
                        &self.pool,
                        split.id,
                        provider_id,
                    ) {
                        let update = UpdateSplitSyncRecord {
                            external_expense_id: None,
                            sync_status: Some(SyncStatus::Synced.as_str().to_string()),
                            last_sync_at: Some(Utc::now()),
                            last_error: None,
                            retry_count: None,
                        };

                        if let Err(e) =
                            SplitSyncRecordRepository::update(&self.pool, record.id, update)
                        {
                            tracing::error!(
                                "Failed to update sync record for split {}: {}",
                                split.id,
                                e
                            );
                        }
                    }
                }

                Ok(())
            }
            Err(e) => {
                // Update sync records with error
                for (split, _) in splits {
                    if let Ok(Some(record)) = SplitSyncRecordRepository::find_by_split_and_provider(
                        &self.pool,
                        split.id,
                        provider_id,
                    ) {
                        let update = UpdateSplitSyncRecord {
                            external_expense_id: None,
                            sync_status: Some(SyncStatus::Failed.as_str().to_string()),
                            last_sync_at: Some(Utc::now()),
                            last_error: Some(e.to_string()),
                            retry_count: Some(record.retry_count + 1),
                        };

                        if let Err(e) =
                            SplitSyncRecordRepository::update(&self.pool, record.id, update)
                        {
                            tracing::error!(
                                "Failed to update failed sync record for split {}: {}",
                                split.id,
                                e
                            );
                        }
                    }
                }

                Err(ApiError::External(format!(
                    "Failed to update expense: {}",
                    e
                )))
            }
        }
    }

    /// Delete an expense from a provider
    async fn delete_expense(&self, provider_id: Uuid, external_expense_id: &str) -> ApiResult<()> {
        // Fetch provider
        let mut conn = self.pool.get().map_err(|e| {
            tracing::error!("Failed to get DB connection: {}", e);
            ApiError::Internal
        })?;
        let provider_model = split_providers::table
            .find(provider_id)
            .first::<SplitProviderModel>(&mut conn)?;

        // Get provider implementation
        let provider = self
            .providers
            .get(&provider_model.provider_type)
            .ok_or_else(|| {
                ApiError::BadRequest(format!(
                    "Unknown provider type: {}",
                    provider_model.provider_type
                ))
            })?;

        // Decrypt credentials
        let encrypted = provider_model
            .credentials
            .get("encrypted")
            .and_then(|v| v.as_str())
            .ok_or_else(|| {
                ApiError::InternalWithMessage("Invalid credentials format".to_string())
            })?;

        let credentials = encryption::decrypt_credentials(encrypted).map_err(|e| {
            ApiError::InternalWithMessage(format!("Failed to decrypt credentials: {}", e))
        })?;

        // Call provider to delete expense
        provider
            .delete_expense(&credentials, external_expense_id)
            .await
            .map_err(|e| ApiError::External(format!("Failed to delete expense: {}", e)))?;

        Ok(())
    }

    /// Upsert a sync record: update if exists, create if not
    ///
    /// This avoids unique constraint violations when retrying failed syncs.
    fn upsert_sync_record(
        &self,
        split_id: Uuid,
        provider_id: Uuid,
        external_expense_id: Option<String>,
        status: SyncStatus,
        last_error: Option<String>,
        retry_count: i32,
    ) {
        // Check if a record already exists for this split+provider
        match SplitSyncRecordRepository::find_by_split_and_provider(
            &self.pool,
            split_id,
            provider_id,
        ) {
            Ok(Some(existing)) => {
                // Update existing record
                let update = UpdateSplitSyncRecord {
                    external_expense_id: external_expense_id.clone(),
                    sync_status: Some(status.as_str().to_string()),
                    last_sync_at: Some(Utc::now()),
                    last_error,
                    retry_count: Some(retry_count),
                };
                if let Err(e) = SplitSyncRecordRepository::update(&self.pool, existing.id, update) {
                    tracing::error!("Failed to update sync record for split {}: {}", split_id, e);
                }
            }
            Ok(None) => {
                // Create new record
                let new_record = NewSplitSyncRecord {
                    transaction_split_id: split_id,
                    split_provider_id: provider_id,
                    external_expense_id,
                    sync_status: status.as_str().to_string(),
                    last_sync_at: Some(Utc::now()),
                    last_error,
                    retry_count,
                };
                if let Err(e) = SplitSyncRecordRepository::create(&self.pool, new_record) {
                    tracing::error!("Failed to create sync record for split {}: {}", split_id, e);
                }
            }
            Err(e) => {
                tracing::error!(
                    "Failed to look up sync record for split {}: {}",
                    split_id,
                    e
                );
            }
        }
    }

    /// Build expense users from transaction and splits
    ///
    /// The payer is the transaction owner (user who paid the full amount)
    /// Each split represents an amount owed by that person.
    /// All amounts are sent as absolute values since Splitwise requires cost >= 0.
    fn build_expense_users(
        &self,
        transaction: &Transaction,
        splits: &[(TransactionSplit, PersonSplitConfig)],
        payer_external_id: &str,
    ) -> ApiResult<Vec<ExpenseUser>> {
        let mut users = Vec::new();

        // Use absolute value of transaction amount (expenses are stored as negative)
        let abs_amount = transaction.amount.abs();

        // Calculate total split amount (what others owe), also as absolute values
        let total_split: BigDecimal = splits.iter().map(|(s, _)| s.amount.abs()).sum();

        // Payer paid the full amount and owes their own share
        // (total amount minus what others owe)
        let payer_owed = &abs_amount - &total_split;

        users.push(ExpenseUser {
            external_user_id: payer_external_id.to_string(),
            paid_share: abs_amount.to_string(),
            owed_share: payer_owed.to_string(),
        });

        // Each split person owes their split amount (absolute) and paid nothing
        for (split, config) in splits {
            users.push(ExpenseUser {
                external_user_id: config.external_user_id.clone(),
                paid_share: "0.00".to_string(),
                owed_share: split.amount.abs().to_string(),
            });
        }

        Ok(users)
    }

    /// Build expense users for a DEBT account transaction (paid by others).
    ///
    /// In this case, the **friend** (split person) is the payer, and the current user
    /// owes their share. The total cost on Splitwise equals the user's owed share
    /// (since that's the amount of the DEBT transaction).
    ///
    /// For a debt transaction of -50 EUR (friend paid, I owe 50):
    /// - Friend: paid_share = 50, owed_share = 0
    /// - Current user: paid_share = 0, owed_share = 50
    fn build_debt_expense_users(
        &self,
        transaction: &Transaction,
        splits: &[(TransactionSplit, PersonSplitConfig)],
        current_user_external_id: &str,
    ) -> ApiResult<Vec<ExpenseUser>> {
        let mut users = Vec::new();

        // The transaction amount is the user's owed share (stored as negative for expenses)
        let abs_amount = transaction.amount.abs();

        // For debt transactions, there's typically one split — the payer (friend).
        // The friend paid the full amount and owes nothing (or their own share if it's a group expense).
        // The current user paid nothing and owes the full transaction amount.
        for (_split, config) in splits {
            // The split person (friend) is the payer
            // paid_share = full amount, owed_share = 0 (they don't owe themselves)
            users.push(ExpenseUser {
                external_user_id: config.external_user_id.clone(),
                paid_share: abs_amount.to_string(),
                owed_share: "0.00".to_string(),
            });
        }

        // Current user owes the full amount and paid nothing
        users.push(ExpenseUser {
            external_user_id: current_user_external_id.to_string(),
            paid_share: "0.00".to_string(),
            owed_share: abs_amount.to_string(),
        });

        Ok(users)
    }

    /// Find matching expenses on the split provider for a transaction
    ///
    /// Searches the provider for expenses that match the transaction's amount and date.
    /// Returns a list of potential matches with their user details.
    pub async fn find_split_match(
        &self,
        transaction_id: Uuid,
    ) -> ApiResult<Vec<ExternalExpenseDetail>> {
        let (transaction, splits_with_configs) =
            self.fetch_transaction_and_splits(transaction_id).await?;

        if splits_with_configs.is_empty() {
            return Err(ApiError::BadRequest(
                "Transaction has no splits to match".to_string(),
            ));
        }

        // Group by provider
        let grouped = self.group_splits_by_provider(splits_with_configs.clone());

        // Collect already-linked external expense IDs to filter them out
        let mut linked_expense_ids: std::collections::HashSet<String> =
            std::collections::HashSet::new();
        for (split, _config) in &splits_with_configs {
            if let Ok(records) = SplitSyncRecordRepository::find_by_split_id(&self.pool, split.id) {
                for record in records {
                    if let Some(ext_id) = record.external_expense_id {
                        linked_expense_ids.insert(ext_id);
                    }
                }
            }
        }

        let mut all_matches: Vec<ExternalExpenseDetail> = Vec::new();

        for (provider_id, splits_group) in grouped {
            // Fetch provider credentials
            let mut conn = self.pool.get().map_err(|e| {
                tracing::error!("Failed to get DB connection: {}", e);
                ApiError::Internal
            })?;
            let provider_model = split_providers::table
                .find(provider_id)
                .first::<SplitProviderModel>(&mut conn)?;

            let provider = self
                .providers
                .get(&provider_model.provider_type)
                .ok_or_else(|| {
                    ApiError::BadRequest(format!(
                        "Unknown provider type: {}",
                        provider_model.provider_type
                    ))
                })?;

            let encrypted = provider_model
                .credentials
                .get("encrypted")
                .and_then(|v| v.as_str())
                .ok_or_else(|| {
                    ApiError::InternalWithMessage("Invalid credentials format".to_string())
                })?;

            let credentials = encryption::decrypt_credentials(encrypted).map_err(|e| {
                ApiError::InternalWithMessage(format!("Failed to decrypt credentials: {}", e))
            })?;

            // Get the first friend's external ID to filter expenses
            let friend_id = splits_group
                .first()
                .map(|(_, config)| config.external_user_id.clone());

            // Search for expenses around the transaction date (±3 days)
            let tx_date = transaction.date;
            let dated_after = (tx_date - chrono::Duration::days(3))
                .format("%Y-%m-%dT00:00:00Z")
                .to_string();
            let dated_before = (tx_date + chrono::Duration::days(3))
                .format("%Y-%m-%dT23:59:59Z")
                .to_string();

            match provider
                .get_expenses(
                    &credentials,
                    friend_id.as_deref(),
                    Some(&dated_after),
                    Some(&dated_before),
                    Some(50),
                )
                .await
            {
                Ok(expenses) => {
                    // Filter by matching total amount (numeric) and exclude already-linked
                    let tx_abs_amount = transaction.amount.abs();
                    for expense in expenses {
                        let cost_matches = expense
                            .cost
                            .parse::<BigDecimal>()
                            .map(|c| c == tx_abs_amount)
                            .unwrap_or(false);
                        if cost_matches
                            && !linked_expense_ids.contains(&expense.external_expense_id)
                        {
                            all_matches.push(expense);
                        }
                    }
                }
                Err(e) => {
                    tracing::error!(
                        "Failed to search expenses from provider {}: {}",
                        provider_id,
                        e
                    );
                }
            }
        }

        Ok(all_matches)
    }

    /// Single entry point for syncing a transaction's splits with the external provider.
    ///
    /// Flow:
    /// 1. If already linked to an external expense → fetch it and compare splits
    ///    - If splits match → "synced" (already in sync)
    ///    - If splits differ → "mismatch" (returns both sides' details)
    /// 2. If not linked → search provider for matching expenses (same amount, ±3 days)
    ///    - If exact match found → "linked" (auto-links)
    ///    - If amount matches but splits differ → "mismatch"
    ///    - If no match → "created" (creates new expense)
    ///
    /// # Returns
    ///
    /// JSON value with `status` field: "synced", "linked", "created", or "mismatch"
    pub async fn sync_transaction(&self, transaction_id: Uuid) -> ApiResult<serde_json::Value> {
        let (transaction, splits_with_configs) =
            self.fetch_transaction_and_splits(transaction_id).await?;

        if splits_with_configs.is_empty() {
            return Err(ApiError::BadRequest(
                "Transaction has no splits to sync".to_string(),
            ));
        }

        let grouped = self.group_splits_by_provider(splits_with_configs.clone());

        // Handle the first provider group
        let (provider_id, splits_group) = grouped.into_iter().next().ok_or_else(|| {
            ApiError::BadRequest("No splits have a configured split provider".to_string())
        })?;

        // Check if this is a DEBT account transaction (paid by others)
        let mut conn = self.pool.get().map_err(|e| {
            tracing::error!("Failed to get DB connection: {}", e);
            ApiError::Internal
        })?;
        let account = accounts::table
            .find(transaction.account_id)
            .first::<Account>(&mut conn)?;
        drop(conn);

        if account.account_type == crate::types::AccountType::Debt {
            // Debt transaction sync flow:
            // 1. Check if already linked to an external expense
            // 2. Search for matching expenses (where friend paid)
            // 3. If match found → link it
            // 4. If no match → create new expense with friend as payer

            let existing_expense_id = self.get_linked_expense_id(&splits_group);

            if let Some(ref ext_id) = existing_expense_id {
                // Already linked — fetch expense and compare with local data
                let linked_expense = self.fetch_linked_expense(provider_id, ext_id).await?;
                if let Some(ref expense) = linked_expense {
                    let payer_info = self.get_payer_info(provider_id)?;
                    let current_user_external_id = &payer_info.0;

                    // Compare: check if the user's owed share matches
                    let user_owed = transaction.amount.abs();
                    let splits_match = self.compare_debt_splits(
                        &user_owed,
                        current_user_external_id,
                        &splits_group,
                        expense,
                    );

                    if splits_match {
                        // In sync — update metadata from Splitwise (backfill)
                        self.update_debt_metadata_from_expense(transaction.id, expense)
                            .await;

                        for (split, _config) in &splits_group {
                            self.upsert_sync_record(
                                split.id,
                                provider_id,
                                Some(ext_id.clone()),
                                SyncStatus::Synced,
                                None,
                                0,
                            );
                        }
                        return Ok(serde_json::json!({
                            "status": "synced",
                            "external_expense_id": ext_id,
                            "message": "Debt transaction is in sync with split provider",
                        }));
                    }

                    // Mismatch — build comparison response for push/pull choice
                    // Build local shares from expense_participants metadata
                    let local_shares = self.build_debt_local_shares(
                        &transaction,
                        current_user_external_id,
                        &payer_info.1,
                    );

                    let external_shares: Vec<serde_json::Value> = expense
                        .users
                        .iter()
                        .map(|u| {
                            serde_json::json!({
                                "external_user_id": u.external_user_id,
                                "first_name": u.first_name,
                                "last_name": u.last_name,
                                "paid_share": u.paid_share,
                                "owed_share": u.owed_share,
                            })
                        })
                        .collect();

                    // For debt transactions, local_total should be the total_cost from metadata
                    // (the full expense amount), not the transaction amount (user's share)
                    let local_total = self
                        .get_debt_total_cost(transaction.id)
                        .unwrap_or_else(|| transaction.amount.abs().to_string());
                    let external_total = expense.cost.clone();

                    let error_msg =
                        "Debt expense mismatch: local and Splitwise data differ".to_string();

                    // Record mismatch status
                    for (split, _config) in &splits_group {
                        self.upsert_sync_record(
                            split.id,
                            provider_id,
                            Some(ext_id.clone()),
                            SyncStatus::Failed,
                            Some(error_msg.clone()),
                            0,
                        );
                    }

                    return Ok(serde_json::json!({
                        "status": "mismatch",
                        "external_expense_id": ext_id,
                        "message": error_msg,
                        "local_total": local_total,
                        "external_total": external_total,
                        "totals_differ": local_total != external_total,
                        "local_splits": local_shares,
                        "external_expense": {
                            "description": expense.description,
                            "cost": expense.cost,
                            "currency_code": expense.currency_code,
                            "date": expense.date,
                            "users": external_shares,
                        },
                    }));
                }
                // Linked expense was deleted — fall through to search/create
            }

            // Search for matching expenses on Splitwise
            // For debt transactions, we search by the friend's external ID and date range
            let payer_info = self.get_payer_info(provider_id)?;
            let current_user_external_id = &payer_info.0;

            let matches = self
                .find_debt_split_match(&transaction, &splits_group, provider_id)
                .await?;

            // Check each match: the friend should be the payer (paid_share > 0)
            // and the current user should owe the transaction amount
            let user_owed = transaction.amount.abs();
            for matched_expense in &matches {
                if self.compare_debt_splits(
                    &user_owed,
                    current_user_external_id,
                    &splits_group,
                    matched_expense,
                ) {
                    // Exact match → link it and update metadata
                    for (split, _config) in &splits_group {
                        self.upsert_sync_record(
                            split.id,
                            provider_id,
                            Some(matched_expense.external_expense_id.clone()),
                            SyncStatus::Synced,
                            None,
                            0,
                        );
                    }
                    // Update local metadata with full expense details
                    self.update_debt_metadata_from_expense(transaction.id, matched_expense)
                        .await;

                    return Ok(serde_json::json!({
                        "status": "linked",
                        "external_expense_id": matched_expense.external_expense_id,
                        "message": "Existing Splitwise expense found and linked (friend as payer)",
                    }));
                }
            }

            // No match found → create new expense with friend as payer
            self.sync_splits_group(&transaction, provider_id, splits_group.clone())
                .await?;

            // After creating, fetch the expense from Splitwise to get full details
            // and update local metadata
            let new_expense_id = self.get_linked_expense_id(&splits_group);
            if let Some(ref ext_id) = new_expense_id {
                if let Ok(Some(ref created_expense)) =
                    self.fetch_linked_expense(provider_id, ext_id).await
                {
                    self.update_debt_metadata_from_expense(transaction.id, created_expense)
                        .await;
                }
            }

            return Ok(serde_json::json!({
                "status": "created",
                "message": "Debt expense created on split provider (friend as payer)",
            }));
        }

        // --- Normal (non-debt) transaction sync flow below ---

        // Fetch person names for display
        let person_ids: Vec<Uuid> = splits_group.iter().map(|(s, _)| s.person_id).collect();
        let person_names: HashMap<Uuid, String> = {
            use crate::models::person::Person;
            use crate::schema::people;
            let mut conn = self.pool.get().map_err(|e| {
                tracing::error!("Failed to get DB connection: {}", e);
                ApiError::Internal
            })?;
            let persons: Vec<Person> = people::table
                .filter(people::id.eq_any(&person_ids))
                .load(&mut conn)?;
            persons.into_iter().map(|p| (p.id, p.name)).collect()
        };

        // Get the payer's info (current user) from provider credentials
        let payer_info = self.get_payer_info(provider_id)?;

        // Calculate payer's share: total amount - sum of all splits
        let total_split_amount: BigDecimal = splits_group.iter().map(|(s, _)| s.amount.abs()).sum();
        let payer_share = transaction.amount.abs() - &total_split_amount;

        // Build local user shares for comparison/display (including payer)
        let mut local_shares: Vec<serde_json::Value> = Vec::new();

        // Add payer (you) first
        local_shares.push(serde_json::json!({
            "external_user_id": payer_info.0,
            "person_name": payer_info.1,
            "owed_share": payer_share.to_string(),
        }));

        // Add split participants
        for (split, config) in &splits_group {
            let name = person_names
                .get(&split.person_id)
                .cloned()
                .unwrap_or_else(|| format!("User {}", config.external_user_id));
            local_shares.push(serde_json::json!({
                "external_user_id": config.external_user_id,
                "person_name": name,
                "owed_share": split.amount.abs().to_string(),
            }));
        }

        // Step 1: Check if already linked to an external expense
        let existing_expense_id = self.get_linked_expense_id(&splits_group);

        if let Some(ref ext_id) = existing_expense_id {
            // Already linked — fetch that specific expense and compare
            let linked_expense = self.fetch_linked_expense(provider_id, ext_id).await?;

            if let Some(expense) = linked_expense {
                let splits_match = self.compare_splits(&transaction, &splits_group, &expense);

                if splits_match {
                    // Already in sync — ensure sync records reflect this
                    for (split, _config) in &splits_group {
                        self.upsert_sync_record(
                            split.id,
                            provider_id,
                            Some(ext_id.clone()),
                            SyncStatus::Synced,
                            None,
                            0,
                        );
                    }

                    return Ok(serde_json::json!({
                        "status": "synced",
                        "external_expense_id": ext_id,
                        "message": "Transaction is already in sync with split provider",
                    }));
                }

                // Splits differ — return mismatch
                return self.build_mismatch_response(
                    &transaction,
                    &splits_group,
                    provider_id,
                    &expense,
                    &local_shares,
                );
            }
            // Linked expense not found on provider (deleted?) — fall through to search
        }

        // Step 2: Not linked yet — search for matching expenses
        let matches = self.find_split_match(transaction_id).await?;

        if matches.is_empty() {
            // No match found → create new expense
            self.sync_splits_group(&transaction, provider_id, splits_group)
                .await?;

            return Ok(serde_json::json!({
                "status": "created",
                "message": "New expense created on split provider",
            }));
        }

        // Step 3: Check each match for exact split alignment
        for matched_expense in &matches {
            let splits_match = self.compare_splits(&transaction, &splits_group, matched_expense);

            if splits_match {
                // Exact match → link it
                for (split, _config) in &splits_group {
                    self.upsert_sync_record(
                        split.id,
                        provider_id,
                        Some(matched_expense.external_expense_id.clone()),
                        SyncStatus::Synced,
                        None,
                        0,
                    );
                }

                return Ok(serde_json::json!({
                    "status": "linked",
                    "external_expense_id": matched_expense.external_expense_id,
                    "message": "Existing expense found and linked",
                }));
            }
        }

        // Step 4: Amount matches but splits differ → mismatch
        let first_match = &matches[0];
        self.build_mismatch_response(
            &transaction,
            &splits_group,
            provider_id,
            first_match,
            &local_shares,
        )
    }

    /// Sync on transaction update.
    ///
    /// If already linked to an external expense → pushes updated local splits to provider.
    /// If not linked → runs regular sync logic (search, link, or create).
    pub async fn sync_on_update(&self, transaction_id: Uuid) -> ApiResult<serde_json::Value> {
        let (_transaction, splits_with_configs) =
            self.fetch_transaction_and_splits(transaction_id).await?;

        if splits_with_configs.is_empty() {
            return Ok(serde_json::json!({
                "status": "no_splits",
                "message": "Transaction has no splits to sync",
            }));
        }

        let grouped = self.group_splits_by_provider(splits_with_configs.clone());

        let (_provider_id, splits_group) = match grouped.into_iter().next() {
            Some(g) => g,
            None => {
                return Ok(serde_json::json!({
                    "status": "no_provider",
                    "message": "No splits have a configured split provider",
                }));
            }
        };

        // Check if already linked to an external expense
        let existing_expense_id = self.get_linked_expense_id(&splits_group);

        if let Some(ref ext_id) = existing_expense_id {
            // Already linked → push updated local splits to provider
            return self.resolve_mismatch(transaction_id, ext_id, "push").await;
        }

        // Not linked → run regular sync logic
        self.sync_transaction(transaction_id).await
    }

    /// Get the linked external expense ID from existing sync records, if any.
    fn get_linked_expense_id(
        &self,
        splits_group: &[(TransactionSplit, PersonSplitConfig)],
    ) -> Option<String> {
        for (split, _config) in splits_group {
            if let Ok(records) = SplitSyncRecordRepository::find_by_split_id(&self.pool, split.id) {
                for record in records {
                    if record.status() == SyncStatus::Synced
                        || record.status() == SyncStatus::Failed
                    {
                        if let Some(ext_id) = record.external_expense_id {
                            return Some(ext_id);
                        }
                    }
                }
            }
        }
        None
    }

    /// Fetch a specific linked expense from the provider by its external ID.
    pub async fn fetch_linked_expense(
        &self,
        provider_id: Uuid,
        external_expense_id: &str,
    ) -> ApiResult<Option<ExternalExpenseDetail>> {
        let mut conn = self.pool.get().map_err(|e| {
            tracing::error!("Failed to get DB connection: {}", e);
            ApiError::Internal
        })?;
        let provider_model = split_providers::table
            .find(provider_id)
            .first::<SplitProviderModel>(&mut conn)?;

        let provider = self
            .providers
            .get(&provider_model.provider_type)
            .ok_or_else(|| {
                ApiError::BadRequest(format!(
                    "Unknown provider type: {}",
                    provider_model.provider_type
                ))
            })?;

        let encrypted = provider_model
            .credentials
            .get("encrypted")
            .and_then(|v| v.as_str())
            .ok_or_else(|| {
                ApiError::InternalWithMessage("Invalid credentials format".to_string())
            })?;

        let credentials = encryption::decrypt_credentials(encrypted).map_err(|e| {
            ApiError::InternalWithMessage(format!("Failed to decrypt credentials: {}", e))
        })?;

        // Fetch the specific expense by ID
        let expense = provider
            .get_expense_by_id(&credentials, external_expense_id)
            .await
            .map_err(|e| {
                ApiError::External(format!(
                    "Failed to fetch expense {}: {}",
                    external_expense_id, e
                ))
            })?;

        Ok(expense)
    }

    /// Build a mismatch JSON response and record mismatch status on sync records.
    fn build_mismatch_response(
        &self,
        transaction: &Transaction,
        splits_group: &[(TransactionSplit, PersonSplitConfig)],
        provider_id: Uuid,
        expense: &ExternalExpenseDetail,
        local_shares: &[serde_json::Value],
    ) -> ApiResult<serde_json::Value> {
        let external_shares: Vec<serde_json::Value> = expense
            .users
            .iter()
            .map(|u| {
                serde_json::json!({
                    "external_user_id": u.external_user_id,
                    "first_name": u.first_name,
                    "last_name": u.last_name,
                    "paid_share": u.paid_share,
                    "owed_share": u.owed_share,
                })
            })
            .collect();

        // Check if totals differ (numeric comparison to handle "124.00" vs "124.0")
        let local_total_bd = transaction.amount.abs();
        let external_total_bd = expense.cost.parse::<BigDecimal>().unwrap_or_default();
        let totals_differ = local_total_bd != external_total_bd;
        let local_total = local_total_bd.to_string();
        let external_total = expense.cost.clone();

        let error_msg = if totals_differ {
            format!(
                "Total amount mismatch: local {} vs external {}",
                local_total, external_total
            )
        } else {
            "Split mismatch: per-user splits differ".to_string()
        };

        // Record mismatch status on sync records
        for (split, _config) in splits_group {
            self.upsert_sync_record(
                split.id,
                provider_id,
                Some(expense.external_expense_id.clone()),
                SyncStatus::Failed,
                Some(error_msg.clone()),
                0,
            );
        }

        Ok(serde_json::json!({
            "status": "mismatch",
            "external_expense_id": expense.external_expense_id,
            "message": error_msg,
            "local_total": local_total,
            "external_total": external_total,
            "totals_differ": totals_differ,
            "local_splits": local_shares,
            "external_expense": {
                "description": expense.description,
                "cost": expense.cost,
                "currency_code": expense.currency_code,
                "date": expense.date,
                "users": external_shares,
            },
        }))
    }

    /// Resolve a split mismatch by pushing local data or pulling external data.
    ///
    /// # Arguments
    ///
    /// * `transaction_id` - The local transaction ID
    /// * `external_expense_id` - The external expense to resolve against
    /// * `action` - "push" to overwrite provider with local, "pull" to update local from provider
    ///
    /// # Returns
    ///
    /// JSON value with resolution status
    pub async fn resolve_mismatch(
        &self,
        transaction_id: Uuid,
        external_expense_id: &str,
        action: &str,
    ) -> ApiResult<serde_json::Value> {
        let (transaction, splits_with_configs) =
            self.fetch_transaction_and_splits(transaction_id).await?;

        let grouped = self.group_splits_by_provider(splits_with_configs);

        let (provider_id, splits_group) = grouped.into_iter().next().ok_or_else(|| {
            ApiError::BadRequest("No splits have a configured split provider".to_string())
        })?;

        match action {
            "push" => {
                // Update the external expense with local split data
                self.update_splits_group(&transaction, provider_id, splits_group)
                    .await?;

                Ok(serde_json::json!({
                    "status": "pushed",
                    "message": "Local splits pushed to split provider",
                }))
            }
            "pull" => {
                // Fetch the external expense to get its split data
                let mut conn = self.pool.get().map_err(|e| {
                    tracing::error!("Failed to get DB connection: {}", e);
                    ApiError::Internal
                })?;
                let provider_model = split_providers::table
                    .find(provider_id)
                    .first::<SplitProviderModel>(&mut conn)?;

                let provider = self
                    .providers
                    .get(&provider_model.provider_type)
                    .ok_or_else(|| {
                        ApiError::BadRequest(format!(
                            "Unknown provider type: {}",
                            provider_model.provider_type
                        ))
                    })?;

                let encrypted = provider_model
                    .credentials
                    .get("encrypted")
                    .and_then(|v| v.as_str())
                    .ok_or_else(|| {
                        ApiError::InternalWithMessage("Invalid credentials format".to_string())
                    })?;

                let credentials = encryption::decrypt_credentials(encrypted).map_err(|e| {
                    ApiError::InternalWithMessage(format!("Failed to decrypt credentials: {}", e))
                })?;

                // Get the specific external expense by ID
                let external_expense = provider
                    .get_expense_by_id(&credentials, external_expense_id)
                    .await
                    .map_err(|e| {
                        ApiError::External(format!(
                            "Failed to fetch expense {}: {}",
                            external_expense_id, e
                        ))
                    })?;

                // Update local transaction and splits from external data
                if let Some(ext) = &external_expense {
                    // Update the transaction's total amount from external cost
                    if let Ok(ext_cost) = ext.cost.parse::<BigDecimal>() {
                        // Expenses are stored as negative amounts
                        let neg_cost = -ext_cost.abs();
                        diesel::update(transactions::table.find(transaction_id))
                            .set(transactions::amount.eq(&neg_cost))
                            .execute(&mut conn)?;
                    }

                    // Update each local split amount from the external user's owed_share
                    for (split, config) in &splits_group {
                        if let Some(ext_user) = ext
                            .users
                            .iter()
                            .find(|u| u.external_user_id == config.external_user_id)
                        {
                            if let Ok(new_amount) = ext_user.owed_share.parse::<BigDecimal>() {
                                // Splits are stored as positive amounts (what others owe)
                                let abs_amount = new_amount.abs();
                                diesel::update(transaction_splits::table.find(split.id))
                                    .set(transaction_splits::amount.eq(&abs_amount))
                                    .execute(&mut conn)?;
                            }
                        }
                    }
                }

                // Only update debt metadata for DEBT account transactions —
                // this method overwrites the transaction amount with the user's
                // owed share, which is wrong for regular (paid-by-user) transactions.
                if let Some(ref ext) = external_expense {
                    let account = accounts::table
                        .find(transaction.account_id)
                        .first::<Account>(&mut conn)?;

                    if account.account_type == crate::types::AccountType::Debt {
                        self.update_debt_metadata_from_expense(transaction_id, ext)
                            .await;
                    }
                }

                // Link the sync records
                for (split, _config) in &splits_group {
                    self.upsert_sync_record(
                        split.id,
                        provider_id,
                        Some(external_expense_id.to_string()),
                        SyncStatus::Synced,
                        None,
                        0,
                    );
                }

                Ok(serde_json::json!({
                    "status": "pulled",
                    "message": "Local data updated from split provider",
                }))
            }
            _ => Err(ApiError::BadRequest(format!(
                "Invalid action: {}. Must be 'push' or 'pull'",
                action
            ))),
        }
    }

    /// Compare local transaction splits with an external expense's user shares.
    ///
    /// Validates ALL users including the payer (current user):
    /// 1. Each split participant's owed_share matches
    /// 2. The payer's owed_share matches (local payer share vs external payer owed_share)
    ///
    /// Returns `true` only if all users' shares match.
    fn compare_splits(
        &self,
        transaction: &Transaction,
        local_splits: &[(TransactionSplit, PersonSplitConfig)],
        external_expense: &ExternalExpenseDetail,
    ) -> bool {
        // Build a map of external_user_id → owed_share (as BigDecimal) from the external expense
        let external_map: HashMap<String, BigDecimal> = external_expense
            .users
            .iter()
            .filter_map(|u| {
                u.owed_share
                    .parse::<BigDecimal>()
                    .ok()
                    .map(|amount| (u.external_user_id.clone(), amount))
            })
            .collect();

        // Check each local split participant matches numerically
        for (split, config) in local_splits {
            let local_owed = split.amount.abs();
            match external_map.get(&config.external_user_id) {
                Some(external_owed) => {
                    if local_owed != *external_owed {
                        return false;
                    }
                }
                None => return false,
            }
        }

        // Also validate the payer's share:
        // Local payer share = local transaction amount - sum of local splits
        // External payer share = their owed_share (the user with paid_share > 0)
        let local_total = transaction.amount.abs();
        let local_splits_total: BigDecimal = local_splits.iter().map(|(s, _)| s.amount.abs()).sum();
        let local_payer_share = &local_total - &local_splits_total;

        // The payer is the user whose paid_share > 0
        let external_payer_owed: BigDecimal = external_expense
            .users
            .iter()
            .filter(|u| {
                u.paid_share
                    .parse::<BigDecimal>()
                    .map(|p| p > BigDecimal::from(0))
                    .unwrap_or(false)
            })
            .filter_map(|u| u.owed_share.parse::<BigDecimal>().ok())
            .sum();

        if local_payer_share != external_payer_owed {
            return false;
        }

        true
    }

    /// Get the payer's external user ID and display name from provider credentials.
    ///
    /// Returns `(external_user_id, display_name)` tuple.
    fn get_payer_info(&self, provider_id: Uuid) -> ApiResult<(String, String)> {
        let mut conn = self.pool.get().map_err(|e| {
            tracing::error!("Failed to get DB connection: {}", e);
            ApiError::Internal
        })?;
        let provider_model = split_providers::table
            .find(provider_id)
            .first::<SplitProviderModel>(&mut conn)?;

        let encrypted = provider_model
            .credentials
            .get("encrypted")
            .and_then(|v| v.as_str())
            .ok_or_else(|| {
                ApiError::InternalWithMessage("Invalid credentials format".to_string())
            })?;

        let credentials = encryption::decrypt_credentials(encrypted).map_err(|e| {
            ApiError::InternalWithMessage(format!("Failed to decrypt credentials: {}", e))
        })?;

        let external_id =
            extract_external_user_id(&credentials).unwrap_or_else(|| "unknown".to_string());

        // Try to get the user's name from credentials, fall back to "You"
        let name = credentials
            .get("splitwise_user_name")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
            .unwrap_or_else(|| "You".to_string());

        Ok((external_id, name))
    }

    /// Sync an external Splitwise expense into the local system.
    ///
    /// This is the entry point for importing expenses from Splitwise. It handles
    /// both cases:
    /// - **Paid by others**: Creates a DEBT account transaction (the user owes money)
    /// - **Paid by user**: Creates a regular transaction on a non-debt account with
    ///   splits for each participant the user is owed by
    ///
    /// Also handles:
    /// - Idempotency — won't create duplicates if already linked
    /// - Zero-share filtering — skips participants with no owed amount
    ///
    /// # Arguments
    ///
    /// * `user_id` - The authenticated user's ID
    /// * `external_expense` - The Splitwise expense to import
    /// * `provider_id` - The split provider ID
    ///
    /// # Returns
    ///
    /// JSON value with `status` field: "imported", "already_linked", or "not_applicable"
    pub async fn sync_external_expense(
        &self,
        user_id: Uuid,
        external_expense: &ExternalExpenseDetail,
        provider_id: Uuid,
    ) -> ApiResult<serde_json::Value> {
        let payer_info = self.get_payer_info(provider_id)?;
        let current_user_external_id = &payer_info.0;

        // Idempotency check: see if we've already linked this external expense
        let existing_records = SplitSyncRecordRepository::find_by_external_expense_id(
            &self.pool,
            &external_expense.external_expense_id,
        )?;

        if !existing_records.is_empty() {
            return Ok(serde_json::json!({
                "status": "already_linked",
                "external_expense_id": external_expense.external_expense_id,
                "message": "This external expense is already linked to a local transaction",
            }));
        }

        // Check if this expense was paid by someone else
        let payer_external_id =
            self.find_external_payer_id(external_expense, current_user_external_id);

        match payer_external_id {
            Some(payer_ext_id) => {
                // Paid by someone else — create a DEBT transaction
                // Get the payer's name from the expense users list
                let payer_user = external_expense
                    .users
                    .iter()
                    .find(|u| u.external_user_id == payer_ext_id);
                let payer_first_name = payer_user
                    .map(|u| u.first_name.as_str())
                    .unwrap_or("Unknown");
                let payer_last_name = payer_user.map(|u| u.last_name.as_str()).unwrap_or("");

                let payer_person_id = self
                    .find_or_create_person_by_external_id(
                        user_id,
                        &payer_ext_id,
                        payer_first_name,
                        payer_last_name,
                        provider_id,
                    )
                    .await?;

                // Find the current user's owed share from the expense
                let user_owed_share = external_expense
                    .users
                    .iter()
                    .find(|u| u.external_user_id == *current_user_external_id)
                    .and_then(|u| u.owed_share.parse::<BigDecimal>().ok())
                    .unwrap_or_else(|| BigDecimal::from(0));

                if user_owed_share == BigDecimal::from(0) {
                    return Ok(serde_json::json!({
                        "status": "not_applicable",
                        "message": "Current user has no share in this expense",
                    }));
                }

                // Create the debt transaction
                let transaction_id = self
                    .create_debt_from_external_expense(
                        user_id,
                        external_expense,
                        &payer_ext_id,
                        payer_person_id,
                        &user_owed_share,
                        provider_id,
                    )
                    .await?;

                Ok(serde_json::json!({
                    "status": "imported",
                    "transaction_id": transaction_id,
                    "external_expense_id": external_expense.external_expense_id,
                    "message": format!(
                        "Created debt transaction for {} (paid by Splitwise user {})",
                        user_owed_share,
                        payer_ext_id
                    ),
                }))
            }
            None => {
                // Current user paid — create a regular transaction with splits
                let transaction_id = self
                    .create_transaction_from_external_expense(
                        user_id,
                        external_expense,
                        current_user_external_id,
                        provider_id,
                    )
                    .await?;

                Ok(serde_json::json!({
                    "status": "imported",
                    "transaction_id": transaction_id,
                    "external_expense_id": external_expense.external_expense_id,
                    "message": format!(
                        "Created regular transaction for {} (paid by current user)",
                        external_expense.cost
                    ),
                }))
            }
        }
    }

    /// Find the payer in an external expense who is NOT the current user.
    ///
    /// Returns `Some(external_user_id)` if someone else paid (has paid_share > 0),
    /// or `None` if the current user paid.
    fn find_external_payer_id(
        &self,
        expense: &ExternalExpenseDetail,
        current_user_external_id: &str,
    ) -> Option<String> {
        expense
            .users
            .iter()
            .find(|u| {
                u.external_user_id != *current_user_external_id
                    && u.paid_share
                        .parse::<BigDecimal>()
                        .map(|p| p > BigDecimal::from(0))
                        .unwrap_or(false)
            })
            .map(|u| u.external_user_id.clone())
    }

    /// Look up a local person by their external user ID on a given provider.
    ///
    /// Uses the `person_split_configs` table to find the mapping.
    pub async fn find_person_by_external_id(
        &self,
        external_user_id: &str,
        provider_id: Uuid,
    ) -> ApiResult<Option<Uuid>> {
        let config = repositories::person_split_config::find_by_external_user_id(
            &self.pool,
            external_user_id,
            provider_id,
        )
        .await?;

        Ok(config.map(|c| c.person_id))
    }

    /// Look up a local person by their external user ID, or auto-create one if not found.
    ///
    /// When importing expenses from an external provider, participants may not yet have
    /// a local Person record. This method:
    /// 1. Tries `find_person_by_external_id()` first
    /// 2. If not found, creates a new `Person` with the external user's name
    /// 3. Creates a `PersonSplitConfig` linking the new person to the external user
    ///
    /// # Arguments
    ///
    /// * `user_id` - The authenticated user's ID (owner of the person record)
    /// * `external_user_id` - The external platform user ID
    /// * `first_name` - The external user's first name
    /// * `last_name` - The external user's last name
    /// * `provider_id` - The split provider ID
    ///
    /// # Returns
    ///
    /// The person_id (existing or newly created).
    async fn find_or_create_person_by_external_id(
        &self,
        user_id: Uuid,
        external_user_id: &str,
        first_name: &str,
        last_name: &str,
        provider_id: Uuid,
    ) -> ApiResult<Uuid> {
        // Try to find an existing person mapped to this external user
        if let Some(person_id) = self
            .find_person_by_external_id(external_user_id, provider_id)
            .await?
        {
            return Ok(person_id);
        }

        // Not found — auto-create a Person and PersonSplitConfig
        let name = format!("{} {}", first_name, last_name).trim().to_string();
        let name = if name.is_empty() {
            format!("Splitwise User {}", external_user_id)
        } else {
            name
        };

        tracing::info!(
            "Auto-creating person '{}' for external user {} on provider {}",
            name,
            external_user_id,
            provider_id
        );

        let new_person = NewPerson {
            user_id,
            name,
            email: None,
            phone: None,
            notes: Some(format!(
                "Auto-created from Splitwise (external user ID: {})",
                external_user_id
            )),
        };

        let person = repositories::person::create_person(&self.pool, user_id, new_person).await?;

        // Link the new person to the external user via PersonSplitConfig
        let new_config = NewPersonSplitConfig {
            person_id: person.id,
            split_provider_id: provider_id,
            external_user_id: external_user_id.to_string(),
        };

        repositories::person_split_config::upsert_config(&self.pool, new_config).await?;

        tracing::info!(
            "Created person {} with split config for external user {}",
            person.id,
            external_user_id
        );

        Ok(person.id)
    }

    /// Create a DEBT account transaction from an external expense where someone else paid.
    ///
    /// This creates:
    /// 1. A DEBT account for the expense's currency (lazily created)
    /// 2. A transaction on the DEBT account (negative amount = expense)
    /// 3. `debt_transaction_metadata` linking to the payer person
    /// 4. A `transaction_split` for the payer (negative amount = I owe them)
    /// 5. A `split_sync_record` linking the split to the external expense
    ///
    /// # Returns
    ///
    /// The ID of the created transaction.
    async fn create_debt_from_external_expense(
        &self,
        user_id: Uuid,
        expense: &ExternalExpenseDetail,
        payer_external_id: &str,
        payer_person_id: Uuid,
        user_owed_share: &BigDecimal,
        provider_id: Uuid,
    ) -> ApiResult<Uuid> {
        // Parse currency from the expense
        let currency = CurrencyCode::from_code(&expense.currency_code).ok_or_else(|| {
            ApiError::BadRequest(format!(
                "Unsupported currency code: {}",
                expense.currency_code
            ))
        })?;

        // Get or create DEBT account for this currency
        let debt_account =
            repositories::account::get_or_create_debt_account(&self.pool, user_id, currency)
                .await?;

        // Parse the expense date
        let expense_date = chrono::DateTime::parse_from_rfc3339(&expense.date)
            .or_else(|_| {
                // Try parsing as just a date (YYYY-MM-DD)
                chrono::NaiveDate::parse_from_str(&expense.date, "%Y-%m-%d")
                    .map(|d| d.and_hms_opt(0, 0, 0).unwrap().and_utc().fixed_offset())
            })
            .map(|dt| dt.with_timezone(&Utc))
            .unwrap_or_else(|_| Utc::now());

        // Amount is negative (expense paid by someone else)
        let amount = -user_owed_share.abs();

        // Create the transaction on the DEBT account
        let new_transaction = NewTransaction {
            user_id,
            account_id: debt_account.id,
            category_id: None, // User can categorize later
            title: expense.description.clone(),
            amount: amount.clone(),
            date: expense_date,
            notes: Some(format!(
                "Imported from Splitwise (expense #{})",
                expense.external_expense_id
            )),
        };

        let transaction =
            repositories::transaction::create_transaction(&self.pool, user_id, new_transaction)
                .await?;

        tracing::info!(
            "Created debt transaction {} from Splitwise expense {} for user {} (payer: {})",
            transaction.id,
            expense.external_expense_id,
            user_id,
            payer_external_id
        );

        // Build expense_participants JSONB from the external expense users
        let participants_json: Vec<serde_json::Value> = expense
            .users
            .iter()
            .map(|u| {
                serde_json::json!({
                    "name": format!("{} {}", u.first_name, u.last_name).trim(),
                    "external_user_id": u.external_user_id,
                    "paid_share": u.paid_share,
                    "owed_share": u.owed_share,
                })
            })
            .collect();

        // Parse total_cost from the expense
        let total_cost = expense
            .cost
            .parse::<BigDecimal>()
            .unwrap_or_else(|_| user_owed_share.abs());

        // Create debt_transaction_metadata with full expense details
        let new_metadata = NewDebtTransactionMetadata {
            transaction_id: transaction.id,
            payer_person_id,
            total_cost,
            expense_participants: Some(serde_json::Value::Array(participants_json)),
        };
        repositories::debt_transaction_metadata::create_metadata(&self.pool, new_metadata).await?;

        // Create split for debt tracking (negative = I owe them)
        let new_split = NewTransactionSplit {
            transaction_id: transaction.id,
            person_id: payer_person_id,
            amount: amount.clone(),
        };
        let split =
            repositories::transaction::create_split(&self.pool, transaction.id, new_split).await?;

        // Create sync record linking the split to the external expense
        self.upsert_sync_record(
            split.id,
            provider_id,
            Some(expense.external_expense_id.clone()),
            SyncStatus::Synced,
            None,
            0,
        );

        Ok(transaction.id)
    }

    /// Create a regular (non-debt) transaction from an external expense where the
    /// current user paid.
    ///
    /// This creates:
    /// 1. A transaction on the user's first non-debt account matching the expense currency
    /// 2. A `transaction_split` for each participant (excluding the current user)
    /// 3. A `split_sync_record` linking each split to the external expense
    ///
    /// # Returns
    ///
    /// The ID of the created transaction.
    async fn create_transaction_from_external_expense(
        &self,
        user_id: Uuid,
        expense: &ExternalExpenseDetail,
        current_user_external_id: &str,
        provider_id: Uuid,
    ) -> ApiResult<Uuid> {
        // Parse currency from the expense
        let currency = CurrencyCode::from_code(&expense.currency_code).ok_or_else(|| {
            ApiError::BadRequest(format!(
                "Unsupported currency code: {}",
                expense.currency_code
            ))
        })?;

        // Find the user's first non-debt account matching the expense currency
        let accounts =
            repositories::account::list_by_user_excluding_debt(&self.pool, user_id).await?;

        let account = accounts
            .into_iter()
            .find(|a| a.currency == currency)
            .ok_or_else(|| {
                ApiError::BadRequest(format!(
                    "No non-debt account found for currency {:?}. \
                     Please create an account with this currency first.",
                    currency
                ))
            })?;

        // Parse the expense date
        let expense_date = chrono::DateTime::parse_from_rfc3339(&expense.date)
            .or_else(|_| {
                chrono::NaiveDate::parse_from_str(&expense.date, "%Y-%m-%d")
                    .map(|d| d.and_hms_opt(0, 0, 0).unwrap().and_utc().fixed_offset())
            })
            .map(|dt| dt.with_timezone(&Utc))
            .unwrap_or_else(|_| Utc::now());

        // Parse the total cost — expenses are stored as negative amounts
        let total_cost = expense
            .cost
            .parse::<BigDecimal>()
            .map_err(|_| ApiError::BadRequest(format!("Invalid expense cost: {}", expense.cost)))?;
        let amount = -total_cost.abs();

        // Create the transaction on the user's regular account
        let new_transaction = NewTransaction {
            user_id,
            account_id: account.id,
            category_id: None,
            title: expense.description.clone(),
            amount: amount.clone(),
            date: expense_date,
            notes: Some(format!(
                "Imported from Splitwise (expense #{})",
                expense.external_expense_id
            )),
        };

        let transaction =
            repositories::transaction::create_transaction(&self.pool, user_id, new_transaction)
                .await?;

        tracing::info!(
            "Created regular transaction {} from Splitwise expense {} for user {} (paid by user)",
            transaction.id,
            expense.external_expense_id,
            user_id,
        );

        // Create splits for each participant (excluding the current user)
        // and link each split via a sync record
        for user in &expense.users {
            // Skip the current user (the payer) — they don't get a split
            if user.external_user_id == *current_user_external_id {
                continue;
            }

            let owed_share = user
                .owed_share
                .parse::<BigDecimal>()
                .unwrap_or_else(|_| BigDecimal::from(0));

            // Skip participants with zero owed share
            if owed_share == BigDecimal::from(0) {
                continue;
            }

            // Find or auto-create the local person mapped to this external user
            let person_id = self
                .find_or_create_person_by_external_id(
                    user_id,
                    &user.external_user_id,
                    &user.first_name,
                    &user.last_name,
                    provider_id,
                )
                .await?;

            // Split amount is negative (matches the expense sign convention)
            let split_amount = -owed_share.abs();

            let new_split = NewTransactionSplit {
                transaction_id: transaction.id,
                person_id,
                amount: split_amount,
            };

            let split =
                repositories::transaction::create_split(&self.pool, transaction.id, new_split)
                    .await?;

            // Create sync record linking this split to the external expense
            self.upsert_sync_record(
                split.id,
                provider_id,
                Some(expense.external_expense_id.clone()),
                SyncStatus::Synced,
                None,
                0,
            );
        }

        Ok(transaction.id)
    }

    /// Check if an external expense was paid by someone other than the current user.
    ///
    /// Returns `true` if the expense has a user with `paid_share > 0` who is NOT
    /// the current Splitwise user.
    pub fn is_paid_by_others(
        &self,
        expense: &ExternalExpenseDetail,
        provider_id: Uuid,
    ) -> ApiResult<bool> {
        let payer_info = self.get_payer_info(provider_id)?;
        let current_user_external_id = &payer_info.0;

        Ok(self
            .find_external_payer_id(expense, current_user_external_id)
            .is_some())
    }

    /// Search for matching Splitwise expenses for a debt transaction.
    ///
    /// For debt transactions, we search by the friend's external user ID (the payer)
    /// and the transaction date range. We filter by expenses where the cost matches
    /// the user's owed share (the local transaction amount).
    async fn find_debt_split_match(
        &self,
        transaction: &Transaction,
        splits_group: &[(TransactionSplit, PersonSplitConfig)],
        provider_id: Uuid,
    ) -> ApiResult<Vec<ExternalExpenseDetail>> {
        // Fetch provider credentials
        let mut conn = self.pool.get().map_err(|e| {
            tracing::error!("Failed to get DB connection: {}", e);
            ApiError::Internal
        })?;
        let provider_model = split_providers::table
            .find(provider_id)
            .first::<SplitProviderModel>(&mut conn)?;

        let provider = self
            .providers
            .get(&provider_model.provider_type)
            .ok_or_else(|| {
                ApiError::BadRequest(format!(
                    "Unknown provider type: {}",
                    provider_model.provider_type
                ))
            })?;

        let encrypted = provider_model
            .credentials
            .get("encrypted")
            .and_then(|v| v.as_str())
            .ok_or_else(|| {
                ApiError::InternalWithMessage("Invalid credentials format".to_string())
            })?;

        let credentials = encryption::decrypt_credentials(encrypted).map_err(|e| {
            ApiError::InternalWithMessage(format!("Failed to decrypt credentials: {}", e))
        })?;

        // Get the friend's external ID (the payer in the split)
        let friend_id = splits_group
            .first()
            .map(|(_, config)| config.external_user_id.clone());

        // Collect already-linked external expense IDs to filter them out
        let mut linked_expense_ids: std::collections::HashSet<String> =
            std::collections::HashSet::new();
        for (split, _config) in splits_group {
            if let Ok(records) = SplitSyncRecordRepository::find_by_split_id(&self.pool, split.id) {
                for record in records {
                    if let Some(ext_id) = record.external_expense_id {
                        linked_expense_ids.insert(ext_id);
                    }
                }
            }
        }

        // Search for expenses around the transaction date (±3 days)
        let tx_date = transaction.date;
        let dated_after = (tx_date - chrono::Duration::days(3))
            .format("%Y-%m-%dT00:00:00Z")
            .to_string();
        let dated_before = (tx_date + chrono::Duration::days(3))
            .format("%Y-%m-%dT23:59:59Z")
            .to_string();

        let mut all_matches: Vec<ExternalExpenseDetail> = Vec::new();

        match provider
            .get_expenses(
                &credentials,
                friend_id.as_deref(),
                Some(&dated_after),
                Some(&dated_before),
                Some(50),
            )
            .await
        {
            Ok(expenses) => {
                // For debt transactions, we don't filter by total cost matching
                // because the Splitwise expense cost may be larger (e.g., EUR 100 total
                // where the user's share is EUR 40). Instead, we'll compare in
                // compare_debt_splits() which checks the user's owed_share.
                for expense in expenses {
                    if !linked_expense_ids.contains(&expense.external_expense_id) {
                        all_matches.push(expense);
                    }
                }
            }
            Err(e) => {
                tracing::error!(
                    "Failed to search expenses from provider {}: {}",
                    provider_id,
                    e
                );
            }
        }

        Ok(all_matches)
    }

    /// Compare a debt transaction against an external Splitwise expense.
    ///
    /// Compares ALL participants' owed_shares from the local metadata against the
    /// external expense. If any participant's share differs, returns false (mismatch).
    /// Also checks the total cost matches.
    ///
    /// This is different from `compare_splits()` which assumes the current user is the payer.
    fn compare_debt_splits(
        &self,
        _user_owed_amount: &BigDecimal,
        _current_user_external_id: &str,
        _local_splits: &[(TransactionSplit, PersonSplitConfig)],
        external_expense: &ExternalExpenseDetail,
    ) -> bool {
        // Get local expense_participants from debt metadata
        let transaction_id = _local_splits
            .first()
            .map(|(s, _)| s.transaction_id)
            .unwrap_or_default();

        let local_participants = self.get_debt_participants(transaction_id);

        match local_participants {
            Some(participants) => {
                // Build external map: external_user_id → owed_share
                let ext_map: HashMap<String, BigDecimal> = external_expense
                    .users
                    .iter()
                    .filter_map(|u| {
                        u.owed_share
                            .parse::<BigDecimal>()
                            .ok()
                            .map(|v| (u.external_user_id.clone(), v))
                    })
                    .collect();

                // Compare each local participant against external
                for p in &participants {
                    let ext_id = p.external_user_id.as_deref().unwrap_or("");
                    if ext_id.is_empty() {
                        continue; // Skip participants without external ID
                    }

                    let local_owed = p
                        .owed_share
                        .parse::<BigDecimal>()
                        .unwrap_or_else(|_| BigDecimal::from(0));

                    match ext_map.get(ext_id) {
                        Some(ext_owed) => {
                            if local_owed != *ext_owed {
                                return false; // Owed share mismatch
                            }
                        }
                        None => {
                            if local_owed > BigDecimal::from(0) {
                                return false; // Local participant not in external expense
                            }
                        }
                    }
                }

                // Also check total cost matches
                let local_total = self
                    .get_debt_total_cost(transaction_id)
                    .and_then(|s| s.parse::<BigDecimal>().ok());
                let ext_total = external_expense.cost.parse::<BigDecimal>().ok();

                if let (Some(lt), Some(et)) = (local_total, ext_total) {
                    if lt != et {
                        return false; // Total cost mismatch
                    }
                }

                true
            }
            None => {
                // No local participants — can't compare, treat as mismatch
                // (will trigger metadata backfill on next sync)
                false
            }
        }
    }

    /// Get expense_participants from debt metadata for a transaction.
    fn get_debt_participants(
        &self,
        transaction_id: Uuid,
    ) -> Option<Vec<crate::models::debt_transaction_metadata::ExpenseParticipantInput>> {
        let mut conn = self.pool.get().ok()?;
        use crate::schema::debt_transaction_metadata;

        let meta = debt_transaction_metadata::table
            .filter(debt_transaction_metadata::transaction_id.eq(transaction_id))
            .first::<crate::models::debt_transaction_metadata::DebtTransactionMetadata>(&mut conn)
            .ok()?;

        meta.expense_participants.and_then(|json| {
            serde_json::from_value::<
                Vec<crate::models::debt_transaction_metadata::ExpenseParticipantInput>,
            >(json)
            .ok()
        })
    }

    /// Update local debt_transaction_metadata, transaction amount, and split amount
    /// from a Splitwise expense — all within a single database transaction.
    ///
    /// This is called after a successful sync to:
    /// 1. Populate `total_cost` and `expense_participants` from the external expense data
    /// 2. Update the transaction amount to match the user's owed share from Splitwise
    /// 3. Update the split amount to match
    ///
    /// All updates are atomic — either all succeed or none are applied.
    async fn update_debt_metadata_from_expense(
        &self,
        transaction_id: Uuid,
        expense: &ExternalExpenseDetail,
    ) {
        // Build participants JSON from the expense users
        let participants_json: Vec<serde_json::Value> = expense
            .users
            .iter()
            .map(|u| {
                serde_json::json!({
                    "name": format!("{} {}", u.first_name, u.last_name).trim(),
                    "external_user_id": u.external_user_id,
                    "paid_share": u.paid_share,
                    "owed_share": u.owed_share,
                })
            })
            .collect();

        let total_cost = expense
            .cost
            .parse::<BigDecimal>()
            .unwrap_or_else(|_| BigDecimal::from(0));

        // Find payer IDs and the current user's owed share
        let payer_ids: Vec<String> = expense
            .users
            .iter()
            .filter(|u| {
                u.paid_share
                    .parse::<BigDecimal>()
                    .map(|p| p > BigDecimal::from(0))
                    .unwrap_or(false)
            })
            .map(|u| u.external_user_id.clone())
            .collect();

        let user_owed_share: Option<BigDecimal> = expense
            .users
            .iter()
            .filter(|u| !payer_ids.contains(&u.external_user_id))
            .find_map(|u| {
                u.owed_share
                    .parse::<BigDecimal>()
                    .ok()
                    .filter(|v| *v > BigDecimal::from(0))
            });

        let participants_value = serde_json::Value::Array(participants_json);
        let pool = self.pool.clone();

        // Run all updates in a single database transaction
        let result = tokio::task::spawn_blocking(move || {
            use diesel::Connection;

            let mut conn = pool.get().map_err(|e| {
                tracing::error!("Failed to get DB connection: {}", e);
                e.to_string()
            })?;

            conn.transaction::<_, diesel::result::Error, _>(|conn| {
                // 1. Update debt_transaction_metadata
                diesel::update(crate::schema::debt_transaction_metadata::table.filter(
                    crate::schema::debt_transaction_metadata::transaction_id.eq(transaction_id),
                ))
                .set((
                    crate::schema::debt_transaction_metadata::total_cost.eq(&total_cost),
                    crate::schema::debt_transaction_metadata::expense_participants
                        .eq(&participants_value),
                ))
                .execute(conn)?;

                // 2. Update transaction amount if the user's owed share differs
                if let Some(ref owed) = user_owed_share {
                    let current_tx = transactions::table
                        .find(transaction_id)
                        .first::<Transaction>(conn)?;

                    if current_tx.amount.abs() != *owed {
                        let new_amount = -owed.abs();
                        tracing::info!(
                            "Updating debt transaction {} amount from {} to {} based on Splitwise",
                            transaction_id,
                            current_tx.amount,
                            new_amount
                        );

                        diesel::update(transactions::table.find(transaction_id))
                            .set(transactions::amount.eq(&new_amount))
                            .execute(conn)?;

                        // 3. Update split amount
                        diesel::update(
                            transaction_splits::table
                                .filter(transaction_splits::transaction_id.eq(transaction_id)),
                        )
                        .set(transaction_splits::amount.eq(&new_amount))
                        .execute(conn)?;
                    }
                }

                Ok(())
            })
            .map_err(|e| e.to_string())
        })
        .await;

        match result {
            Ok(Ok(())) => {}
            Ok(Err(e)) => {
                tracing::error!(
                    "Failed to update debt metadata/amount for transaction {}: {}",
                    transaction_id,
                    e
                );
            }
            Err(e) => {
                tracing::error!("Task join error updating debt metadata: {}", e);
            }
        }
    }

    /// Build local shares for a debt transaction mismatch response.
    ///
    /// Returns all participants from the `expense_participants` metadata.
    fn build_debt_local_shares(
        &self,
        transaction: &Transaction,
        _current_user_external_id: &str,
        _current_user_name: &str,
    ) -> Vec<serde_json::Value> {
        if let Ok(mut conn) = self.pool.get() {
            use crate::schema::debt_transaction_metadata;

            if let Ok(meta) = debt_transaction_metadata::table
                .filter(debt_transaction_metadata::transaction_id.eq(transaction.id))
                .first::<crate::models::debt_transaction_metadata::DebtTransactionMetadata>(
                    &mut conn,
                )
            {
                if let Some(ref participants_json) = meta.expense_participants {
                    if let Ok(participants) = serde_json::from_value::<
                        Vec<crate::models::debt_transaction_metadata::ExpenseParticipantInput>,
                    >(participants_json.clone())
                    {
                        return participants
                            .iter()
                            .map(|p| {
                                serde_json::json!({
                                    "external_user_id": p.external_user_id.as_deref().unwrap_or(""),
                                    "person_name": p.name,
                                    "owed_share": p.owed_share,
                                    "paid_share": p.paid_share,
                                })
                            })
                            .collect();
                    }
                }
            }
        }

        // No participants available — return empty (shouldn't happen after first sync)
        vec![]
    }

    /// Get the total_cost from debt_transaction_metadata for a transaction.
    /// Returns the formatted total cost string, or None if not available.
    fn get_debt_total_cost(&self, transaction_id: Uuid) -> Option<String> {
        let mut conn = self.pool.get().ok()?;
        use crate::schema::debt_transaction_metadata;

        let meta = debt_transaction_metadata::table
            .filter(debt_transaction_metadata::transaction_id.eq(transaction_id))
            .first::<crate::models::debt_transaction_metadata::DebtTransactionMetadata>(&mut conn)
            .ok()?;

        let cost = meta.total_cost;
        if cost > BigDecimal::from(0) {
            Some(format!("{:.2}", cost))
        } else {
            None
        }
    }
}

/// Extract the external user ID from provider credentials.
/// Supports both Splitwise (`splitwise_user_id`) and SplitPro (`splitpro_user_id`).
fn extract_external_user_id(credentials: &serde_json::Value) -> Option<String> {
    // Try splitwise_user_id first, then splitpro_user_id
    credentials
        .get("splitwise_user_id")
        .or_else(|| credentials.get("splitpro_user_id"))
        .and_then(|v| {
            v.as_i64()
                .map(|id| id.to_string())
                .or_else(|| v.as_str().map(|s| s.to_string()))
        })
}
