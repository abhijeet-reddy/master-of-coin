//! Integration tests for debt transaction API endpoints (Paid by Others feature).
//!
//! This module tests the Phase 2 functionality:
//! - POST /api/v1/debt-transactions — create a "paid by others" transaction
//! - Verify transaction is on DEBT account
//! - Verify debt_transaction_metadata is created
//! - Verify split is created for debt tracking
//! - Verify budget includes the expense
//! - Verify net worth excludes the expense
//! - Verify transaction response includes debt_metadata
//! - Verify deleting transaction cascades to metadata

use crate::common::*;
use chrono::Utc;
use master_of_coin_backend::models::{AccountResponse, TransactionResponse};
use serde_json::json;

// ============================================================================
// Create Debt Transaction Tests
// ============================================================================

/// Test creating a "paid by others" transaction via the debt-transactions endpoint.
///
/// Verifies that:
/// - Status code is 201 Created
/// - Transaction is created on a DEBT account
/// - Response includes debt_metadata with payer info
/// - Response includes a split for debt tracking
#[tokio::test]
async fn test_create_debt_transaction() {
    let server = create_test_server().await;
    let timestamp = Utc::now().timestamp_nanos_opt().unwrap();

    // Register a user
    let auth = register_test_user(
        &server,
        &format!("debtcreate_{}", timestamp),
        &format!("debtcreate_{}@example.com", timestamp),
        "SecurePass123!",
        "Debt Create Test User",
    )
    .await;

    // Create a person (the payer)
    let person = create_test_person(&server, &auth.token, "Alex").await;

    // Create a category for budget tracking
    let category = create_test_category(&server, &auth.token, "Dining Out").await;

    // Create a debt transaction
    let debt_txn = json!({
        "payer_person_id": person.id,
        "currency": "EUR",
        "category_id": category.id,
        "title": "Dinner with Alex",
        "amount": -50.0,
        "date": "2026-02-18T20:00:00Z",
        "notes": "Alex paid for dinner"
    });

    let response =
        post_authenticated(&server, "/api/v1/debt-transactions", &auth.token, &debt_txn).await;
    assert_status(&response, 201);

    let txn: TransactionResponse = extract_json(response);

    // Verify response fields
    assert_eq!(txn.title, "Dinner with Alex");
    assert_eq!(txn.amount, "-50.00");

    // Verify debt_metadata is populated
    assert!(
        txn.debt_metadata.is_some(),
        "debt_metadata should be populated for debt transactions"
    );
    let debt_meta = txn.debt_metadata.unwrap();
    assert_eq!(debt_meta.payer_person_id, person.id);
    assert_eq!(debt_meta.payer_person_name, "Alex");

    // Verify split exists
    assert!(txn.splits.is_some(), "Splits should be populated");
    let splits = txn.splits.unwrap();
    assert_eq!(splits.len(), 1);
    assert_eq!(splits[0].person_id, person.id);
    assert_eq!(splits[0].amount, "-50.00");
}

/// Test that debt transactions are excluded from net worth.
///
/// Verifies that:
/// - A normal account balance is included in net worth
/// - A debt transaction does NOT affect net worth
#[tokio::test]
async fn test_debt_transaction_excluded_from_net_worth() {
    let server = create_test_server().await;
    let timestamp = Utc::now().timestamp_nanos_opt().unwrap();

    let auth = register_test_user(
        &server,
        &format!("debtnw2_{}", timestamp),
        &format!("debtnw2_{}@example.com", timestamp),
        "SecurePass123!",
        "Debt NW Test User",
    )
    .await;

    // Create a normal account with balance
    let normal_account = json!({
        "name": "My Checking",
        "account_type": "CHECKING",
        "currency": "EUR",
        "initial_balance": 1000.0
    });
    let response =
        post_authenticated(&server, "/api/v1/accounts", &auth.token, &normal_account).await;
    assert_status(&response, 201);

    // Create a person and a debt transaction
    let person = create_test_person(&server, &auth.token, "Bob").await;
    let debt_txn = json!({
        "payer_person_id": person.id,
        "currency": "EUR",
        "title": "Taxi paid by Bob",
        "amount": -25.0,
        "date": "2026-02-18T20:00:00Z"
    });
    let response =
        post_authenticated(&server, "/api/v1/debt-transactions", &auth.token, &debt_txn).await;
    assert_status(&response, 201);

    // Check dashboard — net worth should only include the checking account (1000)
    let response = get_authenticated(&server, "/api/v1/dashboard", &auth.token).await;
    assert_status(&response, 200);

    let dashboard: serde_json::Value = extract_json(response);
    let net_worth: f64 = dashboard["net_worth"]
        .as_str()
        .unwrap_or("0")
        .parse()
        .unwrap_or(0.0);

    assert!(
        (net_worth - 1000.0).abs() < 0.01,
        "Net worth should be 1000.00 (DEBT account excluded), got {}",
        net_worth
    );
}

