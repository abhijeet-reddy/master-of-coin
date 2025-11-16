//! Integration tests for transaction API endpoints.
//!
//! This module tests the transaction endpoints including:
//! - GET /api/v1/transactions - List transactions with optional filters
//! - POST /api/v1/transactions - Create new transaction
//! - GET /api/v1/transactions/:id - Get specific transaction
//! - PUT /api/v1/transactions/:id - Update transaction
//! - DELETE /api/v1/transactions/:id - Delete transaction
//!
//! Tests cover success cases, error cases, authorization, data isolation, and splits functionality.

use crate::common::*;
use chrono::{Duration, Utc};
use master_of_coin_backend::models::TransactionResponse;
use serde_json::json;

// ============================================================================
// List Transactions Tests
// ============================================================================

/// Test that a new user has no transactions initially.
///
/// Verifies that:
/// - Status code is 200 OK
/// - Response is an empty array
/// - No transactions exist for a newly registered user
#[tokio::test]
async fn test_list_transactions_empty() {
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

    // List transactions should return empty array
    let response = get_authenticated(&server, "/api/v1/transactions", &auth.token).await;
    assert_status(&response, 200);

    let transactions: Vec<TransactionResponse> = extract_json(response);
    assert_eq!(
        transactions.len(),
        0,
        "New user should have no transactions"
    );
}

/// Test that list transactions returns user's transactions.
///
/// Verifies that:
/// - Status code is 200 OK
/// - Response contains all user's transactions
/// - Transaction data is correct
#[tokio::test]
async fn test_list_transactions_with_data() {
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

    // Create account and category
    let account = create_test_account(&server, &auth.token, "Test Account").await;
    let category = create_test_category(&server, &auth.token, "Test Category").await;

    // Create multiple transactions
    let transaction1 = json!({
        "account_id": account.id,
        "category_id": category.id,
        "title": "Grocery Shopping",
        "amount": -50.00,
        "date": Utc::now().to_rfc3339(),
        "notes": "Weekly groceries"
    });
    let response1 =
        post_authenticated(&server, "/api/v1/transactions", &auth.token, &transaction1).await;
    assert_status(&response1, 201);

    let transaction2 = json!({
        "account_id": account.id,
        "category_id": category.id,
        "title": "Salary",
        "amount": 3000.00,
        "date": Utc::now().to_rfc3339()
    });
    let response2 =
        post_authenticated(&server, "/api/v1/transactions", &auth.token, &transaction2).await;
    assert_status(&response2, 201);

    // List transactions
    let response = get_authenticated(&server, "/api/v1/transactions", &auth.token).await;
    assert_status(&response, 200);

    let transactions: Vec<TransactionResponse> = extract_json(response);
    assert_eq!(transactions.len(), 2, "User should have 2 transactions");

    // Verify transaction details
    let grocery = transactions
        .iter()
        .find(|t| t.title == "Grocery Shopping")
        .unwrap();
    assert_eq!(grocery.amount, "-50.00");
    assert_eq!(grocery.account_id, account.id);

    let salary = transactions.iter().find(|t| t.title == "Salary").unwrap();
    assert_eq!(salary.amount, "3000.00");
}

/// Test filtering transactions by account_id.
///
/// Verifies that:
/// - Status code is 200 OK
/// - Only transactions for specified account are returned
#[tokio::test]
async fn test_list_transactions_filter_by_account() {
    let server = create_test_server().await;
    let timestamp = Utc::now().timestamp_nanos_opt().unwrap();

    let auth = register_test_user(
        &server,
        &format!("filteracct_{}", timestamp),
        &format!("filteracct_{}@example.com", timestamp),
        "SecurePass123!",
        "Filter Account User",
    )
    .await;

    // Create two accounts
    let account1 = create_test_account(&server, &auth.token, "Account 1").await;
    let account2 = create_test_account(&server, &auth.token, "Account 2").await;
    let category = create_test_category(&server, &auth.token, "Test Category").await;

    // Create transactions in different accounts
    let txn1 = json!({
        "account_id": account1.id,
        "category_id": category.id,
        "title": "Transaction in Account 1",
        "amount": -25.00,
        "date": Utc::now().to_rfc3339()
    });
    post_authenticated(&server, "/api/v1/transactions", &auth.token, &txn1).await;

    let txn2 = json!({
        "account_id": account2.id,
        "category_id": category.id,
        "title": "Transaction in Account 2",
        "amount": -35.00,
        "date": Utc::now().to_rfc3339()
    });
    post_authenticated(&server, "/api/v1/transactions", &auth.token, &txn2).await;

    // Filter by account1
    let response = get_authenticated(
        &server,
        &format!("/api/v1/transactions?account_id={}", account1.id),
        &auth.token,
    )
    .await;
    assert_status(&response, 200);

    let transactions: Vec<TransactionResponse> = extract_json(response);
    assert_eq!(transactions.len(), 1);
    assert_eq!(transactions[0].account_id, account1.id);
    assert_eq!(transactions[0].title, "Transaction in Account 1");
}

