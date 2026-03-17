use diesel::prelude::*;
use uuid::Uuid;

use crate::{
    DbPool,
    errors::ApiError,
    models::bank_sync::{BankSyncRecord, NewBankSyncRecord},
    schema::{bank_sync_records, transactions},
};

/// Get all previously-imported external transaction IDs for a bank provider.
/// Used during sync to detect duplicates.
///
/// Excludes sync records where the linked transaction has been soft-deleted
/// (deleted_at IS NOT NULL), so that soft-deleted transactions can be re-imported.
pub async fn find_imported_ids(
    pool: &DbPool,
    bank_provider_id: Uuid,
) -> Result<Vec<String>, ApiError> {
    let mut conn = pool.get().map_err(|e| {
        tracing::error!("Failed to get DB connection: {}", e);
        ApiError::InternalWithMessage("Failed to get database connection".to_string())
    })?;

    tokio::task::spawn_blocking(move || {
        bank_sync_records::table
            .inner_join(
                transactions::table.on(transactions::id
                    .nullable()
                    .eq(bank_sync_records::transaction_id)),
            )
            .filter(bank_sync_records::bank_provider_id.eq(bank_provider_id))
            .filter(transactions::deleted_at.is_null())
            .select(bank_sync_records::external_transaction_id)
            .load::<String>(&mut conn)
    })
    .await
    .map_err(|e| {
        tracing::error!("Task join error: {}", e);
        ApiError::InternalWithMessage("Task execution error".to_string())
    })?
    .map_err(|e| {
        tracing::error!("Database error loading imported IDs: {}", e);
        ApiError::from(e)
    })
}

/// Batch upsert sync records when transactions are imported.
///
/// Uses ON CONFLICT (bank_provider_id, external_transaction_id) DO UPDATE
/// to handle re-imports of soft-deleted transactions — updates the
/// transaction_id and imported_at instead of failing with a unique violation.
pub async fn create_records(
    pool: &DbPool,
    records: Vec<NewBankSyncRecord>,
) -> Result<Vec<BankSyncRecord>, ApiError> {
    if records.is_empty() {
        return Ok(vec![]);
    }

    let mut conn = pool.get().map_err(|e| {
        tracing::error!("Failed to get DB connection: {}", e);
        ApiError::InternalWithMessage("Failed to get database connection".to_string())
    })?;

    tokio::task::spawn_blocking(move || {
        diesel::insert_into(bank_sync_records::table)
            .values(&records)
            .on_conflict((
                bank_sync_records::bank_provider_id,
                bank_sync_records::external_transaction_id,
            ))
            .do_update()
            .set((
                bank_sync_records::transaction_id
                    .eq(diesel::upsert::excluded(bank_sync_records::transaction_id)),
                bank_sync_records::imported_at.eq(diesel::dsl::now),
            ))
            .get_results::<BankSyncRecord>(&mut conn)
    })
    .await
    .map_err(|e| {
        tracing::error!("Task join error: {}", e);
        ApiError::InternalWithMessage("Task execution error".to_string())
    })?
    .map_err(|e| {
        tracing::error!("Database error creating sync records: {}", e);
        ApiError::from(e)
    })
}

/// List all sync records for a bank provider
pub async fn find_by_provider(
    pool: &DbPool,
    bank_provider_id: Uuid,
) -> Result<Vec<BankSyncRecord>, ApiError> {
    let mut conn = pool.get().map_err(|e| {
        tracing::error!("Failed to get DB connection: {}", e);
        ApiError::InternalWithMessage("Failed to get database connection".to_string())
    })?;

    tokio::task::spawn_blocking(move || {
        bank_sync_records::table
            .filter(bank_sync_records::bank_provider_id.eq(bank_provider_id))
            .order(bank_sync_records::imported_at.desc())
            .load::<BankSyncRecord>(&mut conn)
    })
    .await
    .map_err(|e| {
        tracing::error!("Task join error: {}", e);
        ApiError::InternalWithMessage("Task execution error".to_string())
    })?
    .map_err(|e| {
        tracing::error!("Database error: {}", e);
        ApiError::from(e)
    })
}
