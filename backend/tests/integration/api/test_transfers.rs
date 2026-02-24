//! Integration tests for account-to-account transfer API endpoints.
//!
//! This module tests the transfer endpoint:
//! - POST /api/v1/transfers - Create a new transfer between two accounts
//!
//! It also tests cascading behaviour when deleting transfer transactions,
//! and verifies that `transfer_info` is populated in transaction listings.

use crate::common::*;
use chrono::Utc;
use master_of_coin_backend::models::{AccountResponse, TransactionResponse, TransferResponse};
use serde_json::json;

// ============================================================================
// Helper: Create an account with a specific currency via the API
// ============================================================================

/// Creates a test account with the given name and currency code (e.g. "EUR", "USD").
async fn create_account_with_currency(
    server: &axum_test::TestServer,
    token: &str,
    name: &str,
    currency: &str,
) -> AccountResponse {
    let request = json!({
        "name": name,
        "account_type": "CHECKING",
        "currency": currency
    });

    let response = post_authenticated(server, "/api/v1/accounts", token, &request).await;
    assert_status(&response, 201);
    extract_json(response)
}

// ============================================================================
// Create Transfer Tests — Happy Path
// ============================================================================

/// Test creating a same-currency transfer between two EUR accounts.
///
/// Verifies that:
/// - Status code is 201 Created
/// - Response has `from_transaction` with negative amount (-100.00) on from_account
/// - Response has `to_transaction` with positive amount (100.00) on to_account
/// - `exchange_rate` is "1" (same currency)
#[tokio::test]
async fn test_create_same_currency_transfer() {
    let server = create_test_server().await;
    let timestamp = Utc::now().timestamp_nanos_opt().unwrap();

    let auth = register_test_user(
        &server,
        &format!("xfer_same_{}", timestamp),
        &format!("xfer_same_{}@example.com", timestamp),
        "SecurePass123!",
        "Transfer Same Currency User",
    )
    .await;

    // Create two EUR accounts
    let from_account =
        create_account_with_currency(&server, &auth.token, "EUR Checking", "EUR").await;
    let to_account = create_account_with_currency(&server, &auth.token, "EUR Savings", "EUR").await;

    // Create transfer
    let request = json!({
        "from_account_id": from_account.id,
        "to_account_id": to_account.id,
        "from_amount": 100.0,
        "date": Utc::now().to_rfc3339()
    });

    let response = post_authenticated(&server, "/api/v1/transfers", &auth.token, &request).await;
    assert_status(&response, 201);

    let transfer: TransferResponse = extract_json(response);

    // Verify from_transaction: negative amount on from_account
    assert_eq!(
        transfer.from_transaction.account_id, from_account.id,
        "from_transaction should be on the from_account"
    );
    assert_eq!(
        transfer.from_transaction.amount, "-100.00",
        "from_transaction amount should be -100.00"
    );

    // Verify to_transaction: positive amount on to_account
    assert_eq!(
        transfer.to_transaction.account_id, to_account.id,
        "to_transaction should be on the to_account"
    );
    assert_eq!(
        transfer.to_transaction.amount, "100.00",
        "to_transaction amount should be 100.00"
    );

    // Verify exchange_rate is 1 for same-currency
    assert_eq!(
        transfer.exchange_rate, "1",
        "Exchange rate should be 1 for same-currency transfer"
    );

    // Verify transfer ID is set
    assert_ne!(
        transfer.id,
        uuid::Uuid::nil(),
        "Transfer should have a valid ID"
    );
}

