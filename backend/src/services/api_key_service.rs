use chrono::{Duration, Utc};
use uuid::Uuid;
use validator::Validate;

use crate::{
    auth::api_key as api_key_crypto,
    db::DbPool,
    errors::ApiError,
    models::{
        ApiKey, ApiKeyResponse, ApiKeyScopes, CreateApiKeyRequest, CreateApiKeyResponse,
        ListApiKeysResponse, NewApiKey, UpdateApiKeyRequest,
    },
    repositories::api_key as api_key_repo,
    types::ApiKeyStatus,
};

/// Create a new API key
///
/// # Arguments
/// * `pool` - Database connection pool
/// * `user_id` - ID of the user creating the key
/// * `request` - API key creation request
///
/// # Returns
/// * `Result<CreateApiKeyResponse, ApiError>` - Response with the plain API key (shown only once)
///
/// # Errors
/// - Validation errors if request data is invalid
/// - Conflict errors if name already exists for user
/// - Internal errors for database or hashing failures
pub async fn create_api_key(
    pool: &DbPool,
    user_id: Uuid,
    request: CreateApiKeyRequest,
) -> Result<CreateApiKeyResponse, ApiError> {
    // Validate request
    request.validate().map_err(|e| {
        tracing::warn!("Validation error during API key creation: {}", e);
        ApiError::Validation(format!("Invalid API key data: {}", e))
    })?;

    // Validate that at least one scope is provided
    if request.scopes.transactions.is_empty()
        && request.scopes.accounts.is_empty()
        && request.scopes.budgets.is_empty()
        && request.scopes.categories.is_empty()
        && request.scopes.people.is_empty()
    {
        return Err(ApiError::Validation(
            "At least one permission scope must be selected".to_string(),
        ));
    }

    // Generate API key
    let plain_key = api_key_crypto::generate_api_key();
    let key_hash = api_key_crypto::hash_api_key(&plain_key)?;
    let key_prefix = api_key_crypto::extract_key_prefix(&plain_key);

    // Calculate expiration date
    let expires_at = request
        .expires_in_days
        .map(|days| Utc::now() + Duration::days(days));

    // Convert scopes to JSON
    let scopes_json = request.scopes.to_json().map_err(|e| {
        tracing::error!("Failed to serialize scopes: {}", e);
        ApiError::Internal
    })?;

    // Create new API key record
    let new_api_key = NewApiKey {
        user_id,
        name: request.name.clone(),
        key_hash,
        key_prefix: key_prefix.clone(),
        scopes: scopes_json,
        status: ApiKeyStatus::Active,
        expires_at,
    };

    let api_key = api_key_repo::create(pool, new_api_key).await?;

    tracing::info!(
        "API key created successfully for user {}: {}",
        user_id,
        api_key.id
    );

    Ok(CreateApiKeyResponse {
        id: api_key.id,
        name: api_key.name,
        key: plain_key, // Only shown once!
        key_prefix,
        scopes: request.scopes,
        status: api_key.status,
        expires_at: api_key.expires_at,
        created_at: api_key.created_at,
    })
}

/// List all API keys for a user
///
/// # Arguments
/// * `pool` - Database connection pool
/// * `user_id` - ID of the user
///
/// # Returns
/// * `Result<ListApiKeysResponse, ApiError>` - List of API keys (without plain keys)
pub async fn list_api_keys(pool: &DbPool, user_id: Uuid) -> Result<ListApiKeysResponse, ApiError> {
    let api_keys = api_key_repo::find_by_user_id(pool, user_id).await?;

    let api_key_responses: Result<Vec<ApiKeyResponse>, ApiError> = api_keys
        .into_iter()
        .map(|key| {
            ApiKeyResponse::from_api_key(key).map_err(|e| {
                tracing::error!("Failed to parse API key scopes: {}", e);
                ApiError::Internal
            })
        })
        .collect();

    Ok(ListApiKeysResponse {
        api_keys: api_key_responses?,
    })
}

