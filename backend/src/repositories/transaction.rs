use bigdecimal::BigDecimal;
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
    schema::{transaction_splits, transactions},
};

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

/// Find transaction by ID
pub async fn find_by_id(pool: &DbPool, transaction_id: Uuid) -> Result<Transaction, ApiError> {
    let mut conn = pool.get().map_err(|e| {
        tracing::error!("Failed to get DB connection: {}", e);
        ApiError::Internal
    })?;

    tokio::task::spawn_blocking(move || {
        transactions::table
            .find(transaction_id)
            .first(&mut conn)
            .map_err(|e| {
                tracing::error!("Failed to find transaction by id {}: {}", transaction_id, e);
                ApiError::from(e)
            })
    })
    .await
    .map_err(|e| {
        tracing::error!("Task join error: {}", e);
        ApiError::Internal
    })?
}

/// List transactions for a user with optional filters
pub async fn list_transactions(
    pool: &DbPool,
    user_id: Uuid,
    filters: TransactionFilter,
) -> Result<Vec<Transaction>, ApiError> {
    let mut conn = pool.get().map_err(|e| {
        tracing::error!("Failed to get DB connection: {}", e);
        ApiError::Internal
    })?;

    tokio::task::spawn_blocking(move || {
        let mut query = transactions::table
            .filter(transactions::user_id.eq(user_id))
            .into_boxed();

        // Apply filters
        if let Some(account_id) = filters.account_id {
            query = query.filter(transactions::account_id.eq(account_id));
        }

        if let Some(category_id) = filters.category_id {
            query = query.filter(transactions::category_id.eq(category_id));
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
        let limit = filters.limit.unwrap_or(50).min(100); // TODO: Make default limit (50) and max (100) configurable
        let offset = filters.offset.unwrap_or(0);

        query
            .limit(limit)
            .offset(offset)
            .load(&mut conn)
            .map_err(|e| {
                tracing::error!("Failed to list transactions for user {}: {}", user_id, e);
                ApiError::from(e)
            })
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

/// Delete transaction
pub async fn delete_transaction(pool: &DbPool, transaction_id: Uuid) -> Result<(), ApiError> {
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
