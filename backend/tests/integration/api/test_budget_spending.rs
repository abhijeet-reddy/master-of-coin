//! Integration tests for budget spending calculations with transaction splits.
//!
//! This module tests that budget spending correctly accounts for transaction splits:
//! - When a transaction is split with another person, only the user's share should
//!   count toward budget spending (not the full transaction amount).
//! - Budget detail page should show all transactions created against that budget's
//!   category within the active date range.
//!
//! Related issues:
//! - Budget spending should reflect user's share after splits, not the full amount
//! - Budget detail page should list all matching transactions

use crate::common::*;
use chrono::{Datelike, NaiveDate, Utc};
use master_of_coin_backend::models::{BudgetResponse, TransactionResponse};
use serde_json::json;

// ============================================================================
// Helper: Create a EUR account (matching PRIMARY_CURRENCY to avoid FX conversion)
// ============================================================================

/// Creates a test account with EUR currency via the API.
/// Using EUR avoids exchange rate conversion in budget spending calculations
/// since PRIMARY_CURRENCY is EUR.
async fn create_eur_account(
    server: &axum_test::TestServer,
    token: &str,
    name: &str,
) -> master_of_coin_backend::models::AccountResponse {
    let request = json!({
        "name": name,
        "account_type": "CHECKING",
        "currency": "EUR"
    });
    let response = post_authenticated(server, "/api/v1/accounts", token, &request).await;
    assert_status(&response, 201);
    extract_json(response)
}

// ============================================================================
// Helper: Create a budget with category filter and active range covering today
// ============================================================================

/// Creates a budget filtered by category_id with a MONTHLY range covering the
/// current month. Returns the budget response (before spending is computed).
async fn create_budget_with_active_range(
    server: &axum_test::TestServer,
    token: &str,
    budget_name: &str,
    category_id: uuid::Uuid,
    limit: f64,
) -> BudgetResponse {
    // Step 1: Create budget with category filter
    let budget_request = json!({
        "name": budget_name,
        "filters": {
            "category_id": category_id.to_string()
        }
    });
    let budget_response =
        post_authenticated(server, "/api/v1/budgets", token, &budget_request).await;
    assert_status(&budget_response, 201);
    let budget: BudgetResponse = extract_json(budget_response);

    // Step 2: Add a MONTHLY range covering the current month
    let today = Utc::now().date_naive();
    let start_of_month = NaiveDate::from_ymd_opt(today.year(), today.month(), 1).unwrap();
    // End of month: go to next month day 1, subtract 1 day
    let end_of_month = if today.month() == 12 {
        NaiveDate::from_ymd_opt(today.year() + 1, 1, 1).unwrap()
    } else {
        NaiveDate::from_ymd_opt(today.year(), today.month() + 1, 1).unwrap()
    }
    .pred_opt()
    .unwrap();

    let range_request = json!({
        "limit_amount": limit,
        "period": "MONTHLY",
        "start_date": start_of_month.to_string(),
        "end_date": end_of_month.to_string()
    });
    let range_response = post_authenticated(
        server,
        &format!("/api/v1/budgets/{}/ranges", budget.id),
        token,
        &range_request,
    )
    .await;
    assert_status(&range_response, 201);

    budget
}

// ============================================================================
// Test 1: Budget spending should reflect user's share after splits
// ============================================================================

