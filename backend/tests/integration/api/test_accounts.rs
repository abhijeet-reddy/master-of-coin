//! Integration tests for account API endpoints.
//!
//! This module tests the account endpoints including:
//! - GET /api/v1/accounts - List all accounts for user
//! - POST /api/v1/accounts - Create new account
//! - GET /api/v1/accounts/:id - Get specific account
//! - PUT /api/v1/accounts/:id - Update account
//! - DELETE /api/v1/accounts/:id - Delete account
//!
//! Tests cover success cases, error cases, authorization, and data isolation.

use crate::common::*;
use chrono::Utc;
use master_of_coin_backend::{
    models::AccountResponse,
    types::{AccountType, CurrencyCode},
};
use serde_json::json;

// ============================================================================
// List Accounts Tests
// ============================================================================

/// Test that a new user has no accounts initially.
///
/// Verifies that:
/// - Status code is 200 OK
/// - Response is an empty array
/// - No accounts exist for a newly registered user
#[tokio::test]
async fn test_list_accounts_empty() {
    let server = create_test_server().await;
    let timestamp = Utc::now().timestamp_nanos_opt().unwrap();

    // Register a new user
    let auth = register_test_user(
        &server,
        &format!("emptyuser_{}", timestamp),
        &format!("empty_{}@example.com", timestamp),
        "SecurePass123!",
        "Empty Test User",
    )
    .await;

    // List accounts should return empty array
    let response = get_authenticated(&server, "/api/v1/accounts", &auth.token).await;
    assert_status(&response, 200);

    let accounts: Vec<AccountResponse> = extract_json(response);
    assert_eq!(accounts.len(), 0, "New user should have no accounts");
}

/// Test that list accounts returns user's accounts.
///
/// Verifies that:
/// - Status code is 200 OK
/// - Response contains all user's accounts
/// - Account data is correct
#[tokio::test]
async fn test_list_accounts_with_data() {
    let server = create_test_server().await;
    let timestamp = Utc::now().timestamp_nanos_opt().unwrap();

    // Register a user
    let auth = register_test_user(
        &server,
        &format!("listuser_{}", timestamp),
        &format!("list_{}@example.com", timestamp),
        "SecurePass123!",
        "List Test User",
    )
    .await;

    // Create multiple accounts
    let account1 = json!({
        "name": "Checking Account",
        "account_type": "CHECKING",
        "currency": "USD",
        "initial_balance": 1000.0
    });
    let response1 = post_authenticated(&server, "/api/v1/accounts", &auth.token, &account1).await;
    assert_status(&response1, 201);

    let account2 = json!({
        "name": "Savings Account",
        "account_type": "SAVINGS",
        "currency": "EUR",
        "initial_balance": 5000.0
    });
    let response2 = post_authenticated(&server, "/api/v1/accounts", &auth.token, &account2).await;
    assert_status(&response2, 201);

    // List accounts
    let response = get_authenticated(&server, "/api/v1/accounts", &auth.token).await;
    assert_status(&response, 200);

    let accounts: Vec<AccountResponse> = extract_json(response);
    assert_eq!(accounts.len(), 2, "User should have 2 accounts");

    // Verify account details
    let checking = accounts
        .iter()
        .find(|a| a.name == "Checking Account")
        .unwrap();
    assert_eq!(checking.account_type, AccountType::Checking);
    assert_eq!(checking.currency, CurrencyCode::Usd);

    let savings = accounts
        .iter()
        .find(|a| a.name == "Savings Account")
        .unwrap();
    assert_eq!(savings.account_type, AccountType::Savings);
    assert_eq!(savings.currency, CurrencyCode::Eur);
}

/// Test that listing accounts without authentication fails.
///
/// Verifies that:
/// - Status code is 401 Unauthorized
/// - Error message indicates missing authentication
#[tokio::test]
async fn test_list_accounts_unauthorized() {
    let server = create_test_server().await;

    // Try to list accounts without token
    let response = get_unauthenticated(&server, "/api/v1/accounts").await;
    assert_status(&response, 401);

    let error_text = response.text();
    assert!(
        error_text.to_lowercase().contains("unauthorized")
            || error_text.to_lowercase().contains("token"),
        "Error message should indicate missing authentication"
    );
}

