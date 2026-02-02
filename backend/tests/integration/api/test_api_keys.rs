//! Integration tests for API key management endpoints.
//!
//! This module tests the API key endpoints including:
//! - Create API key (POST /api/v1/api-keys)
//! - List API keys (GET /api/v1/api-keys)
//! - Get API key (GET /api/v1/api-keys/:id)
//! - Update API key (PATCH /api/v1/api-keys/:id)
//! - Revoke API key (DELETE /api/v1/api-keys/:id)
//! - Authentication with API keys
//! - Scope enforcement
//!
//! Tests cover both success and error cases with proper validation
//! of status codes, response bodies, and error messages.

use crate::common::*;
use chrono::Utc;
use master_of_coin_backend::models::{
    ApiKeyScopes, CreateApiKeyRequest, CreateApiKeyResponse, ListApiKeysResponse, ScopePermission,
    UpdateApiKeyRequest,
};
use serde_json::json;

// ============================================================================
// Create API Key Tests
// ============================================================================

/// Test successful API key creation with valid scopes.
#[tokio::test]
async fn test_create_api_key_success() {
    let server = create_test_server().await;
    let timestamp = Utc::now().timestamp_nanos_opt().unwrap();

    // Register and login
    let auth = register_test_user(
        &server,
        &format!("apiuser_{}", timestamp),
        &format!("api_test_{}@example.com", timestamp),
        "SecurePass123!",
        "API Test User",
    )
    .await;

    // Create API key
    let request = CreateApiKeyRequest {
        name: "Test Integration".to_string(),
        scopes: ApiKeyScopes {
            transactions: vec![ScopePermission::Read, ScopePermission::Write],
            accounts: vec![ScopePermission::Read],
            budgets: vec![],
            categories: vec![],
            people: vec![],
        },
        expires_in_days: Some(90),
    };

    let response = server
        .post("/api/v1/api-keys")
        .add_header("Authorization", format!("Bearer {}", auth.token))
        .json(&request)
        .await;

    assert_status(&response, 201);

    let api_key_response: CreateApiKeyResponse = extract_json(response);

    // Validate response
    assert_eq!(api_key_response.name, "Test Integration");
    assert!(api_key_response.key.starts_with("moc_"));
    assert_eq!(api_key_response.key.len(), 36);
    assert!(api_key_response.key_prefix.starts_with("moc_"));
    assert!(api_key_response.expires_at.is_some());
}

/// Test API key creation with no scopes fails.
#[tokio::test]
async fn test_create_api_key_no_scopes() {
    let server = create_test_server().await;
    let timestamp = Utc::now().timestamp_nanos_opt().unwrap();

    let auth = register_test_user(
        &server,
        &format!("noscope_{}", timestamp),
        &format!("noscope_{}@example.com", timestamp),
        "SecurePass123!",
        "No Scope User",
    )
    .await;

    let request = CreateApiKeyRequest {
        name: "No Scopes Key".to_string(),
        scopes: ApiKeyScopes::default(), // Empty scopes
        expires_in_days: Some(90),
    };

    let response = server
        .post("/api/v1/api-keys")
        .add_header("Authorization", format!("Bearer {}", auth.token))
        .json(&request)
        .await;

    assert_status(&response, 422);
}

/// Test API key creation without authentication fails.
#[tokio::test]
async fn test_create_api_key_no_auth() {
    let server = create_test_server().await;

    let request = CreateApiKeyRequest {
        name: "Unauthorized Key".to_string(),
        scopes: ApiKeyScopes {
            transactions: vec![ScopePermission::Read],
            accounts: vec![],
            budgets: vec![],
            categories: vec![],
            people: vec![],
        },
        expires_in_days: Some(90),
    };

    let response = server.post("/api/v1/api-keys").json(&request).await;

    assert_status(&response, 401);
}

// ============================================================================
// List API Keys Tests
// ============================================================================

/// Test listing API keys returns all user's keys.
#[tokio::test]
async fn test_list_api_keys_success() {
    let server = create_test_server().await;
    let timestamp = Utc::now().timestamp_nanos_opt().unwrap();

    let auth = register_test_user(
        &server,
        &format!("listuser_{}", timestamp),
        &format!("list_{}@example.com", timestamp),
        "SecurePass123!",
        "List Test User",
    )
    .await;

    // Create two API keys
    for i in 1..=2 {
        let request = CreateApiKeyRequest {
            name: format!("Key {}", i),
            scopes: ApiKeyScopes {
                transactions: vec![ScopePermission::Read],
                accounts: vec![],
                budgets: vec![],
                categories: vec![],
                people: vec![],
            },
            expires_in_days: Some(90),
        };

        let response = server
            .post("/api/v1/api-keys")
            .add_header("Authorization", format!("Bearer {}", auth.token))
            .json(&request)
            .await;

        assert_status(&response, 201);
    }

    // List API keys
    let response = server
        .get("/api/v1/api-keys")
        .add_header("Authorization", format!("Bearer {}", auth.token))
        .await;

    assert_status(&response, 200);

    let list_response: ListApiKeysResponse = extract_json(response);
    assert_eq!(list_response.api_keys.len(), 2);
}