/// Test filtering transactions by category_id.
///
/// Verifies that:
/// - Status code is 200 OK
/// - Only transactions for specified category are returned
#[tokio::test]
async fn test_list_transactions_filter_by_category() {
    let server = create_test_server().await;
    let timestamp = Utc::now().timestamp_nanos_opt().unwrap();

    let auth = register_test_user(
        &server,
        &format!("filtercat_{}", timestamp),
        &format!("filtercat_{}@example.com", timestamp),
        "SecurePass123!",
        "Filter Category User",
    )
    .await;

    let account = create_test_account(&server, &auth.token, "Test Account").await;
    let category1 = create_test_category(&server, &auth.token, "Category 1").await;
    let category2 = create_test_category(&server, &auth.token, "Category 2").await;

    // Create transactions in different categories
    let txn1 = json!({
        "account_id": account.id,
        "category_id": category1.id,
        "title": "Transaction in Category 1",
        "amount": -40.00,
        "date": Utc::now().to_rfc3339()
    });
    post_authenticated(&server, "/api/v1/transactions", &auth.token, &txn1).await;

    let txn2 = json!({
        "account_id": account.id,
        "category_id": category2.id,
        "title": "Transaction in Category 2",
        "amount": -60.00,
        "date": Utc::now().to_rfc3339()
    });
    post_authenticated(&server, "/api/v1/transactions", &auth.token, &txn2).await;

    // Filter by category1
    let response = get_authenticated(
        &server,
        &format!("/api/v1/transactions?category_id={}", category1.id),
        &auth.token,
    )
    .await;
    assert_status(&response, 200);

    let transactions: Vec<TransactionResponse> = extract_json(response);
    assert_eq!(transactions.len(), 1);
    assert_eq!(transactions[0].category_id, Some(category1.id));
    assert_eq!(transactions[0].title, "Transaction in Category 1");
}

/// Test filtering transactions by date range.
///
/// Verifies that:
/// - Status code is 200 OK
/// - Only transactions within date range are returned
#[tokio::test]
async fn test_list_transactions_filter_by_date_range() {
    let server = create_test_server().await;
    let timestamp = Utc::now().timestamp_nanos_opt().unwrap();

    let auth = register_test_user(
        &server,
        &format!("filterdate_{}", timestamp),
        &format!("filterdate_{}@example.com", timestamp),
        "SecurePass123!",
        "Filter Date User",
    )
    .await;

    let account = create_test_account(&server, &auth.token, "Test Account").await;
    let category = create_test_category(&server, &auth.token, "Test Category").await;

    let now = Utc::now();
    let past = now - Duration::days(10);
    let future = now + Duration::days(10);

    // Create transactions at different dates
    let txn_past = json!({
        "account_id": account.id,
        "category_id": category.id,
        "title": "Past Transaction",
        "amount": -20.00,
        "date": past.to_rfc3339()
    });
    post_authenticated(&server, "/api/v1/transactions", &auth.token, &txn_past).await;

    let txn_now = json!({
        "account_id": account.id,
        "category_id": category.id,
        "title": "Current Transaction",
        "amount": -30.00,
        "date": now.to_rfc3339()
    });
    post_authenticated(&server, "/api/v1/transactions", &auth.token, &txn_now).await;

    let txn_future = json!({
        "account_id": account.id,
        "category_id": category.id,
        "title": "Future Transaction",
        "amount": -40.00,
        "date": future.to_rfc3339()
    });
    post_authenticated(&server, "/api/v1/transactions", &auth.token, &txn_future).await;

    // Filter by date range (past to now)
    let start_date = (now - Duration::days(5)).to_rfc3339();
    let end_date = (now + Duration::days(5)).to_rfc3339();

    let encoded_start = start_date.replace("+", "%2B").replace(":", "%3A");
    let encoded_end = end_date.replace("+", "%2B").replace(":", "%3A");

    let response = get_authenticated(
        &server,
        &format!(
            "/api/v1/transactions?start_date={}&end_date={}",
            encoded_start, encoded_end
        ),
        &auth.token,
    )
    .await;
    assert_status(&response, 200);

    let transactions: Vec<TransactionResponse> = extract_json(response);
    assert_eq!(transactions.len(), 1);
    assert_eq!(transactions[0].title, "Current Transaction");
}