/// Test that users can only see their own accounts (data isolation).
///
/// Verifies that:
/// - User A can see their accounts
/// - User B can see their accounts
/// - User A cannot see User B's accounts
/// - User B cannot see User A's accounts
#[tokio::test]
async fn test_list_accounts_isolation() {
    let server = create_test_server().await;
    let timestamp = Utc::now().timestamp_nanos_opt().unwrap();

    // Register two users
    let auth_a = register_test_user(
        &server,
        &format!("usera_{}", timestamp),
        &format!("usera_{}@example.com", timestamp),
        "SecurePass123!",
        "User A",
    )
    .await;

    let auth_b = register_test_user(
        &server,
        &format!("userb_{}", timestamp),
        &format!("userb_{}@example.com", timestamp),
        "SecurePass123!",
        "User B",
    )
    .await;

    // User A creates an account
    let account_a = json!({
        "name": "User A Account",
        "account_type": "CHECKING",
        "currency": "USD"
    });
    let response_a =
        post_authenticated(&server, "/api/v1/accounts", &auth_a.token, &account_a).await;
    assert_status(&response_a, 201);

    // User B creates an account
    let account_b = json!({
        "name": "User B Account",
        "account_type": "SAVINGS",
        "currency": "EUR"
    });
    let response_b =
        post_authenticated(&server, "/api/v1/accounts", &auth_b.token, &account_b).await;
    assert_status(&response_b, 201);

    // User A lists accounts - should only see their own
    let response_a = get_authenticated(&server, "/api/v1/accounts", &auth_a.token).await;
    assert_status(&response_a, 200);
    let accounts_a: Vec<AccountResponse> = extract_json(response_a);
    assert_eq!(accounts_a.len(), 1);
    assert_eq!(accounts_a[0].name, "User A Account");

    // User B lists accounts - should only see their own
    let response_b = get_authenticated(&server, "/api/v1/accounts", &auth_b.token).await;
    assert_status(&response_b, 200);
    let accounts_b: Vec<AccountResponse> = extract_json(response_b);
    assert_eq!(accounts_b.len(), 1);
    assert_eq!(accounts_b[0].name, "User B Account");
}

// ============================================================================
// Create Account Tests
// ============================================================================

/// Test successful account creation with all fields.
///
/// Verifies that:
/// - Status code is 201 Created
/// - Response contains account data
/// - Account ID is a valid UUID
/// - All fields are correctly set
#[tokio::test]
async fn test_create_account_success() {
    let server = create_test_server().await;
    let timestamp = Utc::now().timestamp_nanos_opt().unwrap();

    let auth = register_test_user(
        &server,
        &format!("createuser_{}", timestamp),
        &format!("create_{}@example.com", timestamp),
        "SecurePass123!",
        "Create Test User",
    )
    .await;

    let request = json!({
        "name": "My Checking Account",
        "account_type": "CHECKING",
        "currency": "USD",
        "initial_balance": 1500.50,
        "notes": "Primary checking account"
    });

    let response = post_authenticated(&server, "/api/v1/accounts", &auth.token, &request).await;
    assert_status(&response, 201);

    let account: AccountResponse = extract_json(response);
    assert_eq!(account.name, "My Checking Account");
    assert_eq!(account.account_type, AccountType::Checking);
    assert_eq!(account.currency, CurrencyCode::Usd);
    assert_eq!(account.user_id, auth.user.id);
    assert!(account.notes.is_some());
    assert_eq!(account.notes.unwrap(), "Primary checking account");
}

/// Test creating accounts with all account types.
///
/// Verifies that:
/// - All account types can be created successfully
/// - Each account type is correctly stored
#[tokio::test]
async fn test_create_account_all_types() {
    let server = create_test_server().await;
    let timestamp = Utc::now().timestamp_nanos_opt().unwrap();

    let auth = register_test_user(
        &server,
        &format!("typesuser_{}", timestamp),
        &format!("types_{}@example.com", timestamp),
        "SecurePass123!",
        "Types Test User",
    )
    .await;

    let account_types = vec![
        ("CHECKING", AccountType::Checking),
        ("SAVINGS", AccountType::Savings),
        ("CREDIT_CARD", AccountType::CreditCard),
        ("INVESTMENT", AccountType::Investment),
        ("CASH", AccountType::Cash),
    ];

    for (type_str, expected_type) in account_types {
        let request = json!({
            "name": format!("{} Account", type_str),
            "account_type": type_str,
            "currency": "USD"
        });

        let response = post_authenticated(&server, "/api/v1/accounts", &auth.token, &request).await;
        assert_status(&response, 201);

        let account: AccountResponse = extract_json(response);
        assert_eq!(
            account.account_type, expected_type,
            "Account type should be {}",
            type_str
        );
    }

    // Verify all accounts were created
    let list_response = get_authenticated(&server, "/api/v1/accounts", &auth.token).await;
    assert_status(&list_response, 200);
    let accounts: Vec<AccountResponse> = extract_json(list_response);
    assert_eq!(accounts.len(), 5, "Should have created 5 accounts");
}

