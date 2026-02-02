use argon2::{
    Argon2,
    password_hash::{PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
};
use rand::{Rng, distributions::Alphanumeric};
use rand_core::OsRng;

use crate::errors::ApiError;

/// Prefix for all Master of Coin API keys
const API_KEY_PREFIX: &str = "moc_";

/// Length of the random part of the API key (after prefix)
const API_KEY_RANDOM_LENGTH: usize = 32;

/// Generate a new API key
///
/// # Returns
/// * `String` - A new API key in the format `moc_<32_random_chars>`
///
/// # Format
/// - Prefix: `moc_` (Master of Coin)
/// - Length: 36 characters total (4 prefix + 32 random)
/// - Character set: alphanumeric (a-z, A-Z, 0-9)
/// - Example: `moc_k7Hj9pL2mN4qR8sT1vW3xY5zA6bC`
///
/// # Security
/// - Uses cryptographically secure random number generator (OsRng)
/// - Each key is unique with ~62^32 possible combinations
pub fn generate_api_key() -> String {
    let random_part: String = rand::thread_rng()
        .sample_iter(&Alphanumeric)
        .take(API_KEY_RANDOM_LENGTH)
        .map(char::from)
        .collect();

    format!("{}{}", API_KEY_PREFIX, random_part)
}

/// Extract the key prefix for display purposes
///
/// # Arguments
/// * `api_key` - The full API key
///
/// # Returns
/// * `String` - The first 12 characters of the key (e.g., "moc_k7Hj9pL2")
///
/// # Purpose
/// The prefix is stored in the database and shown to users to help them
/// identify keys without exposing the full key value.
pub fn extract_key_prefix(api_key: &str) -> String {
    api_key.chars().take(12).collect()
}

/// Hash an API key using Argon2
///
/// # Arguments
/// * `api_key` - The plain text API key to hash
///
/// # Returns
/// * `Result<String, ApiError>` - The hashed API key string or an error
///
/// # Security
/// - Uses Argon2id with default configuration (same as passwords)
/// - Generates a random salt using OsRng (cryptographically secure)
/// - Never logs the API key or hash
/// - Constant-time comparison when verifying
pub fn hash_api_key(api_key: &str) -> Result<String, ApiError> {
    let salt = SaltString::generate(&mut OsRng);
    let argon2 = Argon2::default();

    argon2
        .hash_password(api_key.as_bytes(), &salt)
        .map(|hash| hash.to_string())
        .map_err(|e| {
            tracing::error!("Failed to hash API key: {}", e);
            ApiError::Internal
        })
}

/// Verify an API key against a hash
///
/// # Arguments
/// * `api_key` - The plain text API key to verify
/// * `hash` - The API key hash to verify against
///
/// # Returns
/// * `Result<bool, ApiError>` - True if API key matches, false otherwise
///
/// # Security
/// - Uses constant-time comparison to prevent timing attacks
/// - Never logs the API key or hash
pub fn verify_api_key(api_key: &str, hash: &str) -> Result<bool, ApiError> {
    let parsed_hash = PasswordHash::new(hash).map_err(|e| {
        tracing::error!("Failed to parse API key hash: {}", e);
        ApiError::Internal
    })?;

    Ok(Argon2::default()
        .verify_password(api_key.as_bytes(), &parsed_hash)
        .is_ok())
}

/// Validate API key format
///
/// # Arguments
/// * `api_key` - The API key to validate
///
/// # Returns
/// * `bool` - True if the key has the correct format
///
/// # Format Requirements
/// - Must start with "moc_"
/// - Must be exactly 36 characters long
/// - Must contain only alphanumeric characters after prefix
pub fn is_valid_api_key_format(api_key: &str) -> bool {
    if !api_key.starts_with(API_KEY_PREFIX) {
        return false;
    }

    if api_key.len() != API_KEY_PREFIX.len() + API_KEY_RANDOM_LENGTH {
        return false;
    }

    // Check that the part after prefix is alphanumeric
    api_key[API_KEY_PREFIX.len()..]
        .chars()
        .all(|c| c.is_ascii_alphanumeric())
}