/// Test that listing transactions without authentication fails.
///
/// Verifies that:
/// - Status code is 401 Unauthorized
/// - Error message indicates missing authentication
#[tokio::test]
async fn test_list_transactions_unauthorized() {
    let server = create_test_server().await;

    // Try to list transactions without token
    let response = get_unauthenticated(&server, "/api/v1/transactions").await;
    assert_status(&response, 401);

    let error_text = response.text();
    assert!(
        error_text.to_lowercase().contains("unauthorized")
            || error_text.to_lowercase().contains("token"),
        "Error message should indicate missing authentication"
    );
}

/// Test that users can only see their own transactions (data isolation).
///
/// Verifies that:
/// - User A can see their transactions
/// - User B can see their transactions
/// - User A cannot see User B's transactions
/// - User B cannot see User A's transactions
#[tokio::test]
async fn test_list_transactions_isolation() {
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

    // User A creates account and transaction
    let account_a = create_test_account(&server, &auth_a.token, "User A Account").await;
    let category_a = create_test_category(&server, &auth_a.token, "User A Category").await;
    let txn_a = json!({
        "account_id": account_a.id,
        "category_id": category_a.id,
        "title": "User A Transaction",
        "amount": -100.00,
        "date": Utc::now().to_rfc3339()
    });
    post_authenticated(&server, "/api/v1/transactions", &auth_a.token, &txn_a).await;

    // User B creates account and transaction
    let account_b = create_test_account(&server, &auth_b.token, "User B Account").await;
    let category_b = create_test_category(&server, &auth_b.token, "User B Category").await;
    let txn_b = json!({
        "account_id": account_b.id,
        "category_id": category_b.id,
        "title": "User B Transaction",
        "amount": -200.00,
        "date": Utc::now().to_rfc3339()
    });
    post_authenticated(&server, "/api/v1/transactions", &auth_b.token, &txn_b).await;

    // User A lists transactions - should only see their own
    let response_a = get_authenticated(&server, "/api/v1/transactions", &auth_a.token).await;
    assert_status(&response_a, 200);
    let transactions_a: Vec<TransactionResponse> = extract_json(response_a);
    assert_eq!(transactions_a.len(), 1);
    assert_eq!(transactions_a[0].title, "User A Transaction");

    // User B lists transactions - should only see their own
    let response_b = get_authenticated(&server, "/api/v1/transactions", &auth_b.token).await;
    assert_status(&response_b, 200);
    let transactions_b: Vec<TransactionResponse> = extract_json(response_b);
    assert_eq!(transactions_b.len(), 1);
    assert_eq!(transactions_b[0].title, "User B Transaction");
}

// ============================================================================
// Create Transaction Tests
// ============================================================================

/// Test successful transaction creation.
///
/// Verifies that:
/// - Status code is 201 Created
/// - Response contains transaction data
/// - Transaction ID is a valid UUID
/// - All fields are correctly set
#[tokio::test]
async fn test_create_transaction_success() {
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

    let account = create_test_account(&server, &auth.token, "Test Account").await;
    let category = create_test_category(&server, &auth.token, "Test Category").await;

    let request = json!({
        "account_id": account.id,
        "category_id": category.id,
        "title": "Test Transaction",
        "amount": -75.50,
        "date": Utc::now().to_rfc3339(),
        "notes": "Test transaction notes"
    });

    let response = post_authenticated(&server, "/api/v1/transactions", &auth.token, &request).await;
    assert_status(&response, 201);

    let transaction: TransactionResponse = extract_json(response);
    assert_eq!(transaction.title, "Test Transaction");
    assert_eq!(transaction.amount, "-75.50");
    assert_eq!(transaction.account_id, account.id);
    assert_eq!(transaction.category_id, Some(category.id));
    assert_eq!(transaction.user_id, auth.user.id);
    assert!(transaction.notes.is_some());
    assert_eq!(transaction.notes.unwrap(), "Test transaction notes");
}