/// Test that budget spending accounts for transaction splits.
///
/// Scenario:
/// - User creates a budget on "Groceries" category with a €100 monthly limit
/// - User creates a €10 expense transaction in "Groceries"
/// - The transaction is split equally with friend X (split amount = €5 for friend)
/// - Budget should show current_spending = €5 (user's share), NOT €10 (full amount)
///
/// This test currently FAILS because the budget service uses the full transaction
/// amount without subtracting split amounts.
#[tokio::test]
async fn test_budget_spending_accounts_for_splits() {
    let server = create_test_server().await;
    let timestamp = Utc::now().timestamp_nanos_opt().unwrap();

    // Register user
    let auth = register_test_user(
        &server,
        &format!("budgetsplit_{}", timestamp),
        &format!("budgetsplit_{}@example.com", timestamp),
        "SecurePass123!",
        "Budget Split User",
    )
    .await;

    // Create EUR account (matches PRIMARY_CURRENCY), category, and person (friend X)
    let account = create_eur_account(&server, &auth.token, "EUR Checking").await;
    let category = create_test_category(&server, &auth.token, "Groceries").await;
    let friend = create_test_person(&server, &auth.token, "Friend X").await;

    // Create budget with active range covering this month
    let budget =
        create_budget_with_active_range(&server, &auth.token, "Grocery Budget", category.id, 100.0)
            .await;

    // Create a €10 expense transaction in Groceries, split equally with Friend X
    // Split amount = €5 means Friend X owes €5, so user's share = €10 - €5 = €5
    let transaction_request = json!({
        "account_id": account.id,
        "category_id": category.id,
        "title": "Weekly Groceries",
        "amount": -10.0,
        "date": Utc::now().to_rfc3339(),
        "splits": [
            {
                "person_id": friend.id,
                "amount": 5.0
            }
        ]
    });
    let txn_response = post_authenticated(
        &server,
        "/api/v1/transactions",
        &auth.token,
        &transaction_request,
    )
    .await;
    assert_status(&txn_response, 201);

    // Verify transaction was created with splits
    let transaction: TransactionResponse = extract_json(txn_response);
    assert_eq!(transaction.amount, "-10.00");
    assert!(
        transaction.splits.is_some(),
        "Transaction should have splits"
    );
    let splits = transaction.splits.unwrap();
    assert_eq!(splits.len(), 1);
    assert_eq!(splits[0].amount, "5.00");

    // Now fetch the budget detail — this should compute current_spending
    let budget_detail_response = get_authenticated(
        &server,
        &format!("/api/v1/budgets/{}", budget.id),
        &auth.token,
    )
    .await;
    assert_status(&budget_detail_response, 200);

    let budget_detail: BudgetResponse = extract_json(budget_detail_response);

    // Verify the budget has an active range and spending data
    assert!(
        budget_detail.active_range.is_some(),
        "Budget should have an active range for the current month"
    );
    assert!(
        budget_detail.current_spending.is_some(),
        "Budget should have current_spending computed"
    );

    let current_spending: f64 = budget_detail
        .current_spending
        .as_ref()
        .unwrap()
        .parse()
        .expect("current_spending should be a valid number");

    // KEY ASSERTION: Budget spending should be €5 (user's share), NOT €10 (full amount)
    // The transaction is -€10, but €5 is split with Friend X, so user only spent €5
    assert!(
        (current_spending - 5.0).abs() < 0.01,
        "Budget spending should be 5.00 (user's share after split), but got {}. \
         The budget service is using the full transaction amount instead of \
         subtracting the split amounts (friend's share).",
        current_spending
    );

    // Also verify percentage_used is based on user's share
    let percentage_used = budget_detail.percentage_used.unwrap_or(0.0);
    assert!(
        (percentage_used - 5.0).abs() < 0.1,
        "Percentage used should be ~5% (€5 of €100 limit), but got {}%",
        percentage_used
    );
}

