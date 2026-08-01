use bigdecimal::BigDecimal;
use chrono::{DateTime, Utc};
use diesel::prelude::*;
use std::str::FromStr;
use uuid::Uuid;

use crate::{
    DbPool,
    errors::ApiError,
    models::{
        transaction::{NewTransaction, Transaction, TransactionFilter, UpdateTransaction},
        transaction_split::{NewTransactionSplit, TransactionSplit},
    },
    schema::{debt_transaction_metadata, people, transaction_splits, transactions},
};

/// A transaction row joined with optional debt metadata (payer info + expense details).
pub struct TransactionWithDebtInfo {
    pub transaction: Transaction,
    pub payer_person_id: Option<Uuid>,
    pub payer_person_name: Option<String>,
    pub total_cost: Option<bigdecimal::BigDecimal>,
    pub expense_participants: Option<serde_json::Value>,
}

/// Create a new transaction
pub async fn create_transaction(
    pool: &DbPool,
    user_id: Uuid,
    new_transaction: NewTransaction,
) -> Result<Transaction, ApiError> {
    let mut conn = pool.get().map_err(|e| {
        tracing::error!("Failed to get DB connection: {}", e);
        ApiError::Internal
    })?;

    tokio::task::spawn_blocking(move || {
        diesel::insert_into(transactions::table)
            .values(&new_transaction)
            .get_result(&mut conn)
            .map_err(|e| {
                tracing::error!("Failed to create transaction for user {}: {}", user_id, e);
                ApiError::from(e)
            })
    })
    .await
    .map_err(|e| {
        tracing::error!("Task join error: {}", e);
        ApiError::Internal
    })?
}

/// Bulk create multiple transactions in a single INSERT statement.
///
/// Uses Diesel's multi-row insert (`INSERT INTO ... VALUES (...), (...), ...`)
/// which is atomic — all rows succeed or none do.
///
/// # Arguments
///
/// * `pool` - Database connection pool
/// * `new_transactions` - Vector of transactions to insert
///
/// # Returns
///
/// Returns all created `Transaction` rows on success.
///
/// # Errors
///
/// Returns `ApiError` if the insert fails (e.g. constraint violation).
/// The entire batch is rolled back on any failure.
pub async fn bulk_create_transactions(
    pool: &DbPool,
    new_transactions: Vec<NewTransaction>,
) -> Result<Vec<Transaction>, ApiError> {
    if new_transactions.is_empty() {
        return Ok(Vec::new());
    }

    let mut conn = pool.get().map_err(|e| {
        tracing::error!("Failed to get DB connection: {}", e);
        ApiError::Internal
    })?;

    let count = new_transactions.len();

    tokio::task::spawn_blocking(move || {
        diesel::insert_into(transactions::table)
            .values(&new_transactions)
            .get_results(&mut conn)
            .map_err(|e| {
                tracing::error!("Failed to bulk create {} transactions: {}", count, e);
                ApiError::from(e)
            })
    })
    .await
    .map_err(|e| {
        tracing::error!("Task join error: {}", e);
        ApiError::Internal
    })?
}

/// Find transaction by ID with optional debt metadata via LEFT JOIN.
/// Find an ACTIVE (not soft-deleted) transaction by id.
///
/// This is the fail-safe default: it excludes soft-deleted rows, so mutating
/// paths (update, convert-to-transfer, debt-update) and any future by-id caller
/// cannot accidentally operate on a deleted transaction. Callers that
/// legitimately need deleted rows (detail view, delete, restore,
/// permanent-delete, trash) must use [`find_by_id_including_deleted`] explicitly.
pub async fn find_by_id(
    pool: &DbPool,
    transaction_id: Uuid,
) -> Result<TransactionWithDebtInfo, ApiError> {
    find_by_id_inner(pool, transaction_id, false).await
}