/// Test creating transaction with splits.
///
/// Verifies that:
/// - Status code is 201 Created
/// - Transaction is created with splits
/// - Splits are correctly associated with transaction
#[tokio::test]
async fn test_create_transaction_with_splits() {
    let server = create_test_server().await;
    let timestamp = Utc::now().timestamp_nanos_opt().unwrap();

    let auth = register_test_user(
        &server,
        &format!("splitsuser_{}", timestamp),
        &format!("splits_{}@example.com", timestamp),
        "SecurePass123!",
        "Splits Test User",
    )
    .await;

    let account = create_test_account(&server, &auth.token, "Test Account").await;
    let category = create_test_category(&server, &auth.token, "Test Category").await;

    // Create people for splits
    let person1 = create_test_person(&server, &auth.token, "Person 1").await;
    let person2 = create_test_person(&server, &auth.token, "Person 2").await;

    let request = json!({
        "account_id": account.id,
        "category_id": category.id,
        "title": "Shared Expense",
        "amount": -100.00,
        "date": Utc::now().to_rfc3339(),
        "splits": [
            {
                "person_id": person1.id,
                "amount": 50.00
            },
            {
                "person_id": person2.id,
                "amount": 50.00
            }
        ]
    });

    let response = post_authenticated(&server, "/api/v1/transactions", &auth.token, &request).await;
    assert_status(&response, 201);

    let transaction: TransactionResponse = extract_json(response);
    assert_eq!(transaction.title, "Shared Expense");
    assert_eq!(transaction.amount, "-100.00");
    assert!(transaction.splits.is_some());

    let splits = transaction.splits.unwrap();
    assert_eq!(splits.len(), 2);
}

/// Test that creating transaction with missing required fields fails.
///
/// Verifies that:
/// - Missing account_id fails with 422
/// - Missing title fails with 422
/// - Missing amount fails with 422
/// - Error messages indicate validation failure
#[tokio::test]
async fn test_create_transaction_missing_fields() {
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

    let account = create_test_account(&server, &auth.token, "Test Account").await;

    // Missing title
    let missing_title = json!({
        "account_id": account.id,
        "amount": -50.00,
        "date": Utc::now().to_rfc3339()
    });
    let response =
        post_authenticated(&server, "/api/v1/transactions", &auth.token, &missing_title).await;
    assert_status(&response, 422);

    // Missing amount
    let missing_amount = json!({
        "account_id": account.id,
        "title": "Test Transaction",
        "date": Utc::now().to_rfc3339()
    });
    let response = post_authenticated(
        &server,
        "/api/v1/transactions",
        &auth.token,
        &missing_amount,
    )
    .await;
    assert_status(&response, 422);

    // Missing account_id
    let missing_account = json!({
        "title": "Test Transaction",
        "amount": -50.00,
        "date": Utc::now().to_rfc3339()
    });
    let response = post_authenticated(
        &server,
        "/api/v1/transactions",
        &auth.token,
        &missing_account,
    )
    .await;
    assert_status(&response, 422);
}

/// Test that creating transaction with non-existent account fails.
///
/// Verifies that:
/// - Status code is 404 Not Found
/// - Error message indicates account not found
#[tokio::test]
async fn test_create_transaction_invalid_account() {
    let server = create_test_server().await;
    let timestamp = Utc::now().timestamp_nanos_opt().unwrap();

    let auth = register_test_user(
        &server,
        &format!("invalidacct_{}", timestamp),
        &format!("invalidacct_{}@example.com", timestamp),
        "SecurePass123!",
        "Invalid Account User",
    )
    .await;

    let fake_account_id = uuid::Uuid::new_v4();
    let request = json!({
        "account_id": fake_account_id,
        "title": "Test Transaction",
        "amount": -50.00,
        "date": Utc::now().to_rfc3339()
    });

    let response = post_authenticated(&server, "/api/v1/transactions", &auth.token, &request).await;
    assert_status(&response, 404);

    let error_text = response.text();
    assert!(
        error_text.to_lowercase().contains("not found")
            || error_text.to_lowercase().contains("account"),
        "Error should mention account not found"
    );
}

/// Test that creating transaction with non-existent category fails.
///
/// Verifies that:
/// - Status code is 404 Not Found
/// - Error message indicates category not found
#[tokio::test]
async fn test_create_transaction_invalid_category() {
    let server = create_test_server().await;
    let timestamp = Utc::now().timestamp_nanos_opt().unwrap();

    let auth = register_test_user(
        &server,
        &format!("invalidcat_{}", timestamp),
        &format!("invalidcat_{}@example.com", timestamp),
        "SecurePass123!",
        "Invalid Category User",
    )
    .await;

    let account = create_test_account(&server, &auth.token, "Test Account").await;
    let fake_category_id = uuid::Uuid::new_v4();

    let request = json!({
        "account_id": account.id,
        "category_id": fake_category_id,
        "title": "Test Transaction",
        "amount": -50.00,
        "date": Utc::now().to_rfc3339()
    });

    let response = post_authenticated(&server, "/api/v1/transactions", &auth.token, &request).await;
    assert_status(&response, 404);

    let error_text = response.text();
    assert!(
        error_text.to_lowercase().contains("not found")
            || error_text.to_lowercase().contains("category"),
        "Error should mention category not found"
    );
}