/// Test that budget spending is correct when a transaction has NO splits.
///
/// Scenario:
/// - User creates a budget on "Groceries" with €100 limit
/// - User creates a €10 expense with no splits
/// - Budget should show current_spending = €10 (full amount, no split)
///
/// This is a baseline test to confirm the non-split case works correctly.
#[tokio::test]
async fn test_budget_spending_without_splits() {
    let server = create_test_server().await;
    let timestamp = Utc::now().timestamp_nanos_opt().unwrap();

    // Register user
    let auth = register_test_user(
        &server,
        &format!("budgetnosplit_{}", timestamp),
        &format!("budgetnosplit_{}@example.com", timestamp),
        "SecurePass123!",
        "Budget No Split User",
    )
    .await;

    // Create EUR account and category
    let account = create_eur_account(&server, &auth.token, "EUR Checking").await;
    let category = create_test_category(&server, &auth.token, "Groceries").await;

    // Create budget with active range
    let budget = create_budget_with_active_range(
        &server,
        &auth.token,
        "Grocery Budget No Split",
        category.id,
        100.0,
    )
    .await;

    // Create a €10 expense with NO splits
    let transaction_request = json!({
        "account_id": account.id,
        "category_id": category.id,
        "title": "Solo Groceries",
        "amount": -10.0,
        "date": Utc::now().to_rfc3339()
    });
    let txn_response = post_authenticated(
        &server,
        "/api/v1/transactions",
        &auth.token,
        &transaction_request,
    )
    .await;
    assert_status(&txn_response, 201);

    // Fetch budget detail
    let budget_detail_response = get_authenticated(
        &server,
        &format!("/api/v1/budgets/{}", budget.id),
        &auth.token,
    )
    .await;
    assert_status(&budget_detail_response, 200);

    let budget_detail: BudgetResponse = extract_json(budget_detail_response);

    assert!(
        budget_detail.current_spending.is_some(),
        "Budget should have current_spending computed"
    );

    let current_spending: f64 = budget_detail
        .current_spending
        .as_ref()
        .unwrap()
        .parse()
        .expect("current_spending should be a valid number");

    // Without splits, the full €10 should count
    assert!(
        (current_spending - 10.0).abs() < 0.01,
        "Budget spending should be 10.00 (full amount, no splits), but got {}",
        current_spending
    );
}

/// Test budget spending with multiple transactions, some with splits and some without.
///
/// Scenario:
/// - Budget on "Groceries" with €200 limit
/// - Transaction 1: -€20 expense, split €8 with Friend X → user's share = €12
/// - Transaction 2: -€15 expense, no splits → user's share = €15
/// - Transaction 3: -€30 expense, split €10 with Friend X and €10 with Friend Y → user's share = €10
/// - Expected total spending = €12 + €15 + €10 = €37
#[tokio::test]
async fn test_budget_spending_mixed_splits() {
    let server = create_test_server().await;
    let timestamp = Utc::now().timestamp_nanos_opt().unwrap();

    // Register user
    let auth = register_test_user(
        &server,
        &format!("budgetmixed_{}", timestamp),
        &format!("budgetmixed_{}@example.com", timestamp),
        "SecurePass123!",
        "Budget Mixed User",
    )
    .await;

    // Create EUR account, category, and two friends
    let account = create_eur_account(&server, &auth.token, "EUR Checking").await;
    let category = create_test_category(&server, &auth.token, "Groceries").await;
    let friend_x = create_test_person(&server, &auth.token, "Friend X").await;
    let friend_y = create_test_person(&server, &auth.token, "Friend Y").await;

    // Create budget
    let budget = create_budget_with_active_range(
        &server,
        &auth.token,
        "Mixed Grocery Budget",
        category.id,
        200.0,
    )
    .await;

    // Transaction 1: -€20, split €8 with Friend X → user's share = €12
    let txn1 = json!({
        "account_id": account.id,
        "category_id": category.id,
        "title": "Groceries with Friend X",
        "amount": -20.0,
        "date": Utc::now().to_rfc3339(),
        "splits": [
            { "person_id": friend_x.id, "amount": 8.0 }
        ]
    });
    let resp1 = post_authenticated(&server, "/api/v1/transactions", &auth.token, &txn1).await;
    assert_status(&resp1, 201);

    // Transaction 2: -€15, no splits → user's share = €15
    let txn2 = json!({
        "account_id": account.id,
        "category_id": category.id,
        "title": "Solo Groceries",
        "amount": -15.0,
        "date": Utc::now().to_rfc3339()
    });
    let resp2 = post_authenticated(&server, "/api/v1/transactions", &auth.token, &txn2).await;
    assert_status(&resp2, 201);

    // Transaction 3: -€30, split €10 with Friend X and €10 with Friend Y → user's share = €10
    let txn3 = json!({
        "account_id": account.id,
        "category_id": category.id,
        "title": "Group Groceries",
        "amount": -30.0,
        "date": Utc::now().to_rfc3339(),
        "splits": [
            { "person_id": friend_x.id, "amount": 10.0 },
            { "person_id": friend_y.id, "amount": 10.0 }
        ]
    });
    let resp3 = post_authenticated(&server, "/api/v1/transactions", &auth.token, &txn3).await;
    assert_status(&resp3, 201);

    // Fetch budget detail
    let budget_detail_response = get_authenticated(
        &server,
        &format!("/api/v1/budgets/{}", budget.id),
        &auth.token,
    )
    .await;
    assert_status(&budget_detail_response, 200);

    let budget_detail: BudgetResponse = extract_json(budget_detail_response);

    let current_spending: f64 = budget_detail
        .current_spending
        .as_ref()
        .expect("Budget should have current_spending")
        .parse()
        .expect("current_spending should be a valid number");

    // Expected: €12 + €15 + €10 = €37
    assert!(
        (current_spending - 37.0).abs() < 0.01,
        "Budget spending should be 37.00 (sum of user's shares after splits), but got {}. \
         Breakdown: Txn1 user share=€12, Txn2 user share=€15, Txn3 user share=€10",
        current_spending
    );

    // Verify percentage: €37 of €200 = 18.5%
    let percentage_used = budget_detail.percentage_used.unwrap_or(0.0);
    assert!(
        (percentage_used - 18.5).abs() < 0.5,
        "Percentage used should be ~18.5% (€37 of €200 limit), but got {}%",
        percentage_used
    );
}