/// Test that creating account with missing required fields fails.
///
/// Verifies that:
/// - Missing name fails with 400
/// - Missing account_type fails with 400
/// - Error messages indicate validation failure
#[tokio::test]
async fn test_create_account_missing_fields() {
    let server = create_test_server().await;
    let timestamp = Utc::now().timestamp_nanos_opt().unwrap();

    let auth = register_test_user(
        &server,
        &format!("missinguser_{}", timestamp),
        &format!("missing_{}@example.com", timestamp),
        "SecurePass123!",
        "Missing Test User",
    )
    .await;

    // Missing name
    let missing_name = json!({
        "account_type": "CHECKING",
        "currency": "USD"
    });
    let response =
        post_authenticated(&server, "/api/v1/accounts", &auth.token, &missing_name).await;
    assert_status(&response, 422);

    // Missing account_type
    let missing_type = json!({
        "name": "Test Account",
        "currency": "USD"
    });
    let response =
        post_authenticated(&server, "/api/v1/accounts", &auth.token, &missing_type).await;
    assert_status(&response, 422);

    // Both missing
    let both_missing = json!({
        "currency": "USD"
    });
    let response =
        post_authenticated(&server, "/api/v1/accounts", &auth.token, &both_missing).await;
    assert_status(&response, 422);
}

/// Test that creating account with invalid account type fails.
///
/// Verifies that:
/// - Status code is 400 Bad Request
/// - Error message indicates invalid account type
#[tokio::test]
async fn test_create_account_invalid_type() {
    let server = create_test_server().await;
    let timestamp = Utc::now().timestamp_nanos_opt().unwrap();

    let auth = register_test_user(
        &server,
        &format!("invalidtype_{}", timestamp),
        &format!("invalidtype_{}@example.com", timestamp),
        "SecurePass123!",
        "Invalid Type User",
    )
    .await;

    let invalid_types = vec!["InvalidType", "checking", "savings", "Unknown"];

    for invalid_type in invalid_types {
        let request = json!({
            "name": "Test Account",
            "account_type": invalid_type,
            "currency": "USD"
        });

        let response = post_authenticated(&server, "/api/v1/accounts", &auth.token, &request).await;
        assert_status(&response, 422);

        let error_text = response.text();
        assert!(
            error_text.to_lowercase().contains("account")
                || error_text.to_lowercase().contains("type")
                || error_text.to_lowercase().contains("invalid"),
            "Error should mention account type for: {}",
            invalid_type
        );
    }
}

/// Test that creating account with invalid currency code fails.
///
/// Verifies that:
/// - Status code is 400 Bad Request
/// - Error message indicates invalid currency
#[tokio::test]
async fn test_create_account_invalid_currency() {
    let server = create_test_server().await;
    let timestamp = Utc::now().timestamp_nanos_opt().unwrap();

    let auth = register_test_user(
        &server,
        &format!("invalidcurr_{}", timestamp),
        &format!("invalidcurr_{}@example.com", timestamp),
        "SecurePass123!",
        "Invalid Currency User",
    )
    .await;

    let invalid_currencies = vec!["XXX", "usd", "INVALID", "123"];

    for invalid_currency in invalid_currencies {
        let request = json!({
            "name": "Test Account",
            "account_type": "CHECKING",
            "currency": invalid_currency
        });

        let response = post_authenticated(&server, "/api/v1/accounts", &auth.token, &request).await;
        assert_status(&response, 422);

        let error_text = response.text();
        assert!(
            error_text.to_lowercase().contains("currency")
                || error_text.to_lowercase().contains("invalid"),
            "Error should mention currency for: {}",
            invalid_currency
        );
    }
}

