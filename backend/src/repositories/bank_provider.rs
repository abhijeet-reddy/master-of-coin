use chrono::Utc;
use diesel::prelude::*;
use uuid::Uuid;

use crate::{
    DbPool,
    errors::ApiError,
    models::bank_provider::{BankProviderRecord, NewBankProvider},
    schema::bank_providers,
};

/// Create a new bank provider connection
pub async fn create(
    pool: &DbPool,
    new_provider: NewBankProvider,
) -> Result<BankProviderRecord, ApiError> {
    let mut conn = pool.get().map_err(|e| {
        tracing::error!("Failed to get DB connection: {}", e);
        ApiError::InternalWithMessage("Failed to get database connection".to_string())
    })?;

    tokio::task::spawn_blocking(move || {
        diesel::insert_into(bank_providers::table)
            .values(&new_provider)
            .get_result::<BankProviderRecord>(&mut conn)
    })
    .await
    .map_err(|e| {
        tracing::error!("Task join error: {}", e);
        ApiError::InternalWithMessage("Task execution error".to_string())
    })?
    .map_err(|e| {
        tracing::error!("Database error creating bank provider: {}", e);
        ApiError::from(e)
    })
}

/// Find a bank provider by ID
pub async fn find_by_id(pool: &DbPool, id: Uuid) -> Result<Option<BankProviderRecord>, ApiError> {
    let mut conn = pool.get().map_err(|e| {
        tracing::error!("Failed to get DB connection: {}", e);
        ApiError::InternalWithMessage("Failed to get database connection".to_string())
    })?;

    tokio::task::spawn_blocking(move || {
        bank_providers::table
            .find(id)
            .first::<BankProviderRecord>(&mut conn)
            .optional()
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

/// Find a bank provider by account ID
pub async fn find_by_account_id(
    pool: &DbPool,
    account_id: Uuid,
) -> Result<Option<BankProviderRecord>, ApiError> {
    let mut conn = pool.get().map_err(|e| {
        tracing::error!("Failed to get DB connection: {}", e);
        ApiError::InternalWithMessage("Failed to get database connection".to_string())
    })?;

    tokio::task::spawn_blocking(move || {
        bank_providers::table
            .filter(bank_providers::account_id.eq(account_id))
            .first::<BankProviderRecord>(&mut conn)
            .optional()
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

/// List all bank providers for a user
pub async fn list_by_user(
    pool: &DbPool,
    user_id: Uuid,
) -> Result<Vec<BankProviderRecord>, ApiError> {
    let mut conn = pool.get().map_err(|e| {
        tracing::error!("Failed to get DB connection: {}", e);
        ApiError::InternalWithMessage("Failed to get database connection".to_string())
    })?;

    tokio::task::spawn_blocking(move || {
        bank_providers::table
            .filter(bank_providers::user_id.eq(user_id))
            .order(bank_providers::created_at.desc())
            .load::<BankProviderRecord>(&mut conn)
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

/// Update encrypted credentials (e.g., after token refresh)
pub async fn update_credentials(
    pool: &DbPool,
    id: Uuid,
    credentials: serde_json::Value,
) -> Result<BankProviderRecord, ApiError> {
    let mut conn = pool.get().map_err(|e| {
        tracing::error!("Failed to get DB connection: {}", e);
        ApiError::InternalWithMessage("Failed to get database connection".to_string())
    })?;

    tokio::task::spawn_blocking(move || {
        diesel::update(bank_providers::table.find(id))
            .set((
                bank_providers::credentials.eq(credentials),
                bank_providers::updated_at.eq(Utc::now()),
            ))
            .get_result::<BankProviderRecord>(&mut conn)
    })
    .await
    .map_err(|e| {
        tracing::error!("Task join error: {}", e);
        ApiError::InternalWithMessage("Task execution error".to_string())
    })?
    .map_err(|e| {
        tracing::error!("Database error updating credentials: {}", e);
        ApiError::from(e)
    })
}

/// Update the external account ID (after user selects which bank account to link)
pub async fn update_external_account_id(
    pool: &DbPool,
    id: Uuid,
    external_account_id: &str,
) -> Result<BankProviderRecord, ApiError> {
    let external_id = external_account_id.to_string();
    let mut conn = pool.get().map_err(|e| {
        tracing::error!("Failed to get DB connection: {}", e);
        ApiError::InternalWithMessage("Failed to get database connection".to_string())
    })?;

    tokio::task::spawn_blocking(move || {
        diesel::update(bank_providers::table.find(id))
            .set((
                bank_providers::external_account_id.eq(Some(external_id)),
                bank_providers::updated_at.eq(Utc::now()),
            ))
            .get_result::<BankProviderRecord>(&mut conn)
    })
    .await
    .map_err(|e| {
        tracing::error!("Task join error: {}", e);
        ApiError::InternalWithMessage("Task execution error".to_string())
    })?
    .map_err(|e| {
        tracing::error!("Database error updating external account ID: {}", e);
        ApiError::from(e)
    })
}

/// Update last_sync_at timestamp
pub async fn update_last_sync(pool: &DbPool, id: Uuid) -> Result<(), ApiError> {
    let mut conn = pool.get().map_err(|e| {
        tracing::error!("Failed to get DB connection: {}", e);
        ApiError::InternalWithMessage("Failed to get database connection".to_string())
    })?;

    tokio::task::spawn_blocking(move || {
        diesel::update(bank_providers::table.find(id))
            .set((
                bank_providers::last_sync_at.eq(Some(Utc::now())),
                bank_providers::updated_at.eq(Utc::now()),
            ))
            .execute(&mut conn)
    })
    .await
    .map_err(|e| {
        tracing::error!("Task join error: {}", e);
        ApiError::InternalWithMessage("Task execution error".to_string())
    })?
    .map_err(|e| {
        tracing::error!("Database error updating last_sync_at: {}", e);
        ApiError::from(e)
    })?;

    Ok(())
}

/// Deactivate a bank provider (set is_active = false)
pub async fn deactivate(pool: &DbPool, id: Uuid) -> Result<(), ApiError> {
    let mut conn = pool.get().map_err(|e| {
        tracing::error!("Failed to get DB connection: {}", e);
        ApiError::InternalWithMessage("Failed to get database connection".to_string())
    })?;

    tokio::task::spawn_blocking(move || {
        diesel::update(bank_providers::table.find(id))
            .set((
                bank_providers::is_active.eq(false),
                bank_providers::updated_at.eq(Utc::now()),
            ))
            .execute(&mut conn)
    })
    .await
    .map_err(|e| {
        tracing::error!("Task join error: {}", e);
        ApiError::InternalWithMessage("Task execution error".to_string())
    })?
    .map_err(|e| {
        tracing::error!("Database error deactivating bank provider: {}", e);
        ApiError::from(e)
    })?;

    Ok(())
}

/// Delete a bank provider (cascades to bank_sync_records)
pub async fn delete(pool: &DbPool, id: Uuid) -> Result<(), ApiError> {
    let mut conn = pool.get().map_err(|e| {
        tracing::error!("Failed to get DB connection: {}", e);
        ApiError::InternalWithMessage("Failed to get database connection".to_string())
    })?;

    tokio::task::spawn_blocking(move || {
        diesel::delete(bank_providers::table.find(id)).execute(&mut conn)
    })
    .await
    .map_err(|e| {
        tracing::error!("Task join error: {}", e);
        ApiError::InternalWithMessage("Task execution error".to_string())
    })?
    .map_err(|e| {
        tracing::error!("Database error deleting bank provider: {}", e);
        ApiError::from(e)
    })?;

    Ok(())
}
