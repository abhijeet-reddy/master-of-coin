//! Integration tests for API key scope enforcement.
//!
//! This module tests that API keys are properly restricted by their scopes
//! and that JWT tokens maintain full access.

use crate::common::*;
use chrono::Utc;
use master_of_coin_backend::models::{
    ApiKeyScopes, CreateApiKeyRequest, CreateApiKeyResponse, ScopePermission,
};
use serde_json::json;

// ============================================================================
// Scope Enforcement Tests - Accounts
// ============================================================================

/// Test API key with transaction-only scope CANNOT access accounts endpoint
#[tokio::test]
async fn test_api_key_transaction_scope_cannot_access_accounts() {
    let server = create_test_server().await;
    let timestamp = Utc::now().timestamp_nanos_opt().unwrap();

    let auth = register_test_user(
        &server,
        &format!("scope_test_{}", timestamp),
        &format!("scope_test_{}@example.com", timestamp),
        "SecurePass123!",
        "Scope Test User",
    )
    .await;

    // Create API key with ONLY transaction read permission
    let request = CreateApiKeyRequest {
        name: "Transaction Only Key".to_string(),
        scopes: ApiKeyScopes {
            transactions: vec![ScopePermission::Read],
            accounts: vec![], // NO account permissions
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

    // Try to access accounts endpoint with transaction-only API key
    let response = server
        .get("/api/v1/accounts")
        .add_header("Authorization", format!("Bearer {}", api_key))
        .await;

    // Should return 403 Forbidden due to insufficient permissions
    assert_status(&response, 403);
    let error_text = response.text();
    assert!(error_text.contains("Insufficient permissions"));
    assert!(error_text.contains("Accounts"));
}

/// Test API key with account read scope CAN access accounts list
#[tokio::test]
async fn test_api_key_account_read_scope_can_list_accounts() {
    let server = create_test_server().await;
    let timestamp = Utc::now().timestamp_nanos_opt().unwrap();

    let auth = register_test_user(
        &server,
        &format!("account_read_{}", timestamp),
        &format!("account_read_{}@example.com", timestamp),
        "SecurePass123!",
        "Account Read User",
    )
    .await;

    // Create API key with account read permission
    let request = CreateApiKeyRequest {
        name: "Account Read Key".to_string(),
        scopes: ApiKeyScopes {
            transactions: vec![],
            accounts: vec![ScopePermission::Read],
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

    // Access accounts endpoint with account read API key
    let response = server
        .get("/api/v1/accounts")
        .add_header("Authorization", format!("Bearer {}", api_key))
        .await;

    // Should return 200 OK
    assert_status(&response, 200);
}

/// Test API key with account read scope CANNOT create accounts
#[tokio::test]
async fn test_api_key_account_read_scope_cannot_create() {
    let server = create_test_server().await;
    let timestamp = Utc::now().timestamp_nanos_opt().unwrap();

    let auth = register_test_user(
        &server,
        &format!("account_readonly_{}", timestamp),
        &format!("account_readonly_{}@example.com", timestamp),
        "SecurePass123!",
        "Account ReadOnly User",
    )
    .await;

    // Create API key with ONLY account read permission
    let request = CreateApiKeyRequest {
        name: "Account ReadOnly Key".to_string(),
        scopes: ApiKeyScopes {
            transactions: vec![],
            accounts: vec![ScopePermission::Read], // Only read, no write
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

    // Try to create an account with read-only API key
    let account_request = json!({
        "name": "Test Account",
        "account_type": "CHECKING",
        "currency": "USD",
        "initial_balance": 1000.00
    });

    let response = server
        .post("/api/v1/accounts")
        .add_header("Authorization", format!("Bearer {}", api_key))
        .json(&account_request)
        .await;

    // Should return 403 Forbidden
    assert_status(&response, 403);
    let error_text = response.text();
    assert!(error_text.contains("Insufficient permissions"));
}

// ============================================================================
// Scope Enforcement Tests - JWT Full Access
// ============================================================================

/// Test JWT token has full access to all endpoints regardless of scopes
#[tokio::test]
async fn test_jwt_has_full_access_to_all_resources() {
    let server = create_test_server().await;
    let timestamp = Utc::now().timestamp_nanos_opt().unwrap();

    let auth = register_test_user(
        &server,
        &format!("jwt_full_{}", timestamp),
        &format!("jwt_full_{}@example.com", timestamp),
        "SecurePass123!",
        "JWT Full Access User",
    )
    .await;

    // Test access to all resource types with JWT token
    // Accounts
    let response = server
        .get("/api/v1/accounts")
        .add_header("Authorization", format!("Bearer {}", auth.token))
        .await;
    assert_status(&response, 200);

    // Transactions
    let response = server
        .get("/api/v1/transactions")
        .add_header("Authorization", format!("Bearer {}", auth.token))
        .await;
    assert_status(&response, 200);

    // Budgets
    let response = server
        .get("/api/v1/budgets")
        .add_header("Authorization", format!("Bearer {}", auth.token))
        .await;
    assert_status(&response, 200);

    // Categories
    let response = server
        .get("/api/v1/categories")
        .add_header("Authorization", format!("Bearer {}", auth.token))
        .await;
    assert_status(&response, 200);

    // People
    let response = server
        .get("/api/v1/people")
        .add_header("Authorization", format!("Bearer {}", auth.token))
        .await;
    assert_status(&response, 200);
}

// ============================================================================
// Scope Enforcement Tests - Multiple Resources
// ============================================================================

/// Test API key with multiple resource scopes works correctly
#[tokio::test]
async fn test_api_key_multiple_scopes() {
    let server = create_test_server().await;
    let timestamp = Utc::now().timestamp_nanos_opt().unwrap();

    let auth = register_test_user(
        &server,
        &format!("multi_scope_{}", timestamp),
        &format!("multi_scope_{}@example.com", timestamp),
        "SecurePass123!",
        "Multi Scope User",
    )
    .await;

    // Create API key with transactions and accounts read permissions
    let request = CreateApiKeyRequest {
        name: "Multi Scope Key".to_string(),
        scopes: ApiKeyScopes {
            transactions: vec![ScopePermission::Read],
            accounts: vec![ScopePermission::Read],
            budgets: vec![], // No budget permissions
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

    // Can access transactions
    let response = server
        .get("/api/v1/transactions")
        .add_header("Authorization", format!("Bearer {}", api_key))
        .await;
    assert_status(&response, 200);

    // Can access accounts
    let response = server
        .get("/api/v1/accounts")
        .add_header("Authorization", format!("Bearer {}", api_key))
        .await;
    assert_status(&response, 200);

    // Cannot access budgets
    let response = server
        .get("/api/v1/budgets")
        .add_header("Authorization", format!("Bearer {}", api_key))
        .await;
    assert_status(&response, 403);
}

// ============================================================================
// Scope Enforcement Tests - Write Operations
// ============================================================================

/// Test API key with write scope can perform write operations
#[tokio::test]
async fn test_api_key_write_scope_allows_write_operations() {
    let server = create_test_server().await;
    let timestamp = Utc::now().timestamp_nanos_opt().unwrap();

    let auth = register_test_user(
        &server,
        &format!("write_scope_{}", timestamp),
        &format!("write_scope_{}@example.com", timestamp),
        "SecurePass123!",
        "Write Scope User",
    )
    .await;

    // Create API key with account write permission
    let request = CreateApiKeyRequest {
        name: "Account Write Key".to_string(),
        scopes: ApiKeyScopes {
            transactions: vec![],
            accounts: vec![ScopePermission::Read, ScopePermission::Write],
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

    // Create an account with write permission
    let account_request = json!({
        "name": "Test Account",
        "account_type": "CHECKING",
        "currency": "USD",
        "initial_balance": 1000.00
    });

    let response = server
        .post("/api/v1/accounts")
        .add_header("Authorization", format!("Bearer {}", api_key))
        .json(&account_request)
        .await;

    // Should succeed with 201 Created
    assert_status(&response, 201);
}

// ============================================================================
// Scope Enforcement Tests - All Resources
// ============================================================================

/// Test scope enforcement across all resource types
#[tokio::test]
async fn test_scope_enforcement_all_resources() {
    let server = create_test_server().await;
    let timestamp = Utc::now().timestamp_nanos_opt().unwrap();

    let auth = register_test_user(
        &server,
        &format!("all_resources_{}", timestamp),
        &format!("all_resources_{}@example.com", timestamp),
        "SecurePass123!",
        "All Resources User",
    )
    .await;

    // Create API key with NO permissions
    let request = CreateApiKeyRequest {
        name: "No Permissions Key".to_string(),
        scopes: ApiKeyScopes::default(), // Empty scopes
        expires_in_days: Some(90),
    };

    // This should fail validation (no scopes)
    let create_response = server
        .post("/api/v1/api-keys")
        .add_header("Authorization", format!("Bearer {}", auth.token))
        .json(&request)
        .await;

    assert_status(&create_response, 422);
}