/// Test that creating account without authentication fails.
///
/// Verifies that:
/// - Status code is 401 Unauthorized
/// - Error message indicates missing authentication
#[tokio::test]
async fn test_create_account_unauthorized() {
    let server = create_test_server().await;

    let request = json!({
        "name": "Test Account",
        "account_type": "CHECKING",
        "currency": "USD"
    });

    let response = post_unauthenticated(&server, "/api/v1/accounts", &request).await;
    assert_status(&response, 401);

    let error_text = response.text();
    assert!(
        error_text.to_lowercase().contains("unauthorized")
            || error_text.to_lowercase().contains("token"),
        "Error message should indicate missing authentication"
    );
}

// ============================================================================
// Get Account Tests
// ============================================================================

/// Test successful retrieval of a specific account.
///
/// Verifies that:
/// - Status code is 200 OK
/// - Response contains correct account data
/// - All fields match the created account
#[tokio::test]
async fn test_get_account_success() {
    let server = create_test_server().await;
    let timestamp = Utc::now().timestamp_nanos_opt().unwrap();

    let auth = register_test_user(
        &server,
        &format!("getuser_{}", timestamp),
        &format!("get_{}@example.com", timestamp),
        "SecurePass123!",
        "Get Test User",
    )
    .await;

    // Create an account
    let create_request = json!({
        "name": "Test Account",
        "account_type": "SAVINGS",
        "currency": "GBP",
        "notes": "Test notes"
    });
    let create_response =
        post_authenticated(&server, "/api/v1/accounts", &auth.token, &create_request).await;
    assert_status(&create_response, 201);
    let created_account: AccountResponse = extract_json(create_response);

    // Get the account
    let get_response = get_authenticated(
        &server,
        &format!("/api/v1/accounts/{}", created_account.id),
        &auth.token,
    )
    .await;
    assert_status(&get_response, 200);

    let account: AccountResponse = extract_json(get_response);
    assert_eq!(account.id, created_account.id);
    assert_eq!(account.name, "Test Account");
    assert_eq!(account.account_type, AccountType::Savings);
    assert_eq!(account.currency, CurrencyCode::Gbp);
}

/// Test that getting a non-existent account fails.
///
/// Verifies that:
/// - Status code is 404 Not Found
/// - Error message indicates account not found
#[tokio::test]
async fn test_get_account_not_found() {
    let server = create_test_server().await;
    let timestamp = Utc::now().timestamp_nanos_opt().unwrap();

    let auth = register_test_user(
        &server,
        &format!("notfounduser_{}", timestamp),
        &format!("notfound_{}@example.com", timestamp),
        "SecurePass123!",
        "Not Found User",
    )
    .await;

    // Try to get a non-existent account
    let fake_id = uuid::Uuid::new_v4();
    let response = get_authenticated(
        &server,
        &format!("/api/v1/accounts/{}", fake_id),
        &auth.token,
    )
    .await;
    assert_status(&response, 404);

    let error_text = response.text();
    assert!(
        error_text.to_lowercase().contains("not found")
            || error_text.to_lowercase().contains("account"),
        "Error message should indicate account not found"
    );
}

/// Test that users cannot access other users' accounts.
///
/// Verifies that:
/// - Status code is 403 Forbidden or 404 Not Found
/// - User A cannot access User B's account
#[tokio::test]
async fn test_get_account_wrong_user() {
    let server = create_test_server().await;
    let timestamp = Utc::now().timestamp_nanos_opt().unwrap();

    // Register two users
    let auth_a = register_test_user(
        &server,
        &format!("wrongusera_{}", timestamp),
        &format!("wrongusera_{}@example.com", timestamp),
        "SecurePass123!",
        "Wrong User A",
    )
    .await;

    let auth_b = register_test_user(
        &server,
        &format!("wronguserb_{}", timestamp),
        &format!("wronguserb_{}@example.com", timestamp),
        "SecurePass123!",
        "Wrong User B",
    )
    .await;

    // User A creates an account
    let create_request = json!({
        "name": "User A Account",
        "account_type": "CHECKING",
        "currency": "USD"
    });
    let create_response =
        post_authenticated(&server, "/api/v1/accounts", &auth_a.token, &create_request).await;
    assert_status(&create_response, 201);
    let account_a: AccountResponse = extract_json(create_response);

    // User B tries to access User A's account
    let response = get_authenticated(
        &server,
        &format!("/api/v1/accounts/{}", account_a.id),
        &auth_b.token,
    )
    .await;

    // Should be 403 Forbidden (user authenticated but accessing wrong resource)
    assert_status(&response, 403);
}

