use chrono::Utc;
use diesel::prelude::*;
use uuid::Uuid;

use crate::{
    DbPool,
    errors::ApiError,
    models::{ApiKey, NewApiKey},
    schema::api_keys,
    types::ApiKeyStatus,
};

/// Create a new API key
pub async fn create(pool: &DbPool, new_api_key: NewApiKey) -> Result<ApiKey, ApiError> {
    let mut conn = pool.get().map_err(|e| {
        tracing::error!("Failed to get DB connection: {}", e);
        ApiError::Internal
    })?;

    tokio::task::spawn_blocking(move || {
        diesel::insert_into(api_keys::table)
            .values(&new_api_key)
            .get_result(&mut conn)
            .map_err(|e| {
                tracing::error!("Failed to create API key: {}", e);
                ApiError::from(e)
            })
    })
    .await
    .map_err(|e| {
        tracing::error!("Task join error: {}", e);
        ApiError::Internal
    })?
}

/// Find API key by hash
pub async fn find_by_hash(pool: &DbPool, key_hash: &str) -> Result<ApiKey, ApiError> {
    let key_hash = key_hash.to_string();
    let mut conn = pool.get().map_err(|e| {
        tracing::error!("Failed to get DB connection: {}", e);
        ApiError::Internal
    })?;

    tokio::task::spawn_blocking(move || {
        api_keys::table
            .filter(api_keys::key_hash.eq(&key_hash))
            .first(&mut conn)
            .map_err(|e| {
                tracing::debug!("API key not found by hash: {}", e);
                ApiError::Unauthorized("Invalid API key".to_string())
            })
    })
    .await
    .map_err(|e| {
        tracing::error!("Task join error: {}", e);
        ApiError::Internal
    })?
}

/// Find API key by ID
pub async fn find_by_id(pool: &DbPool, id: Uuid) -> Result<ApiKey, ApiError> {
    let mut conn = pool.get().map_err(|e| {
        tracing::error!("Failed to get DB connection: {}", e);
        ApiError::Internal
    })?;

    tokio::task::spawn_blocking(move || {
        api_keys::table.find(id).first(&mut conn).map_err(|e| {
            tracing::error!("Failed to find API key by id {}: {}", id, e);
            ApiError::from(e)
        })
    })
    .await
    .map_err(|e| {
        tracing::error!("Task join error: {}", e);
        ApiError::Internal
    })?
}

/// Find all API keys for a user
pub async fn find_by_user_id(pool: &DbPool, user_id: Uuid) -> Result<Vec<ApiKey>, ApiError> {
    let mut conn = pool.get().map_err(|e| {
        tracing::error!("Failed to get DB connection: {}", e);
        ApiError::Internal
    })?;

    tokio::task::spawn_blocking(move || {
        api_keys::table
            .filter(api_keys::user_id.eq(user_id))
            .order(api_keys::created_at.desc())
            .load(&mut conn)
            .map_err(|e| {
                tracing::error!("Failed to find API keys for user {}: {}", user_id, e);
                ApiError::from(e)
            })
    })
    .await
    .map_err(|e| {
        tracing::error!("Task join error: {}", e);
        ApiError::Internal
    })?
}

/// Find active API keys for a user
pub async fn find_active_by_user_id(pool: &DbPool, user_id: Uuid) -> Result<Vec<ApiKey>, ApiError> {
    let mut conn = pool.get().map_err(|e| {
        tracing::error!("Failed to get DB connection: {}", e);
        ApiError::Internal
    })?;

    tokio::task::spawn_blocking(move || {
        api_keys::table
            .filter(api_keys::user_id.eq(user_id))
            .filter(api_keys::status.eq(ApiKeyStatus::Active))
            .order(api_keys::created_at.desc())
            .load(&mut conn)
            .map_err(|e| {
                tracing::error!("Failed to find active API keys for user {}: {}", user_id, e);
                ApiError::from(e)
            })
    })
    .await
    .map_err(|e| {
        tracing::error!("Task join error: {}", e);
        ApiError::Internal
    })?
}

/// Update API key name
pub async fn update_name(pool: &DbPool, id: Uuid, name: String) -> Result<ApiKey, ApiError> {
    let mut conn = pool.get().map_err(|e| {
        tracing::error!("Failed to get DB connection: {}", e);
        ApiError::Internal
    })?;

    tokio::task::spawn_blocking(move || {
        diesel::update(api_keys::table.find(id))
            .set(api_keys::name.eq(name))
            .get_result(&mut conn)
            .map_err(|e| {
                tracing::error!("Failed to update API key name {}: {}", id, e);
                ApiError::from(e)
            })
    })
    .await
    .map_err(|e| {
        tracing::error!("Task join error: {}", e);
        ApiError::Internal
    })?
}