/// Get a single API key by ID
///
/// # Arguments
/// * `pool` - Database connection pool
/// * `user_id` - ID of the user (for authorization)
/// * `id` - ID of the API key
///
/// # Returns
/// * `Result<ApiKeyResponse, ApiError>` - API key details (without plain key)
///
/// # Errors
/// - NotFound if API key doesn't exist
/// - Forbidden if API key belongs to a different user
pub async fn get_api_key(
    pool: &DbPool,
    user_id: Uuid,
    id: Uuid,
) -> Result<ApiKeyResponse, ApiError> {
    let api_key = api_key_repo::find_by_id(pool, id).await?;

    // Verify ownership
    if api_key.user_id != user_id {
        tracing::warn!(
            "User {} attempted to access API key {} owned by {}",
            user_id,
            id,
            api_key.user_id
        );
        return Err(ApiError::Forbidden(
            "You don't have permission to access this API key".to_string(),
        ));
    }

    ApiKeyResponse::from_api_key(api_key).map_err(|e| {
        tracing::error!("Failed to parse API key scopes: {}", e);
        ApiError::Internal
    })
}

/// Update an API key
///
/// # Arguments
/// * `pool` - Database connection pool
/// * `user_id` - ID of the user (for authorization)
/// * `id` - ID of the API key
/// * `request` - Update request
///
/// # Returns
/// * `Result<ApiKeyResponse, ApiError>` - Updated API key details
///
/// # Errors
/// - Validation errors if request data is invalid
/// - NotFound if API key doesn't exist
/// - Forbidden if API key belongs to a different user
pub async fn update_api_key(
    pool: &DbPool,
    user_id: Uuid,
    id: Uuid,
    request: UpdateApiKeyRequest,
) -> Result<ApiKeyResponse, ApiError> {
    // Validate request
    request.validate().map_err(|e| {
        tracing::warn!("Validation error during API key update: {}", e);
        ApiError::Validation(format!("Invalid API key update data: {}", e))
    })?;

    // Fetch existing API key to verify ownership
    let api_key = api_key_repo::find_by_id(pool, id).await?;

    if api_key.user_id != user_id {
        tracing::warn!(
            "User {} attempted to update API key {} owned by {}",
            user_id,
            id,
            api_key.user_id
        );
        return Err(ApiError::Forbidden(
            "You don't have permission to update this API key".to_string(),
        ));
    }

    // Apply updates
    let mut updated_key = api_key;

    if let Some(name) = request.name {
        updated_key = api_key_repo::update_name(pool, id, name).await?;
    }

    if let Some(expires_in_days) = request.expires_in_days {
        let expires_at = Some(Utc::now() + Duration::days(expires_in_days));
        updated_key = api_key_repo::update_expiration(pool, id, expires_at).await?;
    }

    if let Some(scopes) = request.scopes {
        let scopes_json = scopes.to_json().map_err(|e| {
            tracing::error!("Failed to serialize scopes: {}", e);
            ApiError::Internal
        })?;
        updated_key = api_key_repo::update_scopes(pool, id, scopes_json).await?;
    }

    tracing::info!("API key updated successfully: {}", id);

    ApiKeyResponse::from_api_key(updated_key).map_err(|e| {
        tracing::error!("Failed to parse API key scopes: {}", e);
        ApiError::Internal
    })
}

/// Revoke an API key
///
/// # Arguments
/// * `pool` - Database connection pool
/// * `user_id` - ID of the user (for authorization)
/// * `id` - ID of the API key
///
/// # Returns
/// * `Result<(), ApiError>` - Success or error
///
/// # Errors
/// - NotFound if API key doesn't exist
/// - Forbidden if API key belongs to a different user
pub async fn revoke_api_key(pool: &DbPool, user_id: Uuid, id: Uuid) -> Result<(), ApiError> {
    // Fetch existing API key to verify ownership
    let api_key = api_key_repo::find_by_id(pool, id).await?;

    if api_key.user_id != user_id {
        tracing::warn!(
            "User {} attempted to revoke API key {} owned by {}",
            user_id,
            id,
            api_key.user_id
        );
        return Err(ApiError::Forbidden(
            "You don't have permission to revoke this API key".to_string(),
        ));
    }

    api_key_repo::revoke(pool, id).await?;

    tracing::info!("API key revoked successfully: {}", id);

    Ok(())
}

