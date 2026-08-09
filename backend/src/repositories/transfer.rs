use bigdecimal::BigDecimal;
use chrono::{DateTime, Utc};
use diesel::prelude::*;
use std::collections::HashMap;
use uuid::Uuid;

use crate::{
    DbPool,
    errors::ApiError,
    models::{
        transaction::{NewTransaction, Transaction},
        transfer::{NewTransfer, Transfer, TransferInfo},
    },
    schema::{accounts, transaction_splits, transactions, transfers},
};

/// Atomically create two transactions and a transfer linking them.
///
/// Uses a single DB connection with `conn.transaction()` so that if any
/// INSERT fails the entire operation is rolled back.
pub async fn create_transfer_atomic(
    pool: &DbPool,
    from_txn: NewTransaction,
    to_txn: NewTransaction,
    exchange_rate: BigDecimal,
) -> Result<(Transfer, Transaction, Transaction), ApiError> {
    let mut conn = pool.get().map_err(|e| {
        tracing::error!("Failed to get DB connection: {}", e);
        ApiError::Internal
    })?;

    tokio::task::spawn_blocking(move || {
        conn.transaction(|conn| {
            // 1. Insert the from-side transaction
            let from_transaction: Transaction = diesel::insert_into(transactions::table)
                .values(&from_txn)
                .get_result(conn)?;

            // 2. Insert the to-side transaction
            let to_transaction: Transaction = diesel::insert_into(transactions::table)
                .values(&to_txn)
                .get_result(conn)?;

            // 3. Insert the transfer row linking both transactions
            let new_transfer = NewTransfer {
                from_transaction_id: from_transaction.id,
                to_transaction_id: to_transaction.id,
                exchange_rate,
            };

            let transfer: Transfer = diesel::insert_into(transfers::table)
                .values(&new_transfer)
                .get_result(conn)?;

            Ok((transfer, from_transaction, to_transaction))
        })
        .map_err(|e: diesel::result::Error| {
            tracing::error!("Failed to create transfer atomically: {}", e);
            ApiError::from(e)
        })
    })
    .await
    .map_err(|e| {
        tracing::error!("Task join error: {}", e);
        ApiError::Internal
    })?
}

/// Atomically join an existing transaction into a transfer.
///
/// The original transaction (`original_transaction_id`) is left untouched. Only
/// the opposite leg (`new_leg`) and the linking `transfers` row are inserted,
/// both inside one `conn.transaction()` so a partial failure rolls back
/// entirely — there is no half-converted state. The caller resolves direction
/// and passes the correct `from`/`to` assignment via `original_is_source`.
pub async fn join_transaction_into_transfer_atomic(
    pool: &DbPool,
    original_transaction_id: Uuid,
    original_is_source: bool,
    new_leg: NewTransaction,
    exchange_rate: BigDecimal,
) -> Result<(Transfer, Transaction), ApiError> {
    let mut conn = pool.get().map_err(|e| {
        tracing::error!("Failed to get DB connection: {}", e);
        ApiError::Internal
    })?;

    tokio::task::spawn_blocking(move || {
        conn.transaction(|conn| {
            // 1. Insert the new opposite leg.
            let new_transaction: Transaction = diesel::insert_into(transactions::table)
                .values(&new_leg)
                .get_result(conn)?;

            // 2. Assign from/to slots. The from (source) leg is the negative
            //    side, the to (destination) leg the positive side.
            let (from_transaction_id, to_transaction_id) = if original_is_source {
                (original_transaction_id, new_transaction.id)
            } else {
                (new_transaction.id, original_transaction_id)
            };

            // 3. Insert the transfer row linking both transactions.
            let new_transfer = NewTransfer {
                from_transaction_id,
                to_transaction_id,
                exchange_rate,
            };

            let transfer: Transfer = diesel::insert_into(transfers::table)
                .values(&new_transfer)
                .get_result(conn)?;

            Ok((transfer, new_transaction))
        })
        .map_err(|e: diesel::result::Error| {
            tracing::error!("Failed to convert transaction to transfer atomically: {}", e);
            ApiError::from(e)
        })
    })
    .await
    .map_err(|e| {
        tracing::error!("Task join error: {}", e);
        ApiError::Internal
    })?
}