/// Update API key expiration
pub async fn update_expiration(
    pool: &DbPool,
    id: Uuid,
    expires_at: Option<chrono::DateTime<Utc>>,
) -> Result<ApiKey, ApiError> {
    let mut conn = pool.get().map_err(|e| {
        tracing::error!("Failed to get DB connection: {}", e);
        ApiError::Internal
    })?;

    tokio::task::spawn_blocking(move || {
        diesel::update(api_keys::table.find(id))
            .set(api_keys::expires_at.eq(expires_at))
            .get_result(&mut conn)
            .map_err(|e| {
                tracing::error!("Failed to update API key expiration {}: {}", id, e);
                ApiError::from(e)
            })
    })
    .await
    .map_err(|e| {
        tracing::error!("Task join error: {}", e);
        ApiError::Internal
    })?
}

/// Update API key scopes
pub async fn update_scopes(
    pool: &DbPool,
    id: Uuid,
    scopes: serde_json::Value,
) -> Result<ApiKey, ApiError> {
    let mut conn = pool.get().map_err(|e| {
        tracing::error!("Failed to get DB connection: {}", e);
        ApiError::Internal
    })?;

    tokio::task::spawn_blocking(move || {
        diesel::update(api_keys::table.find(id))
            .set(api_keys::scopes.eq(scopes))
            .get_result(&mut conn)
            .map_err(|e| {
                tracing::error!("Failed to update API key scopes {}: {}", id, e);
                ApiError::from(e)
            })
    })
    .await
    .map_err(|e| {
        tracing::error!("Task join error: {}", e);
        ApiError::Internal
    })?
}

/// Revoke an API key (set status to revoked)
pub async fn revoke(pool: &DbPool, id: Uuid) -> Result<ApiKey, ApiError> {
    let mut conn = pool.get().map_err(|e| {
        tracing::error!("Failed to get DB connection: {}", e);
        ApiError::Internal
    })?;

    tokio::task::spawn_blocking(move || {
        diesel::update(api_keys::table.find(id))
            .set(api_keys::status.eq(ApiKeyStatus::Revoked))
            .get_result(&mut conn)
            .map_err(|e| {
                tracing::error!("Failed to revoke API key {}: {}", id, e);
                ApiError::from(e)
            })
    })
    .await
    .map_err(|e| {
        tracing::error!("Task join error: {}", e);
        ApiError::Internal
    })?
}

/// Update last_used_at timestamp for an API key
pub async fn update_last_used(pool: &DbPool, id: Uuid) -> Result<(), ApiError> {
    let mut conn = pool.get().map_err(|e| {
        tracing::error!("Failed to get DB connection: {}", e);
        ApiError::Internal
    })?;

    tokio::task::spawn_blocking(move || {
        diesel::update(api_keys::table.find(id))
            .set(api_keys::last_used_at.eq(Utc::now()))
            .execute(&mut conn)
            .map_err(|e| {
                tracing::error!("Failed to update API key last_used_at {}: {}", id, e);
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

/// Mark expired API keys as expired (background job)
pub async fn mark_expired_keys(pool: &DbPool) -> Result<usize, ApiError> {
    let mut conn = pool.get().map_err(|e| {
        tracing::error!("Failed to get DB connection: {}", e);
        ApiError::Internal
    })?;

    tokio::task::spawn_blocking(move || {
        diesel::update(api_keys::table)
            .filter(api_keys::status.eq(ApiKeyStatus::Active))
            .filter(api_keys::expires_at.lt(Utc::now()))
            .set(api_keys::status.eq(ApiKeyStatus::Expired))
            .execute(&mut conn)
            .map_err(|e| {
                tracing::error!("Failed to mark expired API keys: {}", e);
                ApiError::from(e)
            })
    })
    .await
    .map_err(|e| {
        tracing::error!("Task join error: {}", e);
        ApiError::Internal
    })?
}

/// Delete an API key permanently (hard delete)
pub async fn delete(pool: &DbPool, id: Uuid) -> Result<(), ApiError> {
    let mut conn = pool.get().map_err(|e| {
        tracing::error!("Failed to get DB connection: {}", e);
        ApiError::Internal
    })?;

    tokio::task::spawn_blocking(move || {
        diesel::delete(api_keys::table.find(id))
            .execute(&mut conn)
            .map_err(|e| {
                tracing::error!("Failed to delete API key {}: {}", id, e);
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
