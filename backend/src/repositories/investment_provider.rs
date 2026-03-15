use crate::{
    DbPool,
    errors::ApiError,
    models::investment_provider::{InvestmentProviderRecord, NewInvestmentProvider},
    schema::investment_providers,
};
use diesel::prelude::*;
use uuid::Uuid;

/// Create a new investment provider
pub async fn create(
    pool: &DbPool,
    new_provider: NewInvestmentProvider,
) -> Result<InvestmentProviderRecord, ApiError> {
    let mut conn = pool.get().map_err(|e| {
        tracing::error!("Failed to get DB connection: {}", e);
        ApiError::InternalWithMessage("Failed to get database connection".to_string())
    })?;

    tokio::task::spawn_blocking(move || {
        diesel::insert_into(investment_providers::table)
            .values(&new_provider)
            .get_result::<InvestmentProviderRecord>(&mut conn)
    })
    .await
    .map_err(|e| {
        tracing::error!("Task join error: {}", e);
        ApiError::InternalWithMessage("Task execution error".to_string())
    })?
    .map_err(|e| {
        tracing::error!("Database error creating investment provider: {}", e);
        ApiError::from(e)
    })
}

/// Find an investment provider by ID
pub async fn find_by_id(
    pool: &DbPool,
    id: Uuid,
) -> Result<Option<InvestmentProviderRecord>, ApiError> {
    let mut conn = pool.get().map_err(|e| {
        tracing::error!("Failed to get DB connection: {}", e);
        ApiError::InternalWithMessage("Failed to get database connection".to_string())
    })?;

    tokio::task::spawn_blocking(move || {
        investment_providers::table
            .find(id)
            .first::<InvestmentProviderRecord>(&mut conn)
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

/// Find an investment provider by account ID
pub async fn find_by_account_id(
    pool: &DbPool,
    account_id: Uuid,
) -> Result<Option<InvestmentProviderRecord>, ApiError> {
    let mut conn = pool.get().map_err(|e| {
        tracing::error!("Failed to get DB connection: {}", e);
        ApiError::InternalWithMessage("Failed to get database connection".to_string())
    })?;

    tokio::task::spawn_blocking(move || {
        investment_providers::table
            .filter(investment_providers::account_id.eq(account_id))
            .first::<InvestmentProviderRecord>(&mut conn)
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

/// List all investment providers for a user
pub async fn list_by_user(
    pool: &DbPool,
    user_id: Uuid,
) -> Result<Vec<InvestmentProviderRecord>, ApiError> {
    let mut conn = pool.get().map_err(|e| {
        tracing::error!("Failed to get DB connection: {}", e);
        ApiError::InternalWithMessage("Failed to get database connection".to_string())
    })?;

    tokio::task::spawn_blocking(move || {
        investment_providers::table
            .filter(investment_providers::user_id.eq(user_id))
            .order(investment_providers::created_at.desc())
            .load::<InvestmentProviderRecord>(&mut conn)
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

/// List active investment providers for a user (used by sync job)
pub async fn list_active_by_user(
    pool: &DbPool,
    user_id: Uuid,
) -> Result<Vec<InvestmentProviderRecord>, ApiError> {
    let mut conn = pool.get().map_err(|e| {
        tracing::error!("Failed to get DB connection: {}", e);
        ApiError::InternalWithMessage("Failed to get database connection".to_string())
    })?;

    tokio::task::spawn_blocking(move || {
        investment_providers::table
            .filter(investment_providers::user_id.eq(user_id))
            .filter(investment_providers::is_active.eq(true))
            .order(investment_providers::created_at.desc())
            .load::<InvestmentProviderRecord>(&mut conn)
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

/// Delete an investment provider by ID
pub async fn delete(pool: &DbPool, id: Uuid) -> Result<(), ApiError> {
    let mut conn = pool.get().map_err(|e| {
        tracing::error!("Failed to get DB connection: {}", e);
        ApiError::InternalWithMessage("Failed to get database connection".to_string())
    })?;

    tokio::task::spawn_blocking(move || {
        diesel::delete(investment_providers::table.find(id)).execute(&mut conn)
    })
    .await
    .map_err(|e| {
        tracing::error!("Task join error: {}", e);
        ApiError::InternalWithMessage("Task execution error".to_string())
    })?
    .map_err(|e| {
        tracing::error!("Database error deleting investment provider: {}", e);
        ApiError::from(e)
    })?;

    Ok(())
}