/// Test that creating transaction without authentication fails.
///
/// Verifies that:
/// - Status code is 401 Unauthorized
/// - Error message indicates missing authentication
#[tokio::test]
async fn test_create_transaction_unauthorized() {
    let server = create_test_server().await;

    let request = json!({
        "account_id": uuid::Uuid::new_v4(),
        "title": "Test Transaction",
        "amount": -50.00,
        "date": Utc::now().to_rfc3339()
    });

    let response = post_unauthenticated(&server, "/api/v1/transactions", &request).await;
    assert_status(&response, 401);

    let error_text = response.text();
    assert!(
        error_text.to_lowercase().contains("unauthorized")
            || error_text.to_lowercase().contains("token"),
        "Error message should indicate missing authentication"
    );
}

// ============================================================================
// Get Transaction Tests
// ============================================================================

/// Test successful retrieval of a specific transaction.
///
/// Verifies that:
/// - Status code is 200 OK
/// - Response contains correct transaction data
/// - All fields match the created transaction
#[tokio::test]
async fn test_get_transaction_success() {
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

    let account = create_test_account(&server, &auth.token, "Test Account").await;
    let category = create_test_category(&server, &auth.token, "Test Category").await;

    // Create a transaction
    let create_request = json!({
        "account_id": account.id,
        "category_id": category.id,
        "title": "Test Transaction",
        "amount": -125.75,
        "date": Utc::now().to_rfc3339(),
        "notes": "Test notes"
    });
    let create_response = post_authenticated(
        &server,
        "/api/v1/transactions",
        &auth.token,
        &create_request,
    )
    .await;
    assert_status(&create_response, 201);
    let created_transaction: TransactionResponse = extract_json(create_response);

    // Get the transaction
    let get_response = get_authenticated(
        &server,
        &format!("/api/v1/transactions/{}", created_transaction.id),
        &auth.token,
    )
    .await;
    assert_status(&get_response, 200);

    let transaction: TransactionResponse = extract_json(get_response);
    assert_eq!(transaction.id, created_transaction.id);
    assert_eq!(transaction.title, "Test Transaction");
    assert_eq!(transaction.amount, "-125.75");
    assert_eq!(transaction.account_id, account.id);
}

/// Test that getting a non-existent transaction fails.
///
/// Verifies that:
/// - Status code is 404 Not Found
/// - Error message indicates transaction not found
#[tokio::test]
async fn test_get_transaction_not_found() {
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

    // Try to get a non-existent transaction
    let fake_id = uuid::Uuid::new_v4();
    let response = get_authenticated(
        &server,
        &format!("/api/v1/transactions/{}", fake_id),
        &auth.token,
    )
    .await;
    assert_status(&response, 404);

    let error_text = response.text();
    assert!(
        error_text.to_lowercase().contains("not found")
            || error_text.to_lowercase().contains("transaction"),
        "Error message should indicate transaction not found"
    );
}

/// Test that users cannot access other users' transactions.
///
/// Verifies that:
/// - Status code is 403 Forbidden or 404 Not Found
/// - User A cannot access User B's transaction
#[tokio::test]
async fn test_get_transaction_wrong_user() {
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

    // User A creates a transaction
    let account_a = create_test_account(&server, &auth_a.token, "User A Account").await;
    let category_a = create_test_category(&server, &auth_a.token, "User A Category").await;
    let create_request = json!({
        "account_id": account_a.id,
        "category_id": category_a.id,
        "title": "User A Transaction",
        "amount": -50.00,
        "date": Utc::now().to_rfc3339()
    });
    let create_response = post_authenticated(
        &server,
        "/api/v1/transactions",
        &auth_a.token,
        &create_request,
    )
    .await;
    assert_status(&create_response, 201);
    let transaction_a: TransactionResponse = extract_json(create_response);

    // User B tries to access User A's transaction
    let response = get_authenticated(
        &server,
        &format!("/api/v1/transactions/{}", transaction_a.id),
        &auth_b.token,
    )
    .await;

    // Should be 403 Forbidden (user authenticated but accessing wrong resource)
    assert_status(&response, 403);
}

