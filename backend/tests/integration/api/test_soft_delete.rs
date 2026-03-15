//! Integration tests for soft-delete transaction functionality.
//!
//! This module tests the soft-delete feature including:
//! - DELETE /api/v1/transactions/:id - Soft-delete (move to trash)
//! - POST /api/v1/transactions/:id/restore - Restore from trash
//! - DELETE /api/v1/transactions/:id?is_permanent=true - Permanent delete
//! - GET /api/v1/transactions?is_deleted=true - List trashed transactions
//!
//! Tests cover soft-delete, restore, permanent delete, error cases,
//! and transfer pair cascading behaviour.

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
// Soft Delete Tests
// ============================================================================

/// Test soft-deleting a transaction moves it to trash.
///
/// Verifies that:
/// - DELETE returns 200 (not 204)
/// - Response body contains `deleted_at` (not null) and `permanent_delete_at` (not null)
/// - Transaction no longer appears in `GET /transactions` (normal listing)
/// - Transaction appears in `GET /transactions?is_deleted=true` (trash listing)
#[tokio::test]
async fn test_soft_delete_transaction() {
    let server = create_test_server().await;
    let timestamp = Utc::now().timestamp_nanos_opt().unwrap();

    let auth = register_test_user(
        &server,
        &format!("softdel_{}", timestamp),
        &format!("softdel_{}@example.com", timestamp),
        "SecurePass123!",
        "Soft Delete User",
    )
    .await;

    let account = create_test_account(&server, &auth.token, "Test Account").await;
    let category = create_test_category(&server, &auth.token, "Test Category").await;

    // Create a transaction
    let create_request = json!({
        "account_id": account.id,
        "category_id": category.id,
        "title": "Transaction to Soft Delete",
        "amount": -75.00,
        "date": Utc::now().to_rfc3339()
    });
    let create_response = post_authenticated(
        &server,
        "/api/v1/transactions",
        &auth.token,
        &create_request,
    )
    .await;
    assert_status(&create_response, 201);
    let transaction: TransactionResponse = extract_json(create_response);

    // Soft-delete the transaction
    let delete_response = delete_authenticated(
        &server,
        &format!("/api/v1/transactions/{}", transaction.id),
        &auth.token,
    )
    .await;
    assert_status(&delete_response, 200);

    let deleted_txn: TransactionResponse = extract_json(delete_response);
    assert!(
        deleted_txn.deleted_at.is_some(),
        "Soft-deleted transaction should have deleted_at set"
    );
    assert!(
        deleted_txn.permanent_delete_at.is_some(),
        "Soft-deleted transaction should have permanent_delete_at set"
    );

    // Verify transaction does NOT appear in normal listing
    let normal_list = get_authenticated(&server, "/api/v1/transactions", &auth.token).await;
    assert_status(&normal_list, 200);
    let normal_transactions: Vec<TransactionResponse> = extract_json(normal_list);
    assert!(
        !normal_transactions.iter().any(|t| t.id == transaction.id),
        "Soft-deleted transaction should not appear in normal listing"
    );

    // Verify transaction DOES appear in trash listing
    let trash_list =
        get_authenticated(&server, "/api/v1/transactions?is_deleted=true", &auth.token).await;
    assert_status(&trash_list, 200);
    let trash_transactions: Vec<TransactionResponse> = extract_json(trash_list);
    assert!(
        trash_transactions.iter().any(|t| t.id == transaction.id),
        "Soft-deleted transaction should appear in trash listing"
    );
}

// ============================================================================
// Restore Tests
// ============================================================================