// ============================================================================
// Authentication with API Key Tests
// ============================================================================

/// Test using API key for authentication works.
#[tokio::test]
async fn test_authenticate_with_api_key() {
    let server = create_test_server().await;
    let timestamp = Utc::now().timestamp_nanos_opt().unwrap();

    let auth = register_test_user(
        &server,
        &format!("authkey_{}", timestamp),
        &format!("authkey_{}@example.com", timestamp),
        "SecurePass123!",
        "Auth Key User",
    )
    .await;

    // Create API key with transaction read permission
    let request = CreateApiKeyRequest {
        name: "Auth Test Key".to_string(),
        scopes: ApiKeyScopes {
            transactions: vec![ScopePermission::Read],
            accounts: vec![],
            budgets: vec![],
            categories: vec![],
            people: vec![],
        },
        expires_in_days: Some(90),
    };

    let create_response = server
        .post("/api/v1/api-keys")
        .add_header("Authorization", format!("Bearer {}", auth.token))
        .json(&request)
        .await;

    assert_status(&create_response, 201);

    let api_key_response: CreateApiKeyResponse = extract_json(create_response);
    let api_key = api_key_response.key;

    // Use API key to access transactions endpoint
    let response = server
        .get("/api/v1/transactions")
        .add_header("Authorization", format!("Bearer {}", api_key))
        .await;

    assert_status(&response, 200);
}

/// Test API key without required scope fails with 403.
#[tokio::test]
async fn test_api_key_insufficient_permissions() {
    let server = create_test_server().await;
    let timestamp = Utc::now().timestamp_nanos_opt().unwrap();

    let auth = register_test_user(
        &server,
        &format!("noperm_{}", timestamp),
        &format!("noperm_{}@example.com", timestamp),
        "SecurePass123!",
        "No Perm User",
    )
    .await;

    // Create API key with only transaction read permission
    let request = CreateApiKeyRequest {
        name: "Limited Key".to_string(),
        scopes: ApiKeyScopes {
            transactions: vec![ScopePermission::Read],
            accounts: vec![], // No account permissions
            budgets: vec![],
            categories: vec![],
            people: vec![],
        },
        expires_in_days: Some(90),
    };

    let create_response = server
        .post("/api/v1/api-keys")
        .add_header("Authorization", format!("Bearer {}", auth.token))
        .json(&request)
        .await;

    assert_status(&create_response, 201);

    let api_key_response: CreateApiKeyResponse = extract_json(create_response);
    let api_key = api_key_response.key;

    // Try to access accounts endpoint without permission (should fail with 403)
    let response = server
        .get("/api/v1/accounts")
        .add_header("Authorization", format!("Bearer {}", api_key))
        .await;

    // Should return 403 Forbidden due to scope enforcement middleware
    assert_status(&response, 403);

    // Verify error message
    let error_text = response.text();
    assert!(error_text.contains("Insufficient permissions"));
    assert!(error_text.contains("Accounts"));
}

/// Test invalid API key format fails with 401.
#[tokio::test]
async fn test_invalid_api_key_format() {
    let server = create_test_server().await;

    let invalid_keys = vec![
        "invalid_key",
        "moc_short",
        "wrong_prefix_k7Hj9pL2mN4qR8sT1vW3xY5zA6bC",
    ];

    for invalid_key in invalid_keys {
        let response = server
            .get("/api/v1/transactions")
            .add_header("Authorization", format!("Bearer {}", invalid_key))
            .await;

        assert_status(&response, 401);
    }
}

// ============================================================================
// Revoke API Key Tests
// ============================================================================