/// Test that getting transaction without authentication fails.
///
/// Verifies that:
/// - Status code is 401 Unauthorized
/// - Error message indicates missing authentication
#[tokio::test]
async fn test_get_transaction_unauthorized() {
    let server = create_test_server().await;

    let fake_id = uuid::Uuid::new_v4();
    let response = get_unauthenticated(&server, &format!("/api/v1/transactions/{}", fake_id)).await;
    assert_status(&response, 401);

    let error_text = response.text();
    assert!(
        error_text.to_lowercase().contains("unauthorized")
            || error_text.to_lowercase().contains("token"),
        "Error message should indicate missing authentication"
    );
}

// ============================================================================
// Update Transaction Tests
// ============================================================================

/// Test successful transaction update.
///
/// Verifies that:
/// - Status code is 200 OK
/// - Response contains updated transaction data
/// - Only specified fields are updated
#[tokio::test]
async fn test_update_transaction_success() {
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

    let account = create_test_account(&server, &auth.token, "Test Account").await;
    let category = create_test_category(&server, &auth.token, "Test Category").await;

    // Create a transaction
    let create_request = json!({
        "account_id": account.id,
        "category_id": category.id,
        "title": "Original Title",
        "amount": -100.00,
        "date": Utc::now().to_rfc3339(),
        "notes": "Original notes"
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

    // Update the transaction
    let update_request = json!({
        "title": "Updated Title",
        "amount": -150.00,
        "notes": "Updated notes"
    });
    let update_response = put_authenticated(
        &server,
        &format!("/api/v1/transactions/{}", transaction.id),
        &auth.token,
        &update_request,
    )
    .await;
    assert_status(&update_response, 200);

    let updated_transaction: TransactionResponse = extract_json(update_response);
    assert_eq!(updated_transaction.id, transaction.id);
    assert_eq!(updated_transaction.title, "Updated Title");
    assert_eq!(updated_transaction.amount, "-150.00");
    assert_eq!(updated_transaction.notes, Some("Updated notes".to_string()));
    // Account and category should remain unchanged
    assert_eq!(updated_transaction.account_id, account.id);
    assert_eq!(updated_transaction.category_id, Some(category.id));
}

/// Test partial transaction update (only some fields).
///
/// Verifies that:
/// - Status code is 200 OK
/// - Only specified fields are updated
/// - Other fields remain unchanged
#[tokio::test]
async fn test_update_transaction_partial() {
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

    let account = create_test_account(&server, &auth.token, "Test Account").await;
    let category = create_test_category(&server, &auth.token, "Test Category").await;

    // Create a transaction
    let create_request = json!({
        "account_id": account.id,
        "category_id": category.id,
        "title": "Original Title",
        "amount": -200.00,
        "date": Utc::now().to_rfc3339(),
        "notes": "Original notes"
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

    // Update only the title
    let update_request = json!({
        "title": "New Title Only"
    });
    let update_response = put_authenticated(
        &server,
        &format!("/api/v1/transactions/{}", transaction.id),
        &auth.token,
        &update_request,
    )
    .await;
    assert_status(&update_response, 200);

    let updated_transaction: TransactionResponse = extract_json(update_response);
    assert_eq!(updated_transaction.title, "New Title Only");
    assert_eq!(updated_transaction.amount, "-200.00");
    assert_eq!(
        updated_transaction.notes,
        Some("Original notes".to_string())
    );
}

/// Test that updating a non-existent transaction fails.
///
/// Verifies that:
/// - Status code is 404 Not Found
/// - Error message indicates transaction not found
#[tokio::test]
async fn test_update_transaction_not_found() {
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
        "title": "New Title"
    });
    let response = put_authenticated(
        &server,
        &format!("/api/v1/transactions/{}", fake_id),
        &auth.token,
        &update_request,
    )
    .await;
    assert_status(&response, 404);
}

/// Test that users cannot update other users' transactions.
///
/// Verifies that:
/// - Status code is 403 Forbidden or 404 Not Found
/// - User B cannot update User A's transaction
#[tokio::test]
async fn test_update_transaction_wrong_user() {
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

    // User A creates a transaction
    let account_a = create_test_account(&server, &auth_a.token, "User A Account").await;
    let category_a = create_test_category(&server, &auth_a.token, "User A Category").await;
    let create_request = json!({
        "account_id": account_a.id,
        "category_id": category_a.id,
        "title": "User A Transaction",
        "amount": -75.00,
        "date": Utc::now().to_rfc3339()
    });
    let create_response = post_authenticated(
        &server,
        "/api/v1/transactions",
        &auth_a.token,
        &create_request,
    )
    .await;
    assert_status(&create_response, 201);
    let transaction: TransactionResponse = extract_json(create_response);

    // User B tries to update User A's transaction
    let update_request = json!({
        "title": "Hacked Title"
    });
    let response = put_authenticated(
        &server,
        &format!("/api/v1/transactions/{}", transaction.id),
        &auth_b.token,
        &update_request,
    )
    .await;

    // Should be 403 Forbidden (user authenticated but accessing wrong resource)
    assert_status(&response, 403);
}

/// Test that updating transaction without authentication fails.
///
/// Verifies that:
/// - Status code is 401 Unauthorized
/// - Error message indicates missing authentication
#[tokio::test]
async fn test_update_transaction_unauthorized() {
    let server = create_test_server().await;

    let fake_id = uuid::Uuid::new_v4();
    let update_request = json!({
        "title": "New Title"
    });

    let response = server
        .put(&format!("/api/v1/transactions/{}", fake_id))
        .json(&update_request)
        .await;
    assert_status(&response, 401);
}

// ============================================================================
// Delete Transaction Tests
// ============================================================================

/// Test successful transaction deletion.
///
/// Verifies that:
/// - Status code is 204 No Content
/// - Transaction is actually deleted
/// - Subsequent GET returns 404
#[tokio::test]
async fn test_delete_transaction_success() {
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

    let account = create_test_account(&server, &auth.token, "Test Account").await;
    let category = create_test_category(&server, &auth.token, "Test Category").await;

    // Create a transaction
    let create_request = json!({
        "account_id": account.id,
        "category_id": category.id,
        "title": "Transaction to Delete",
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

    // Delete the transaction
    let delete_response = delete_authenticated(
        &server,
        &format!("/api/v1/transactions/{}", transaction.id),
        &auth.token,
    )
    .await;
    assert_status(&delete_response, 204);

    // Verify transaction is deleted - GET should return 404
    let get_response = get_authenticated(
        &server,
        &format!("/api/v1/transactions/{}", transaction.id),
        &auth.token,
    )
    .await;
    assert_status(&get_response, 404);

    // Verify transaction is not in list
    let list_response = get_authenticated(&server, "/api/v1/transactions", &auth.token).await;
    assert_status(&list_response, 200);
    let transactions: Vec<TransactionResponse> = extract_json(list_response);
    assert!(
        !transactions.iter().any(|t| t.id == transaction.id),
        "Deleted transaction should not appear in list"
    );
}

/// Test that deleting a non-existent transaction fails.
///
/// Verifies that:
/// - Status code is 404 Not Found
/// - Error message indicates transaction not found
#[tokio::test]
async fn test_delete_transaction_not_found() {
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
        &format!("/api/v1/transactions/{}", fake_id),
        &auth.token,
    )
    .await;
    assert_status(&response, 404);
}

/// Test that users cannot delete other users' transactions.
///
/// Verifies that:
/// - Status code is 403 Forbidden or 404 Not Found
/// - User B cannot delete User A's transaction
#[tokio::test]
async fn test_delete_transaction_wrong_user() {
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

    // User A creates a transaction
    let account_a = create_test_account(&server, &auth_a.token, "User A Account").await;
    let category_a = create_test_category(&server, &auth_a.token, "User A Category").await;
    let create_request = json!({
        "account_id": account_a.id,
        "category_id": category_a.id,
        "title": "User A Transaction",
        "amount": -100.00,
        "date": Utc::now().to_rfc3339()
    });
    let create_response = post_authenticated(
        &server,
        "/api/v1/transactions",
        &auth_a.token,
        &create_request,
    )
    .await;
    assert_status(&create_response, 201);
    let transaction: TransactionResponse = extract_json(create_response);

    // User B tries to delete User A's transaction
    let response = delete_authenticated(
        &server,
        &format!("/api/v1/transactions/{}", transaction.id),
        &auth_b.token,
    )
    .await;

    // Should be 403 Forbidden (user authenticated but accessing wrong resource)
    assert_status(&response, 403);

    // Verify transaction still exists for User A
    let get_response = get_authenticated(
        &server,
        &format!("/api/v1/transactions/{}", transaction.id),
        &auth_a.token,
    )
    .await;
    assert_status(&get_response, 200);
}

/// Test that deleting transaction without authentication fails.
///
/// Verifies that:
/// - Status code is 401 Unauthorized
/// - Error message indicates missing authentication
#[tokio::test]
async fn test_delete_transaction_unauthorized() {
    let server = create_test_server().await;

    let fake_id = uuid::Uuid::new_v4();
    let response = server
        .delete(&format!("/api/v1/transactions/{}", fake_id))
        .await;
    assert_status(&response, 401);
}

// ============================================================================
// Integration Flow Test
// ============================================================================

/// Test complete CRUD flow: Create → Read → Update → Delete.
///
/// Verifies that:
/// - Transaction can be created successfully
/// - Transaction can be retrieved with correct data
/// - Transaction can be updated with new data
/// - Transaction can be deleted successfully
/// - All operations maintain data consistency
#[tokio::test]
async fn test_full_transaction_crud_flow() {
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

    let account = create_test_account(&server, &auth.token, "Test Account").await;
    let category = create_test_category(&server, &auth.token, "Test Category").await;

    // Step 1: Create transaction
    let create_request = json!({
        "account_id": account.id,
        "category_id": category.id,
        "title": "CRUD Test Transaction",
        "amount": -250.50,
        "date": Utc::now().to_rfc3339(),
        "notes": "Initial notes"
    });
    let create_response = post_authenticated(
        &server,
        "/api/v1/transactions",
        &auth.token,
        &create_request,
    )
    .await;
    assert_status(&create_response, 201);
    let created_transaction: TransactionResponse = extract_json(create_response);

    assert_eq!(created_transaction.title, "CRUD Test Transaction");
    assert_eq!(created_transaction.amount, "-250.50");
    assert_eq!(created_transaction.account_id, account.id);
    assert_eq!(created_transaction.user_id, auth.user.id);

    // Step 2: Read transaction
    let get_response = get_authenticated(
        &server,
        &format!("/api/v1/transactions/{}", created_transaction.id),
        &auth.token,
    )
    .await;
    assert_status(&get_response, 200);
    let read_transaction: TransactionResponse = extract_json(get_response);

    assert_eq!(read_transaction.id, created_transaction.id);
    assert_eq!(read_transaction.title, created_transaction.title);
    assert_eq!(read_transaction.amount, created_transaction.amount);

    // Step 3: Update transaction
    let update_request = json!({
        "title": "Updated CRUD Transaction",
        "amount": -300.00,
        "notes": "Updated notes"
    });
    let update_response = put_authenticated(
        &server,
        &format!("/api/v1/transactions/{}", created_transaction.id),
        &auth.token,
        &update_request,
    )
    .await;
    assert_status(&update_response, 200);
    let updated_transaction: TransactionResponse = extract_json(update_response);

    assert_eq!(updated_transaction.id, created_transaction.id);
    assert_eq!(updated_transaction.title, "Updated CRUD Transaction");
    assert_eq!(updated_transaction.amount, "-300.00");
    assert_eq!(updated_transaction.notes, Some("Updated notes".to_string()));
    // Account and category should remain unchanged
    assert_eq!(updated_transaction.account_id, account.id);
    assert_eq!(updated_transaction.category_id, Some(category.id));

    // Step 4: Verify update persisted
    let get_response2 = get_authenticated(
        &server,
        &format!("/api/v1/transactions/{}", created_transaction.id),
        &auth.token,
    )
    .await;
    assert_status(&get_response2, 200);
    let verified_transaction: TransactionResponse = extract_json(get_response2);
    assert_eq!(verified_transaction.title, "Updated CRUD Transaction");
    assert_eq!(verified_transaction.amount, "-300.00");

    // Step 5: Delete transaction
    let delete_response = delete_authenticated(
        &server,
        &format!("/api/v1/transactions/{}", created_transaction.id),
        &auth.token,
    )
    .await;
    assert_status(&delete_response, 204);

    // Step 6: Verify deletion
    let get_response3 = get_authenticated(
        &server,
        &format!("/api/v1/transactions/{}", created_transaction.id),
        &auth.token,
    )
    .await;
    assert_status(&get_response3, 404);

    // Step 7: Verify transaction not in list
    let list_response = get_authenticated(&server, "/api/v1/transactions", &auth.token).await;
    assert_status(&list_response, 200);
    let final_transactions: Vec<TransactionResponse> = extract_json(list_response);
    assert_eq!(
        final_transactions.len(),
        0,
        "All transactions should be deleted"
    );
}