/// Test that getting account without authentication fails.
///
/// Verifies that:
/// - Status code is 401 Unauthorized
/// - Error message indicates missing authentication
#[tokio::test]
async fn test_get_account_unauthorized() {
    let server = create_test_server().await;

    let fake_id = uuid::Uuid::new_v4();
    let response = get_unauthenticated(&server, &format!("/api/v1/accounts/{}", fake_id)).await;
    assert_status(&response, 401);

    let error_text = response.text();
    assert!(
        error_text.to_lowercase().contains("unauthorized")
            || error_text.to_lowercase().contains("token"),
        "Error message should indicate missing authentication"
    );
}

// ============================================================================
// Update Account Tests
// ============================================================================

/// Test successful account update.
///
/// Verifies that:
/// - Status code is 200 OK
/// - Response contains updated account data
/// - Only specified fields are updated
#[tokio::test]
async fn test_update_account_success() {
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

    // Create an account
    let create_request = json!({
        "name": "Original Name",
        "account_type": "CHECKING",
        "currency": "USD",
        "notes": "Original notes"
    });
    let create_response =
        post_authenticated(&server, "/api/v1/accounts", &auth.token, &create_request).await;
    assert_status(&create_response, 201);
    let account: AccountResponse = extract_json(create_response);

    // Update the account
    let update_request = json!({
        "name": "Updated Name",
        "notes": "Updated notes"
    });
    let update_response = put_authenticated(
        &server,
        &format!("/api/v1/accounts/{}", account.id),
        &auth.token,
        &update_request,
    )
    .await;
    assert_status(&update_response, 200);

    let updated_account: AccountResponse = extract_json(update_response);
    assert_eq!(updated_account.id, account.id);
    assert_eq!(updated_account.name, "Updated Name");
    assert_eq!(updated_account.notes, Some("Updated notes".to_string()));
    // Type and currency should remain unchanged
    assert_eq!(updated_account.account_type, AccountType::Checking);
    assert_eq!(updated_account.currency, CurrencyCode::Usd);
}

/// Test partial account update (only some fields).
///
/// Verifies that:
/// - Status code is 200 OK
/// - Only specified fields are updated
/// - Other fields remain unchanged
#[tokio::test]
async fn test_update_account_partial() {
    let server = create_test_server().await;
    let timestamp = Utc::now().timestamp_nanos_opt().unwrap();

    let auth = register_test_user(
        &server,
        &format!("partialuser_{}", timestamp),
        &format!("partial_{}@example.com", timestamp),
        "SecurePass123!",
        "Partial Test User",
    )
    .await;

    // Create an account
    let create_request = json!({
        "name": "Original Name",
        "account_type": "SAVINGS",
        "currency": "EUR",
        "notes": "Original notes"
    });
    let create_response =
        post_authenticated(&server, "/api/v1/accounts", &auth.token, &create_request).await;
    assert_status(&create_response, 201);
    let account: AccountResponse = extract_json(create_response);

    // Update only the name
    let update_request = json!({
        "name": "New Name Only"
    });
    let update_response = put_authenticated(
        &server,
        &format!("/api/v1/accounts/{}", account.id),
        &auth.token,
        &update_request,
    )
    .await;
    assert_status(&update_response, 200);

    let updated_account: AccountResponse = extract_json(update_response);
    assert_eq!(updated_account.name, "New Name Only");
    assert_eq!(updated_account.notes, Some("Original notes".to_string()));
}

/// Test that updating a non-existent account fails.
///
/// Verifies that:
/// - Status code is 404 Not Found
/// - Error message indicates account not found
#[tokio::test]
async fn test_update_account_not_found() {
    let server = create_test_server().await;
    let timestamp = Utc::now().timestamp_nanos_opt().unwrap();

    let auth = register_test_user(
        &server,
        &format!("updatenotfound_{}", timestamp),
        &format!("updatenotfound_{}@example.com", timestamp),
        "SecurePass123!",
        "Update Not Found User",
    )
    .await;

    let fake_id = uuid::Uuid::new_v4();
    let update_request = json!({
        "name": "New Name"
    });
    let response = put_authenticated(
        &server,
        &format!("/api/v1/accounts/{}", fake_id),
        &auth.token,
        &update_request,
    )
    .await;
    assert_status(&response, 404);
}