/// Test creating a cross-currency transfer with `to_amount` specified.
///
/// Verifies that:
/// - Status code is 201 Created
/// - from_transaction has negative from_amount on the EUR account
/// - to_transaction has positive to_amount on the USD account
/// - exchange_rate is computed as to_amount / from_amount
#[tokio::test]
async fn test_create_cross_currency_transfer_with_to_amount() {
    let server = create_test_server().await;
    let timestamp = Utc::now().timestamp_nanos_opt().unwrap();

    let auth = register_test_user(
        &server,
        &format!("xfer_cross_to_{}", timestamp),
        &format!("xfer_cross_to_{}@example.com", timestamp),
        "SecurePass123!",
        "Transfer Cross To Amount User",
    )
    .await;

    // Create EUR and USD accounts
    let eur_account =
        create_account_with_currency(&server, &auth.token, "EUR Account", "EUR").await;
    let usd_account =
        create_account_with_currency(&server, &auth.token, "USD Account", "USD").await;

    // Create cross-currency transfer: 100 EUR → 108 USD
    let request = json!({
        "from_account_id": eur_account.id,
        "to_account_id": usd_account.id,
        "from_amount": 100.0,
        "to_amount": 108.0,
        "date": Utc::now().to_rfc3339()
    });

    let response = post_authenticated(&server, "/api/v1/transfers", &auth.token, &request).await;
    assert_status(&response, 201);

    let transfer: TransferResponse = extract_json(response);

    // Verify from_transaction: -100.00 on EUR account
    assert_eq!(transfer.from_transaction.account_id, eur_account.id);
    assert_eq!(
        transfer.from_transaction.amount, "-100.00",
        "from_transaction amount should be -100.00"
    );

    // Verify to_transaction: +108.00 on USD account
    assert_eq!(transfer.to_transaction.account_id, usd_account.id);
    assert_eq!(
        transfer.to_transaction.amount, "108.00",
        "to_transaction amount should be 108.00"
    );

    // Verify exchange_rate = to_amount / from_amount = 108 / 100 = 1.08
    let rate: f64 = transfer
        .exchange_rate
        .parse()
        .expect("exchange_rate should be a valid number");
    assert!(
        (rate - 1.08).abs() < 0.001,
        "Exchange rate should be ~1.08, got {}",
        rate
    );
}

/// Test creating a cross-currency transfer with `exchange_rate` specified.
///
/// Verifies that:
/// - Status code is 201 Created
/// - to_amount is computed as from_amount * exchange_rate
/// - from_transaction and to_transaction have correct amounts
#[tokio::test]
async fn test_create_cross_currency_transfer_with_exchange_rate() {
    let server = create_test_server().await;
    let timestamp = Utc::now().timestamp_nanos_opt().unwrap();

    let auth = register_test_user(
        &server,
        &format!("xfer_cross_rate_{}", timestamp),
        &format!("xfer_cross_rate_{}@example.com", timestamp),
        "SecurePass123!",
        "Transfer Cross Rate User",
    )
    .await;

    // Create EUR and GBP accounts
    let eur_account =
        create_account_with_currency(&server, &auth.token, "EUR Account", "EUR").await;
    let gbp_account =
        create_account_with_currency(&server, &auth.token, "GBP Account", "GBP").await;

    // Create cross-currency transfer: 200 EUR at rate 0.85 → 170 GBP
    let request = json!({
        "from_account_id": eur_account.id,
        "to_account_id": gbp_account.id,
        "from_amount": 200.0,
        "exchange_rate": 0.85,
        "date": Utc::now().to_rfc3339()
    });

    let response = post_authenticated(&server, "/api/v1/transfers", &auth.token, &request).await;
    assert_status(&response, 201);

    let transfer: TransferResponse = extract_json(response);

    // Verify from_transaction: -200.00 on EUR account
    assert_eq!(transfer.from_transaction.account_id, eur_account.id);
    assert_eq!(
        transfer.from_transaction.amount, "-200.00",
        "from_transaction amount should be -200.00"
    );

    // Verify to_transaction: +170.00 on GBP account (200 * 0.85)
    assert_eq!(transfer.to_transaction.account_id, gbp_account.id);
    let to_amount: f64 = transfer
        .to_transaction
        .amount
        .parse()
        .expect("to_transaction amount should be a valid number");
    assert!(
        (to_amount - 170.0).abs() < 0.01,
        "to_transaction amount should be ~170.00, got {}",
        to_amount
    );

    // Verify exchange_rate is 0.85
    let rate: f64 = transfer
        .exchange_rate
        .parse()
        .expect("exchange_rate should be a valid number");
    assert!(
        (rate - 0.85).abs() < 0.001,
        "Exchange rate should be ~0.85, got {}",
        rate
    );
}