// ============================================================================
// Test 2: Budget detail page shows all matching transactions
// ============================================================================

/// Test that the transactions API returns all transactions matching a budget's
/// category and date range filters.
///
/// Scenario:
/// - Budget on "Groceries" category for the current month
/// - Create 3 transactions in "Groceries" category within the date range
/// - Create 1 transaction in a DIFFERENT category (should NOT appear)
/// - Create 1 transaction in "Groceries" but outside the date range (should NOT appear)
/// - Verify that querying transactions with the budget's filters returns exactly 3
#[tokio::test]
async fn test_budget_detail_shows_matching_transactions() {
    let server = create_test_server().await;
    let timestamp = Utc::now().timestamp_nanos_opt().unwrap();

    // Register user
    let auth = register_test_user(
        &server,
        &format!("budgettxns_{}", timestamp),
        &format!("budgettxns_{}@example.com", timestamp),
        "SecurePass123!",
        "Budget Transactions User",
    )
    .await;

    // Create EUR account and categories
    let account = create_eur_account(&server, &auth.token, "EUR Checking").await;
    let groceries_category = create_test_category(&server, &auth.token, "Groceries").await;
    let entertainment_category = create_test_category(&server, &auth.token, "Entertainment").await;

    // Create budget on Groceries
    let budget = create_budget_with_active_range(
        &server,
        &auth.token,
        "Grocery Budget Txns",
        groceries_category.id,
        500.0,
    )
    .await;

    // Get the budget detail to find the active range dates
    let budget_detail_resp = get_authenticated(
        &server,
        &format!("/api/v1/budgets/{}", budget.id),
        &auth.token,
    )
    .await;
    assert_status(&budget_detail_resp, 200);
    let budget_detail: BudgetResponse = extract_json(budget_detail_resp);
    let active_range = budget_detail
        .active_range
        .expect("Budget should have an active range");

    // Transaction 1: Groceries, within date range ✓
    let txn1 = json!({
        "account_id": account.id,
        "category_id": groceries_category.id,
        "title": "Grocery Trip 1",
        "amount": -25.0,
        "date": Utc::now().to_rfc3339()
    });
    let resp1 = post_authenticated(&server, "/api/v1/transactions", &auth.token, &txn1).await;
    assert_status(&resp1, 201);

    // Transaction 2: Groceries, within date range ✓
    let txn2 = json!({
        "account_id": account.id,
        "category_id": groceries_category.id,
        "title": "Grocery Trip 2",
        "amount": -30.0,
        "date": Utc::now().to_rfc3339()
    });
    let resp2 = post_authenticated(&server, "/api/v1/transactions", &auth.token, &txn2).await;
    assert_status(&resp2, 201);

    // Transaction 3: Groceries, within date range, with splits ✓
    let friend = create_test_person(&server, &auth.token, "Friend Z").await;
    let txn3 = json!({
        "account_id": account.id,
        "category_id": groceries_category.id,
        "title": "Grocery Trip 3 (Split)",
        "amount": -40.0,
        "date": Utc::now().to_rfc3339(),
        "splits": [
            { "person_id": friend.id, "amount": 20.0 }
        ]
    });
    let resp3 = post_authenticated(&server, "/api/v1/transactions", &auth.token, &txn3).await;
    assert_status(&resp3, 201);

    // Transaction 4: DIFFERENT category (Entertainment), within date range ✗
    let txn4 = json!({
        "account_id": account.id,
        "category_id": entertainment_category.id,
        "title": "Movie Night",
        "amount": -15.0,
        "date": Utc::now().to_rfc3339()
    });
    let resp4 = post_authenticated(&server, "/api/v1/transactions", &auth.token, &txn4).await;
    assert_status(&resp4, 201);

    // Transaction 5: Groceries but OUTSIDE date range (last year) ✗
    let last_year = Utc::now()
        .checked_sub_signed(chrono::Duration::days(400))
        .unwrap();
    let txn5 = json!({
        "account_id": account.id,
        "category_id": groceries_category.id,
        "title": "Old Grocery Trip",
        "amount": -50.0,
        "date": last_year.to_rfc3339()
    });
    let resp5 = post_authenticated(&server, "/api/v1/transactions", &auth.token, &txn5).await;
    assert_status(&resp5, 201);

    // Now query transactions with the budget's filters (category + date range)
    // This simulates what the frontend useBudgetDetail hook does.
    // The TransactionFilter expects DateTime<Utc> for start_date/end_date,
    // so we need RFC3339 format.
    let start_date_rfc3339 = format!("{}T00:00:00Z", active_range.start_date);
    let end_date_rfc3339 = active_range
        .end_date
        .map(|d| format!("{}T23:59:59Z", d))
        .unwrap_or_default();

    let query_url = format!(
        "/api/v1/transactions?category_id={}&start_date={}&end_date={}",
        groceries_category.id, start_date_rfc3339, end_date_rfc3339
    );
    let txn_list_response = get_authenticated(&server, &query_url, &auth.token).await;
    assert_status(&txn_list_response, 200);

    let transactions: Vec<TransactionResponse> = extract_json(txn_list_response);

    // Should have exactly 3 transactions (the ones in Groceries within the date range)
    assert_eq!(
        transactions.len(),
        3,
        "Budget detail should show exactly 3 transactions matching the budget's \
         category and date range. Got {} transactions: {:?}",
        transactions.len(),
        transactions.iter().map(|t| &t.title).collect::<Vec<_>>()
    );

    // Verify the correct transactions are included
    let titles: Vec<&str> = transactions.iter().map(|t| t.title.as_str()).collect();
    assert!(
        titles.contains(&"Grocery Trip 1"),
        "Should include 'Grocery Trip 1'"
    );
    assert!(
        titles.contains(&"Grocery Trip 2"),
        "Should include 'Grocery Trip 2'"
    );
    assert!(
        titles.contains(&"Grocery Trip 3 (Split)"),
        "Should include 'Grocery Trip 3 (Split)'"
    );

    // Verify excluded transactions are NOT present
    assert!(
        !titles.contains(&"Movie Night"),
        "Should NOT include 'Movie Night' (different category)"
    );
    assert!(
        !titles.contains(&"Old Grocery Trip"),
        "Should NOT include 'Old Grocery Trip' (outside date range)"
    );
}

