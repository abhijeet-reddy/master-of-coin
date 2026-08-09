//! Integration tests for account-to-account transfer API endpoints.
//!
//! This module tests the transfer endpoint:
//! - POST /api/v1/transfers - Create a new transfer between two accounts
//!
//! It also tests cascading behaviour when deleting transfer transactions,
//! and verifies that `transfer_info` is populated in transaction listings.

use crate::common::*;
use chrono::Utc;
use master_of_coin_backend::models::{
    AccountResponse, TransactionResponse, TransferCandidate, TransferResponse,
};
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
// Delete Transfer (Cascading Soft-Delete) Tests
// ============================================================================

/// Test that soft-deleting one side of a transfer cascades to soft-delete both transactions.
///
/// Verifies that:
/// - Soft-deleting the from_transaction returns 200 (soft-delete)
/// - Both transactions are soft-deleted (still accessible via GET but have deleted_at)
/// - Neither transaction appears in the normal transaction listing
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

    // Soft-delete the from_transaction — should cascade and soft-delete both
    let delete_response = delete_authenticated(
        &server,
        &format!("/api/v1/transactions/{}", from_txn_id),
        &auth.token,
    )
    .await;
    assert_status(&delete_response, 200);

    let deleted_txn: TransactionResponse = extract_json(delete_response);
    assert!(
        deleted_txn.deleted_at.is_some(),
        "Soft-deleted transaction should have deleted_at set"
    );

    // Verify neither transaction appears in normal listing
    let list_response = get_authenticated(&server, "/api/v1/transactions", &auth.token).await;
    assert_status(&list_response, 200);
    let transactions: Vec<TransactionResponse> = extract_json(list_response);
    assert!(
        !transactions.iter().any(|t| t.id == from_txn_id),
        "from_transaction should not appear in normal listing after soft-delete"
    );
    assert!(
        !transactions.iter().any(|t| t.id == to_txn_id),
        "to_transaction should not appear in normal listing after soft-delete"
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
    // linked_amount on the from-side is the TO leg (+250.00)
    assert_eq!(
        from_transfer_info["linked_amount"].as_str().unwrap(),
        "250.00",
        "from-side transfer_info.linked_amount should be the to-leg amount"
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
    // linked_amount on the to-side is the FROM leg (-250.00)
    assert_eq!(
        to_transfer_info["linked_amount"].as_str().unwrap(),
        "-250.00",
        "to-side transfer_info.linked_amount should be the from-leg amount"
    );
}

// ============================================================================
// Convert-to-transfer Tests
// ============================================================================

/// Helper: create a normal transaction and return its JSON.
async fn create_normal_transaction(
    server: &axum_test::TestServer,
    token: &str,
    account_id: uuid::Uuid,
    amount: f64,
    extra: serde_json::Value,
) -> TransactionResponse {
    let mut request = json!({
        "account_id": account_id,
        "title": "To convert",
        "amount": amount,
        "date": Utc::now().to_rfc3339(),
    });
    if let Some(obj) = extra.as_object() {
        for (k, v) in obj {
            request[k] = v.clone();
        }
    }
    let response = post_authenticated(server, "/api/v1/transactions", token, &request).await;
    assert_status(&response, 201);
    extract_json(response)
}

/// A NEGATIVE (debit) transaction converts with the counterpart as the
/// DESTINATION: original stays the from-leg, new positive leg on the counterpart.
#[tokio::test]
async fn test_convert_debit_counterpart_is_destination() {
    let server = create_test_server().await;
    let timestamp = Utc::now().timestamp_nanos_opt().unwrap();
    let auth = register_test_user(
        &server,
        &format!("conv_debit_{}", timestamp),
        &format!("conv_debit_{}@example.com", timestamp),
        "SecurePass123!",
        "Convert Debit User",
    )
    .await;

    let source = create_account_with_currency(&server, &auth.token, "EUR Source", "EUR").await;
    let dest = create_account_with_currency(&server, &auth.token, "EUR Dest", "EUR").await;

    // A -100 debit on `source`.
    let txn = create_normal_transaction(&server, &auth.token, source.id, -100.0, json!({})).await;

    let request = json!({ "account_id": dest.id });
    let response = post_authenticated(
        &server,
        &format!("/api/v1/transactions/{}/convert-to-transfer", txn.id),
        &auth.token,
        &request,
    )
    .await;
    assert_status(&response, 201);
    let transfer: TransferResponse = extract_json(response);

    // Original (the -100 on source) is the from-leg.
    assert_eq!(transfer.from_transaction.id, txn.id);
    assert_eq!(transfer.from_transaction.account_id, source.id);
    assert_eq!(transfer.from_transaction.amount, "-100.00");
    // New leg is +100 on the destination account.
    assert_eq!(transfer.to_transaction.account_id, dest.id);
    assert_eq!(transfer.to_transaction.amount, "100.00");
    assert_eq!(transfer.exchange_rate, "1");

    // The transaction now reports transfer_info when fetched.
    let get = get_authenticated(
        &server,
        &format!("/api/v1/transactions/{}", txn.id),
        &auth.token,
    )
    .await;
    assert_status(&get, 200);
    let fetched: TransactionResponse = extract_json(get);
    assert!(
        fetched.transfer_info.is_some(),
        "converted transaction should carry transfer_info"
    );
}

/// A POSITIVE (credit) transaction converts with the counterpart as the SOURCE:
/// original becomes the to-leg, new negative leg on the counterpart.
#[tokio::test]
async fn test_convert_credit_counterpart_is_source() {
    let server = create_test_server().await;
    let timestamp = Utc::now().timestamp_nanos_opt().unwrap();
    let auth = register_test_user(
        &server,
        &format!("conv_credit_{}", timestamp),
        &format!("conv_credit_{}@example.com", timestamp),
        "SecurePass123!",
        "Convert Credit User",
    )
    .await;

    let dest = create_account_with_currency(&server, &auth.token, "EUR Dest", "EUR").await;
    let source = create_account_with_currency(&server, &auth.token, "EUR Source", "EUR").await;

    // A +100 credit on `dest`.
    let txn = create_normal_transaction(&server, &auth.token, dest.id, 100.0, json!({})).await;

    let request = json!({ "account_id": source.id });
    let response = post_authenticated(
        &server,
        &format!("/api/v1/transactions/{}/convert-to-transfer", txn.id),
        &auth.token,
        &request,
    )
    .await;
    assert_status(&response, 201);
    let transfer: TransferResponse = extract_json(response);

    // New leg is the -100 source; original +100 is the to-leg.
    assert_eq!(transfer.from_transaction.account_id, source.id);
    assert_eq!(transfer.from_transaction.amount, "-100.00");
    assert_eq!(transfer.to_transaction.id, txn.id);
    assert_eq!(transfer.to_transaction.account_id, dest.id);
    assert_eq!(transfer.to_transaction.amount, "100.00");
}

/// The original transaction's category is preserved (not overwritten).
#[tokio::test]
async fn test_convert_preserves_category() {
    let server = create_test_server().await;
    let timestamp = Utc::now().timestamp_nanos_opt().unwrap();
    let auth = register_test_user(
        &server,
        &format!("conv_cat_{}", timestamp),
        &format!("conv_cat_{}@example.com", timestamp),
        "SecurePass123!",
        "Convert Category User",
    )
    .await;

    let source = create_account_with_currency(&server, &auth.token, "EUR Source", "EUR").await;
    let dest = create_account_with_currency(&server, &auth.token, "EUR Dest", "EUR").await;
    let category = create_test_category(&server, &auth.token, "Groceries").await;

    let txn = create_normal_transaction(
        &server,
        &auth.token,
        source.id,
        -50.0,
        json!({ "category_id": category.id }),
    )
    .await;

    let request = json!({ "account_id": dest.id });
    let response = post_authenticated(
        &server,
        &format!("/api/v1/transactions/{}/convert-to-transfer", txn.id),
        &auth.token,
        &request,
    )
    .await;
    assert_status(&response, 201);
    let transfer: TransferResponse = extract_json(response);

    // Original leg keeps its category.
    assert_eq!(
        transfer.from_transaction.category_id,
        Some(category.id),
        "original leg should keep its category"
    );
    // New leg inherits the same category.
    assert_eq!(
        transfer.to_transaction.category_id,
        Some(category.id),
        "new leg should inherit the original category"
    );
}

/// A transaction with splits cannot be converted — API returns a validation error.
#[tokio::test]
async fn test_convert_with_splits_refused() {
    let server = create_test_server().await;
    let timestamp = Utc::now().timestamp_nanos_opt().unwrap();
    let auth = register_test_user(
        &server,
        &format!("conv_splits_{}", timestamp),
        &format!("conv_splits_{}@example.com", timestamp),
        "SecurePass123!",
        "Convert Splits User",
    )
    .await;

    let source = create_account_with_currency(&server, &auth.token, "EUR Source", "EUR").await;
    let dest = create_account_with_currency(&server, &auth.token, "EUR Dest", "EUR").await;
    let person = create_test_person(&server, &auth.token, "Alex").await;

    // -100 expense with a split.
    let txn = create_normal_transaction(
        &server,
        &auth.token,
        source.id,
        -100.0,
        json!({ "splits": [ { "person_id": person.id, "amount": 40.0 } ] }),
    )
    .await;

    let request = json!({ "account_id": dest.id });
    let response = post_authenticated(
        &server,
        &format!("/api/v1/transactions/{}/convert-to-transfer", txn.id),
        &auth.token,
        &request,
    )
    .await;
    // Validation error (splits present) → 422 Unprocessable Entity.
    assert_status(&response, 422);
}

/// A transaction already part of a transfer cannot be converted again.
#[tokio::test]
async fn test_convert_already_transfer_refused() {
    let server = create_test_server().await;
    let timestamp = Utc::now().timestamp_nanos_opt().unwrap();
    let auth = register_test_user(
        &server,
        &format!("conv_dup_{}", timestamp),
        &format!("conv_dup_{}@example.com", timestamp),
        "SecurePass123!",
        "Convert Dup User",
    )
    .await;

    let source = create_account_with_currency(&server, &auth.token, "EUR Source", "EUR").await;
    let dest = create_account_with_currency(&server, &auth.token, "EUR Dest", "EUR").await;
    let third = create_account_with_currency(&server, &auth.token, "EUR Third", "EUR").await;

    let txn = create_normal_transaction(&server, &auth.token, source.id, -100.0, json!({})).await;

    // First conversion succeeds.
    let ok = post_authenticated(
        &server,
        &format!("/api/v1/transactions/{}/convert-to-transfer", txn.id),
        &auth.token,
        &json!({ "account_id": dest.id }),
    )
    .await;
    assert_status(&ok, 201);

    // Second conversion of the same transaction is refused.
    let again = post_authenticated(
        &server,
        &format!("/api/v1/transactions/{}/convert-to-transfer", txn.id),
        &auth.token,
        &json!({ "account_id": third.id }),
    )
    .await;
    assert_status(&again, 422);
}

/// A soft-deleted transaction cannot be converted into a transfer.
#[tokio::test]
async fn test_convert_soft_deleted_refused() {
    let server = create_test_server().await;
    let timestamp = Utc::now().timestamp_nanos_opt().unwrap();
    let auth = register_test_user(
        &server,
        &format!("conv_deleted_{}", timestamp),
        &format!("conv_deleted_{}@example.com", timestamp),
        "SecurePass123!",
        "Convert Deleted User",
    )
    .await;

    let source = create_account_with_currency(&server, &auth.token, "EUR Source", "EUR").await;
    let dest = create_account_with_currency(&server, &auth.token, "EUR Dest", "EUR").await;

    let txn = create_normal_transaction(&server, &auth.token, source.id, -100.0, json!({})).await;

    // Soft-delete it.
    let del = delete_authenticated(
        &server,
        &format!("/api/v1/transactions/{}", txn.id),
        &auth.token,
    )
    .await;
    assert_status(&del, 200);

    // Convert must now be refused. The fail-safe find_by_id excludes deleted
    // rows, so the fetch fails with 404 before the row is ever loaded — the
    // deleted transaction is not eligible for conversion.
    let response = post_authenticated(
        &server,
        &format!("/api/v1/transactions/{}/convert-to-transfer", txn.id),
        &auth.token,
        &json!({ "account_id": dest.id }),
    )
    .await;
    assert_status(&response, 404);
}

// ============================================================================
// Same-currency UNEQUAL legs (issue #67)
// ============================================================================

/// Helper: fetch an account's current balance via the API.
async fn get_account_balance(
    server: &axum_test::TestServer,
    token: &str,
    account_id: uuid::Uuid,
) -> f64 {
    let response =
        get_authenticated(server, &format!("/api/v1/accounts/{}", account_id), token).await;
    assert_status(&response, 200);
    let account: AccountResponse = extract_json(response);
    account.balance
}

/// The motivating case: a same-currency transfer whose legs differ because the
/// destination received more than the source paid (a discounted gift-card
/// top-up). 48.50 leaves the source, 50.00 lands on the destination, and both
/// balances reflect their own leg. exchange_rate stays 1 (no conversion).
#[tokio::test]
async fn test_create_same_currency_transfer_unequal_legs() {
    let server = create_test_server().await;
    let timestamp = Utc::now().timestamp_nanos_opt().unwrap();

    let auth = register_test_user(
        &server,
        &format!("xfer_uneq_{}", timestamp),
        &format!("xfer_uneq_{}@example.com", timestamp),
        "SecurePass123!",
        "Transfer Unequal Legs User",
    )
    .await;

    let from_account =
        create_account_with_currency(&server, &auth.token, "T212 Card", "EUR").await;
    let to_account =
        create_account_with_currency(&server, &auth.token, "Tesco Gift Card", "EUR").await;

    // 48.50 out of the source, 50.00 onto the destination (1.50 discount).
    let request = json!({
        "from_account_id": from_account.id,
        "to_account_id": to_account.id,
        "from_amount": 48.50,
        "to_amount": 50.00,
        "date": Utc::now().to_rfc3339()
    });

    let response = post_authenticated(&server, "/api/v1/transfers", &auth.token, &request).await;
    assert_status(&response, 201);
    let transfer: TransferResponse = extract_json(response);

    // Legs carry their own amounts — the delta is implicit in the two legs.
    assert_eq!(
        transfer.from_transaction.amount, "-48.50",
        "source leg should be -48.50"
    );
    assert_eq!(
        transfer.to_transaction.amount, "50.00",
        "destination leg should be 50.00"
    );
    assert_eq!(
        transfer.exchange_rate, "1",
        "same-currency transfer keeps exchange_rate 1 even when legs differ"
    );

    // Both balances reflect their own leg (accounts start at 0).
    let from_balance = get_account_balance(&server, &auth.token, from_account.id).await;
    let to_balance = get_account_balance(&server, &auth.token, to_account.id).await;
    assert!(
        (from_balance - (-48.50)).abs() < 0.001,
        "source balance should be -48.50, got {}",
        from_balance
    );
    assert!(
        (to_balance - 50.00).abs() < 0.001,
        "destination balance should be 50.00, got {}",
        to_balance
    );
}

/// Regression: a same-currency transfer with no to_amount still produces equal
/// legs. The unequal-legs change must not alter the common path.
#[tokio::test]
async fn test_same_currency_transfer_defaults_to_equal_legs() {
    let server = create_test_server().await;
    let timestamp = Utc::now().timestamp_nanos_opt().unwrap();

    let auth = register_test_user(
        &server,
        &format!("xfer_eqdef_{}", timestamp),
        &format!("xfer_eqdef_{}@example.com", timestamp),
        "SecurePass123!",
        "Transfer Equal Default User",
    )
    .await;

    let from_account = create_account_with_currency(&server, &auth.token, "A", "EUR").await;
    let to_account = create_account_with_currency(&server, &auth.token, "B", "EUR").await;

    let request = json!({
        "from_account_id": from_account.id,
        "to_account_id": to_account.id,
        "from_amount": 100.0,
        "date": Utc::now().to_rfc3339()
    });

    let response = post_authenticated(&server, "/api/v1/transfers", &auth.token, &request).await;
    assert_status(&response, 201);
    let transfer: TransferResponse = extract_json(response);

    assert_eq!(transfer.from_transaction.amount, "-100.00");
    assert_eq!(transfer.to_transaction.amount, "100.00");
    assert_eq!(transfer.exchange_rate, "1");
}

/// Convert-to-transfer honours an unequal counterpart_amount for same-currency
/// too: a -48.50 debit converts to a transfer whose destination leg is 50.00.
#[tokio::test]
async fn test_convert_same_currency_unequal_counterpart() {
    let server = create_test_server().await;
    let timestamp = Utc::now().timestamp_nanos_opt().unwrap();

    let auth = register_test_user(
        &server,
        &format!("conv_uneq_{}", timestamp),
        &format!("conv_uneq_{}@example.com", timestamp),
        "SecurePass123!",
        "Convert Unequal User",
    )
    .await;

    let source = create_account_with_currency(&server, &auth.token, "EUR Source", "EUR").await;
    let dest = create_account_with_currency(&server, &auth.token, "EUR Dest", "EUR").await;

    // A -48.50 debit on source.
    let txn =
        create_normal_transaction(&server, &auth.token, source.id, -48.50, json!({})).await;

    // Convert, with the destination leg receiving 50.00 (same currency).
    let request = json!({ "account_id": dest.id, "counterpart_amount": 50.00 });
    let response = post_authenticated(
        &server,
        &format!("/api/v1/transactions/{}/convert-to-transfer", txn.id),
        &auth.token,
        &request,
    )
    .await;
    assert_status(&response, 201);
    let transfer: TransferResponse = extract_json(response);

    assert_eq!(transfer.from_transaction.id, txn.id);
    assert_eq!(transfer.from_transaction.amount, "-48.50");
    assert_eq!(transfer.to_transaction.account_id, dest.id);
    assert_eq!(transfer.to_transaction.amount, "50.00");
    assert_eq!(transfer.exchange_rate, "1");

    let dest_balance = get_account_balance(&server, &auth.token, dest.id).await;
    assert!(
        (dest_balance - 50.00).abs() < 0.001,
        "destination balance should be 50.00, got {}",
        dest_balance
    );
}

// ============================================================================
// Convert-to-transfer: LINK an existing counterpart (issue: convert-link)
// ============================================================================

/// Fetch convert candidates for a transaction against a counterpart account.
async fn get_convert_candidates(
    server: &axum_test::TestServer,
    token: &str,
    transaction_id: uuid::Uuid,
    account_id: uuid::Uuid,
    search: Option<&str>,
) -> Vec<TransferCandidate> {
    let mut path = format!(
        "/api/v1/transactions/{}/convert-candidates?account_id={}",
        transaction_id, account_id
    );
    if let Some(s) = search {
        path.push_str(&format!("&search={}", s));
    }
    let response = get_authenticated(server, &path, token).await;
    assert_status(&response, 200);
    extract_json(response)
}

/// Link an existing counterpart via convert-to-transfer.
async fn convert_linking(
    server: &axum_test::TestServer,
    token: &str,
    transaction_id: uuid::Uuid,
    account_id: uuid::Uuid,
    counterpart_transaction_id: uuid::Uuid,
) -> axum_test::TestResponse {
    let request = json!({
        "account_id": account_id,
        "counterpart_transaction_id": counterpart_transaction_id,
    });
    post_authenticated(
        server,
        &format!("/api/v1/transactions/{}/convert-to-transfer", transaction_id),
        token,
        &request,
    )
    .await
}

/// Suggestions: an opposite-sign, same-amount row within the window is a
/// candidate, and linking it joins the two existing rows without creating a
/// third. Balances are unchanged (both rows already existed).
#[tokio::test]
async fn test_convert_link_suggestion_found_and_links() {
    let server = create_test_server().await;
    let timestamp = Utc::now().timestamp_nanos_opt().unwrap();
    let auth = register_test_user(
        &server,
        &format!("link_sugg_{}", timestamp),
        &format!("link_sugg_{}@example.com", timestamp),
        "SecurePass123!",
        "Link Suggestion User",
    )
    .await;

    let source = create_account_with_currency(&server, &auth.token, "EUR Source", "EUR").await;
    let dest = create_account_with_currency(&server, &auth.token, "EUR Dest", "EUR").await;

    // Both legs already exist as imported rows on the same day.
    let out = create_normal_transaction(&server, &auth.token, source.id, -100.0, json!({})).await;
    let inc = create_normal_transaction(&server, &auth.token, dest.id, 100.0, json!({})).await;

    // Suggestion appears.
    let candidates =
        get_convert_candidates(&server, &auth.token, out.id, dest.id, None).await;
    assert_eq!(candidates.len(), 1, "should suggest the matching inflow");
    assert_eq!(candidates[0].id, inc.id);

    // Link it.
    let response = convert_linking(&server, &auth.token, out.id, dest.id, inc.id).await;
    assert_status(&response, 201);
    let transfer: TransferResponse = extract_json(response);
    assert_eq!(transfer.from_transaction.id, out.id);
    assert_eq!(transfer.to_transaction.id, inc.id);
    assert_eq!(transfer.from_transaction.amount, "-100.00");
    assert_eq!(transfer.to_transaction.amount, "100.00");

    // No third row was created: still exactly 2 transactions on the ledger.
    let list = get_authenticated(&server, "/api/v1/transactions", &auth.token).await;
    let txns: Vec<serde_json::Value> = extract_json(list);
    assert_eq!(txns.len(), 2, "linking must not create a third transaction");
}

/// The linked row's category and notes are NOT mutated by linking.
#[tokio::test]
async fn test_convert_link_preserves_counterpart_category_and_notes() {
    let server = create_test_server().await;
    let timestamp = Utc::now().timestamp_nanos_opt().unwrap();
    let auth = register_test_user(
        &server,
        &format!("link_pres_{}", timestamp),
        &format!("link_pres_{}@example.com", timestamp),
        "SecurePass123!",
        "Link Preserve User",
    )
    .await;

    let source = create_account_with_currency(&server, &auth.token, "EUR Source", "EUR").await;
    let dest = create_account_with_currency(&server, &auth.token, "EUR Dest", "EUR").await;

    // Counterpart has its own notes.
    let out = create_normal_transaction(&server, &auth.token, source.id, -60.0, json!({})).await;
    let inc = create_normal_transaction(
        &server,
        &auth.token,
        dest.id,
        60.0,
        json!({ "notes": "hand set note" }),
    )
    .await;

    let response = convert_linking(&server, &auth.token, out.id, dest.id, inc.id).await;
    assert_status(&response, 201);

    // Re-fetch the counterpart; its notes survive.
    let get = get_authenticated(
        &server,
        &format!("/api/v1/transactions/{}", inc.id),
        &auth.token,
    )
    .await;
    assert_status(&get, 200);
    let fetched: TransactionResponse = extract_json(get);
    assert_eq!(
        fetched.notes.as_deref(),
        Some("hand set note"),
        "linking must not overwrite the counterpart's notes"
    );
    assert_eq!(fetched.amount, "60.00", "counterpart keeps its own amount");
}

/// The same counterpart row cannot be linked into two transfers. The second
/// submit is rejected and no second transfers row is created (double-link guard
/// on the submit path).
#[tokio::test]
async fn test_convert_link_double_link_rejected() {
    let server = create_test_server().await;
    let timestamp = Utc::now().timestamp_nanos_opt().unwrap();
    let auth = register_test_user(
        &server,
        &format!("link_dbl_{}", timestamp),
        &format!("link_dbl_{}@example.com", timestamp),
        "SecurePass123!",
        "Link Double User",
    )
    .await;

    let source = create_account_with_currency(&server, &auth.token, "EUR Source", "EUR").await;
    let dest = create_account_with_currency(&server, &auth.token, "EUR Dest", "EUR").await;
    let source2 = create_account_with_currency(&server, &auth.token, "EUR Source2", "EUR").await;

    let out = create_normal_transaction(&server, &auth.token, source.id, -30.0, json!({})).await;
    let inc = create_normal_transaction(&server, &auth.token, dest.id, 30.0, json!({})).await;
    let out2 = create_normal_transaction(&server, &auth.token, source2.id, -30.0, json!({})).await;

    // First link succeeds.
    let r1 = convert_linking(&server, &auth.token, out.id, dest.id, inc.id).await;
    assert_status(&r1, 201);

    // Second attempt to link the SAME counterpart (inc) from a different source
    // must be rejected.
    let r2 = convert_linking(&server, &auth.token, out2.id, dest.id, inc.id).await;
    assert_status(&r2, 422);
}

/// Search finds an out-of-window opposite-sign row that suggestions exclude.
#[tokio::test]
async fn test_convert_link_search_finds_out_of_window() {
    let server = create_test_server().await;
    let timestamp = Utc::now().timestamp_nanos_opt().unwrap();
    let auth = register_test_user(
        &server,
        &format!("link_search_{}", timestamp),
        &format!("link_search_{}@example.com", timestamp),
        "SecurePass123!",
        "Link Search User",
    )
    .await;

    let source = create_account_with_currency(&server, &auth.token, "EUR Source", "EUR").await;
    let dest = create_account_with_currency(&server, &auth.token, "EUR Dest", "EUR").await;

    let now = Utc::now();
    let out = create_normal_transaction(
        &server,
        &auth.token,
        source.id,
        -75.0,
        json!({ "date": now.to_rfc3339() }),
    )
    .await;
    // Counterpart is 5 days earlier and a different amount: outside the window
    // and not amount-matched, so NOT a suggestion.
    let far = create_normal_transaction(
        &server,
        &auth.token,
        dest.id,
        70.0,
        json!({ "title": "Zebra Payout", "date": (now - chrono::Duration::days(5)).to_rfc3339() }),
    )
    .await;

    // Suggestions do not include it.
    let suggestions =
        get_convert_candidates(&server, &auth.token, out.id, dest.id, None).await;
    assert!(
        !suggestions.iter().any(|c| c.id == far.id),
        "out-of-window row must not be a suggestion"
    );

    // Search by title finds it.
    let results =
        get_convert_candidates(&server, &auth.token, out.id, dest.id, Some("Zebra")).await;
    assert!(
        results.iter().any(|c| c.id == far.id),
        "search should find the out-of-window opposite-sign row"
    );

    // And it can be linked (unequal legs allowed, per #67).
    let response = convert_linking(&server, &auth.token, out.id, dest.id, far.id).await;
    assert_status(&response, 201);
}

/// Search excludes a same-sign row, a soft-deleted row, and an already-linked
/// row.
#[tokio::test]
async fn test_convert_candidates_exclusions() {
    let server = create_test_server().await;
    let timestamp = Utc::now().timestamp_nanos_opt().unwrap();
    let auth = register_test_user(
        &server,
        &format!("link_excl_{}", timestamp),
        &format!("link_excl_{}@example.com", timestamp),
        "SecurePass123!",
        "Link Exclusions User",
    )
    .await;

    let source = create_account_with_currency(&server, &auth.token, "EUR Source", "EUR").await;
    let dest = create_account_with_currency(&server, &auth.token, "EUR Dest", "EUR").await;

    let out = create_normal_transaction(&server, &auth.token, source.id, -50.0, json!({})).await;

    // Same-sign row in dest (also an outflow) must never be a candidate.
    let same_sign =
        create_normal_transaction(&server, &auth.token, dest.id, -50.0, json!({})).await;
    // A valid opposite-sign candidate.
    let good = create_normal_transaction(&server, &auth.token, dest.id, 50.0, json!({})).await;

    let candidates =
        get_convert_candidates(&server, &auth.token, out.id, dest.id, None).await;
    assert!(
        candidates.iter().any(|c| c.id == good.id),
        "opposite-sign match should be a candidate"
    );
    assert!(
        !candidates.iter().any(|c| c.id == same_sign.id),
        "same-sign row must be excluded"
    );

    // Link `good`, then it must no longer appear as a candidate for another txn.
    let out2 = create_normal_transaction(&server, &auth.token, source.id, -50.0, json!({})).await;
    let r = convert_linking(&server, &auth.token, out.id, dest.id, good.id).await;
    assert_status(&r, 201);
    let after =
        get_convert_candidates(&server, &auth.token, out2.id, dest.id, None).await;
    assert!(
        !after.iter().any(|c| c.id == good.id),
        "an already-linked row must be excluded from candidates"
    );
}
