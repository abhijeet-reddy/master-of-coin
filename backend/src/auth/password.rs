use argon2::{
    Argon2,
    password_hash::{PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
};
use rand_core::OsRng;

use crate::errors::ApiError;

/// Hash a password using Argon2
///
/// # Arguments
/// * `password` - The plain text password to hash
///
/// # Returns
/// * `Result<String, ApiError>` - The hashed password string or an error
///
/// # Security
/// - Uses Argon2 with default configuration (recommended parameters)
/// - Generates a random salt using OsRng (cryptographically secure)
/// - Never logs the password or hash
pub fn hash_password(password: &str) -> Result<String, ApiError> {
    let salt = SaltString::generate(&mut OsRng);
    let argon2 = Argon2::default();

    argon2
        .hash_password(password.as_bytes(), &salt)
        .map(|hash| hash.to_string())
        .map_err(|e| {
            tracing::error!("Failed to hash password: {}", e);
            ApiError::Internal
        })
}

/// Verify a password against a hash
///
/// # Arguments
/// * `password` - The plain text password to verify
/// * `hash` - The password hash to verify against
///
/// # Returns
/// * `Result<bool, ApiError>` - True if password matches, false otherwise
///
/// # Security
/// - Uses constant-time comparison to prevent timing attacks
/// - Never logs the password or hash
pub fn verify_password(password: &str, hash: &str) -> Result<bool, ApiError> {
    let parsed_hash = PasswordHash::new(hash).map_err(|e| {
        tracing::error!("Failed to parse password hash: {}", e);
        ApiError::Internal
    })?;

    Ok(Argon2::default()
        .verify_password(password.as_bytes(), &parsed_hash)
        .is_ok())
}
