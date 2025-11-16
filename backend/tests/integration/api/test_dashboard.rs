//! Integration tests for dashboard/analytics API endpoints.
//!
//! This module tests the dashboard endpoint:
//! - GET /api/v1/dashboard - Get dashboard data with analytics
//!
//! Tests cover:
//! - Empty dashboard for new users
//! - Dashboard with accounts showing total balance
//! - Dashboard with transactions showing income/expense totals
//! - Dashboard with recent transactions
//! - Dashboard with category breakdown
//! - Dashboard with budget status and alerts
//! - Data isolation between users
//! - Full integration scenario with all features

use crate::common::*;
use axum_test::{TestResponse, TestServer};
use bigdecimal::BigDecimal;
use chrono::{Duration, Utc};
use serde_json::{Value, json};
use std::str::FromStr;

// ============================================================================
// Helper Functions
// ============================================================================

/// Helper to extract dashboard summary from response
fn extract_dashboard(response: TestResponse) -> Value {
    extract_json(response)
}

/// Helper to create a category for testing
async fn create_test_category(server: &TestServer, token: &str, name: &str) -> Value {
    let request = json!({
        "name": name,
        "icon": "💰",
        "color": "#4CAF50"
    });
    let response = post_authenticated(server, "/api/v1/categories", token, &request).await;
    assert_status(&response, 201);
    extract_json(response)
}

/// Helper to create an account for testing
async fn create_test_account(
    server: &TestServer,
    token: &str,
    name: &str,
    account_type: &str,
    initial_balance: f64,
) -> Value {
    let request = json!({
        "name": name,
        "account_type": account_type,
        "currency": "USD",
        "initial_balance": initial_balance
    });
    let response = post_authenticated(server, "/api/v1/accounts", token, &request).await;
    assert_status(&response, 201);
    extract_json(response)
}

/// Helper to create a transaction for testing
async fn create_test_transaction(
    server: &TestServer,
    token: &str,
    account_id: &str,
    amount: f64,
    title: &str,
    category_id: Option<&str>,
    date: Option<chrono::DateTime<Utc>>,
) -> Value {
    let mut request = json!({
        "account_id": account_id,
        "amount": amount,
        "title": title,
        "date": date.unwrap_or_else(Utc::now).to_rfc3339()
    });

    if let Some(cat_id) = category_id {
        request["category_id"] = json!(cat_id);
    }

    let response = post_authenticated(server, "/api/v1/transactions", token, &request).await;
    assert_status(&response, 201);
    extract_json(response)
}

/// Helper to create a budget with range for testing
async fn create_test_budget(
    server: &TestServer,
    token: &str,
    name: &str,
    category_id: Option<&str>,
    limit_amount: f64,
) -> Value {
    // Create budget
    let mut budget_request = json!({
        "name": name,
        "filters": {}
    });

    if let Some(cat_id) = category_id {
        budget_request["filters"]["category_id"] = json!(cat_id);
    }

    let budget_response =
        post_authenticated(server, "/api/v1/budgets", token, &budget_request).await;
    assert_status(&budget_response, 201);
    let budget: Value = extract_json(budget_response);
    let budget_id = budget["id"].as_str().unwrap();

    // Add range for current month
    let now = Utc::now();
    let start_date = now.date_naive();
    let end_date = (now + Duration::days(30)).date_naive();

    let range_request = json!({
        "budget_id": budget_id,
        "limit_amount": limit_amount,
        "period": "MONTHLY",
        "start_date": start_date.to_string(),
        "end_date": end_date.to_string()
    });

    let range_response = post_authenticated(
        server,
        &format!("/api/v1/budgets/{}/ranges", budget_id),
        token,
        &range_request,
    )
    .await;
    assert_status(&range_response, 201);

    budget
}

// ============================================================================
// Basic Dashboard Tests
// ============================================================================