/// Find a transaction by id, INCLUDING soft-deleted rows.
///
/// Only for paths that must see deleted transactions: the detail view (renders
/// a "deleted" banner rather than 404ing), delete/restore, permanent-delete,
/// and the trash listing. Prefer [`find_by_id`] everywhere else.
pub async fn find_by_id_including_deleted(
    pool: &DbPool,
    transaction_id: Uuid,
) -> Result<TransactionWithDebtInfo, ApiError> {
    find_by_id_inner(pool, transaction_id, true).await
}

async fn find_by_id_inner(
    pool: &DbPool,
    transaction_id: Uuid,
    include_deleted: bool,
) -> Result<TransactionWithDebtInfo, ApiError> {
    let mut conn = pool.get().map_err(|e| {
        tracing::error!("Failed to get DB connection: {}", e);
        ApiError::Internal
    })?;

    tokio::task::spawn_blocking(move || {
        let mut query = transactions::table
            .left_join(
                debt_transaction_metadata::table
                    .on(debt_transaction_metadata::transaction_id.eq(transactions::id)),
            )
            .left_join(
                people::table.on(people::id
                    .nullable()
                    .eq(debt_transaction_metadata::payer_person_id.nullable())),
            )
            .filter(transactions::id.eq(transaction_id))
            .into_boxed();

        // Fail-safe default: exclude soft-deleted rows unless explicitly requested.
        if !include_deleted {
            query = query.filter(transactions::is_deleted.eq(false));
        }

        let (transaction, payer_person_id, payer_person_name, total_cost, expense_participants): (
            Transaction,
            Option<Uuid>,
            Option<String>,
            Option<bigdecimal::BigDecimal>,
            Option<serde_json::Value>,
        ) = query
            .select((
                transactions::all_columns,
                debt_transaction_metadata::payer_person_id.nullable(),
                people::name.nullable(),
                debt_transaction_metadata::total_cost.nullable(),
                debt_transaction_metadata::expense_participants.nullable(),
            ))
            .first(&mut conn)
            .map_err(|e| {
                tracing::error!("Failed to find transaction by id {}: {}", transaction_id, e);
                ApiError::from(e)
            })?;

        Ok(TransactionWithDebtInfo {
            transaction,
            payer_person_id,
            payer_person_name,
            total_cost,
            expense_participants,
        })
    })
    .await
    .map_err(|e| {
        tracing::error!("Task join error: {}", e);
        ApiError::Internal
    })?
}