/// Test revoking an API key prevents its use.
#[tokio::test]
async fn test_revoke_api_key() {
    let server = create_test_server().await;
    let timestamp = Utc::now().timestamp_nanos_opt().unwrap();

    let auth = register_test_user(
        &server,
        &format!("revokeuser_{}", timestamp),
        &format!("revoke_{}@example.com", timestamp),
        "SecurePass123!",
        "Revoke Test User",
    )
    .await;

    // Create API key
    let request = CreateApiKeyRequest {
        name: "To Be Revoked".to_string(),
        scopes: ApiKeyScopes {
            transactions: vec![ScopePermission::Read],
            accounts: vec![],
            budgets: vec![],
            categories: vec![],
            people: vec![],
        },
        expires_in_days: Some(90),
    };

    let create_response = server
        .post("/api/v1/api-keys")
        .add_header("Authorization", format!("Bearer {}", auth.token))
        .json(&request)
        .await;

    assert_status(&create_response, 201);

    let api_key_response: CreateApiKeyResponse = extract_json(create_response);
    let api_key = api_key_response.key.clone();
    let api_key_id = api_key_response.id;

    // Verify API key works
    let response = server
        .get("/api/v1/transactions")
        .add_header("Authorization", format!("Bearer {}", api_key))
        .await;

    assert_status(&response, 200);

    // Revoke the API key
    let revoke_response = server
        .delete(&format!("/api/v1/api-keys/{}", api_key_id))
        .add_header("Authorization", format!("Bearer {}", auth.token))
        .await;

    assert_status(&revoke_response, 204);

    // Try to use revoked API key (should fail)
    let response = server
        .get("/api/v1/transactions")
        .add_header("Authorization", format!("Bearer {}", api_key))
        .await;

    assert_status(&response, 401);
}

// ============================================================================
// Update API Key Tests
// ============================================================================

/// Test updating API key name.
#[tokio::test]
async fn test_update_api_key_name() {
    let server = create_test_server().await;
    let timestamp = Utc::now().timestamp_nanos_opt().unwrap();

    let auth = register_test_user(
        &server,
        &format!("updateuser_{}", timestamp),
        &format!("update_{}@example.com", timestamp),
        "SecurePass123!",
        "Update Test User",
    )
    .await;

    // Create API key
    let request = CreateApiKeyRequest {
        name: "Original Name".to_string(),
        scopes: ApiKeyScopes {
            transactions: vec![ScopePermission::Read],
            accounts: vec![],
            budgets: vec![],
            categories: vec![],
            people: vec![],
        },
        expires_in_days: Some(90),
    };

    let create_response = server
        .post("/api/v1/api-keys")
        .add_header("Authorization", format!("Bearer {}", auth.token))
        .json(&request)
        .await;

    assert_status(&create_response, 201);

    let api_key_response: CreateApiKeyResponse = extract_json(create_response);
    let api_key_id = api_key_response.id;

    // Update the name
    let update_request = UpdateApiKeyRequest {
        name: Some("Updated Name".to_string()),
        expires_in_days: None,
        scopes: None,
    };

    let update_response = server
        .patch(&format!("/api/v1/api-keys/{}", api_key_id))
        .add_header("Authorization", format!("Bearer {}", auth.token))
        .json(&update_request)
        .await;

    assert_status(&update_response, 200);

    // Verify the name was updated
    let get_response = server
        .get(&format!("/api/v1/api-keys/{}", api_key_id))
        .add_header("Authorization", format!("Bearer {}", auth.token))
        .await;

    assert_status(&get_response, 200);

    let response_text = get_response.text();
    assert!(response_text.contains("Updated Name"));
}

// ============================================================================
// Scope Validation Tests
// ============================================================================

/// Test API key scopes are properly validated.
#[tokio::test]
async fn test_api_key_scopes() {
    let server = create_test_server().await;
    let timestamp = Utc::now().timestamp_nanos_opt().unwrap();

    let auth = register_test_user(
        &server,
        &format!("scopeuser_{}", timestamp),
        &format!("scope_{}@example.com", timestamp),
        "SecurePass123!",
        "Scope Test User",
    )
    .await;

    // Create API key with specific scopes
    let request = CreateApiKeyRequest {
        name: "Scoped Key".to_string(),
        scopes: ApiKeyScopes {
            transactions: vec![ScopePermission::Read, ScopePermission::Write],
            accounts: vec![ScopePermission::Read],
            budgets: vec![],
            categories: vec![],
            people: vec![],
        },
        expires_in_days: None, // Never expires
    };

    let create_response = server
        .post("/api/v1/api-keys")
        .add_header("Authorization", format!("Bearer {}", auth.token))
        .json(&request)
        .await;

    assert_status(&create_response, 201);

    let api_key_response: CreateApiKeyResponse = extract_json(create_response);

    // Verify scopes in response
    assert_eq!(api_key_response.scopes.transactions.len(), 2);
    assert_eq!(api_key_response.scopes.accounts.len(), 1);
    assert_eq!(api_key_response.scopes.budgets.len(), 0);
}

