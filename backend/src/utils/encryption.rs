use aes_gcm::{
    Aes256Gcm, Nonce,
    aead::{Aead, KeyInit, OsRng},
};
use base64::{Engine, engine::general_purpose::STANDARD as BASE64};
use rand::RngCore;
use serde_json::Value;
use std::env;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum EncryptionError {
    #[error("Encryption key not configured. Set ENCRYPTION_KEY environment variable")]
    KeyNotConfigured,

    #[error("Invalid encryption key format: {0}")]
    InvalidKeyFormat(String),

    #[error("Encryption failed: {0}")]
    EncryptionFailed(String),

    #[error("Decryption failed: {0}")]
    DecryptionFailed(String),

    #[error("JSON serialization error: {0}")]
    JsonError(#[from] serde_json::Error),
}

/// Get the encryption key from environment variable
/// The key should be a base64-encoded 32-byte key
/// Generate with: openssl rand -base64 32
fn get_encryption_key() -> Result<Vec<u8>, EncryptionError> {
    let key_b64 = env::var("ENCRYPTION_KEY").map_err(|_| EncryptionError::KeyNotConfigured)?;

    BASE64
        .decode(key_b64.trim())
        .map_err(|e| EncryptionError::InvalidKeyFormat(e.to_string()))
}

/// Encrypt credentials as JSON value
/// Returns base64-encoded ciphertext with nonce prepended
///
/// # Arguments
///
/// * `data` - JSON value containing credentials to encrypt
///
/// # Returns
///
/// Base64-encoded string with format: [12-byte nonce][ciphertext]
///
/// # Errors
///
/// Returns `EncryptionError` if:
/// - ENCRYPTION_KEY environment variable is not set
/// - Key is not valid base64 or not 32 bytes
/// - JSON serialization fails
/// - AES-GCM encryption fails
pub fn encrypt_credentials(data: &Value) -> Result<String, EncryptionError> {
    // Get encryption key
    let key_bytes = get_encryption_key()?;
    if key_bytes.len() != 32 {
        return Err(EncryptionError::InvalidKeyFormat(format!(
            "Key must be 32 bytes, got {}",
            key_bytes.len()
        )));
    }

    // Create cipher
    let cipher = Aes256Gcm::new_from_slice(&key_bytes)
        .map_err(|e| EncryptionError::EncryptionFailed(e.to_string()))?;

    // Generate random nonce (96 bits / 12 bytes for GCM)
    let mut nonce_bytes = [0u8; 12];
    OsRng.fill_bytes(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);

    // Serialize JSON to bytes
    let plaintext = serde_json::to_vec(data)?;

    // Encrypt
    let ciphertext = cipher
        .encrypt(nonce, plaintext.as_ref())
        .map_err(|e| EncryptionError::EncryptionFailed(e.to_string()))?;

    // Prepend nonce to ciphertext and encode as base64
    let mut result = nonce_bytes.to_vec();
    result.extend_from_slice(&ciphertext);

    Ok(BASE64.encode(&result))
}

/// Decrypt credentials from base64-encoded ciphertext
/// Expects nonce to be prepended to ciphertext
///
/// # Arguments
///
/// * `encrypted` - Base64-encoded string with format: [12-byte nonce][ciphertext]
///
/// # Returns
///
/// Decrypted JSON value
///
/// # Errors
///
/// Returns `EncryptionError` if:
/// - ENCRYPTION_KEY environment variable is not set
/// - Key is not valid base64 or not 32 bytes
/// - Encrypted data is not valid base64
/// - Encrypted data is too short (< 12 bytes)
/// - AES-GCM decryption fails (wrong key or tampered data)
/// - Decrypted data is not valid JSON
pub fn decrypt_credentials(encrypted: &str) -> Result<Value, EncryptionError> {
    // Get encryption key
    let key_bytes = get_encryption_key()?;
    if key_bytes.len() != 32 {
        return Err(EncryptionError::InvalidKeyFormat(format!(
            "Key must be 32 bytes, got {}",
            key_bytes.len()
        )));
    }

    // Create cipher
    let cipher = Aes256Gcm::new_from_slice(&key_bytes)
        .map_err(|e| EncryptionError::DecryptionFailed(e.to_string()))?;

    // Decode from base64
    let encrypted_bytes = BASE64
        .decode(encrypted.trim())
        .map_err(|e| EncryptionError::DecryptionFailed(format!("Base64 decode error: {}", e)))?;

    // Extract nonce (first 12 bytes) and ciphertext (rest)
    if encrypted_bytes.len() < 12 {
        return Err(EncryptionError::DecryptionFailed(
            "Encrypted data too short".to_string(),
        ));
    }

    let (nonce_bytes, ciphertext) = encrypted_bytes.split_at(12);
    let nonce = Nonce::from_slice(nonce_bytes);

    // Decrypt
    let plaintext = cipher
        .decrypt(nonce, ciphertext)
        .map_err(|e| EncryptionError::DecryptionFailed(e.to_string()))?;

    // Deserialize JSON
    let value: Value = serde_json::from_slice(&plaintext)?;

    Ok(value)
}