/// List transactions for a user with optional filters, including debt metadata via LEFT JOIN.
pub async fn list_transactions(
    pool: &DbPool,
    user_id: Uuid,
    filters: TransactionFilter,
) -> Result<Vec<TransactionWithDebtInfo>, ApiError> {
    let mut conn = pool.get().map_err(|e| {
        tracing::error!("Failed to get DB connection: {}", e);
        ApiError::Internal
    })?;

    tokio::task::spawn_blocking(move || {
        let mut query = transactions::table
            .left_join(
                debt_transaction_metadata::table
                    .on(debt_transaction_metadata::transaction_id.eq(transactions::id)),
            )
            .left_join(
                people::table.on(people::id
                    .nullable()
                    .eq(debt_transaction_metadata::payer_person_id.nullable())),
            )
            .filter(transactions::user_id.eq(user_id))
            .select((
                transactions::all_columns,
                debt_transaction_metadata::payer_person_id.nullable(),
                people::name.nullable(),
                debt_transaction_metadata::total_cost.nullable(),
                debt_transaction_metadata::expense_participants.nullable(),
            ))
            .into_boxed();

        // Apply soft-delete filter: default to showing only active transactions
        if filters.is_deleted == Some(true) {
            query = query.filter(transactions::is_deleted.eq(true));
        } else {
            query = query.filter(transactions::is_deleted.eq(false));
        }

        // Apply filters
        if let Some(account_id) = filters.account_id {
            query = query.filter(transactions::account_id.eq(account_id));
        }

        if let Some(category_id) = filters.category_id {
            query = query.filter(transactions::category_id.eq(category_id));
        }

        if let Some(person_id) = filters.person_id {
            // Subquery: find transaction IDs that have a split for this person
            let split_txn_ids = transaction_splits::table
                .filter(transaction_splits::person_id.eq(person_id))
                .select(transaction_splits::transaction_id);
            query = query.filter(transactions::id.eq_any(split_txn_ids));
        }

        if let Some(start_date) = filters.start_date {
            query = query.filter(transactions::date.ge(start_date));
        }

        if let Some(end_date) = filters.end_date {
            query = query.filter(transactions::date.le(end_date));
        }

        if let Some(min_amount) = filters.min_amount {
            let min_bd = BigDecimal::from_str(&min_amount.to_string()).map_err(|e| {
                tracing::error!("Failed to convert min_amount to BigDecimal: {}", e);
                ApiError::Validation("Invalid min_amount".to_string())
            })?;
            query = query.filter(transactions::amount.ge(min_bd));
        }

        if let Some(max_amount) = filters.max_amount {
            let max_bd = BigDecimal::from_str(&max_amount.to_string()).map_err(|e| {
                tracing::error!("Failed to convert max_amount to BigDecimal: {}", e);
                ApiError::Validation("Invalid max_amount".to_string())
            })?;
            query = query.filter(transactions::amount.le(max_bd));
        }

        if let Some(search) = filters.search {
            let search_pattern = format!("%{}%", search);
            query = query.filter(
                transactions::title
                    .ilike(search_pattern.clone())
                    .or(transactions::notes.ilike(search_pattern)),
            );
        }

        // Apply ordering
        query = query.order(transactions::date.desc());

        // Apply pagination
        let limit = filters.limit.unwrap_or(50).min(100);
        let offset = filters.offset.unwrap_or(0);

        let results: Vec<(
            Transaction,
            Option<Uuid>,
            Option<String>,
            Option<bigdecimal::BigDecimal>,
            Option<serde_json::Value>,
        )> = query
            .limit(limit)
            .offset(offset)
            .load(&mut conn)
            .map_err(|e| {
                tracing::error!("Failed to list transactions for user {}: {}", user_id, e);
                ApiError::from(e)
            })?;

        Ok(results
            .into_iter()
            .map(
                |(
                    transaction,
                    payer_person_id,
                    payer_person_name,
                    total_cost,
                    expense_participants,
                )| {
                    TransactionWithDebtInfo {
                        transaction,
                        payer_person_id,
                        payer_person_name,
                        total_cost,
                        expense_participants,
                    }
                },
            )
            .collect())
    })
    .await
    .map_err(|e| {
        tracing::error!("Task join error: {}", e);
        ApiError::Internal
    })?
}