/// Test that users cannot update other users' accounts.
///
/// Verifies that:
/// - Status code is 403 Forbidden or 404 Not Found
/// - User B cannot update User A's account
#[tokio::test]
async fn test_update_account_wrong_user() {
    let server = create_test_server().await;
    let timestamp = Utc::now().timestamp_nanos_opt().unwrap();

    // Register two users
    let auth_a = register_test_user(
        &server,
        &format!("updatewronga_{}", timestamp),
        &format!("updatewronga_{}@example.com", timestamp),
        "SecurePass123!",
        "Update Wrong A",
    )
    .await;

    let auth_b = register_test_user(
        &server,
        &format!("updatewrongb_{}", timestamp),
        &format!("updatewrongb_{}@example.com", timestamp),
        "SecurePass123!",
        "Update Wrong B",
    )
    .await;

    // User A creates an account
    let create_request = json!({
        "name": "User A Account",
        "account_type": "CHECKING",
        "currency": "USD"
    });
    let create_response =
        post_authenticated(&server, "/api/v1/accounts", &auth_a.token, &create_request).await;
    assert_status(&create_response, 201);
    let account: AccountResponse = extract_json(create_response);

    // User B tries to update User A's account
    let update_request = json!({
        "name": "Hacked Name"
    });
    let response = put_authenticated(
        &server,
        &format!("/api/v1/accounts/{}", account.id),
        &auth_b.token,
        &update_request,
    )
    .await;

    let status = response.status_code();
    assert!(
        status == 403 || status == 404,
        "Should return 403 or 404, got {}",
        status
    );
}

/// Test that updating account with invalid data fails.
///
/// Verifies that:
/// - Status code is 400 Bad Request
/// - Error message indicates validation failure
#[tokio::test]
async fn test_update_account_invalid_data() {
    let server = create_test_server().await;
    let timestamp = Utc::now().timestamp_nanos_opt().unwrap();

    let auth = register_test_user(
        &server,
        &format!("updateinvalid_{}", timestamp),
        &format!("updateinvalid_{}@example.com", timestamp),
        "SecurePass123!",
        "Update Invalid User",
    )
    .await;

    // Create an account
    let create_request = json!({
        "name": "Test Account",
        "account_type": "CHECKING",
        "currency": "USD"
    });
    let create_response =
        post_authenticated(&server, "/api/v1/accounts", &auth.token, &create_request).await;
    assert_status(&create_response, 201);
    let account: AccountResponse = extract_json(create_response);

    // Try to update with empty name
    let invalid_request = json!({
        "name": ""
    });
    let response = put_authenticated(
        &server,
        &format!("/api/v1/accounts/{}", account.id),
        &auth.token,
        &invalid_request,
    )
    .await;
    assert_status(&response, 422);

    // Try to update with very long notes
    let long_notes = "a".repeat(1000);
    let invalid_request2 = json!({
        "notes": long_notes
    });
    let response2 = put_authenticated(
        &server,
        &format!("/api/v1/accounts/{}", account.id),
        &auth.token,
        &invalid_request2,
    )
    .await;
    assert_status(&response2, 422);
}

/// Test that updating account without authentication fails.
///
/// Verifies that:
/// - Status code is 401 Unauthorized
/// - Error message indicates missing authentication
#[tokio::test]
async fn test_update_account_unauthorized() {
    let server = create_test_server().await;

    let fake_id = uuid::Uuid::new_v4();
    let update_request = json!({
        "name": "New Name"
    });

    let response = server
        .put(&format!("/api/v1/accounts/{}", fake_id))
        .json(&update_request)
        .await;
    assert_status(&response, 401);
}

// ============================================================================
// Delete Account Tests
// ============================================================================

/// Test successful account deletion.
///
/// Verifies that:
/// - Status code is 204 No Content
/// - Account is actually deleted
/// - Subsequent GET returns 404
#[tokio::test]
async fn test_delete_account_success() {
    let server = create_test_server().await;
    let timestamp = Utc::now().timestamp_nanos_opt().unwrap();

    let auth = register_test_user(
        &server,
        &format!("deleteuser_{}", timestamp),
        &format!("delete_{}@example.com", timestamp),
        "SecurePass123!",
        "Delete Test User",
    )
    .await;

    // Create an account
    let create_request = json!({
        "name": "Account to Delete",
        "account_type": "CHECKING",
        "currency": "USD"
    });
    let create_response =
        post_authenticated(&server, "/api/v1/accounts", &auth.token, &create_request).await;
    assert_status(&create_response, 201);
    let account: AccountResponse = extract_json(create_response);

    // Delete the account
    let delete_response = delete_authenticated(
        &server,
        &format!("/api/v1/accounts/{}", account.id),
        &auth.token,
    )
    .await;
    assert_status(&delete_response, 204);

    // Verify account is deleted - GET should return 404
    let get_response = get_authenticated(
        &server,
        &format!("/api/v1/accounts/{}", account.id),
        &auth.token,
    )
    .await;
    assert_status(&get_response, 404);

    // Verify account is not in list
    let list_response = get_authenticated(&server, "/api/v1/accounts", &auth.token).await;
    assert_status(&list_response, 200);
    let accounts: Vec<AccountResponse> = extract_json(list_response);
    assert!(
        !accounts.iter().any(|a| a.id == account.id),
        "Deleted account should not appear in list"
    );
}