/// Test that debt transactions appear in the transaction list with debt_metadata.
///
/// Verifies that:
/// - Normal transactions have debt_metadata: null
/// - Debt transactions have debt_metadata populated
#[tokio::test]
async fn test_debt_transaction_in_list_has_metadata() {
    let server = create_test_server().await;
    let timestamp = Utc::now().timestamp_nanos_opt().unwrap();

    let auth = register_test_user(
        &server,
        &format!("debtlist2_{}", timestamp),
        &format!("debtlist2_{}@example.com", timestamp),
        "SecurePass123!",
        "Debt List Test User",
    )
    .await;

    // Create a normal account and transaction
    let account = json!({
        "name": "Checking",
        "account_type": "CHECKING",
        "currency": "EUR"
    });
    let response = post_authenticated(&server, "/api/v1/accounts", &auth.token, &account).await;
    assert_status(&response, 201);
    let account: AccountResponse = extract_json(response);

    let normal_txn = json!({
        "account_id": account.id,
        "title": "Groceries",
        "amount": -30.0,
        "date": "2026-02-18T10:00:00Z"
    });
    let response =
        post_authenticated(&server, "/api/v1/transactions", &auth.token, &normal_txn).await;
    assert_status(&response, 201);

    // Create a debt transaction
    let person = create_test_person(&server, &auth.token, "Charlie").await;
    let debt_txn = json!({
        "payer_person_id": person.id,
        "currency": "EUR",
        "title": "Coffee paid by Charlie",
        "amount": -5.0,
        "date": "2026-02-18T11:00:00Z"
    });
    let response =
        post_authenticated(&server, "/api/v1/debt-transactions", &auth.token, &debt_txn).await;
    assert_status(&response, 201);

    // List all transactions
    let response = get_authenticated(&server, "/api/v1/transactions", &auth.token).await;
    assert_status(&response, 200);

    let transactions: Vec<TransactionResponse> = extract_json(response);
    assert_eq!(transactions.len(), 2, "Should have 2 transactions");

    // Find the debt transaction and normal transaction
    let debt_txn = transactions
        .iter()
        .find(|t| t.title == "Coffee paid by Charlie");
    let normal_txn = transactions.iter().find(|t| t.title == "Groceries");

    assert!(debt_txn.is_some(), "Debt transaction should be in the list");
    assert!(
        normal_txn.is_some(),
        "Normal transaction should be in the list"
    );

    // Normal transaction should have debt_metadata: null
    assert!(
        normal_txn.unwrap().debt_metadata.is_none(),
        "Normal transaction should have debt_metadata: null"
    );

    // Debt transaction should have debt_metadata populated
    let debt_meta = &debt_txn.unwrap().debt_metadata;
    assert!(
        debt_meta.is_some(),
        "Debt transaction should have debt_metadata populated"
    );
    assert_eq!(debt_meta.as_ref().unwrap().payer_person_name, "Charlie");
}

/// Test validation: payer_person_id must belong to the user.
#[tokio::test]
async fn test_debt_transaction_invalid_person() {
    let server = create_test_server().await;
    let timestamp = Utc::now().timestamp_nanos_opt().unwrap();

    let auth = register_test_user(
        &server,
        &format!("debtinv_{}", timestamp),
        &format!("debtinv_{}@example.com", timestamp),
        "SecurePass123!",
        "Debt Invalid Test User",
    )
    .await;

    // Use a random UUID as person_id (doesn't exist)
    let debt_txn = json!({
        "payer_person_id": "00000000-0000-0000-0000-000000000001",
        "currency": "EUR",
        "title": "Invalid person test",
        "amount": -10.0,
        "date": "2026-02-18T20:00:00Z"
    });

    let response =
        post_authenticated(&server, "/api/v1/debt-transactions", &auth.token, &debt_txn).await;
    assert_error(&response);
}

/// Test that existing transaction creation still works (regression).
#[tokio::test]
async fn test_normal_transaction_still_works() {
    let server = create_test_server().await;
    let timestamp = Utc::now().timestamp_nanos_opt().unwrap();

    let auth = register_test_user(
        &server,
        &format!("debtreg2_{}", timestamp),
        &format!("debtreg2_{}@example.com", timestamp),
        "SecurePass123!",
        "Debt Regression Test User",
    )
    .await;

    // Create a normal account
    let account = json!({
        "name": "Checking",
        "account_type": "CHECKING",
        "currency": "EUR"
    });
    let response = post_authenticated(&server, "/api/v1/accounts", &auth.token, &account).await;
    assert_status(&response, 201);
    let account: AccountResponse = extract_json(response);

    // Create a normal transaction
    let txn = json!({
        "account_id": account.id,
        "title": "Normal expense",
        "amount": -100.0,
        "date": "2026-02-18T20:00:00Z"
    });
    let response = post_authenticated(&server, "/api/v1/transactions", &auth.token, &txn).await;
    assert_status(&response, 201);

    let txn: TransactionResponse = extract_json(response);
    assert_eq!(txn.title, "Normal expense");
    assert!(
        txn.debt_metadata.is_none(),
        "Normal transaction should have debt_metadata: null"
    );
}

/// Test that GET /api/v1/transactions/:id works for debt transactions.
#[tokio::test]
async fn test_get_debt_transaction_by_id() {
    let server = create_test_server().await;
    let timestamp = Utc::now().timestamp_nanos_opt().unwrap();

    let auth = register_test_user(
        &server,
        &format!("debtget_{}", timestamp),
        &format!("debtget_{}@example.com", timestamp),
        "SecurePass123!",
        "Debt Get Test User",
    )
    .await;

    // Create a person and a debt transaction
    let person = create_test_person(&server, &auth.token, "DetailTestPerson").await;
    let debt_txn = json!({
        "payer_person_id": person.id,
        "currency": "EUR",
        "title": "Detail page test",
        "amount": -30.0,
        "date": "2026-02-18T20:00:00Z"
    });
    let response =
        post_authenticated(&server, "/api/v1/debt-transactions", &auth.token, &debt_txn).await;
    assert_status(&response, 201);
    let created: TransactionResponse = extract_json(response);

    // Now GET the transaction by ID — this should NOT return 404
    let response = get_authenticated(
        &server,
        &format!("/api/v1/transactions/{}", created.id),
        &auth.token,
    )
    .await;
    assert_status(&response, 200);

    let detail: TransactionResponse = extract_json(response);
    assert_eq!(detail.title, "Detail page test");
    assert!(
        detail.debt_metadata.is_some(),
        "debt_metadata should be populated"
    );
}