// ============================================================================
// Create Transfer Tests — Error Cases
// ============================================================================

/// Test that creating a transfer with the same account for from and to fails.
///
/// Verifies that:
/// - Status code is 422 Unprocessable Entity
/// - Error message indicates accounts must be different
#[tokio::test]
async fn test_create_transfer_same_account_fails() {
    let server = create_test_server().await;
    let timestamp = Utc::now().timestamp_nanos_opt().unwrap();

    let auth = register_test_user(
        &server,
        &format!("xfer_same_acct_{}", timestamp),
        &format!("xfer_same_acct_{}@example.com", timestamp),
        "SecurePass123!",
        "Transfer Same Account User",
    )
    .await;

    let account = create_test_account(&server, &auth.token, "My Account").await;

    let request = json!({
        "from_account_id": account.id,
        "to_account_id": account.id,
        "from_amount": 50.0,
        "date": Utc::now().to_rfc3339()
    });

    let response = post_authenticated(&server, "/api/v1/transfers", &auth.token, &request).await;
    assert_status(&response, 422);

    let error_text = response.text();
    assert!(
        error_text.to_lowercase().contains("different")
            || error_text.to_lowercase().contains("same"),
        "Error should mention accounts must be different, got: {}",
        error_text
    );
}

/// Test that creating a transfer to an account owned by another user fails.
///
/// Verifies that:
/// - Status code is 401 Unauthorized
/// - Error message indicates account ownership issue
#[tokio::test]
async fn test_create_transfer_wrong_ownership_fails() {
    let server = create_test_server().await;
    let timestamp = Utc::now().timestamp_nanos_opt().unwrap();

    // Register two users
    let auth_a = register_test_user(
        &server,
        &format!("xfer_own_a_{}", timestamp),
        &format!("xfer_own_a_{}@example.com", timestamp),
        "SecurePass123!",
        "Transfer Owner A",
    )
    .await;

    let auth_b = register_test_user(
        &server,
        &format!("xfer_own_b_{}", timestamp),
        &format!("xfer_own_b_{}@example.com", timestamp),
        "SecurePass123!",
        "Transfer Owner B",
    )
    .await;

    // User A creates an account
    let account_a = create_test_account(&server, &auth_a.token, "User A Account").await;
    // User B creates an account
    let account_b = create_test_account(&server, &auth_b.token, "User B Account").await;

    // User A tries to transfer from their account to User B's account
    let request = json!({
        "from_account_id": account_a.id,
        "to_account_id": account_b.id,
        "from_amount": 50.0,
        "date": Utc::now().to_rfc3339()
    });

    let response = post_authenticated(&server, "/api/v1/transfers", &auth_a.token, &request).await;
    assert_status(&response, 401);

    let error_text = response.text();
    assert!(
        error_text.to_lowercase().contains("does not belong")
            || error_text.to_lowercase().contains("unauthorized")
            || error_text.to_lowercase().contains("account"),
        "Error should mention account ownership, got: {}",
        error_text
    );
}