/// Test restoring a soft-deleted transaction from trash.
///
/// Verifies that:
/// - POST /transactions/:id/restore returns 200
/// - Transaction reappears in `GET /transactions` (normal listing)
/// - Transaction no longer appears in `GET /transactions?is_deleted=true`
#[tokio::test]
async fn test_restore_transaction() {
    let server = create_test_server().await;
    let timestamp = Utc::now().timestamp_nanos_opt().unwrap();

    let auth = register_test_user(
        &server,
        &format!("restore_{}", timestamp),
        &format!("restore_{}@example.com", timestamp),
        "SecurePass123!",
        "Restore User",
    )
    .await;

    let account = create_test_account(&server, &auth.token, "Test Account").await;
    let category = create_test_category(&server, &auth.token, "Test Category").await;

    // Create a transaction
    let create_request = json!({
        "account_id": account.id,
        "category_id": category.id,
        "title": "Transaction to Restore",
        "amount": -120.00,
        "date": Utc::now().to_rfc3339()
    });
    let create_response = post_authenticated(
        &server,
        "/api/v1/transactions",
        &auth.token,
        &create_request,
    )
    .await;
    assert_status(&create_response, 201);
    let transaction: TransactionResponse = extract_json(create_response);

    // Soft-delete the transaction
    let delete_response = delete_authenticated(
        &server,
        &format!("/api/v1/transactions/{}", transaction.id),
        &auth.token,
    )
    .await;
    assert_status(&delete_response, 200);

    // Restore the transaction
    let restore_response = post_authenticated(
        &server,
        &format!("/api/v1/transactions/{}/restore", transaction.id),
        &auth.token,
        &json!({}),
    )
    .await;
    assert_status(&restore_response, 200);

    let restored_txn: TransactionResponse = extract_json(restore_response);
    assert!(
        restored_txn.deleted_at.is_none(),
        "Restored transaction should not have deleted_at"
    );

    // Verify transaction reappears in normal listing
    let normal_list = get_authenticated(&server, "/api/v1/transactions", &auth.token).await;
    assert_status(&normal_list, 200);
    let normal_transactions: Vec<TransactionResponse> = extract_json(normal_list);
    assert!(
        normal_transactions.iter().any(|t| t.id == transaction.id),
        "Restored transaction should appear in normal listing"
    );

    // Verify transaction no longer appears in trash listing
    let trash_list =
        get_authenticated(&server, "/api/v1/transactions?is_deleted=true", &auth.token).await;
    assert_status(&trash_list, 200);
    let trash_transactions: Vec<TransactionResponse> = extract_json(trash_list);
    assert!(
        !trash_transactions.iter().any(|t| t.id == transaction.id),
        "Restored transaction should not appear in trash listing"
    );
}

// ============================================================================
// Permanent Delete Tests
// ============================================================================

/// Test permanently deleting a soft-deleted transaction.
///
/// Verifies that:
/// - DELETE /transactions/:id?is_permanent=true returns 204
/// - Transaction no longer appears in either normal or trash listing
/// - GET /transactions/:id returns 404
#[tokio::test]
async fn test_permanent_delete_transaction() {
    let server = create_test_server().await;
    let timestamp = Utc::now().timestamp_nanos_opt().unwrap();

    let auth = register_test_user(
        &server,
        &format!("permdel_{}", timestamp),
        &format!("permdel_{}@example.com", timestamp),
        "SecurePass123!",
        "Permanent Delete User",
    )
    .await;

    let account = create_test_account(&server, &auth.token, "Test Account").await;
    let category = create_test_category(&server, &auth.token, "Test Category").await;

    // Create a transaction
    let create_request = json!({
        "account_id": account.id,
        "category_id": category.id,
        "title": "Transaction to Permanently Delete",
        "amount": -200.00,
        "date": Utc::now().to_rfc3339()
    });
    let create_response = post_authenticated(
        &server,
        "/api/v1/transactions",
        &auth.token,
        &create_request,
    )
    .await;
    assert_status(&create_response, 201);
    let transaction: TransactionResponse = extract_json(create_response);

    // First soft-delete the transaction
    let delete_response = delete_authenticated(
        &server,
        &format!("/api/v1/transactions/{}", transaction.id),
        &auth.token,
    )
    .await;
    assert_status(&delete_response, 200);

    // Now permanently delete it
    let perm_delete_response = delete_authenticated(
        &server,
        &format!("/api/v1/transactions/{}?is_permanent=true", transaction.id),
        &auth.token,
    )
    .await;
    assert_status(&perm_delete_response, 204);

    // Verify transaction is gone from normal listing
    let normal_list = get_authenticated(&server, "/api/v1/transactions", &auth.token).await;
    assert_status(&normal_list, 200);
    let normal_transactions: Vec<TransactionResponse> = extract_json(normal_list);
    assert!(
        !normal_transactions.iter().any(|t| t.id == transaction.id),
        "Permanently deleted transaction should not appear in normal listing"
    );

    // Verify transaction is gone from trash listing
    let trash_list =
        get_authenticated(&server, "/api/v1/transactions?is_deleted=true", &auth.token).await;
    assert_status(&trash_list, 200);
    let trash_transactions: Vec<TransactionResponse> = extract_json(trash_list);
    assert!(
        !trash_transactions.iter().any(|t| t.id == transaction.id),
        "Permanently deleted transaction should not appear in trash listing"
    );

    // Verify GET returns 404
    let get_response = get_authenticated(
        &server,
        &format!("/api/v1/transactions/{}", transaction.id),
        &auth.token,
    )
    .await;
    assert_status(&get_response, 404);
}