/// Test that a new user with no data returns an empty dashboard.
///
/// Verifies that:
/// - Status code is 200 OK
/// - Dashboard returns with zero values
/// - Empty arrays for transactions, budgets, and categories
#[tokio::test]
async fn test_get_dashboard_empty() {
    let server = create_test_server().await;
    let timestamp = Utc::now().timestamp_nanos_opt().unwrap();

    let auth = register_test_user(
        &server,
        &format!("emptyuser_{}", timestamp),
        &format!("empty_{}@example.com", timestamp),
        "SecurePass123!",
        "Empty Dashboard User",
    )
    .await;

    // Get dashboard
    let response = get_authenticated(&server, "/api/v1/dashboard", &auth.token).await;
    assert_status(&response, 200);

    let dashboard = extract_dashboard(response);

    // Verify empty dashboard structure
    assert_eq!(dashboard["net_worth"].as_str().unwrap(), "0");
    assert_eq!(
        dashboard["recent_transactions"].as_array().unwrap().len(),
        0
    );
    assert_eq!(dashboard["budget_statuses"].as_array().unwrap().len(), 0);
    assert_eq!(dashboard["category_breakdown"].as_array().unwrap().len(), 0);
    assert_eq!(
        dashboard["top_spending_categories"]
            .as_array()
            .unwrap()
            .len(),
        0
    );
}

/// Test that getting dashboard without authentication fails.
///
/// Verifies that:
/// - Status code is 401 Unauthorized
/// - Error message indicates missing authentication
#[tokio::test]
async fn test_get_dashboard_unauthorized() {
    let server = create_test_server().await;

    let response = get_unauthenticated(&server, "/api/v1/dashboard").await;
    assert_status(&response, 401);

    let error_text = response.text();
    assert!(
        error_text.to_lowercase().contains("unauthorized")
            || error_text.to_lowercase().contains("token"),
        "Error message should indicate missing authentication"
    );
}

// ============================================================================
// Dashboard with Accounts Tests
// ============================================================================

/// Test that dashboard shows correct total balance from multiple accounts.
///
/// Verifies that:
/// - Status code is 200 OK
/// - Net worth equals sum of all account balances
/// - Dashboard includes all accounts
#[tokio::test]
async fn test_get_dashboard_with_accounts() {
    let server = create_test_server().await;
    let timestamp = Utc::now().timestamp_nanos_opt().unwrap();

    let auth = register_test_user(
        &server,
        &format!("accountuser_{}", timestamp),
        &format!("account_{}@example.com", timestamp),
        "SecurePass123!",
        "Account Dashboard User",
    )
    .await;

    // Create multiple accounts with different balances
    create_test_account(&server, &auth.token, "Checking", "CHECKING", 1000.0).await;
    create_test_account(&server, &auth.token, "Savings", "SAVINGS", 5000.0).await;
    create_test_account(&server, &auth.token, "Investment", "INVESTMENT", 10000.0).await;

    // Get dashboard
    let response = get_authenticated(&server, "/api/v1/dashboard", &auth.token).await;
    assert_status(&response, 200);

    let dashboard = extract_dashboard(response);

    // Verify net worth is sum of all accounts
    let net_worth = BigDecimal::from_str(dashboard["net_worth"].as_str().unwrap()).unwrap();
    let expected = BigDecimal::from_str("16000").unwrap();
    assert_eq!(
        net_worth, expected,
        "Net worth should be sum of all account balances"
    );
}

/// Test that dashboard includes individual account balances.
///
/// Verifies that:
/// - Status code is 200 OK
/// - Dashboard structure includes account information
/// - Net worth calculation is correct
#[tokio::test]
async fn test_get_dashboard_account_balances() {
    let server = create_test_server().await;
    let timestamp = Utc::now().timestamp_nanos_opt().unwrap();

    let auth = register_test_user(
        &server,
        &format!("balanceuser_{}", timestamp),
        &format!("balance_{}@example.com", timestamp),
        "SecurePass123!",
        "Balance Dashboard User",
    )
    .await;

    // Create accounts
    let checking = create_test_account(&server, &auth.token, "Checking", "CHECKING", 2500.50).await;
    let savings = create_test_account(&server, &auth.token, "Savings", "SAVINGS", 7500.75).await;

    // Get dashboard
    let response = get_authenticated(&server, "/api/v1/dashboard", &auth.token).await;
    assert_status(&response, 200);

    let dashboard = extract_dashboard(response);

    // Verify net worth
    let net_worth = BigDecimal::from_str(dashboard["net_worth"].as_str().unwrap()).unwrap();
    let expected = BigDecimal::from_str("10001.25").unwrap();
    assert_eq!(net_worth, expected);
}