/// Test that budget detail shows split transactions with their split data.
///
/// Verifies that when transactions are fetched for a budget's detail page,
/// split information is included in the response so the UI can display it.
#[tokio::test]
async fn test_budget_transactions_include_split_data() {
    let server = create_test_server().await;
    let timestamp = Utc::now().timestamp_nanos_opt().unwrap();

    // Register user
    let auth = register_test_user(
        &server,
        &format!("budgetsplitdata_{}", timestamp),
        &format!("budgetsplitdata_{}@example.com", timestamp),
        "SecurePass123!",
        "Budget Split Data User",
    )
    .await;

    // Create EUR account, category, and friend
    let account = create_eur_account(&server, &auth.token, "EUR Checking").await;
    let category = create_test_category(&server, &auth.token, "Groceries").await;
    let friend = create_test_person(&server, &auth.token, "Friend W").await;

    // Create budget
    let budget = create_budget_with_active_range(
        &server,
        &auth.token,
        "Split Data Budget",
        category.id,
        200.0,
    )
    .await;

    // Get budget detail for date range
    let budget_detail_resp = get_authenticated(
        &server,
        &format!("/api/v1/budgets/{}", budget.id),
        &auth.token,
    )
    .await;
    assert_status(&budget_detail_resp, 200);
    let budget_detail: BudgetResponse = extract_json(budget_detail_resp);
    let active_range = budget_detail
        .active_range
        .expect("Budget should have an active range");

    // Create a transaction with splits
    let txn_request = json!({
        "account_id": account.id,
        "category_id": category.id,
        "title": "Split Grocery Run",
        "amount": -50.0,
        "date": Utc::now().to_rfc3339(),
        "splits": [
            { "person_id": friend.id, "amount": 25.0 }
        ]
    });
    let txn_resp =
        post_authenticated(&server, "/api/v1/transactions", &auth.token, &txn_request).await;
    assert_status(&txn_resp, 201);

    // Query transactions with budget filters using RFC3339 dates
    let start_date_rfc3339 = format!("{}T00:00:00Z", active_range.start_date);
    let end_date_rfc3339 = active_range
        .end_date
        .map(|d| format!("{}T23:59:59Z", d))
        .unwrap_or_default();

    let query_url = format!(
        "/api/v1/transactions?category_id={}&start_date={}&end_date={}",
        category.id, start_date_rfc3339, end_date_rfc3339
    );
    let txn_list_response = get_authenticated(&server, &query_url, &auth.token).await;
    assert_status(&txn_list_response, 200);

    let transactions: Vec<TransactionResponse> = extract_json(txn_list_response);
    assert_eq!(transactions.len(), 1, "Should have 1 transaction");

    let txn = &transactions[0];
    assert_eq!(txn.title, "Split Grocery Run");
    assert_eq!(txn.amount, "-50.00");

    // Verify split data is included in the list response
    assert!(
        txn.splits.is_some(),
        "Transaction in budget detail list should include split data"
    );
    let splits = txn.splits.as_ref().unwrap();
    assert_eq!(splits.len(), 1, "Should have 1 split");
    assert_eq!(splits[0].person_id, friend.id);
    assert_eq!(splits[0].amount, "25.00");
}