/// Test that cross-currency transfer without to_amount or exchange_rate fails.
///
/// Verifies that:
/// - Status code is 422 Unprocessable Entity
/// - Error message indicates missing rate/amount info
#[tokio::test]
async fn test_create_cross_currency_transfer_missing_rate_fails() {
    let server = create_test_server().await;
    let timestamp = Utc::now().timestamp_nanos_opt().unwrap();

    let auth = register_test_user(
        &server,
        &format!("xfer_no_rate_{}", timestamp),
        &format!("xfer_no_rate_{}@example.com", timestamp),
        "SecurePass123!",
        "Transfer No Rate User",
    )
    .await;

    // Create accounts with different currencies
    let eur_account =
        create_account_with_currency(&server, &auth.token, "EUR Account", "EUR").await;
    let usd_account =
        create_account_with_currency(&server, &auth.token, "USD Account", "USD").await;

    // Try cross-currency transfer without to_amount or exchange_rate
    let request = json!({
        "from_account_id": eur_account.id,
        "to_account_id": usd_account.id,
        "from_amount": 100.0,
        "date": Utc::now().to_rfc3339()
    });

    let response = post_authenticated(&server, "/api/v1/transfers", &auth.token, &request).await;
    assert_status(&response, 422);

    let error_text = response.text();
    assert!(
        error_text.to_lowercase().contains("cross-currency")
            || error_text.to_lowercase().contains("to_amount")
            || error_text.to_lowercase().contains("exchange_rate"),
        "Error should mention cross-currency requirement, got: {}",
        error_text
    );
}

// ============================================================================
// Delete Transfer (Cascading) Tests
// ============================================================================

/// Test that deleting one side of a transfer cascades to delete both transactions.
///
/// Verifies that:
/// - Deleting the from_transaction returns 204
/// - Both from_transaction and to_transaction are gone (404 on GET)
/// - Neither transaction appears in the transaction listing
#[tokio::test]
async fn test_delete_transaction_cascades_transfer() {
    let server = create_test_server().await;
    let timestamp = Utc::now().timestamp_nanos_opt().unwrap();

    let auth = register_test_user(
        &server,
        &format!("xfer_del_{}", timestamp),
        &format!("xfer_del_{}@example.com", timestamp),
        "SecurePass123!",
        "Transfer Delete User",
    )
    .await;

    // Create two accounts
    let from_account = create_test_account(&server, &auth.token, "From Account").await;
    let to_account = create_test_account(&server, &auth.token, "To Account").await;

    // Create a transfer
    let request = json!({
        "from_account_id": from_account.id,
        "to_account_id": to_account.id,
        "from_amount": 75.0,
        "date": Utc::now().to_rfc3339()
    });

    let create_response =
        post_authenticated(&server, "/api/v1/transfers", &auth.token, &request).await;
    assert_status(&create_response, 201);
    let transfer: TransferResponse = extract_json(create_response);

    let from_txn_id = transfer.from_transaction.id;
    let to_txn_id = transfer.to_transaction.id;

    // Verify both transactions exist
    let get_from = get_authenticated(
        &server,
        &format!("/api/v1/transactions/{}", from_txn_id),
        &auth.token,
    )
    .await;
    assert_status(&get_from, 200);

    let get_to = get_authenticated(
        &server,
        &format!("/api/v1/transactions/{}", to_txn_id),
        &auth.token,
    )
    .await;
    assert_status(&get_to, 200);

    // Delete the from_transaction — should cascade and delete both
    let delete_response = delete_authenticated(
        &server,
        &format!("/api/v1/transactions/{}", from_txn_id),
        &auth.token,
    )
    .await;
    assert_status(&delete_response, 204);

    // Verify from_transaction is gone
    let get_from_after = get_authenticated(
        &server,
        &format!("/api/v1/transactions/{}", from_txn_id),
        &auth.token,
    )
    .await;
    assert_status(&get_from_after, 404);

    // Verify to_transaction is also gone (cascading delete)
    let get_to_after = get_authenticated(
        &server,
        &format!("/api/v1/transactions/{}", to_txn_id),
        &auth.token,
    )
    .await;
    assert_status(&get_to_after, 404);

    // Verify neither transaction appears in listing
    let list_response = get_authenticated(&server, "/api/v1/transactions", &auth.token).await;
    assert_status(&list_response, 200);
    let transactions: Vec<TransactionResponse> = extract_json(list_response);
    assert!(
        !transactions.iter().any(|t| t.id == from_txn_id),
        "from_transaction should not appear in listing after cascading delete"
    );
    assert!(
        !transactions.iter().any(|t| t.id == to_txn_id),
        "to_transaction should not appear in listing after cascading delete"
    );
}

