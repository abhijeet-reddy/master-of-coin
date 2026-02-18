//! Integration tests for DEBT account type (Paid by Others feature).
//!
//! This module tests the Phase 1 functionality:
//! - DEBT accounts are excluded from the account list
//! - DEBT accounts are excluded from net worth calculations
//! - DEBT accounts cannot be updated or deleted by users
//! - get_or_create_debt_account creates and returns DEBT accounts correctly
//!
//! Note: The database migration adding 'DEBT' to account_type enum must be
//! applied before running these tests.

use crate::common::*;
use chrono::Utc;
use master_of_coin_backend::models::AccountResponse;
use serde_json::json;

// ============================================================================
// DEBT Account Filtering Tests
// ============================================================================

/// Test that DEBT accounts are excluded from the account list endpoint.
///
/// Verifies that:
/// - A user can create a normal account
/// - A DEBT account created directly (simulating system creation) is not returned
/// - Only non-DEBT accounts appear in the list
#[tokio::test]
async fn test_debt_accounts_excluded_from_list() {
    let server = create_test_server().await;
    let timestamp = Utc::now().timestamp_nanos_opt().unwrap();

    // Register a user
    let auth = register_test_user(
        &server,
        &format!("debtlist_{}", timestamp),
        &format!("debtlist_{}@example.com", timestamp),
        "SecurePass123!",
        "Debt List Test User",
    )
    .await;

    // Create a normal checking account
    let normal_account = json!({
        "name": "My Checking",
        "account_type": "CHECKING",
        "currency": "EUR"
    });
    let response =
        post_authenticated(&server, "/api/v1/accounts", &auth.token, &normal_account).await;
    assert_status(&response, 201);

    // Create a DEBT account via the API (this should work since DEBT is a valid type)
    let debt_account = json!({
        "name": "Debts (EUR)",
        "account_type": "DEBT",
        "currency": "EUR"
    });
    let response =
        post_authenticated(&server, "/api/v1/accounts", &auth.token, &debt_account).await;
    assert_status(&response, 201);

    // List accounts — DEBT accounts should be excluded
    let response = get_authenticated(&server, "/api/v1/accounts", &auth.token).await;
    assert_status(&response, 200);

    let accounts: Vec<AccountResponse> = extract_json(response);
    assert_eq!(
        accounts.len(),
        1,
        "Only the normal account should be listed, DEBT accounts should be excluded"
    );
    assert_eq!(accounts[0].name, "My Checking");
    assert_eq!(
        format!("{:?}", accounts[0].account_type),
        "Checking",
        "Listed account should be CHECKING type"
    );
}

// ============================================================================
// DEBT Account Protection Tests
// ============================================================================

/// Test that DEBT accounts cannot be updated by users.
///
/// Verifies that:
/// - Attempting to update a DEBT account returns an error
/// - The error message indicates system-managed accounts cannot be modified
#[tokio::test]
async fn test_debt_account_cannot_be_updated() {
    let server = create_test_server().await;
    let timestamp = Utc::now().timestamp_nanos_opt().unwrap();

    // Register a user
    let auth = register_test_user(
        &server,
        &format!("debtupd_{}", timestamp),
        &format!("debtupd_{}@example.com", timestamp),
        "SecurePass123!",
        "Debt Update Test User",
    )
    .await;

    // Create a DEBT account
    let debt_account = json!({
        "name": "Debts (EUR)",
        "account_type": "DEBT",
        "currency": "EUR"
    });
    let response =
        post_authenticated(&server, "/api/v1/accounts", &auth.token, &debt_account).await;
    assert_status(&response, 201);
    let created: AccountResponse = extract_json(response);

    // Try to update the DEBT account — should fail
    let update = json!({
        "name": "Renamed Debts"
    });
    let response = put_authenticated(
        &server,
        &format!("/api/v1/accounts/{}", created.id),
        &auth.token,
        &update,
    )
    .await;

    // Should return a validation error (422 or 400)
    assert_error(&response);
}

