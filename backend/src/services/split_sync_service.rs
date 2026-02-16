use std::collections::HashMap;
use std::sync::Arc;

use bigdecimal::BigDecimal;
use chrono::Utc;
use diesel::prelude::*;
use uuid::Uuid;

use crate::DbPool;
use crate::errors::{ApiError, ApiResult};
use crate::models::account::Account;
use crate::models::person_split_config::PersonSplitConfig;
use crate::models::split_provider::SplitProvider as SplitProviderModel;
use crate::models::split_sync_record::{
    NewSplitSyncRecord, SplitSyncRecord, SyncStatus, UpdateSplitSyncRecord,
};
use crate::models::transaction::Transaction;
use crate::models::transaction_split::TransactionSplit;
use crate::repositories::split_sync_record::SplitSyncRecordRepository;
use crate::schema::{
    accounts, person_split_configs, split_providers, transaction_splits, transactions,
};
use crate::services::split_provider::{
    CreateExternalExpense, ExpenseUser, ExternalExpenseDetail, SplitProvider, SplitwiseProvider,
    UpdateExternalExpense,
};
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
        let mut providers: HashMap<String, Arc<dyn SplitProvider>> = HashMap::new();

        // Register Splitwise provider
        let splitwise = Arc::new(SplitwiseProvider::new());
        providers.insert("splitwise".to_string(), splitwise);

        // Future providers can be added here
        // let splitpro = Arc::new(SplitProProvider::new());
        // providers.insert("splitpro".to_string(), splitpro);

        Self {
            pool,
            providers: Arc::new(providers),
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
        let payer_external_id = credentials
            .get("splitwise_user_id")
            .and_then(|v| {
                v.as_i64()
                    .map(|id| id.to_string())
                    .or_else(|| v.as_str().map(|s| s.to_string()))
            })
            .ok_or_else(|| {
                ApiError::InternalWithMessage(
                    "Missing splitwise_user_id in provider credentials".to_string(),
                )
            })?;

        // Fetch account to get currency code
        let account = accounts::table
            .find(transaction.account_id)
            .first::<Account>(&mut conn)?;

        // Build expense users
        let users = self.build_expense_users(transaction, &splits, &payer_external_id)?;

        // Create expense request (use absolute value since expenses are stored as negative)
        let request = CreateExternalExpense {
            description: transaction.title.clone(),
            cost: transaction.amount.abs().to_string(),
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
        let payer_external_id = credentials
            .get("splitwise_user_id")
            .and_then(|v| {
                v.as_i64()
                    .map(|id| id.to_string())
                    .or_else(|| v.as_str().map(|s| s.to_string()))
            })
            .ok_or_else(|| {
                ApiError::InternalWithMessage(
                    "Missing splitwise_user_id in provider credentials".to_string(),
                )
            })?;

        // Build expense users
        let users = self.build_expense_users(transaction, &splits, &payer_external_id)?;

        // Create update request
        let request = UpdateExternalExpense {
            description: Some(transaction.title.clone()),
            cost: Some(transaction.amount.abs().to_string()),
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
        let (transaction, splits_with_configs) =
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
    async fn fetch_linked_expense(
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
                    "message": "Local splits updated from split provider data",
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

        let external_id = credentials
            .get("splitwise_user_id")
            .and_then(|v| {
                v.as_i64()
                    .map(|id| id.to_string())
                    .or_else(|| v.as_str().map(|s| s.to_string()))
            })
            .unwrap_or_else(|| "unknown".to_string());

        // Try to get the user's name from credentials, fall back to "You"
        let name = credentials
            .get("splitwise_user_name")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
            .unwrap_or_else(|| "You".to_string());

        Ok((external_id, name))
    }
}