// ============================================================================
// Expiration Tests
// ============================================================================

/// Test API key with never expires option.
#[tokio::test]
async fn test_create_api_key_never_expires() {
    let server = create_test_server().await;
    let timestamp = Utc::now().timestamp_nanos_opt().unwrap();

    let auth = register_test_user(
        &server,
        &format!("neverexp_{}", timestamp),
        &format!("neverexp_{}@example.com", timestamp),
        "SecurePass123!",
        "Never Expire User",
    )
    .await;

    let request = CreateApiKeyRequest {
        name: "Permanent Key".to_string(),
        scopes: ApiKeyScopes {
            transactions: vec![ScopePermission::Read],
            accounts: vec![],
            budgets: vec![],
            categories: vec![],
            people: vec![],
        },
        expires_in_days: None, // Never expires
    };

    let response = server
        .post("/api/v1/api-keys")
        .add_header("Authorization", format!("Bearer {}", auth.token))
        .json(&request)
        .await;

    assert_status(&response, 201);

    let api_key_response: CreateApiKeyResponse = extract_json(response);
    assert!(api_key_response.expires_at.is_none());
}

// ============================================================================
// Ownership Tests
// ============================================================================

/// Test user cannot access another user's API key.
#[tokio::test]
async fn test_api_key_ownership() {
    let server = create_test_server().await;
    let timestamp = Utc::now().timestamp_nanos_opt().unwrap();

    // Create two users
    let auth1 = register_test_user(
        &server,
        &format!("owner1_{}", timestamp),
        &format!("owner1_{}@example.com", timestamp),
        "SecurePass123!",
        "Owner 1",
    )
    .await;

    let auth2 = register_test_user(
        &server,
        &format!("owner2_{}", timestamp),
        &format!("owner2_{}@example.com", timestamp),
        "SecurePass123!",
        "Owner 2",
    )
    .await;

    // User 1 creates an API key
    let request = CreateApiKeyRequest {
        name: "User 1 Key".to_string(),
        scopes: ApiKeyScopes {
            transactions: vec![ScopePermission::Read],
            accounts: vec![],
            budgets: vec![],
            categories: vec![],
            people: vec![],
        },
        expires_in_days: Some(90),
    };

    let create_response = server
        .post("/api/v1/api-keys")
        .add_header("Authorization", format!("Bearer {}", auth1.token))
        .json(&request)
        .await;

    assert_status(&create_response, 201);

    let api_key_response: CreateApiKeyResponse = extract_json(create_response);
    let api_key_id = api_key_response.id;

    // User 2 tries to access User 1's API key (should fail)
    let response = server
        .get(&format!("/api/v1/api-keys/{}", api_key_id))
        .add_header("Authorization", format!("Bearer {}", auth2.token))
        .await;

    assert_status(&response, 403);
}

// ============================================================================
// Key Format Tests
// ============================================================================

/// Test generated API keys have correct format.
#[tokio::test]
async fn test_api_key_format() {
    let server = create_test_server().await;
    let timestamp = Utc::now().timestamp_nanos_opt().unwrap();

    let auth = register_test_user(
        &server,
        &format!("formatuser_{}", timestamp),
        &format!("format_{}@example.com", timestamp),
        "SecurePass123!",
        "Format Test User",
    )
    .await;

    let request = CreateApiKeyRequest {
        name: "Format Test Key".to_string(),
        scopes: ApiKeyScopes {
            transactions: vec![ScopePermission::Read],
            accounts: vec![],
            budgets: vec![],
            categories: vec![],
            people: vec![],
        },
        expires_in_days: Some(90),
    };

    let response = server
        .post("/api/v1/api-keys")
        .add_header("Authorization", format!("Bearer {}", auth.token))
        .json(&request)
        .await;

    assert_status(&response, 201);

    let api_key_response: CreateApiKeyResponse = extract_json(response);

    // Verify format
    assert!(api_key_response.key.starts_with("moc_"));
    assert_eq!(api_key_response.key.len(), 36); // 4 (moc_) + 32 (random)
    assert!(api_key_response.key_prefix.starts_with("moc_"));
    assert_eq!(api_key_response.key_prefix.len(), 12);

    // Verify key is alphanumeric after prefix
    let key_part = &api_key_response.key[4..];
    assert!(key_part.chars().all(|c| c.is_ascii_alphanumeric()));
}