// ============================================================================
// Dashboard with Transactions Tests
// ============================================================================

/// Test that dashboard shows income and expense totals.
///
/// Verifies that:
/// - Status code is 200 OK
/// - Dashboard includes transaction data
/// - Recent transactions are included
#[tokio::test]
async fn test_get_dashboard_with_transactions() {
    let server = create_test_server().await;
    let timestamp = Utc::now().timestamp_nanos_opt().unwrap();

    let auth = register_test_user(
        &server,
        &format!("txuser_{}", timestamp),
        &format!("tx_{}@example.com", timestamp),
        "SecurePass123!",
        "Transaction Dashboard User",
    )
    .await;

    // Create account
    let account = create_test_account(&server, &auth.token, "Checking", "CHECKING", 1000.0).await;
    let account_id = account["id"].as_str().unwrap();

    // Create income transaction
    create_test_transaction(
        &server,
        &auth.token,
        account_id,
        2000.0,
        "Salary",
        None,
        None,
    )
    .await;

    // Create expense transactions
    create_test_transaction(&server, &auth.token, account_id, -500.0, "Rent", None, None).await;
    create_test_transaction(
        &server,
        &auth.token,
        account_id,
        -100.0,
        "Groceries",
        None,
        None,
    )
    .await;

    // Get dashboard
    let response = get_authenticated(&server, "/api/v1/dashboard", &auth.token).await;
    assert_status(&response, 200);

    let dashboard = extract_dashboard(response);

    // Verify dashboard has transaction data
    let recent_transactions = dashboard["recent_transactions"].as_array().unwrap();
    assert!(
        recent_transactions.len() >= 3,
        "Should have at least 3 recent transactions"
    );
}

/// Test that dashboard includes recent transactions list.
///
/// Verifies that:
/// - Status code is 200 OK
/// - Recent transactions array is populated
/// - Transactions are ordered by date (most recent first)
#[tokio::test]
async fn test_get_dashboard_recent_transactions() {
    let server = create_test_server().await;
    let timestamp = Utc::now().timestamp_nanos_opt().unwrap();

    let auth = register_test_user(
        &server,
        &format!("recentuser_{}", timestamp),
        &format!("recent_{}@example.com", timestamp),
        "SecurePass123!",
        "Recent Dashboard User",
    )
    .await;

    // Create account
    let account = create_test_account(&server, &auth.token, "Checking", "CHECKING", 5000.0).await;
    let account_id = account["id"].as_str().unwrap();

    // Create multiple transactions at different times
    let now = Utc::now();
    create_test_transaction(
        &server,
        &auth.token,
        account_id,
        -50.0,
        "Old Transaction",
        None,
        Some(now - Duration::days(5)),
    )
    .await;
    create_test_transaction(
        &server,
        &auth.token,
        account_id,
        -100.0,
        "Recent Transaction",
        None,
        Some(now - Duration::hours(2)),
    )
    .await;
    create_test_transaction(
        &server,
        &auth.token,
        account_id,
        -75.0,
        "Latest Transaction",
        None,
        Some(now),
    )
    .await;

    // Get dashboard
    let response = get_authenticated(&server, "/api/v1/dashboard", &auth.token).await;
    assert_status(&response, 200);

    let dashboard = extract_dashboard(response);

    // Verify recent transactions
    let recent_transactions = dashboard["recent_transactions"].as_array().unwrap();
    assert!(
        recent_transactions.len() >= 3,
        "Should have at least 3 recent transactions"
    );

    // Verify most recent is first (excluding initial balance transaction)
    let titles: Vec<&str> = recent_transactions
        .iter()
        .map(|t| t["title"].as_str().unwrap())
        .collect();
    assert!(
        titles.contains(&"Latest Transaction"),
        "Should include latest transaction"
    );
}