/// Find a transfer by either of its linked transaction IDs.
///
/// Returns `None` if the transaction is not part of a transfer.
pub async fn find_transfer_by_transaction_id(
    pool: &DbPool,
    transaction_id: Uuid,
) -> Result<Option<Transfer>, ApiError> {
    let mut conn = pool.get().map_err(|e| {
        tracing::error!("Failed to get DB connection: {}", e);
        ApiError::Internal
    })?;

    tokio::task::spawn_blocking(move || {
        transfers::table
            .filter(
                transfers::from_transaction_id
                    .eq(transaction_id)
                    .or(transfers::to_transaction_id.eq(transaction_id)),
            )
            .first(&mut conn)
            .optional()
            .map_err(|e| {
                tracing::error!(
                    "Failed to find transfer by transaction id {}: {}",
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

/// Find a transfer by its primary key.
pub async fn find_transfer_by_id(pool: &DbPool, transfer_id: Uuid) -> Result<Transfer, ApiError> {
    let mut conn = pool.get().map_err(|e| {
        tracing::error!("Failed to get DB connection: {}", e);
        ApiError::Internal
    })?;

    tokio::task::spawn_blocking(move || {
        transfers::table
            .find(transfer_id)
            .first(&mut conn)
            .map_err(|e| {
                tracing::error!("Failed to find transfer by id {}: {}", transfer_id, e);
                ApiError::from(e)
            })
    })
    .await
    .map_err(|e| {
        tracing::error!("Task join error: {}", e);
        ApiError::Internal
    })?
}

/// Batch-fetch transfer metadata for a list of transaction IDs.
///
/// For each transaction ID that appears in the `transfers` table (as either
/// `from_transaction_id` or `to_transaction_id`), determines the "linked"
/// transaction, looks up that transaction's account, and returns the linked
/// account's name.
///
/// Returns a `HashMap` keyed by transaction_id → `TransferInfo`.
pub async fn find_transfer_info_for_transactions(
    pool: &DbPool,
    transaction_ids: &[Uuid],
) -> Result<HashMap<Uuid, TransferInfo>, ApiError> {
    if transaction_ids.is_empty() {
        return Ok(HashMap::new());
    }

    let ids = transaction_ids.to_vec();
    let mut conn = pool.get().map_err(|e| {
        tracing::error!("Failed to get DB connection: {}", e);
        ApiError::Internal
    })?;

    tokio::task::spawn_blocking(move || {
        let mut result: HashMap<Uuid, TransferInfo> = HashMap::new();

        // Query 1: Find transfers where our transaction IDs appear as from_transaction_id.
        // The "linked" side is to_transaction_id → look up that transaction's account.
        let from_side_matches: Vec<(Uuid, Uuid, Uuid, String, BigDecimal)> = transfers::table
            .inner_join(transactions::table.on(transactions::id.eq(transfers::to_transaction_id)))
            .inner_join(accounts::table.on(accounts::id.eq(transactions::account_id)))
            .filter(transfers::from_transaction_id.eq_any(&ids))
            .select((
                transfers::id,
                transfers::from_transaction_id,
                transactions::account_id,
                accounts::name,
                transactions::amount, // the linked (counterpart) leg's amount
            ))
            .load(&mut conn)
            .map_err(|e| {
                tracing::error!("Failed to query from-side transfer info: {}", e);
                ApiError::from(e)
            })?;

        for (transfer_id, txn_id, linked_account_id, linked_account_name, linked_amount) in
            from_side_matches
        {
            result.insert(
                txn_id,
                TransferInfo {
                    transfer_id,
                    linked_account_id,
                    linked_account_name,
                    linked_amount: linked_amount.to_string(),
                },
            );
        }

        // Query 2: Find transfers where our transaction IDs appear as to_transaction_id.
        // The "linked" side is from_transaction_id → look up that transaction's account.
        let to_side_matches: Vec<(Uuid, Uuid, Uuid, String, BigDecimal)> = transfers::table
            .inner_join(transactions::table.on(transactions::id.eq(transfers::from_transaction_id)))
            .inner_join(accounts::table.on(accounts::id.eq(transactions::account_id)))
            .filter(transfers::to_transaction_id.eq_any(&ids))
            .select((
                transfers::id,
                transfers::to_transaction_id,
                transactions::account_id,
                accounts::name,
                transactions::amount, // the linked (counterpart) leg's amount
            ))
            .load(&mut conn)
            .map_err(|e| {
                tracing::error!("Failed to query to-side transfer info: {}", e);
                ApiError::from(e)
            })?;

        for (transfer_id, txn_id, linked_account_id, linked_account_name, linked_amount) in
            to_side_matches
        {
            result.insert(
                txn_id,
                TransferInfo {
                    transfer_id,
                    linked_account_id,
                    linked_account_name,
                    linked_amount: linked_amount.to_string(),
                },
            );
        }

        Ok(result)
    })
    .await
    .map_err(|e| {
        tracing::error!("Task join error: {}", e);
        ApiError::Internal
    })?
}

/// Delete both transactions that form a transfer.
///
/// Deletes any transaction splits first, then deletes both transactions.
/// The `transfers` row is automatically removed via ON DELETE CASCADE on
/// the foreign keys.
pub async fn delete_transfer_and_transactions(
    pool: &DbPool,
    transfer: &Transfer,
) -> Result<(), ApiError> {
    let from_id = transfer.from_transaction_id;
    let to_id = transfer.to_transaction_id;

    let mut conn = pool.get().map_err(|e| {
        tracing::error!("Failed to get DB connection: {}", e);
        ApiError::Internal
    })?;

    tokio::task::spawn_blocking(move || {
        conn.transaction(|conn| {
            // 1. Delete any transaction splits for both transactions
            diesel::delete(
                transaction_splits::table
                    .filter(transaction_splits::transaction_id.eq_any(&[from_id, to_id])),
            )
            .execute(conn)?;

            // 2. Delete both transactions (transfer row cascades automatically)
            diesel::delete(transactions::table.filter(transactions::id.eq_any(&[from_id, to_id])))
                .execute(conn)?;

            Ok(())
        })
        .map_err(|e: diesel::result::Error| {
            tracing::error!(
                "Failed to delete transfer and transactions (from={}, to={}): {}",
                from_id,
                to_id,
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

/// Soft-delete both transactions that form a transfer.
///
/// Sets `is_deleted = true` and `deleted_at = now()` on both
/// `transfer.from_transaction_id` and `transfer.to_transaction_id`.
pub async fn soft_delete_transfer_transactions(
    pool: &DbPool,
    transfer: &Transfer,
) -> Result<(), ApiError> {
    let from_id = transfer.from_transaction_id;
    let to_id = transfer.to_transaction_id;

    let mut conn = pool.get().map_err(|e| {
        tracing::error!("Failed to get DB connection: {}", e);
        ApiError::Internal
    })?;

    tokio::task::spawn_blocking(move || {
        let now = Utc::now();
        diesel::update(transactions::table.filter(transactions::id.eq_any(&[from_id, to_id])))
            .set((
                transactions::is_deleted.eq(true),
                transactions::deleted_at.eq(now),
            ))
            .execute(&mut conn)
            .map_err(|e| {
                tracing::error!(
                    "Failed to soft-delete transfer transactions (from={}, to={}): {}",
                    from_id,
                    to_id,
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

/// Restore both transactions that form a transfer.
///
/// Sets `is_deleted = false` and `deleted_at = None` on both
/// `transfer.from_transaction_id` and `transfer.to_transaction_id`.
pub async fn restore_transfer_transactions(
    pool: &DbPool,
    transfer: &Transfer,
) -> Result<(), ApiError> {
    let from_id = transfer.from_transaction_id;
    let to_id = transfer.to_transaction_id;

    let mut conn = pool.get().map_err(|e| {
        tracing::error!("Failed to get DB connection: {}", e);
        ApiError::Internal
    })?;

    tokio::task::spawn_blocking(move || {
        diesel::update(transactions::table.filter(transactions::id.eq_any(&[from_id, to_id])))
            .set((
                transactions::is_deleted.eq(false),
                transactions::deleted_at.eq(None::<DateTime<Utc>>),
            ))
            .execute(&mut conn)
            .map_err(|e| {
                tracing::error!(
                    "Failed to restore transfer transactions (from={}, to={}): {}",
                    from_id,
                    to_id,
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
