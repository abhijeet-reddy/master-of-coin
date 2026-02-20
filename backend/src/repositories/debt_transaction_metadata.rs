use diesel::prelude::*;
use uuid::Uuid;

use crate::{
    DbPool,
    errors::ApiError,
    models::debt_transaction_metadata::{DebtTransactionMetadata, NewDebtTransactionMetadata},
    schema::debt_transaction_metadata,
};

/// Create debt transaction metadata (links a transaction to the person who paid)
pub async fn create_metadata(
    pool: &DbPool,
    new_metadata: NewDebtTransactionMetadata,
) -> Result<DebtTransactionMetadata, ApiError> {
    let mut conn = pool.get().map_err(|e| {
        tracing::error!("Failed to get DB connection: {}", e);
        ApiError::Internal
    })?;

    tokio::task::spawn_blocking(move || {
        diesel::insert_into(debt_transaction_metadata::table)
            .values(&new_metadata)
            .get_result(&mut conn)
            .map_err(|e| {
                tracing::error!("Failed to create debt transaction metadata: {}", e);
                ApiError::from(e)
            })
    })
    .await
    .map_err(|e| {
        tracing::error!("Task join error: {}", e);
        ApiError::Internal
    })?
}

/// Find debt transaction metadata by transaction ID
pub async fn find_by_transaction_id(
    pool: &DbPool,
    transaction_id: Uuid,
) -> Result<Option<DebtTransactionMetadata>, ApiError> {
    let mut conn = pool.get().map_err(|e| {
        tracing::error!("Failed to get DB connection: {}", e);
        ApiError::Internal
    })?;

    tokio::task::spawn_blocking(move || {
        debt_transaction_metadata::table
            .filter(debt_transaction_metadata::transaction_id.eq(transaction_id))
            .first(&mut conn)
            .optional()
            .map_err(|e| {
                tracing::error!(
                    "Failed to find debt metadata for transaction {}: {}",
                    transaction_id,
                    e
                );
                ApiError::from(e)
            })
    })
    .await
    .map_err(|e| {
        tracing::error!("Task join error: {}", e);
        ApiError::Internal
    })?
}

/// Delete debt transaction metadata by transaction ID
pub async fn delete_by_transaction_id(pool: &DbPool, transaction_id: Uuid) -> Result<(), ApiError> {
    let mut conn = pool.get().map_err(|e| {
        tracing::error!("Failed to get DB connection: {}", e);
        ApiError::Internal
    })?;

    tokio::task::spawn_blocking(move || {
        diesel::delete(
            debt_transaction_metadata::table
                .filter(debt_transaction_metadata::transaction_id.eq(transaction_id)),
        )
        .execute(&mut conn)
        .map_err(|e| {
            tracing::error!(
                "Failed to delete debt metadata for transaction {}: {}",
                transaction_id,
                e
            );
            ApiError::from(e)
        })
        .map(|_| ())
    })
    .await
    .map_err(|e| {
        tracing::error!("Task join error: {}", e);
        ApiError::Internal
    })?
}

/// Update the expense details (total_cost and expense_participants) on existing debt metadata.
pub async fn update_expense_details(
    pool: &DbPool,
    transaction_id: Uuid,
    total_cost: bigdecimal::BigDecimal,
    expense_participants: Option<serde_json::Value>,
) -> Result<(), ApiError> {
    let mut conn = pool.get().map_err(|e| {
        tracing::error!("Failed to get DB connection: {}", e);
        ApiError::Internal
    })?;

    tokio::task::spawn_blocking(move || {
        diesel::update(
            debt_transaction_metadata::table
                .filter(debt_transaction_metadata::transaction_id.eq(transaction_id)),
        )
        .set((
            debt_transaction_metadata::total_cost.eq(&total_cost),
            debt_transaction_metadata::expense_participants.eq(&expense_participants),
        ))
        .execute(&mut conn)
        .map_err(|e| {
            tracing::error!(
                "Failed to update expense details for transaction {}: {}",
                transaction_id,
                e
            );
            ApiError::from(e)
        })
        .map(|_| ())
    })
    .await
    .map_err(|e| {
        tracing::error!("Task join error: {}", e);
        ApiError::Internal
    })?
}