// ============================================================================
// Error Case Tests
// ============================================================================

/// Test that permanent delete on an active (non-deleted) transaction fails.
///
/// Verifies that:
/// - DELETE /transactions/:id?is_permanent=true on a non-deleted transaction returns 400
/// - Transaction remains accessible and unchanged
#[tokio::test]
async fn test_permanent_delete_active_transaction_fails() {
    let server = create_test_server().await;
    let timestamp = Utc::now().timestamp_nanos_opt().unwrap();

    let auth = register_test_user(
        &server,
        &format!("permdel_active_{}", timestamp),
        &format!("permdel_active_{}@example.com", timestamp),
        "SecurePass123!",
        "Permanent Delete Active User",
    )
    .await;

    let account = create_test_account(&server, &auth.token, "Test Account").await;
    let category = create_test_category(&server, &auth.token, "Test Category").await;

    // Create a transaction (do NOT soft-delete it)
    let create_request = json!({
        "account_id": account.id,
        "category_id": category.id,
        "title": "Active Transaction",
        "amount": -50.00,
        "date": Utc::now().to_rfc3339()
    });
    let create_response = post_authenticated(
        &server,
        "/api/v1/transactions",
        &auth.token,
        &create_request,
    )
    .await;
    assert_status(&create_response, 201);
    let transaction: TransactionResponse = extract_json(create_response);

    // Try to permanently delete an active transaction — should fail
    let perm_delete_response = delete_authenticated(
        &server,
        &format!("/api/v1/transactions/{}?is_permanent=true", transaction.id),
        &auth.token,
    )
    .await;
    assert_status(&perm_delete_response, 400);

    // Verify transaction still exists and is accessible
    let get_response = get_authenticated(
        &server,
        &format!("/api/v1/transactions/{}", transaction.id),
        &auth.token,
    )
    .await;
    assert_status(&get_response, 200);

    let fetched: TransactionResponse = extract_json(get_response);
    assert_eq!(fetched.title, "Active Transaction");
    assert!(
        fetched.deleted_at.is_none(),
        "Transaction should still be active (not deleted)"
    );
}