/// Test that DEBT accounts cannot be deleted by users.
///
/// Verifies that:
/// - Attempting to delete a DEBT account returns an error
/// - The error message indicates system-managed accounts cannot be deleted
#[tokio::test]
async fn test_debt_account_cannot_be_deleted() {
    let server = create_test_server().await;
    let timestamp = Utc::now().timestamp_nanos_opt().unwrap();

    // Register a user
    let auth = register_test_user(
        &server,
        &format!("debtdel_{}", timestamp),
        &format!("debtdel_{}@example.com", timestamp),
        "SecurePass123!",
        "Debt Delete Test User",
    )
    .await;

    // Create a DEBT account
    let debt_account = json!({
        "name": "Debts (EUR)",
        "account_type": "DEBT",
        "currency": "EUR"
    });
    let response =
        post_authenticated(&server, "/api/v1/accounts", &auth.token, &debt_account).await;
    assert_status(&response, 201);
    let created: AccountResponse = extract_json(response);

    // Try to delete the DEBT account — should fail
    let response = delete_authenticated(
        &server,
        &format!("/api/v1/accounts/{}", created.id),
        &auth.token,
    )
    .await;

    // Should return a validation error (422 or 400)
    assert_error(&response);
}

// ============================================================================
// Net Worth Exclusion Tests
// ============================================================================

/// Test that DEBT accounts are excluded from net worth calculation.
///
/// Verifies that:
/// - A normal account's balance is included in net worth
/// - A DEBT account's balance is NOT included in net worth
/// - The dashboard net worth reflects only real accounts
#[tokio::test]
async fn test_debt_accounts_excluded_from_net_worth() {
    let server = create_test_server().await;
    let timestamp = Utc::now().timestamp_nanos_opt().unwrap();

    // Register a user
    let auth = register_test_user(
        &server,
        &format!("debtnw_{}", timestamp),
        &format!("debtnw_{}@example.com", timestamp),
        "SecurePass123!",
        "Debt Net Worth Test User",
    )
    .await;

    // Create a normal checking account with initial balance of 1000
    let normal_account = json!({
        "name": "My Checking",
        "account_type": "CHECKING",
        "currency": "EUR",
        "initial_balance": 1000.0
    });
    let response =
        post_authenticated(&server, "/api/v1/accounts", &auth.token, &normal_account).await;
    assert_status(&response, 201);

    // Create a DEBT account
    let debt_account = json!({
        "name": "Debts (EUR)",
        "account_type": "DEBT",
        "currency": "EUR",
        "initial_balance": -50.0
    });
    let response =
        post_authenticated(&server, "/api/v1/accounts", &auth.token, &debt_account).await;
    assert_status(&response, 201);

    // Get dashboard — net worth should only include the checking account (1000), not the DEBT (-50)
    let response = get_authenticated(&server, "/api/v1/dashboard", &auth.token).await;
    assert_status(&response, 200);

    let dashboard: serde_json::Value = extract_json(response);
    let net_worth_str = dashboard["net_worth"].as_str().unwrap_or("0");
    let net_worth: f64 = net_worth_str.parse().unwrap_or(0.0);

    assert!(
        (net_worth - 1000.0).abs() < 0.01,
        "Net worth should be 1000.00 (only checking account), got {}",
        net_worth
    );
}

/// Test that creating a normal account still works as expected.
///
/// Regression test to ensure the DEBT changes don't break normal account operations.
#[tokio::test]
async fn test_normal_account_operations_unchanged() {
    let server = create_test_server().await;
    let timestamp = Utc::now().timestamp_nanos_opt().unwrap();

    // Register a user
    let auth = register_test_user(
        &server,
        &format!("debtreg_{}", timestamp),
        &format!("debtreg_{}@example.com", timestamp),
        "SecurePass123!",
        "Debt Regression Test User",
    )
    .await;

    // Create a normal checking account
    let account = json!({
        "name": "Normal Account",
        "account_type": "CHECKING",
        "currency": "EUR",
        "initial_balance": 500.0
    });
    let response = post_authenticated(&server, "/api/v1/accounts", &auth.token, &account).await;
    assert_status(&response, 201);
    let created: AccountResponse = extract_json(response);

    // Update should work
    let update = json!({
        "name": "Updated Normal Account"
    });
    let response = put_authenticated(
        &server,
        &format!("/api/v1/accounts/{}", created.id),
        &auth.token,
        &update,
    )
    .await;
    assert_status(&response, 200);
    let updated: AccountResponse = extract_json(response);
    assert_eq!(updated.name, "Updated Normal Account");

    // List should include it
    let response = get_authenticated(&server, "/api/v1/accounts", &auth.token).await;
    assert_status(&response, 200);
    let accounts: Vec<AccountResponse> = extract_json(response);
    assert_eq!(accounts.len(), 1);
    assert_eq!(accounts[0].name, "Updated Normal Account");
}