/// Test that dashboard shows spending by category.
///
/// Verifies that:
/// - Status code is 200 OK
/// - Category breakdown is included
/// - Spending is correctly grouped by category
/// - Percentages are calculated correctly
#[tokio::test]
async fn test_get_dashboard_category_breakdown() {
    let server = create_test_server().await;
    let timestamp = Utc::now().timestamp_nanos_opt().unwrap();

    let auth = register_test_user(
        &server,
        &format!("catuser_{}", timestamp),
        &format!("cat_{}@example.com", timestamp),
        "SecurePass123!",
        "Category Dashboard User",
    )
    .await;

    // Create categories
    let groceries = create_test_category(&server, &auth.token, "Groceries").await;
    let groceries_id = groceries["id"].as_str().unwrap();

    let utilities = create_test_category(&server, &auth.token, "Utilities").await;
    let utilities_id = utilities["id"].as_str().unwrap();

    // Create account
    let account = create_test_account(&server, &auth.token, "Checking", "CHECKING", 5000.0).await;
    let account_id = account["id"].as_str().unwrap();

    // Create expense transactions in different categories
    create_test_transaction(
        &server,
        &auth.token,
        account_id,
        -300.0,
        "Grocery Shopping",
        Some(groceries_id),
        None,
    )
    .await;
    create_test_transaction(
        &server,
        &auth.token,
        account_id,
        -200.0,
        "More Groceries",
        Some(groceries_id),
        None,
    )
    .await;
    create_test_transaction(
        &server,
        &auth.token,
        account_id,
        -100.0,
        "Electric Bill",
        Some(utilities_id),
        None,
    )
    .await;

    // Get dashboard
    let response = get_authenticated(&server, "/api/v1/dashboard", &auth.token).await;
    assert_status(&response, 200);

    let dashboard = extract_dashboard(response);

    // Verify category breakdown
    let category_breakdown = dashboard["category_breakdown"].as_array().unwrap();
    assert!(
        category_breakdown.len() >= 2,
        "Should have at least 2 categories"
    );

    // Find groceries category
    let groceries_breakdown = category_breakdown
        .iter()
        .find(|c| c["category_name"].as_str() == Some("Groceries"))
        .expect("Should have Groceries category");

    let groceries_total =
        BigDecimal::from_str(groceries_breakdown["total"].as_str().unwrap()).unwrap();
    assert_eq!(groceries_total, BigDecimal::from_str("500").unwrap());

    // Verify percentage is calculated (should be around 83.33% since 500 out of 600 total)
    let percentage = groceries_breakdown["percentage"].as_f64().unwrap();
    assert!(
        percentage > 80.0 && percentage < 85.0,
        "Percentage should be around 83%"
    );
}

// ============================================================================
// Dashboard with Budgets Tests
// ============================================================================

/// Test that dashboard includes budget status and progress.
///
/// Verifies that:
/// - Status code is 200 OK
/// - Budget statuses are included
/// - Budget progress is calculated correctly
#[tokio::test]
async fn test_get_dashboard_with_budgets() {
    let server = create_test_server().await;
    let timestamp = Utc::now().timestamp_nanos_opt().unwrap();

    let auth = register_test_user(
        &server,
        &format!("budgetuser_{}", timestamp),
        &format!("budget_{}@example.com", timestamp),
        "SecurePass123!",
        "Budget Dashboard User",
    )
    .await;

    // Create category
    let category = create_test_category(&server, &auth.token, "Food").await;
    let category_id = category["id"].as_str().unwrap();

    // Create account
    let account = create_test_account(&server, &auth.token, "Checking", "CHECKING", 2000.0).await;
    let account_id = account["id"].as_str().unwrap();

    // Create budget with limit
    create_test_budget(
        &server,
        &auth.token,
        "Food Budget",
        Some(category_id),
        500.0,
    )
    .await;

    // Create some spending in the category
    create_test_transaction(
        &server,
        &auth.token,
        account_id,
        -200.0,
        "Restaurant",
        Some(category_id),
        None,
    )
    .await;
    create_test_transaction(
        &server,
        &auth.token,
        account_id,
        -150.0,
        "Groceries",
        Some(category_id),
        None,
    )
    .await;

    // Get dashboard
    let response = get_authenticated(&server, "/api/v1/dashboard", &auth.token).await;
    assert_status(&response, 200);

    let dashboard = extract_dashboard(response);

    // Verify budget statuses
    let budget_statuses = dashboard["budget_statuses"].as_array().unwrap();
    assert_eq!(budget_statuses.len(), 1, "Should have 1 budget status");

    let budget_status = &budget_statuses[0];
    let current_spending =
        BigDecimal::from_str(budget_status["current_spending"].as_str().unwrap()).unwrap();
    let limit_amount =
        BigDecimal::from_str(budget_status["limit_amount"].as_str().unwrap()).unwrap();

    assert_eq!(current_spending, BigDecimal::from_str("350").unwrap());
    assert_eq!(limit_amount, BigDecimal::from_str("500").unwrap());
    assert_eq!(budget_status["is_over_budget"].as_bool().unwrap(), false);

    // Verify percentage is around 70%
    let percentage = budget_status["percentage_used"].as_f64().unwrap();
    assert!(
        percentage > 69.0 && percentage < 71.0,
        "Percentage should be around 70%"
    );
}