/// Test that deleting a non-existent account fails.
///
/// Verifies that:
/// - Status code is 404 Not Found
/// - Error message indicates account not found
#[tokio::test]
async fn test_delete_account_not_found() {
    let server = create_test_server().await;
    let timestamp = Utc::now().timestamp_nanos_opt().unwrap();

    let auth = register_test_user(
        &server,
        &format!("deletenotfound_{}", timestamp),
        &format!("deletenotfound_{}@example.com", timestamp),
        "SecurePass123!",
        "Delete Not Found User",
    )
    .await;

    let fake_id = uuid::Uuid::new_v4();
    let response = delete_authenticated(
        &server,
        &format!("/api/v1/accounts/{}", fake_id),
        &auth.token,
    )
    .await;
    assert_status(&response, 404);
}

/// Test that users cannot delete other users' accounts.
///
/// Verifies that:
/// - Status code is 403 Forbidden or 404 Not Found
/// - User B cannot delete User A's account
#[tokio::test]
async fn test_delete_account_wrong_user() {
    let server = create_test_server().await;
    let timestamp = Utc::now().timestamp_nanos_opt().unwrap();

    // Register two users
    let auth_a = register_test_user(
        &server,
        &format!("deletewronga_{}", timestamp),
        &format!("deletewronga_{}@example.com", timestamp),
        "SecurePass123!",
        "Delete Wrong A",
    )
    .await;

    let auth_b = register_test_user(
        &server,
        &format!("deletewrongb_{}", timestamp),
        &format!("deletewrongb_{}@example.com", timestamp),
        "SecurePass123!",
        "Delete Wrong B",
    )
    .await;

    // User A creates an account
    let create_request = json!({
        "name": "User A Account",
        "account_type": "CHECKING",
        "currency": "USD"
    });
    let create_response =
        post_authenticated(&server, "/api/v1/accounts", &auth_a.token, &create_request).await;
    assert_status(&create_response, 201);
    let account: AccountResponse = extract_json(create_response);

    // User B tries to delete User A's account
    let response = delete_authenticated(
        &server,
        &format!("/api/v1/accounts/{}", account.id),
        &auth_b.token,
    )
    .await;

    let status = response.status_code();
    assert!(
        status == 403 || status == 404,
        "Should return 403 or 404, got {}",
        status
    );

    // Verify account still exists for User A
    let get_response = get_authenticated(
        &server,
        &format!("/api/v1/accounts/{}", account.id),
        &auth_a.token,
    )
    .await;
    assert_status(&get_response, 200);
}

/// Test that deleting account without authentication fails.
///
/// Verifies that:
/// - Status code is 401 Unauthorized
/// - Error message indicates missing authentication
#[tokio::test]
async fn test_delete_account_unauthorized() {
    let server = create_test_server().await;

    let fake_id = uuid::Uuid::new_v4();
    let response = server
        .delete(&format!("/api/v1/accounts/{}", fake_id))
        .await;
    assert_status(&response, 401);
}

// ============================================================================
// Integration Flow Test
// ============================================================================

