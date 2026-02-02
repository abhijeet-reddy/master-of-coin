use bigdecimal::BigDecimal;
use diesel::prelude::*;
use uuid::Uuid;

use crate::{
    DbPool,
    errors::ApiError,
    models::account::{Account, NewAccount, UpdateAccount},
    schema::{accounts, transactions},
};

/// Create a new account
pub async fn create_account(
    pool: &DbPool,
    user_id: Uuid,
    new_account: NewAccount,
) -> Result<Account, ApiError> {
    let mut conn = pool.get().map_err(|e| {
        tracing::error!("Failed to get DB connection: {}", e);
        ApiError::Internal
    })?;

    tokio::task::spawn_blocking(move || {
        diesel::insert_into(accounts::table)
            .values(&new_account)
            .get_result(&mut conn)
            .map_err(|e| {
                tracing::error!("Failed to create account for user {}: {}", user_id, e);
                ApiError::from(e)
            })
    })
    .await
    .map_err(|e| {
        tracing::error!("Task join error: {}", e);
        ApiError::Internal
    })?
}

/// Find account by ID
pub async fn find_by_id(pool: &DbPool, account_id: Uuid) -> Result<Account, ApiError> {
    let mut conn = pool.get().map_err(|e| {
        tracing::error!("Failed to get DB connection: {}", e);
        ApiError::Internal
    })?;

    tokio::task::spawn_blocking(move || {
        accounts::table
            .find(account_id)
            .first(&mut conn)
            .map_err(|e| {
                tracing::error!("Failed to find account by id {}: {}", account_id, e);
                ApiError::from(e)
            })
    })
    .await
    .map_err(|e| {
        tracing::error!("Task join error: {}", e);
        ApiError::Internal
    })?
}

/// List all accounts for a user
pub async fn list_by_user(pool: &DbPool, user_id: Uuid) -> Result<Vec<Account>, ApiError> {
    let mut conn = pool.get().map_err(|e| {
        tracing::error!("Failed to get DB connection: {}", e);
        ApiError::Internal
    })?;

    tokio::task::spawn_blocking(move || {
        accounts::table
            .filter(accounts::user_id.eq(user_id))
            .order(accounts::created_at.desc())
            .load(&mut conn)
            .map_err(|e| {
                tracing::error!("Failed to list accounts for user {}: {}", user_id, e);
                ApiError::from(e)
            })
    })
    .await
    .map_err(|e| {
        tracing::error!("Task join error: {}", e);
        ApiError::Internal
    })?
}

/// Update account
pub async fn update_account(
    pool: &DbPool,
    account_id: Uuid,
    updates: UpdateAccount,
) -> Result<Account, ApiError> {
    let mut conn = pool.get().map_err(|e| {
        tracing::error!("Failed to get DB connection: {}", e);
        ApiError::Internal
    })?;

    tokio::task::spawn_blocking(move || {
        // Apply updates one at a time
        if let Some(name) = updates.name {
            diesel::update(accounts::table.find(account_id))
                .set(accounts::name.eq(name))
                .execute(&mut conn)
                .map_err(|e| {
                    tracing::error!("Failed to update account name {}: {}", account_id, e);
                    ApiError::from(e)
                })?;
        }
        if let Some(account_type) = updates.account_type {
            diesel::update(accounts::table.find(account_id))
                .set(accounts::type_.eq(account_type))
                .execute(&mut conn)
                .map_err(|e| {
                    tracing::error!("Failed to update account type {}: {}", account_id, e);
                    ApiError::from(e)
                })?;
        }
        if let Some(currency) = updates.currency {
            diesel::update(accounts::table.find(account_id))
                .set(accounts::currency.eq(currency))
                .execute(&mut conn)
                .map_err(|e| {
                    tracing::error!("Failed to update account currency {}: {}", account_id, e);
                    ApiError::from(e)
                })?;
        }
        if let Some(notes) = updates.notes {
            diesel::update(accounts::table.find(account_id))
                .set(accounts::notes.eq(notes))
                .execute(&mut conn)
                .map_err(|e| {
                    tracing::error!("Failed to update account notes {}: {}", account_id, e);
                    ApiError::from(e)
                })?;
        }

        // Return the updated account
        accounts::table
            .find(account_id)
            .first(&mut conn)
            .map_err(|e| {
                tracing::error!("Failed to fetch updated account {}: {}", account_id, e);
                ApiError::from(e)
            })
    })
    .await
    .map_err(|e| {
        tracing::error!("Task join error: {}", e);
        ApiError::Internal
    })?
}

/// Delete account
pub async fn delete_account(pool: &DbPool, account_id: Uuid) -> Result<(), ApiError> {
    let mut conn = pool.get().map_err(|e| {
        tracing::error!("Failed to get DB connection: {}", e);
        ApiError::Internal
    })?;

    tokio::task::spawn_blocking(move || {
        diesel::delete(accounts::table.find(account_id))
            .execute(&mut conn)
            .map_err(|e| {
                tracing::error!("Failed to delete account {}: {}", account_id, e);
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

/// Calculate account balance from transactions
pub async fn calculate_balance(pool: &DbPool, account_id: Uuid) -> Result<BigDecimal, ApiError> {
    let mut conn = pool.get().map_err(|e| {
        tracing::error!("Failed to get DB connection: {}", e);
        ApiError::Internal
    })?;

    tokio::task::spawn_blocking(move || {
        use diesel::dsl::sum;

        let balance: Option<BigDecimal> = transactions::table
            .filter(transactions::account_id.eq(account_id))
            .select(sum(transactions::amount))
            .first(&mut conn)
            .map_err(|e| {
                tracing::error!(
                    "Failed to calculate balance for account {}: {}",
                    account_id,
                    e
                );
                ApiError::from(e)
            })?;

        // If no transactions, balance is 0
        Ok(balance.unwrap_or_else(|| BigDecimal::from(0)))
    })
    .await
    .map_err(|e| {
        tracing::error!("Task join error: {}", e);
        ApiError::Internal
    })?
}

/// Check if account has any transactions
pub async fn has_transactions(pool: &DbPool, account_id: Uuid) -> Result<bool, ApiError> {
    let mut conn = pool.get().map_err(|e| {
        tracing::error!("Failed to get DB connection: {}", e);
        ApiError::Internal
    })?;

    tokio::task::spawn_blocking(move || {
        use diesel::dsl::count;

        let count: i64 = transactions::table
            .filter(transactions::account_id.eq(account_id))
            .select(count(transactions::id))
            .first(&mut conn)
            .map_err(|e| {
                tracing::error!(
                    "Failed to check transactions for account {}: {}",
                    account_id,
                    e
                );
                ApiError::from(e)
            })?;

        Ok(count > 0)
    })
    .await
    .map_err(|e| {
        tracing::error!("Task join error: {}", e);
        ApiError::Internal
    })?
}