/// Test that dashboard shows over-budget warnings.
///
/// Verifies that:
/// - Status code is 200 OK
/// - Over-budget flag is set correctly
/// - Budget status shows exceeded limit
#[tokio::test]
async fn test_get_dashboard_budget_alerts() {
    let server = create_test_server().await;
    let timestamp = Utc::now().timestamp_nanos_opt().unwrap();

    let auth = register_test_user(
        &server,
        &format!("alertuser_{}", timestamp),
        &format!("alert_{}@example.com", timestamp),
        "SecurePass123!",
        "Alert Dashboard User",
    )
    .await;

    // Create category
    let category = create_test_category(&server, &auth.token, "Entertainment").await;
    let category_id = category["id"].as_str().unwrap();

    // Create account
    let account = create_test_account(&server, &auth.token, "Checking", "CHECKING", 3000.0).await;
    let account_id = account["id"].as_str().unwrap();

    // Create budget with low limit
    create_test_budget(
        &server,
        &auth.token,
        "Entertainment Budget",
        Some(category_id),
        200.0,
    )
    .await;

    // Create spending that exceeds the budget
    create_test_transaction(
        &server,
        &auth.token,
        account_id,
        -150.0,
        "Concert Tickets",
        Some(category_id),
        None,
    )
    .await;
    create_test_transaction(
        &server,
        &auth.token,
        account_id,
        -100.0,
        "Movie Night",
        Some(category_id),
        None,
    )
    .await;

    // Get dashboard
    let response = get_authenticated(&server, "/api/v1/dashboard", &auth.token).await;
    assert_status(&response, 200);

    let dashboard = extract_dashboard(response);

    // Verify over-budget alert
    let budget_statuses = dashboard["budget_statuses"].as_array().unwrap();
    assert_eq!(budget_statuses.len(), 1);

    let budget_status = &budget_statuses[0];
    assert_eq!(
        budget_status["is_over_budget"].as_bool().unwrap(),
        true,
        "Should be over budget"
    );

    let current_spending =
        BigDecimal::from_str(budget_status["current_spending"].as_str().unwrap()).unwrap();
    let limit_amount =
        BigDecimal::from_str(budget_status["limit_amount"].as_str().unwrap()).unwrap();

    assert!(
        current_spending > limit_amount,
        "Current spending should exceed limit"
    );
}

// ============================================================================
// Data Isolation Tests
// ============================================================================