// ============================================================================
// Transaction Listing — Transfer Info Tests
// ============================================================================

/// Test that listing transactions includes `transfer_info` for transfer transactions.
///
/// Verifies that:
/// - After creating a transfer, listing transactions shows both transactions
/// - Each transfer transaction has `transfer_info` populated
/// - `transfer_info` contains the correct linked account ID and name
#[tokio::test]
async fn test_list_transactions_includes_transfer_info() {
    let server = create_test_server().await;
    let timestamp = Utc::now().timestamp_nanos_opt().unwrap();

    let auth = register_test_user(
        &server,
        &format!("xfer_info_{}", timestamp),
        &format!("xfer_info_{}@example.com", timestamp),
        "SecurePass123!",
        "Transfer Info User",
    )
    .await;

    // Create two accounts with recognisable names
    let checking = create_account_with_currency(&server, &auth.token, "Main Checking", "USD").await;
    let savings = create_account_with_currency(&server, &auth.token, "Savings Fund", "USD").await;

    // Create a transfer
    let request = json!({
        "from_account_id": checking.id,
        "to_account_id": savings.id,
        "from_amount": 250.0,
        "date": Utc::now().to_rfc3339()
    });

    let create_response =
        post_authenticated(&server, "/api/v1/transfers", &auth.token, &request).await;
    assert_status(&create_response, 201);
    let transfer: TransferResponse = extract_json(create_response);

    // List all transactions
    let list_response = get_authenticated(&server, "/api/v1/transactions", &auth.token).await;
    assert_status(&list_response, 200);
    let transactions: Vec<serde_json::Value> = extract_json(list_response);

    assert_eq!(
        transactions.len(),
        2,
        "Should have exactly 2 transactions from the transfer"
    );

    // Find the from-side transaction (negative amount)
    let from_txn = transactions
        .iter()
        .find(|t| t["id"].as_str().unwrap() == transfer.from_transaction.id.to_string())
        .expect("from_transaction should be in listing");

    // Verify transfer_info on from-side points to the savings account
    let from_transfer_info = &from_txn["transfer_info"];
    assert!(
        !from_transfer_info.is_null(),
        "from_transaction should have transfer_info"
    );
    assert_eq!(
        from_transfer_info["transfer_id"].as_str().unwrap(),
        transfer.id.to_string(),
        "transfer_info.transfer_id should match the transfer ID"
    );
    assert_eq!(
        from_transfer_info["linked_account_id"].as_str().unwrap(),
        savings.id.to_string(),
        "from-side transfer_info should link to the savings account"
    );
    assert_eq!(
        from_transfer_info["linked_account_name"].as_str().unwrap(),
        "Savings Fund",
        "from-side transfer_info should have the savings account name"
    );

    // Find the to-side transaction (positive amount)
    let to_txn = transactions
        .iter()
        .find(|t| t["id"].as_str().unwrap() == transfer.to_transaction.id.to_string())
        .expect("to_transaction should be in listing");

    // Verify transfer_info on to-side points to the checking account
    let to_transfer_info = &to_txn["transfer_info"];
    assert!(
        !to_transfer_info.is_null(),
        "to_transaction should have transfer_info"
    );
    assert_eq!(
        to_transfer_info["transfer_id"].as_str().unwrap(),
        transfer.id.to_string(),
        "transfer_info.transfer_id should match the transfer ID"
    );
    assert_eq!(
        to_transfer_info["linked_account_id"].as_str().unwrap(),
        checking.id.to_string(),
        "to-side transfer_info should link to the checking account"
    );
    assert_eq!(
        to_transfer_info["linked_account_name"].as_str().unwrap(),
        "Main Checking",
        "to-side transfer_info should have the checking account name"
    );
}
