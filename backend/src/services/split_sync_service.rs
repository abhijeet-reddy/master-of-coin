use std::collections::HashMap;
use std::sync::Arc;

use bigdecimal::BigDecimal;
use chrono::Utc;
use diesel::prelude::*;
use uuid::Uuid;

use crate::DbPool;
use crate::errors::{ApiError, ApiResult};
use crate::models::person_split_config::PersonSplitConfig;
use crate::models::split_provider::SplitProvider as SplitProviderModel;
use crate::models::split_sync_record::{
    NewSplitSyncRecord, SplitSyncRecord, SyncStatus, UpdateSplitSyncRecord,
};
use crate::models::transaction::Transaction;
use crate::models::transaction_split::TransactionSplit;
use crate::repositories::split_sync_record::SplitSyncRecordRepository;
use crate::schema::{person_split_configs, split_providers, transaction_splits, transactions};
use crate::services::split_provider::{
    CreateExternalExpense, ExpenseUser, SplitProvider, SplitwiseProvider, UpdateExternalExpense,
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

    /// Sync all splits for a transaction when they are created
    ///
    /// This groups splits by provider and creates one expense per provider
    /// containing all users involved in that provider.
    pub async fn on_transaction_splits_created(
        &self,
        transaction_id: Uuid,
        split_ids: Vec<Uuid>,
    ) -> ApiResult<()> {
        if split_ids.is_empty() {
            return Ok(());
        }

        // Fetch transaction and all splits with their person configs
        let (transaction, splits_with_configs) =
            self.fetch_transaction_and_splits(transaction_id).await?;

        // Filter to only the newly created splits
        let new_splits: Vec<_> = splits_with_configs
            .into_iter()
            .filter(|(split, _)| split_ids.contains(&split.id))
            .collect();

        if new_splits.is_empty() {
            return Ok(());
        }

        // Group splits by provider
        let grouped = self.group_splits_by_provider(new_splits);

        // Sync each provider group
        for (provider_id, splits_group) in grouped {
            if let Err(e) = self
                .sync_splits_group(&transaction, provider_id, splits_group)
                .await
            {
                tracing::error!(
                    "Failed to sync splits for transaction {} to provider {}: {}",
                    transaction_id,
                    provider_id,
                    e
                );
                // Continue with other providers even if one fails
            }
        }

        Ok(())
    }

    /// Sync when a split is updated
    ///
    /// This updates the entire expense with all current splits
    pub async fn on_split_updated(&self, split_id: Uuid) -> ApiResult<()> {
        // Find the transaction for this split
        let mut conn = self.pool.get().map_err(|e| {
            tracing::error!("Failed to get DB connection: {}", e);
            ApiError::Internal
        })?;
        let split = transaction_splits::table
            .find(split_id)
            .first::<TransactionSplit>(&mut conn)
            .optional()?;

        let split = match split {
            Some(s) => s,
            None => return Ok(()), // Split doesn't exist, nothing to do
        };

        // Fetch all splits for this transaction and update
        let (transaction, splits_with_configs) = self
            .fetch_transaction_and_splits(split.transaction_id)
            .await?;

        // Group by provider
        let grouped = self.group_splits_by_provider(splits_with_configs);

        // Update each provider group
        for (provider_id, splits_group) in grouped {
            if let Err(e) = self
                .update_splits_group(&transaction, provider_id, splits_group)
                .await
            {
                tracing::error!(
                    "Failed to update splits for transaction {} to provider {}: {}",
                    transaction.id,
                    provider_id,
                    e
                );
            }
        }

        Ok(())
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

        if record.retry_count >= MAX_RETRY_COUNT {
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

        let (transaction, splits_with_configs) = self
            .fetch_transaction_and_splits(split.transaction_id)
            .await?;

        // Group by provider and retry
        let grouped = self.group_splits_by_provider(splits_with_configs);

        if let Some(splits_group) = grouped.get(&record.split_provider_id) {
            self.sync_splits_group(&transaction, record.split_provider_id, splits_group.clone())
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

        // Build expense users
        let users = self.build_expense_users(transaction, &splits)?;

        // Create expense request
        let request = CreateExternalExpense {
            description: transaction.title.clone(),
            cost: transaction.amount.to_string(),
            currency_code: "USD".to_string(), // TODO: Get from account
            date: transaction.date,
            group_id: None, // TODO: Support groups
            users,
            notes: transaction.notes.clone(),
        };

        // Call provider to create expense
        match provider.create_expense(&credentials, request).await {
            Ok(result) => {
                // Create sync records for all splits in this group
                for (split, _) in splits {
                    let new_record = NewSplitSyncRecord {
                        transaction_split_id: split.id,
                        split_provider_id: provider_id,
                        external_expense_id: Some(result.external_expense_id.clone()),
                        sync_status: SyncStatus::Synced.as_str().to_string(),
                        last_sync_at: Some(Utc::now()),
                        last_error: None,
                        retry_count: 0,
                    };

                    if let Err(e) = SplitSyncRecordRepository::create(&self.pool, new_record) {
                        tracing::error!(
                            "Failed to create sync record for split {}: {}",
                            split.id,
                            e
                        );
                    }
                }

                Ok(())
            }
            Err(e) => {
                // Create failed sync records
                for (split, _) in splits {
                    let new_record = NewSplitSyncRecord {
                        transaction_split_id: split.id,
                        split_provider_id: provider_id,
                        external_expense_id: None,
                        sync_status: SyncStatus::Failed.as_str().to_string(),
                        last_sync_at: Some(Utc::now()),
                        last_error: Some(e.to_string()),
                        retry_count: 0,
                    };

                    if let Err(e) = SplitSyncRecordRepository::create(&self.pool, new_record) {
                        tracing::error!(
                            "Failed to create failed sync record for split {}: {}",
                            split.id,
                            e
                        );
                    }
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

        // Build expense users
        let users = self.build_expense_users(transaction, &splits)?;

        // Create update request
        let request = UpdateExternalExpense {
            description: Some(transaction.title.clone()),
            cost: Some(transaction.amount.to_string()),
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

    /// Build expense users from transaction and splits
    ///
    /// The payer is the transaction owner (user who paid the full amount)
    /// Each split represents an amount owed by that person
    fn build_expense_users(
        &self,
        transaction: &Transaction,
        splits: &[(TransactionSplit, PersonSplitConfig)],
    ) -> ApiResult<Vec<ExpenseUser>> {
        let mut users = Vec::new();

        // Calculate total split amount (reserved for future use in validation)
        let _total_split: BigDecimal = splits.iter().map(|(s, _)| &s.amount).sum();

        // Payer paid the full transaction amount and owes nothing
        // We need to get the payer's external user ID from their person config
        // For now, we'll assume the first split's config provider has the payer
        // This is a simplification - in reality, we'd need to track the payer separately
        let payer_external_id = splits
            .first()
            .map(|(_, config)| config.external_user_id.clone())
            .ok_or_else(|| ApiError::BadRequest("No splits provided".to_string()))?;

        users.push(ExpenseUser {
            external_user_id: payer_external_id,
            paid_share: transaction.amount.to_string(),
            owed_share: "0.00".to_string(),
        });

        // Each split person owes their split amount and paid nothing
        for (split, config) in splits {
            users.push(ExpenseUser {
                external_user_id: config.external_user_id.clone(),
                paid_share: "0.00".to_string(),
                owed_share: split.amount.to_string(),
            });
        }

        Ok(users)
    }
}