/// Update transaction
pub async fn update_transaction(
    pool: &DbPool,
    transaction_id: Uuid,
    updates: UpdateTransaction,
) -> Result<Transaction, ApiError> {
    let mut conn = pool.get().map_err(|e| {
        tracing::error!("Failed to get DB connection: {}", e);
        ApiError::Internal
    })?;

    tokio::task::spawn_blocking(move || {
        // Apply updates one at a time
        if let Some(account_id) = updates.account_id {
            diesel::update(transactions::table.find(transaction_id))
                .set(transactions::account_id.eq(account_id))
                .execute(&mut conn)
                .map_err(|e| {
                    tracing::error!(
                        "Failed to update transaction account_id {}: {}",
                        transaction_id,
                        e
                    );
                    ApiError::from(e)
                })?;
        }
        if let Some(category_id) = updates.category_id {
            diesel::update(transactions::table.find(transaction_id))
                .set(transactions::category_id.eq(category_id))
                .execute(&mut conn)
                .map_err(|e| {
                    tracing::error!(
                        "Failed to update transaction category_id {}: {}",
                        transaction_id,
                        e
                    );
                    ApiError::from(e)
                })?;
        }
        if let Some(title) = updates.title {
            diesel::update(transactions::table.find(transaction_id))
                .set(transactions::title.eq(title))
                .execute(&mut conn)
                .map_err(|e| {
                    tracing::error!(
                        "Failed to update transaction title {}: {}",
                        transaction_id,
                        e
                    );
                    ApiError::from(e)
                })?;
        }
        if let Some(amount) = updates.amount {
            diesel::update(transactions::table.find(transaction_id))
                .set(transactions::amount.eq(amount))
                .execute(&mut conn)
                .map_err(|e| {
                    tracing::error!(
                        "Failed to update transaction amount {}: {}",
                        transaction_id,
                        e
                    );
                    ApiError::from(e)
                })?;
        }
        if let Some(date) = updates.date {
            diesel::update(transactions::table.find(transaction_id))
                .set(transactions::date.eq(date))
                .execute(&mut conn)
                .map_err(|e| {
                    tracing::error!(
                        "Failed to update transaction date {}: {}",
                        transaction_id,
                        e
                    );
                    ApiError::from(e)
                })?;
        }
        if let Some(notes) = updates.notes {
            diesel::update(transactions::table.find(transaction_id))
                .set(transactions::notes.eq(notes))
                .execute(&mut conn)
                .map_err(|e| {
                    tracing::error!(
                        "Failed to update transaction notes {}: {}",
                        transaction_id,
                        e
                    );
                    ApiError::from(e)
                })?;
        }

        // Return the updated transaction
        transactions::table
            .find(transaction_id)
            .first(&mut conn)
            .map_err(|e| {
                tracing::error!(
                    "Failed to fetch updated transaction {}: {}",
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

/// Hard-delete a transaction permanently from the database.
///
/// This performs an actual `DELETE FROM transactions WHERE id = transaction_id`.
/// Use `soft_delete_transaction()` for the default soft-delete behaviour.
pub async fn hard_delete_transaction(pool: &DbPool, transaction_id: Uuid) -> Result<(), ApiError> {
    let mut conn = pool.get().map_err(|e| {
        tracing::error!("Failed to get DB connection: {}", e);
        ApiError::Internal
    })?;

    tokio::task::spawn_blocking(move || {
        diesel::delete(transactions::table.find(transaction_id))
            .execute(&mut conn)
            .map_err(|e| {
                tracing::error!("Failed to delete transaction {}: {}", transaction_id, e);
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

/// Create a transaction split
pub async fn create_split(
    pool: &DbPool,
    transaction_id: Uuid,
    split: NewTransactionSplit,
) -> Result<TransactionSplit, ApiError> {
    let mut conn = pool.get().map_err(|e| {
        tracing::error!("Failed to get DB connection: {}", e);
        ApiError::Internal
    })?;

    tokio::task::spawn_blocking(move || {
        diesel::insert_into(transaction_splits::table)
            .values(&split)
            .get_result(&mut conn)
            .map_err(|e| {
                tracing::error!(
                    "Failed to create split for transaction {}: {}",
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

/// Get all splits for a transaction
pub async fn list_splits_for_transaction(
    pool: &DbPool,
    transaction_id: Uuid,
) -> Result<Vec<TransactionSplit>, ApiError> {
    let mut conn = pool.get().map_err(|e| {
        tracing::error!("Failed to get DB connection: {}", e);
        ApiError::Internal
    })?;

    tokio::task::spawn_blocking(move || {
        transaction_splits::table
            .filter(transaction_splits::transaction_id.eq(transaction_id))
            .order(transaction_splits::created_at.asc())
            .load(&mut conn)
            .map_err(|e| {
                tracing::error!(
                    "Failed to get splits for transaction {}: {}",
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

/// Delete all splits for a transaction
pub async fn delete_splits_for_transaction(
    pool: &DbPool,
    transaction_id: Uuid,
) -> Result<(), ApiError> {
    let mut conn = pool.get().map_err(|e| {
        tracing::error!("Failed to get DB connection: {}", e);
        ApiError::Internal
    })?;

    tokio::task::spawn_blocking(move || {
        diesel::delete(
            transaction_splits::table.filter(transaction_splits::transaction_id.eq(transaction_id)),
        )
        .execute(&mut conn)
        .map_err(|e| {
            tracing::error!(
                "Failed to delete splits for transaction {}: {}",
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

/// Update a split's amount by split ID (preserves split ID for sync records)
pub async fn update_split_amount(
    pool: &DbPool,
    split_id: Uuid,
    new_amount: BigDecimal,
) -> Result<TransactionSplit, ApiError> {
    let mut conn = pool.get().map_err(|e| {
        tracing::error!("Failed to get DB connection: {}", e);
        ApiError::Internal
    })?;

    tokio::task::spawn_blocking(move || {
        diesel::update(transaction_splits::table.find(split_id))
            .set(transaction_splits::amount.eq(new_amount))
            .get_result(&mut conn)
            .map_err(|e| {
                tracing::error!(
                    "Failed to update split amount for split {}: {}",
                    split_id,
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

/// Soft-delete a transaction by setting `is_deleted = true` and `deleted_at = now()`.
///
/// Returns the updated `Transaction`.
pub async fn soft_delete_transaction(
    pool: &DbPool,
    transaction_id: Uuid,
) -> Result<Transaction, ApiError> {
    let mut conn = pool.get().map_err(|e| {
        tracing::error!("Failed to get DB connection: {}", e);
        ApiError::Internal
    })?;

    tokio::task::spawn_blocking(move || {
        let now = Utc::now();
        diesel::update(transactions::table.find(transaction_id))
            .set((
                transactions::is_deleted.eq(true),
                transactions::deleted_at.eq(now),
            ))
            .get_result(&mut conn)
            .map_err(|e| {
                tracing::error!(
                    "Failed to soft-delete transaction {}: {}",
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

/// Restore a soft-deleted transaction by setting `is_deleted = false` and `deleted_at = None`.
///
/// Returns the updated `Transaction`.
pub async fn restore_transaction(
    pool: &DbPool,
    transaction_id: Uuid,
) -> Result<Transaction, ApiError> {
    let mut conn = pool.get().map_err(|e| {
        tracing::error!("Failed to get DB connection: {}", e);
        ApiError::Internal
    })?;

    tokio::task::spawn_blocking(move || {
        diesel::update(transactions::table.find(transaction_id))
            .set((
                transactions::is_deleted.eq(false),
                transactions::deleted_at.eq(None::<DateTime<Utc>>),
            ))
            .get_result(&mut conn)
            .map_err(|e| {
                tracing::error!("Failed to restore transaction {}: {}", transaction_id, e);
                ApiError::from(e)
            })
    })
    .await
    .map_err(|e| {
        tracing::error!("Task join error: {}", e);
        ApiError::Internal
    })?
}

/// Find all soft-deleted transactions whose `deleted_at` is older than the given cutoff.
///
/// These are candidates for permanent purging by the background worker.
pub async fn find_expired_soft_deleted(
    pool: &DbPool,
    cutoff: DateTime<Utc>,
) -> Result<Vec<Transaction>, ApiError> {
    let mut conn = pool.get().map_err(|e| {
        tracing::error!("Failed to get DB connection: {}", e);
        ApiError::Internal
    })?;

    tokio::task::spawn_blocking(move || {
        transactions::table
            .filter(transactions::is_deleted.eq(true))
            .filter(transactions::deleted_at.lt(cutoff))
            .load(&mut conn)
            .map_err(|e| {
                tracing::error!("Failed to find expired soft-deleted transactions: {}", e);
                ApiError::from(e)
            })
    })
    .await
    .map_err(|e| {
        tracing::error!("Task join error: {}", e);
        ApiError::Internal
    })?
}

/// Delete a single split by its ID
pub async fn delete_split_by_id(pool: &DbPool, split_id: Uuid) -> Result<(), ApiError> {
    let mut conn = pool.get().map_err(|e| {
        tracing::error!("Failed to get DB connection: {}", e);
        ApiError::Internal
    })?;

    tokio::task::spawn_blocking(move || {
        diesel::delete(transaction_splits::table.find(split_id))
            .execute(&mut conn)
            .map_err(|e| {
                tracing::error!("Failed to delete split {}: {}", split_id, e);
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