/// Test that restoring an active (non-deleted) transaction fails.
///
/// Verifies that:
/// - POST /transactions/:id/restore on a non-deleted transaction returns 400
/// - Transaction remains unchanged
#[tokio::test]
async fn test_restore_active_transaction_fails() {
    let server = create_test_server().await;
    let timestamp = Utc::now().timestamp_nanos_opt().unwrap();

    let auth = register_test_user(
        &server,
        &format!("restore_active_{}", timestamp),
        &format!("restore_active_{}@example.com", timestamp),
        "SecurePass123!",
        "Restore Active User",
    )
    .await;

    let account = create_test_account(&server, &auth.token, "Test Account").await;
    let category = create_test_category(&server, &auth.token, "Test Category").await;

    // Create a transaction (do NOT soft-delete it)
    let create_request = json!({
        "account_id": account.id,
        "category_id": category.id,
        "title": "Active Transaction",
        "amount": -80.00,
        "date": Utc::now().to_rfc3339()
    });
    let create_response = post_authenticated(
        &server,
        "/api/v1/transactions",
        &auth.token,
        &create_request,
    )
    .await;
    assert_status(&create_response, 201);
    let transaction: TransactionResponse = extract_json(create_response);

    // Try to restore an active transaction — should fail
    let restore_response = post_authenticated(
        &server,
        &format!("/api/v1/transactions/{}/restore", transaction.id),
        &auth.token,
        &json!({}),
    )
    .await;
    assert_status(&restore_response, 400);

    // Verify transaction is still active and unchanged
    let get_response = get_authenticated(
        &server,
        &format!("/api/v1/transactions/{}", transaction.id),
        &auth.token,
    )
    .await;
    assert_status(&get_response, 200);

    let fetched: TransactionResponse = extract_json(get_response);
    assert_eq!(fetched.title, "Active Transaction");
    assert!(
        fetched.deleted_at.is_none(),
        "Transaction should still be active (not deleted)"
    );
}

// ============================================================================
// Transfer Pair Soft-Delete Tests
// ============================================================================

/// Test that soft-deleting one side of a transfer soft-deletes both transactions.
///
/// Verifies that:
/// - Both transactions appear in trash listing after soft-deleting one side
/// - Neither appears in normal listing
#[tokio::test]
async fn test_transfer_pair_soft_delete() {
    let server = create_test_server().await;
    let timestamp = Utc::now().timestamp_nanos_opt().unwrap();

    let auth = register_test_user(
        &server,
        &format!("xfer_softdel_{}", timestamp),
        &format!("xfer_softdel_{}@example.com", timestamp),
        "SecurePass123!",
        "Transfer Soft Delete User",
    )
    .await;

    // Create two accounts
    let from_account =
        create_account_with_currency(&server, &auth.token, "From Account", "USD").await;
    let to_account = create_account_with_currency(&server, &auth.token, "To Account", "USD").await;

    // Create a transfer
    let transfer_request = json!({
        "from_account_id": from_account.id,
        "to_account_id": to_account.id,
        "from_amount": 150.0,
        "date": Utc::now().to_rfc3339()
    });

    let create_response =
        post_authenticated(&server, "/api/v1/transfers", &auth.token, &transfer_request).await;
    assert_status(&create_response, 201);
    let transfer: TransferResponse = extract_json(create_response);

    let from_txn_id = transfer.from_transaction.id;
    let to_txn_id = transfer.to_transaction.id;

    // Verify both transactions appear in normal listing
    let normal_list = get_authenticated(&server, "/api/v1/transactions", &auth.token).await;
    assert_status(&normal_list, 200);
    let normal_transactions: Vec<TransactionResponse> = extract_json(normal_list);
    assert_eq!(
        normal_transactions.len(),
        2,
        "Should have 2 transactions from the transfer"
    );

    // Soft-delete one side of the transfer (the from_transaction)
    let delete_response = delete_authenticated(
        &server,
        &format!("/api/v1/transactions/{}", from_txn_id),
        &auth.token,
    )
    .await;
    assert_status(&delete_response, 200);

    // Verify NEITHER transaction appears in normal listing
    let normal_list_after = get_authenticated(&server, "/api/v1/transactions", &auth.token).await;
    assert_status(&normal_list_after, 200);
    let normal_after: Vec<TransactionResponse> = extract_json(normal_list_after);
    assert!(
        !normal_after.iter().any(|t| t.id == from_txn_id),
        "from_transaction should not appear in normal listing after soft-delete"
    );
    assert!(
        !normal_after.iter().any(|t| t.id == to_txn_id),
        "to_transaction should not appear in normal listing after soft-delete"
    );

    // Verify BOTH transactions appear in trash listing
    let trash_list =
        get_authenticated(&server, "/api/v1/transactions?is_deleted=true", &auth.token).await;
    assert_status(&trash_list, 200);
    let trash_transactions: Vec<TransactionResponse> = extract_json(trash_list);
    assert!(
        trash_transactions.iter().any(|t| t.id == from_txn_id),
        "from_transaction should appear in trash listing"
    );
    assert!(
        trash_transactions.iter().any(|t| t.id == to_txn_id),
        "to_transaction should appear in trash listing"
    );
}