/// Verify an API key and return the associated user and scopes
///
/// # Arguments
/// * `pool` - Database connection pool
/// * `plain_key` - The plain API key to verify
///
/// # Returns
/// * `Result<(ApiKey, ApiKeyScopes), ApiError>` - The API key record and parsed scopes
///
/// # Errors
/// - Unauthorized if key is invalid, revoked, or expired
/// - Internal errors for database or parsing failures
///
/// # Security
/// - Uses key_prefix for efficient lookup (first 12 chars)
/// - Verifies full key hash using constant-time comparison (Argon2 verify)
/// - Checks key status (must be 'active')
/// - Checks expiration at runtime
/// - Updates last_used_at timestamp asynchronously
///
/// # How It Works
/// 1. Extract key_prefix (first 12 chars) from the provided key
/// 2. Query database for active keys with matching prefix
/// 3. For each match, verify the full key against the stored Argon2 hash
/// 4. Argon2's verify extracts the salt from the stored hash and compares
/// 5. Return the first valid match
pub async fn verify_and_get_key(
    pool: &DbPool,
    plain_key: &str,
) -> Result<(ApiKey, ApiKeyScopes), ApiError> {
    // Validate key format
    if !api_key_crypto::is_valid_api_key_format(plain_key) {
        tracing::warn!("Invalid API key format provided");
        return Err(ApiError::Unauthorized("Invalid API key format".to_string()));
    }

    // Extract prefix for efficient lookup
    let key_prefix = api_key_crypto::extract_key_prefix(plain_key);

    // Get all active keys with matching prefix
    let mut conn = pool.get().map_err(|e| {
        tracing::error!("Failed to get DB connection: {}", e);
        ApiError::Internal
    })?;

    use crate::schema::api_keys;
    use diesel::prelude::*;

    let matching_keys: Vec<ApiKey> = tokio::task::spawn_blocking(move || {
        api_keys::table
            .filter(api_keys::key_prefix.eq(&key_prefix))
            .filter(api_keys::status.eq(ApiKeyStatus::Active))
            .load(&mut conn)
            .map_err(|e| {
                tracing::debug!("No API keys found with prefix: {}", e);
                ApiError::Unauthorized("Invalid API key".to_string())
            })
    })
    .await
    .map_err(|e| {
        tracing::error!("Task join error: {}", e);
        ApiError::Internal
    })??;

    // Try to verify against each matching key
    for api_key in matching_keys {
        // Verify the full key against the stored hash
        // Argon2's verify extracts the salt from the stored hash
        match api_key_crypto::verify_api_key(plain_key, &api_key.key_hash) {
            Ok(true) => {
                // Key verified! Now check expiration
                if let Some(expires_at) = api_key.expires_at {
                    if expires_at < Utc::now() {
                        tracing::warn!("Expired API key used: {}", api_key.id);
                        return Err(ApiError::Unauthorized("API key has expired".to_string()));
                    }
                }

                // Parse scopes
                let scopes = ApiKeyScopes::from_json(&api_key.scopes).map_err(|e| {
                    tracing::error!("Failed to parse API key scopes: {}", e);
                    ApiError::Internal
                })?;

                // Update last_used_at asynchronously (don't wait for it)
                let pool_clone = pool.clone();
                let key_id = api_key.id;
                tokio::spawn(async move {
                    if let Err(e) = api_key_repo::update_last_used(&pool_clone, key_id).await {
                        tracing::error!(
                            "Failed to update last_used_at for API key {}: {}",
                            key_id,
                            e
                        );
                    }
                });

                return Ok((api_key, scopes));
            }
            Ok(false) => {
                // Hash doesn't match, try next key (if any)
                continue;
            }
            Err(e) => {
                tracing::error!("Error verifying API key: {}", e);
                return Err(e);
            }
        }
    }

    // No matching key found
    tracing::warn!("No valid API key found for provided key");
    Err(ApiError::Unauthorized("Invalid API key".to_string()))
}