/// Test complete CRUD flow: Create → Read → Update → Delete.
///
/// Verifies that:
/// - Account can be created successfully
/// - Account can be retrieved with correct data
/// - Account can be updated with new data
/// - Account can be deleted successfully
/// - All operations maintain data consistency
#[tokio::test]
async fn test_full_account_crud_flow() {
    let server = create_test_server().await;
    let timestamp = Utc::now().timestamp_nanos_opt().unwrap();

    let auth = register_test_user(
        &server,
        &format!("cruduser_{}", timestamp),
        &format!("crud_{}@example.com", timestamp),
        "SecurePass123!",
        "CRUD Test User",
    )
    .await;

    // Step 1: Create account with initial balance (creates a transaction)
    let create_request = json!({
        "name": "CRUD Test Account",
        "account_type": "SAVINGS",
        "currency": "GBP",
        "initial_balance": 2500.75,
        "notes": "Initial notes"
    });
    let create_response =
        post_authenticated(&server, "/api/v1/accounts", &auth.token, &create_request).await;
    assert_status(&create_response, 201);
    let created_account: AccountResponse = extract_json(create_response);

    assert_eq!(created_account.name, "CRUD Test Account");
    assert_eq!(created_account.account_type, AccountType::Savings);
    assert_eq!(created_account.currency, CurrencyCode::Gbp);
    assert_eq!(created_account.user_id, auth.user.id);
    assert_eq!(created_account.balance, 2500.75);

    // Step 2: Read account
    let get_response = get_authenticated(
        &server,
        &format!("/api/v1/accounts/{}", created_account.id),
        &auth.token,
    )
    .await;
    assert_status(&get_response, 200);
    let read_account: AccountResponse = extract_json(get_response);

    assert_eq!(read_account.id, created_account.id);
    assert_eq!(read_account.name, created_account.name);
    assert_eq!(read_account.account_type, created_account.account_type);

    // Step 3: Update account
    let update_request = json!({
        "name": "Updated CRUD Account",
        "notes": "Updated notes"
    });
    let update_response = put_authenticated(
        &server,
        &format!("/api/v1/accounts/{}", created_account.id),
        &auth.token,
        &update_request,
    )
    .await;
    assert_status(&update_response, 200);
    let updated_account: AccountResponse = extract_json(update_response);

    assert_eq!(updated_account.id, created_account.id);
    assert_eq!(updated_account.name, "Updated CRUD Account");
    assert_eq!(updated_account.notes, Some("Updated notes".to_string()));
    // Type and currency should remain unchanged
    assert_eq!(updated_account.account_type, AccountType::Savings);
    assert_eq!(updated_account.currency, CurrencyCode::Gbp);

    // Step 4: Verify update persisted
    let get_response2 = get_authenticated(
        &server,
        &format!("/api/v1/accounts/{}", created_account.id),
        &auth.token,
    )
    .await;
    assert_status(&get_response2, 200);
    let verified_account: AccountResponse = extract_json(get_response2);
    assert_eq!(verified_account.name, "Updated CRUD Account");

    // Step 5: Try to delete account with transactions (should fail)
    let delete_response_fail = delete_authenticated(
        &server,
        &format!("/api/v1/accounts/{}", created_account.id),
        &auth.token,
    )
    .await;
    assert_status(&delete_response_fail, 422);
    let error_text = delete_response_fail.text();
    assert!(
        error_text.to_lowercase().contains("transaction"),
        "Error should mention transactions"
    );

    // Step 6: Get transactions for the account
    let transactions_response = get_authenticated(
        &server,
        &format!("/api/v1/transactions?account_id={}", created_account.id),
        &auth.token,
    )
    .await;
    assert_status(&transactions_response, 200);
    let transactions: Vec<serde_json::Value> = extract_json(transactions_response);
    assert!(
        !transactions.is_empty(),
        "Should have initial balance transaction"
    );
    let transaction_id = transactions[0]["id"].as_str().unwrap();

    // Step 7: Delete the transaction
    let delete_tx_response = delete_authenticated(
        &server,
        &format!("/api/v1/transactions/{}", transaction_id),
        &auth.token,
    )
    .await;
    assert_status(&delete_tx_response, 204);

    // Step 8: Now delete account (should succeed)
    let delete_response = delete_authenticated(
        &server,
        &format!("/api/v1/accounts/{}", created_account.id),
        &auth.token,
    )
    .await;
    assert_status(&delete_response, 204);

    // Step 9: Verify deletion
    let get_response3 = get_authenticated(
        &server,
        &format!("/api/v1/accounts/{}", created_account.id),
        &auth.token,
    )
    .await;
    assert_status(&get_response3, 404);

    // Step 10: Verify account not in list
    let list_response = get_authenticated(&server, "/api/v1/accounts", &auth.token).await;
    assert_status(&list_response, 200);
    let final_accounts: Vec<AccountResponse> = extract_json(list_response);
    assert_eq!(final_accounts.len(), 0, "All accounts should be deleted");
}
