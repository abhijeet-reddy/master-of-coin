use master_of_coin_backend::utils::{EncryptionError, decrypt_credentials, encrypt_credentials};
use serde_json::json;
use serial_test::serial;
use std::env;

// Test keys: 32 bytes base64-encoded
const TEST_KEY: &str = "aO42n1ptrggkyZKYtsFS2wwsu8+Y9mFhNQ4oAide1Ko=";
const TEST_KEY_ALT: &str = "/RxRYF1i7ojXt8Zl0pRUQZGpKq23KaZ3VUXFlsRCses=";

#[test]
#[serial]
fn test_encrypt_decrypt_roundtrip() {
    // Set test encryption key (32 bytes base64-encoded)
    unsafe {
        env::set_var("ENCRYPTION_KEY", TEST_KEY);
    }

    let original = json!({
        "access_token": "test_token_123",
        "refresh_token": "refresh_456",
        "user_id": 12345,
        "expires_at": "2026-12-31T23:59:59Z"
    });

    // Encrypt
    let encrypted = encrypt_credentials(&original).expect("Encryption should succeed");

    // Verify it's base64
    assert!(!encrypted.is_empty());
    assert!(
        encrypted
            .chars()
            .all(|c| c.is_alphanumeric() || c == '+' || c == '/' || c == '=')
    );

    // Decrypt
    let decrypted = decrypt_credentials(&encrypted).expect("Decryption should succeed");

    // Verify
    assert_eq!(original, decrypted);
}

#[test]
#[serial]
fn test_encrypt_different_nonces() {
    unsafe {
        env::set_var("ENCRYPTION_KEY", TEST_KEY);
    }

    let data = json!({"test": "value"});

    // Encrypt twice
    let encrypted1 = encrypt_credentials(&data).expect("Encryption should succeed");
    let encrypted2 = encrypt_credentials(&data).expect("Encryption should succeed");

    // Should be different due to random nonces
    assert_ne!(encrypted1, encrypted2);

    // But both should decrypt to same value
    let decrypted1 = decrypt_credentials(&encrypted1).expect("Decryption should succeed");
    let decrypted2 = decrypt_credentials(&encrypted2).expect("Decryption should succeed");
    assert_eq!(decrypted1, decrypted2);
    assert_eq!(data, decrypted1);
}

#[test]
#[serial]
fn test_decrypt_invalid_base64() {
    unsafe {
        env::set_var("ENCRYPTION_KEY", TEST_KEY);
    }

    let result = decrypt_credentials("invalid_base64!");
    assert!(result.is_err());
    match result {
        Err(EncryptionError::DecryptionFailed(_)) => (),
        _ => panic!("Expected DecryptionFailed error"),
    }
}

#[test]
#[serial]
fn test_decrypt_too_short() {
    unsafe {
        env::set_var("ENCRYPTION_KEY", TEST_KEY);
    }

    // Base64 of less than 12 bytes
    let result = decrypt_credentials("YWJjZGVm"); // "abcdef" in base64
    assert!(result.is_err());
    match result {
        Err(EncryptionError::DecryptionFailed(_)) => (),
        _ => panic!("Expected DecryptionFailed error"),
    }
}

#[test]
#[serial]
fn test_decrypt_tampered_data() {
    unsafe {
        env::set_var("ENCRYPTION_KEY", TEST_KEY);
    }

    let original = json!({"test": "value"});
    let mut encrypted = encrypt_credentials(&original).expect("Encryption should succeed");

    // Tamper with the encrypted data
    encrypted.push('X');

    let result = decrypt_credentials(&encrypted);
    assert!(result.is_err());
}

#[test]
#[serial]
fn test_decrypt_wrong_key() {
    // Encrypt with one key
    unsafe {
        env::set_var("ENCRYPTION_KEY", TEST_KEY);
    }
    let data = json!({"test": "value"});
    let encrypted = encrypt_credentials(&data).expect("Encryption should succeed");

    // Try to decrypt with different key
    unsafe {
        env::set_var("ENCRYPTION_KEY", TEST_KEY_ALT);
    }
    let result = decrypt_credentials(&encrypted);
    assert!(result.is_err());
    match result {
        Err(EncryptionError::DecryptionFailed(_)) => (),
        _ => panic!("Expected DecryptionFailed error"),
    }
}

#[test]
#[serial]
fn test_missing_encryption_key() {
    unsafe {
        env::remove_var("ENCRYPTION_KEY");
    }

    let data = json!({"test": "value"});
    let result = encrypt_credentials(&data);

    assert!(result.is_err());
    match result {
        Err(EncryptionError::KeyNotConfigured) => (),
        _ => panic!("Expected KeyNotConfigured error"),
    }
}

#[test]
#[serial]
fn test_invalid_key_length() {
    // Set a key that's not 32 bytes when decoded
    unsafe {
        env::set_var("ENCRYPTION_KEY", "c2hvcnRrZXk="); // "shortkey" in base64 (8 bytes)
    }

    let data = json!({"test": "value"});
    let result = encrypt_credentials(&data);

    assert!(result.is_err());
    match result {
        Err(EncryptionError::InvalidKeyFormat(_)) => (),
        _ => panic!("Expected InvalidKeyFormat error"),
    }
}

#[test]
#[serial]
fn test_encrypt_complex_json() {
    unsafe {
        env::set_var("ENCRYPTION_KEY", TEST_KEY);
    }

    let complex_data = json!({
        "access_token": "very_long_token_string_with_special_chars_!@#$%",
        "refresh_token": "another_long_token",
        "expires_at": "2026-12-31T23:59:59Z",
        "user_info": {
            "id": 12345,
            "name": "Test User",
            "email": "test@example.com",
            "friends": [1, 2, 3, 4, 5]
        },
        "metadata": {
            "created": "2026-01-01T00:00:00Z",
            "last_used": null
        }
    });

    let encrypted = encrypt_credentials(&complex_data).expect("Encryption should succeed");
    let decrypted = decrypt_credentials(&encrypted).expect("Decryption should succeed");

    assert_eq!(complex_data, decrypted);
}
