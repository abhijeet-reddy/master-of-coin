use diesel::prelude::*;
use uuid::Uuid;

use crate::DbPool;
use crate::errors::{ApiError, ApiResult};
use crate::models::split_sync_record::{
    NewSplitSyncRecord, SplitSyncRecord, UpdateSplitSyncRecord,
};
use crate::schema::split_sync_records;

/// Repository for split sync record database operations
pub struct SplitSyncRecordRepository;

impl SplitSyncRecordRepository {
    /// Find sync record by transaction split ID and provider ID
    pub fn find_by_split_and_provider(
        pool: &DbPool,
        transaction_split_id: Uuid,
        split_provider_id: Uuid,
    ) -> ApiResult<Option<SplitSyncRecord>> {
        let mut conn = pool.get().map_err(|e| {
            tracing::error!("Failed to get DB connection: {}", e);
            ApiError::Internal
        })?;

        let record = split_sync_records::table
            .filter(split_sync_records::transaction_split_id.eq(transaction_split_id))
            .filter(split_sync_records::split_provider_id.eq(split_provider_id))
            .first::<SplitSyncRecord>(&mut conn)
            .optional()?;

        Ok(record)
    }

    /// Find all sync records for a transaction split
    pub fn find_by_split_id(
        pool: &DbPool,
        transaction_split_id: Uuid,
    ) -> ApiResult<Vec<SplitSyncRecord>> {
        let mut conn = pool.get().map_err(|e| {
            tracing::error!("Failed to get DB connection: {}", e);
            ApiError::Internal
        })?;

        let records = split_sync_records::table
            .filter(split_sync_records::transaction_split_id.eq(transaction_split_id))
            .load::<SplitSyncRecord>(&mut conn)?;

        Ok(records)
    }

    /// Find all sync records for a transaction (across all splits)
    pub fn find_by_transaction_id(
        pool: &DbPool,
        transaction_id: Uuid,
    ) -> ApiResult<Vec<SplitSyncRecord>> {
        use crate::schema::transaction_splits;

        let mut conn = pool.get().map_err(|e| {
            tracing::error!("Failed to get DB connection: {}", e);
            ApiError::Internal
        })?;

        let records = split_sync_records::table
            .inner_join(transaction_splits::table)
            .filter(transaction_splits::transaction_id.eq(transaction_id))
            .select(SplitSyncRecord::as_select())
            .load::<SplitSyncRecord>(&mut conn)?;

        Ok(records)
    }

    /// Find sync record by ID
    pub fn find_by_id(pool: &DbPool, id: Uuid) -> ApiResult<Option<SplitSyncRecord>> {
        let mut conn = pool.get().map_err(|e| {
            tracing::error!("Failed to get DB connection: {}", e);
            ApiError::Internal
        })?;

        let record = split_sync_records::table
            .find(id)
            .first::<SplitSyncRecord>(&mut conn)
            .optional()?;

        Ok(record)
    }

    /// Create a new sync record
    pub fn create(pool: &DbPool, new_record: NewSplitSyncRecord) -> ApiResult<SplitSyncRecord> {
        let mut conn = pool.get().map_err(|e| {
            tracing::error!("Failed to get DB connection: {}", e);
            ApiError::Internal
        })?;

        let record = diesel::insert_into(split_sync_records::table)
            .values(&new_record)
            .get_result::<SplitSyncRecord>(&mut conn)?;

        Ok(record)
    }

    /// Update a sync record
    pub fn update(
        pool: &DbPool,
        id: Uuid,
        update: UpdateSplitSyncRecord,
    ) -> ApiResult<SplitSyncRecord> {
        let mut conn = pool.get().map_err(|e| {
            tracing::error!("Failed to get DB connection: {}", e);
            ApiError::Internal
        })?;

        let record = diesel::update(split_sync_records::table.find(id))
            .set((
                update
                    .external_expense_id
                    .map(|v| split_sync_records::external_expense_id.eq(v)),
                update
                    .sync_status
                    .map(|v| split_sync_records::sync_status.eq(v)),
                update
                    .last_sync_at
                    .map(|v| split_sync_records::last_sync_at.eq(v)),
                update
                    .last_error
                    .map(|v| split_sync_records::last_error.eq(v)),
                update
                    .retry_count
                    .map(|v| split_sync_records::retry_count.eq(v)),
                split_sync_records::updated_at.eq(diesel::dsl::now),
            ))
            .get_result::<SplitSyncRecord>(&mut conn)?;

        Ok(record)
    }

    /// Delete a sync record
    pub fn delete(pool: &DbPool, id: Uuid) -> ApiResult<()> {
        let mut conn = pool.get().map_err(|e| {
            tracing::error!("Failed to get DB connection: {}", e);
            ApiError::Internal
        })?;

        diesel::delete(split_sync_records::table.find(id)).execute(&mut conn)?;

        Ok(())
    }

    /// Delete all sync records for a transaction split
    pub fn delete_by_split_id(pool: &DbPool, transaction_split_id: Uuid) -> ApiResult<usize> {
        let mut conn = pool.get().map_err(|e| {
            tracing::error!("Failed to get DB connection: {}", e);
            ApiError::Internal
        })?;

        let count = diesel::delete(
            split_sync_records::table
                .filter(split_sync_records::transaction_split_id.eq(transaction_split_id)),
        )
        .execute(&mut conn)?;

        Ok(count)
    }

    /// Find all failed sync records for retry
    pub fn find_failed_records(
        pool: &DbPool,
        max_retry_count: i32,
    ) -> ApiResult<Vec<SplitSyncRecord>> {
        let mut conn = pool.get().map_err(|e| {
            tracing::error!("Failed to get DB connection: {}", e);
            ApiError::Internal
        })?;

        let records = split_sync_records::table
            .filter(split_sync_records::sync_status.eq("failed"))
            .filter(split_sync_records::retry_count.lt(max_retry_count))
            .load::<SplitSyncRecord>(&mut conn)?;

        Ok(records)
    }
}
