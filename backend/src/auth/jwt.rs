use chrono::Utc;
use jsonwebtoken::{DecodingKey, EncodingKey, Header, Validation, decode, encode};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{config::JwtConfig, errors::ApiError, models::user::User};

/// JWT Claims structure
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Claims {
    /// Subject (user ID)
    pub sub: Uuid,
    /// Username
    pub username: String,
    /// Expiration timestamp (Unix timestamp)
    pub exp: i64,
    /// Issued at timestamp (Unix timestamp)
    pub iat: i64,
}

/// Generate a JWT token for a user
///
/// # Arguments
/// * `user` - The user to generate a token for
/// * `config` - JWT configuration containing secret and expiration settings
///
/// # Returns
/// * `Result<String, ApiError>` - The JWT token string or an error
///
/// # Security
/// - Uses HS256 algorithm (HMAC with SHA-256)
/// - Token expiration is configurable via JwtConfig
/// - Never logs the secret or token
pub fn generate_token(user: &User, config: &JwtConfig) -> Result<String, ApiError> {
    let now = Utc::now().timestamp();
    let exp = now + (config.expiration_hours * 3600);

    let claims = Claims {
        sub: user.id,
        username: user.username.clone(),
        exp,
        iat: now,
    };

    encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(config.secret.as_bytes()),
    )
    .map_err(|e| {
        tracing::error!("Failed to generate token: {}", e);
        ApiError::Internal
    })
}

/// Verify and decode a JWT token
///
/// # Arguments
/// * `token` - The JWT token string to verify
/// * `secret` - The secret key used to sign the token
///
/// # Returns
/// * `Result<Claims, ApiError>` - The decoded claims if valid, or an error
///
/// # Security
/// - Validates token signature
/// - Checks token expiration
/// - Returns Unauthorized error for invalid tokens
pub fn verify_token(token: &str, secret: &str) -> Result<Claims, ApiError> {
    let validation = Validation::default();

    decode::<Claims>(
        token,
        &DecodingKey::from_secret(secret.as_bytes()),
        &validation,
    )
    .map(|data| data.claims)
    .map_err(|e| {
        tracing::warn!("Token verification failed: {}", e);
        ApiError::Unauthorized("Invalid or expired token".to_string())
    })
}

/// Decode a JWT token without full validation (for debugging)
///
/// # Arguments
/// * `token` - The JWT token string to decode
/// * `secret` - The secret key used to sign the token
///
/// # Returns
/// * `Result<Claims, ApiError>` - The decoded claims or an error
///
/// # Warning
/// This function does not validate expiration. Use `verify_token` for production code.
pub fn decode_token(token: &str, secret: &str) -> Result<Claims, ApiError> {
    let mut validation = Validation::default();
    validation.validate_exp = false; // Don't validate expiration for debugging

    decode::<Claims>(
        token,
        &DecodingKey::from_secret(secret.as_bytes()),
        &validation,
    )
    .map(|data| data.claims)
    .map_err(|e| {
        tracing::error!("Token decoding failed: {}", e);
        ApiError::Unauthorized("Invalid token format".to_string())
    })
}