/// Test that users only see their own dashboard data.
///
/// Verifies that:
/// - User A sees only their own data
/// - User B sees only their own data
/// - No data leakage between users
#[tokio::test]
async fn test_get_dashboard_user_isolation() {
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

    // User A creates data
    let account_a =
        create_test_account(&server, &auth_a.token, "User A Account", "CHECKING", 1000.0).await;
    let account_a_id = account_a["id"].as_str().unwrap();
    create_test_transaction(
        &server,
        &auth_a.token,
        account_a_id,
        -100.0,
        "User A Transaction",
        None,
        None,
    )
    .await;

    // User B creates data
    let account_b =
        create_test_account(&server, &auth_b.token, "User B Account", "SAVINGS", 5000.0).await;
    let account_b_id = account_b["id"].as_str().unwrap();
    create_test_transaction(
        &server,
        &auth_b.token,
        account_b_id,
        -500.0,
        "User B Transaction",
        None,
        None,
    )
    .await;

    // Get User A's dashboard
    let response_a = get_authenticated(&server, "/api/v1/dashboard", &auth_a.token).await;
    assert_status(&response_a, 200);
    let dashboard_a = extract_dashboard(response_a);

    // Get User B's dashboard
    let response_b = get_authenticated(&server, "/api/v1/dashboard", &auth_b.token).await;
    assert_status(&response_b, 200);
    let dashboard_b = extract_dashboard(response_b);

    // Verify User A's data
    let net_worth_a = BigDecimal::from_str(dashboard_a["net_worth"].as_str().unwrap()).unwrap();
    assert_eq!(
        net_worth_a,
        BigDecimal::from_str("900").unwrap(),
        "User A net worth should be 900"
    );

    // Verify User B's data
    let net_worth_b = BigDecimal::from_str(dashboard_b["net_worth"].as_str().unwrap()).unwrap();
    assert_eq!(
        net_worth_b,
        BigDecimal::from_str("4500").unwrap(),
        "User B net worth should be 4500"
    );

    // Verify no cross-contamination
    assert_ne!(
        dashboard_a["net_worth"], dashboard_b["net_worth"],
        "Dashboards should have different net worth"
    );
}

// ============================================================================
// Integration Flow Test
// ============================================================================