/// Test that restoring one side of a soft-deleted transfer restores both transactions.
///
/// Verifies that:
/// - After soft-deleting a transfer, restoring one side restores both
/// - Both transactions reappear in normal listing
/// - Neither appears in trash listing
#[tokio::test]
async fn test_transfer_pair_restore() {
    let server = create_test_server().await;
    let timestamp = Utc::now().timestamp_nanos_opt().unwrap();

    let auth = register_test_user(
        &server,
        &format!("xfer_restore_{}", timestamp),
        &format!("xfer_restore_{}@example.com", timestamp),
        "SecurePass123!",
        "Transfer Restore User",
    )
    .await;

    // Create two accounts
    let from_account =
        create_account_with_currency(&server, &auth.token, "From Account", "USD").await;
    let to_account = create_account_with_currency(&server, &auth.token, "To Account", "USD").await;

    // Create a transfer
    let transfer_request = json!({
        "from_account_id": from_account.id,
        "to_account_id": to_account.id,
        "from_amount": 200.0,
        "date": Utc::now().to_rfc3339()
    });

    let create_response =
        post_authenticated(&server, "/api/v1/transfers", &auth.token, &transfer_request).await;
    assert_status(&create_response, 201);
    let transfer: TransferResponse = extract_json(create_response);

    let from_txn_id = transfer.from_transaction.id;
    let to_txn_id = transfer.to_transaction.id;

    // Soft-delete one side of the transfer
    let delete_response = delete_authenticated(
        &server,
        &format!("/api/v1/transactions/{}", from_txn_id),
        &auth.token,
    )
    .await;
    assert_status(&delete_response, 200);

    // Verify both are in trash
    let trash_list =
        get_authenticated(&server, "/api/v1/transactions?is_deleted=true", &auth.token).await;
    assert_status(&trash_list, 200);
    let trash_transactions: Vec<TransactionResponse> = extract_json(trash_list);
    assert_eq!(
        trash_transactions.len(),
        2,
        "Both transfer transactions should be in trash"
    );

    // Restore one side of the transfer (the to_transaction this time)
    let restore_response = post_authenticated(
        &server,
        &format!("/api/v1/transactions/{}/restore", to_txn_id),
        &auth.token,
        &json!({}),
    )
    .await;
    assert_status(&restore_response, 200);

    // Verify BOTH transactions reappear in normal listing
    let normal_list = get_authenticated(&server, "/api/v1/transactions", &auth.token).await;
    assert_status(&normal_list, 200);
    let normal_transactions: Vec<TransactionResponse> = extract_json(normal_list);
    assert!(
        normal_transactions.iter().any(|t| t.id == from_txn_id),
        "from_transaction should reappear in normal listing after restore"
    );
    assert!(
        normal_transactions.iter().any(|t| t.id == to_txn_id),
        "to_transaction should reappear in normal listing after restore"
    );

    // Verify NEITHER transaction appears in trash listing
    let trash_list_after =
        get_authenticated(&server, "/api/v1/transactions?is_deleted=true", &auth.token).await;
    assert_status(&trash_list_after, 200);
    let trash_after: Vec<TransactionResponse> = extract_json(trash_list_after);
    assert!(
        !trash_after.iter().any(|t| t.id == from_txn_id),
        "from_transaction should not appear in trash after restore"
    );
    assert!(
        !trash_after.iter().any(|t| t.id == to_txn_id),
        "to_transaction should not appear in trash after restore"
    );
}
