//! OAuth state parameter utilities.
//!
//! Provides functions to create and verify signed OAuth state parameters
//! that embed the user_id. This allows the OAuth callback endpoint to
//! identify the user without requiring authentication (since the callback
//! is a browser redirect from the OAuth provider).
//!
//! The state is encrypted using AES-256-GCM with the same ENCRYPTION_KEY
//! used for credential storage, preventing tampering.

use aes_gcm::{
    Aes256Gcm, Nonce,
    aead::{Aead, KeyInit, OsRng},
};
use base64::{Engine, engine::general_purpose::URL_SAFE_NO_PAD as BASE64URL};
use rand::RngCore;
use std::env;
use thiserror::Error;
use uuid::Uuid;

#[derive(Debug, Error)]
pub enum OAuthStateError {
    #[error("Encryption key not configured")]
    KeyNotConfigured,

    #[error("Invalid key format: {0}")]
    InvalidKeyFormat(String),

    #[error("Failed to create state: {0}")]
    CreationFailed(String),

    #[error("Invalid state: {0}")]
    ValidationFailed(String),
}

/// Get the encryption key from environment variable
fn get_key() -> Result<Vec<u8>, OAuthStateError> {
    let key_b64 = env::var("ENCRYPTION_KEY").map_err(|_| OAuthStateError::KeyNotConfigured)?;
    base64::engine::general_purpose::STANDARD
        .decode(key_b64.trim())
        .map_err(|e| OAuthStateError::InvalidKeyFormat(e.to_string()))
}

/// Create a signed OAuth state parameter that embeds the user_id.
///
/// Format: base64url([12-byte nonce][AES-GCM encrypted "user_id:random_nonce"])
///
/// # Arguments
///
/// * `user_id` - The authenticated user's UUID to embed in the state
///
/// # Returns
///
/// A URL-safe base64-encoded encrypted state string
pub fn create_signed_state(user_id: Uuid) -> Result<String, OAuthStateError> {
    let key_bytes = get_key()?;
    if key_bytes.len() != 32 {
        return Err(OAuthStateError::InvalidKeyFormat(format!(
            "Key must be 32 bytes, got {}",
            key_bytes.len()
        )));
    }

    let cipher = Aes256Gcm::new_from_slice(&key_bytes)
        .map_err(|e| OAuthStateError::CreationFailed(e.to_string()))?;

    // Generate random nonce for AES-GCM
    let mut nonce_bytes = [0u8; 12];
    OsRng.fill_bytes(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);

    // Generate random padding to make each state unique
    let mut random_pad = [0u8; 16];
    OsRng.fill_bytes(&mut random_pad);
    let random_hex: String = random_pad.iter().map(|b| format!("{:02x}", b)).collect();

    // Plaintext: "user_id:random_hex"
    let plaintext = format!("{}:{}", user_id, random_hex);

    // Encrypt
    let ciphertext = cipher
        .encrypt(nonce, plaintext.as_bytes())
        .map_err(|e| OAuthStateError::CreationFailed(e.to_string()))?;

    // Prepend nonce to ciphertext and encode as URL-safe base64
    let mut result = nonce_bytes.to_vec();
    result.extend_from_slice(&ciphertext);

    Ok(BASE64URL.encode(&result))
}

/// Verify and extract user_id from a signed OAuth state parameter.
///
/// # Arguments
///
/// * `state` - The state parameter received from the OAuth callback
///
/// # Returns
///
/// The user_id (UUID) that was embedded in the state
pub fn verify_signed_state(state: &str) -> Result<Uuid, OAuthStateError> {
    let key_bytes = get_key()?;
    if key_bytes.len() != 32 {
        return Err(OAuthStateError::InvalidKeyFormat(format!(
            "Key must be 32 bytes, got {}",
            key_bytes.len()
        )));
    }

    let cipher = Aes256Gcm::new_from_slice(&key_bytes)
        .map_err(|e| OAuthStateError::ValidationFailed(e.to_string()))?;

    // Decode from URL-safe base64
    let encrypted_bytes = BASE64URL
        .decode(state.trim())
        .map_err(|e| OAuthStateError::ValidationFailed(format!("Base64 decode error: {}", e)))?;

    if encrypted_bytes.len() < 12 {
        return Err(OAuthStateError::ValidationFailed(
            "State too short".to_string(),
        ));
    }

    // Extract nonce and ciphertext
    let (nonce_bytes, ciphertext) = encrypted_bytes.split_at(12);
    let nonce = Nonce::from_slice(nonce_bytes);

    // Decrypt
    let plaintext = cipher.decrypt(nonce, ciphertext).map_err(|_| {
        OAuthStateError::ValidationFailed(
            "Decryption failed - invalid or tampered state".to_string(),
        )
    })?;

    let plaintext_str = String::from_utf8(plaintext)
        .map_err(|_| OAuthStateError::ValidationFailed("Invalid UTF-8 in state".to_string()))?;

    // Parse "user_id:random_hex" - user_id is a UUID (hyphens, no colons)
    // Use rfind to split at the last colon, keeping the full UUID intact
    let colon_pos = plaintext_str
        .rfind(':')
        .ok_or_else(|| OAuthStateError::ValidationFailed("Invalid state format".to_string()))?;

    let user_id_str = &plaintext_str[..colon_pos];

    Uuid::parse_str(user_id_str)
        .map_err(|_| OAuthStateError::ValidationFailed("Invalid user_id in state".to_string()))
}