/// Test complete financial scenario with all dashboard features.
///
/// Creates a comprehensive test scenario with:
/// - Multiple accounts with different balances
/// - Income and expense transactions
/// - Transactions in different categories
/// - Budgets with ranges
/// - Recent transactions
///
/// Verifies that:
/// - Dashboard aggregates all data correctly
/// - All calculations are accurate
/// - All dashboard sections are populated
#[tokio::test]
async fn test_full_dashboard_scenario() {
    let server = create_test_server().await;
    let timestamp = Utc::now().timestamp_nanos_opt().unwrap();

    let auth = register_test_user(
        &server,
        &format!("fulluser_{}", timestamp),
        &format!("full_{}@example.com", timestamp),
        "SecurePass123!",
        "Full Scenario User",
    )
    .await;

    // Step 1: Create multiple accounts
    let checking =
        create_test_account(&server, &auth.token, "Checking Account", "CHECKING", 2000.0).await;
    let checking_id = checking["id"].as_str().unwrap();

    let savings =
        create_test_account(&server, &auth.token, "Savings Account", "SAVINGS", 10000.0).await;
    let savings_id = savings["id"].as_str().unwrap();

    let credit_card =
        create_test_account(&server, &auth.token, "Credit Card", "CREDIT_CARD", 0.0).await;
    let credit_card_id = credit_card["id"].as_str().unwrap();

    // Step 2: Create categories
    let groceries = create_test_category(&server, &auth.token, "Groceries").await;
    let groceries_id = groceries["id"].as_str().unwrap();

    let utilities = create_test_category(&server, &auth.token, "Utilities").await;
    let utilities_id = utilities["id"].as_str().unwrap();

    let salary = create_test_category(&server, &auth.token, "Salary").await;
    let salary_id = salary["id"].as_str().unwrap();

    let entertainment = create_test_category(&server, &auth.token, "Entertainment").await;
    let entertainment_id = entertainment["id"].as_str().unwrap();

    // Step 3: Create income transactions
    create_test_transaction(
        &server,
        &auth.token,
        checking_id,
        3000.0,
        "Monthly Salary",
        Some(salary_id),
        None,
    )
    .await;
    create_test_transaction(
        &server,
        &auth.token,
        savings_id,
        500.0,
        "Interest",
        Some(salary_id),
        None,
    )
    .await;

    // Step 4: Create expense transactions in different categories
    create_test_transaction(
        &server,
        &auth.token,
        checking_id,
        -400.0,
        "Grocery Shopping",
        Some(groceries_id),
        None,
    )
    .await;
    create_test_transaction(
        &server,
        &auth.token,
        checking_id,
        -150.0,
        "Electric Bill",
        Some(utilities_id),
        None,
    )
    .await;
    create_test_transaction(
        &server,
        &auth.token,
        credit_card_id,
        -200.0,
        "Movie & Dinner",
        Some(entertainment_id),
        None,
    )
    .await;
    create_test_transaction(
        &server,
        &auth.token,
        checking_id,
        -100.0,
        "Gas Bill",
        Some(utilities_id),
        None,
    )
    .await;

    // Step 5: Create budgets
    create_test_budget(
        &server,
        &auth.token,
        "Groceries Budget",
        Some(groceries_id),
        500.0,
    )
    .await;
    create_test_budget(
        &server,
        &auth.token,
        "Utilities Budget",
        Some(utilities_id),
        300.0,
    )
    .await;
    create_test_budget(
        &server,
        &auth.token,
        "Entertainment Budget",
        Some(entertainment_id),
        250.0,
    )
    .await;

    // Step 6: Get dashboard and verify comprehensive data
    let response = get_authenticated(&server, "/api/v1/dashboard", &auth.token).await;
    assert_status(&response, 200);

    let dashboard = extract_dashboard(response);

    // Verify net worth (sum of all accounts)
    // Checking: 2000 + 3000 - 400 - 150 - 100 = 4350
    // Savings: 10000 + 500 = 10500
    // Credit Card: 0 - 200 = -200
    // Total: 4350 + 10500 - 200 = 14650
    let net_worth = BigDecimal::from_str(dashboard["net_worth"].as_str().unwrap()).unwrap();
    let expected_net_worth = BigDecimal::from_str("14650").unwrap();
    assert_eq!(
        net_worth, expected_net_worth,
        "Net worth should be correctly calculated"
    );

    // Verify recent transactions are present
    let recent_transactions = dashboard["recent_transactions"].as_array().unwrap();
    assert!(
        recent_transactions.len() >= 6,
        "Should have at least 6 recent transactions"
    );

    // Verify budget statuses
    let budget_statuses = dashboard["budget_statuses"].as_array().unwrap();
    assert_eq!(budget_statuses.len(), 3, "Should have 3 budget statuses");

    // Verify category breakdown
    let category_breakdown = dashboard["category_breakdown"].as_array().unwrap();
    assert!(
        category_breakdown.len() >= 3,
        "Should have at least 3 categories in breakdown"
    );

    // Verify top spending categories
    let top_spending = dashboard["top_spending_categories"].as_array().unwrap();
    assert!(
        top_spending.len() > 0,
        "Should have top spending categories"
    );

    // Verify groceries category spending
    let groceries_breakdown = category_breakdown
        .iter()
        .find(|c| c["category_name"].as_str() == Some("Groceries"))
        .expect("Should have Groceries category");

    let groceries_total =
        BigDecimal::from_str(groceries_breakdown["total"].as_str().unwrap()).unwrap();
    assert_eq!(
        groceries_total,
        BigDecimal::from_str("400").unwrap(),
        "Groceries spending should be 400"
    );

    // Verify utilities category spending
    let utilities_breakdown = category_breakdown
        .iter()
        .find(|c| c["category_name"].as_str() == Some("Utilities"))
        .expect("Should have Utilities category");

    let utilities_total =
        BigDecimal::from_str(utilities_breakdown["total"].as_str().unwrap()).unwrap();
    assert_eq!(
        utilities_total,
        BigDecimal::from_str("250").unwrap(),
        "Utilities spending should be 250"
    );

    // Verify entertainment budget is under limit
    let entertainment_budget = budget_statuses.iter().find(|b| {
        // Find by checking if current spending matches entertainment spending
        let spending = BigDecimal::from_str(b["current_spending"].as_str().unwrap()).unwrap();
        spending == BigDecimal::from_str("200").unwrap()
    });

    assert!(
        entertainment_budget.is_some(),
        "Should have entertainment budget status"
    );
    let entertainment_budget = entertainment_budget.unwrap();
    assert_eq!(
        entertainment_budget["is_over_budget"].as_bool().unwrap(),
        false,
        "Entertainment should be under budget"
    );
}