// ============================================================================
// Test 3: Debt transactions (paid by others) with budget
// ============================================================================

/// Test that debt transactions are correctly included in budget spending.
///
/// Scenario:
/// - Budget on "Dining" category with €200 limit
/// - Create a debt transaction: friend Alex paid for dinner, user owes €30
///   (transaction amount = -€30, split amount = -€30 for Alex)
/// - Budget should show current_spending = €30 (user's share = full amount)
/// - The negative split should NOT be subtracted (it would make spending = 0)
///
/// Also creates a regular split transaction to verify both types work together:
/// - Regular transaction: -€20, split €8 with Friend Y → user's share = €12
/// - Expected total spending = €30 + €12 = €42
#[tokio::test]
async fn test_budget_spending_with_debt_transaction() {
    let server = create_test_server().await;
    let timestamp = Utc::now().timestamp_nanos_opt().unwrap();

    // Register user
    let auth = register_test_user(
        &server,
        &format!("budgetdebt_{}", timestamp),
        &format!("budgetdebt_{}@example.com", timestamp),
        "SecurePass123!",
        "Budget Debt User",
    )
    .await;

    // Create EUR account, category, and people
    let account = create_eur_account(&server, &auth.token, "EUR Checking").await;
    let category = create_test_category(&server, &auth.token, "Dining").await;
    let alex = create_test_person(&server, &auth.token, "Alex").await;
    let friend_y = create_test_person(&server, &auth.token, "Friend Y").await;

    // Create budget on Dining category
    let budget =
        create_budget_with_active_range(&server, &auth.token, "Dining Budget", category.id, 200.0)
            .await;

    // Create a debt transaction: Alex paid for dinner, user owes €30
    // This creates a transaction on a DEBT account with a negative split
    let debt_txn = json!({
        "payer_person_id": alex.id,
        "currency": "EUR",
        "category_id": category.id,
        "title": "Dinner with Alex",
        "amount": -30.0,
        "date": Utc::now().to_rfc3339(),
        "notes": "Alex paid for dinner"
    });
    let debt_resp =
        post_authenticated(&server, "/api/v1/debt-transactions", &auth.token, &debt_txn).await;
    assert_status(&debt_resp, 201);

    // Verify debt transaction was created correctly
    let debt_transaction: TransactionResponse = extract_json(debt_resp);
    assert_eq!(debt_transaction.amount, "-30.00");
    assert!(
        debt_transaction.debt_metadata.is_some(),
        "Should have debt_metadata"
    );
    assert!(debt_transaction.splits.is_some(), "Should have splits");
    let debt_splits = debt_transaction.splits.unwrap();
    assert_eq!(debt_splits.len(), 1);
    // Debt split amount is negative (same as transaction amount)
    assert_eq!(debt_splits[0].amount, "-30.00");

    // Create a regular transaction with split: -€20, split €8 with Friend Y
    let regular_txn = json!({
        "account_id": account.id,
        "category_id": category.id,
        "title": "Lunch with Friend Y",
        "amount": -20.0,
        "date": Utc::now().to_rfc3339(),
        "splits": [
            { "person_id": friend_y.id, "amount": 8.0 }
        ]
    });
    let regular_resp =
        post_authenticated(&server, "/api/v1/transactions", &auth.token, &regular_txn).await;
    assert_status(&regular_resp, 201);

    // Fetch budget detail
    let budget_detail_response = get_authenticated(
        &server,
        &format!("/api/v1/budgets/{}", budget.id),
        &auth.token,
    )
    .await;
    assert_status(&budget_detail_response, 200);

    let budget_detail: BudgetResponse = extract_json(budget_detail_response);

    assert!(
        budget_detail.current_spending.is_some(),
        "Budget should have current_spending"
    );

    let current_spending: f64 = budget_detail
        .current_spending
        .as_ref()
        .unwrap()
        .parse()
        .expect("current_spending should be a valid number");

    // Expected: debt transaction €30 (full amount, negative split NOT subtracted)
    //         + regular transaction user share €12 (€20 - €8 split)
    //         = €42
    assert!(
        (current_spending - 42.0).abs() < 0.01,
        "Budget spending should be 42.00 (debt €30 + regular user share €12), but got {}. \
         If spending is 12.00, the debt transaction's negative split was incorrectly subtracted. \
         If spending is 0.00, both splits were incorrectly subtracted.",
        current_spending
    );
}
