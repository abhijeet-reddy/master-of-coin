//! Integration tests for currency conversion in dashboard and analytics.
//!
//! This module tests that the backend properly converts currencies to the primary currency
//! when calculating:
//! - Net worth across accounts with different currencies
//! - Budget spending with transactions in different currencies
//! - Category breakdown with multi-currency transactions
//! - Spending trends with multi-currency data
//!
//! Tests cover:
//! - Multi-currency net worth calculation
//! - Multi-currency budget tracking
//! - Multi-currency category breakdown
//! - Currency conversion accuracy
//! - Data isolation between users with different currencies
//!
//! Note: Tests use MockExchangeRateProvider with fixed deterministic rates:
//! EUR base: USD=1.08, GBP=0.85, JPY=162.0, CAD=1.47, AUD=1.65, INR=90.0
//! This means:
//! - 1080 USD = 1080 / 1.08 = 1000 EUR
//! - 850 GBP = 850 / 0.85 = 1000 EUR

use crate::common::*;
use axum_test::{TestResponse, TestServer};
use bigdecimal::BigDecimal;
use chrono::Utc;
use serde_json::{Value, json};
use std::str::FromStr;

// ============================================================================
// Helper Functions
// ============================================================================

/// Helper to extract dashboard summary from response
fn extract_dashboard(response: TestResponse) -> Value {
    extract_json(response)
}

/// Helper to create an account with specific currency
async fn create_account_with_currency(
    server: &TestServer,
    token: &str,
    name: &str,
    account_type: &str,
    currency: &str,
    initial_balance: f64,
) -> Value {
    let request = json!({
        "name": name,
        "account_type": account_type,
        "currency": currency,
        "initial_balance": initial_balance
    });
    let response = post_authenticated(server, "/api/v1/accounts", token, &request).await;
    assert_status(&response, 201);
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

/// Helper to create a transaction for testing
async fn create_test_transaction(
    server: &TestServer,
    token: &str,
    account_id: &str,
    amount: f64,
    title: &str,
    category_id: Option<&str>,
) -> Value {
    let mut request = json!({
        "account_id": account_id,
        "amount": amount,
        "title": title,
        "date": Utc::now().to_rfc3339()
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
    let end_date = (now + chrono::Duration::days(30)).date_naive();

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
// Multi-Currency Net Worth Tests
// ============================================================================

/// Test that net worth is calculated correctly with accounts in different currencies.
///
/// Scenario:
/// - Create EUR account with 1000 EUR
/// - Create USD account with 1080 USD (= 1000 EUR at mock rate 1.08)
/// - Create GBP account with 850 GBP (= 1000 EUR at mock rate 0.85)
///
/// With mock rates: net worth should be exactly 3000 EUR.
#[tokio::test]
async fn test_multi_currency_net_worth() {
    let server = create_test_server().await;
    let timestamp = Utc::now().timestamp_nanos_opt().unwrap();

    let auth = register_test_user(
        &server,
        &format!("multicurrency_{}", timestamp),
        &format!("multi_{}@example.com", timestamp),
        "SecurePass123!",
        "Multi Currency User",
    )
    .await;

    // Create accounts in different currencies
    // EUR account (base currency)
    create_account_with_currency(
        &server,
        &auth.token,
        "EUR Account",
        "CHECKING",
        "EUR",
        1000.0,
    )
    .await;

    // USD account: 1080 USD / 1.08 = 1000 EUR
    create_account_with_currency(
        &server,
        &auth.token,
        "USD Account",
        "SAVINGS",
        "USD",
        1080.0,
    )
    .await;

    // GBP account: 850 GBP / 0.85 = 1000 EUR
    create_account_with_currency(
        &server,
        &auth.token,
        "GBP Account",
        "INVESTMENT",
        "GBP",
        850.0,
    )
    .await;

    // Get dashboard
    let response = get_authenticated(&server, "/api/v1/dashboard", &auth.token).await;
    assert_status(&response, 200);

    let dashboard = extract_dashboard(response);

    // With mock rates, net worth should be exactly 3000 EUR
    // EUR: 1000, USD: 1080/1.08=1000, GBP: 850/0.85=1000
    let net_worth = BigDecimal::from_str(dashboard["net_worth"].as_str().unwrap()).unwrap();
    let expected_min = BigDecimal::from_str("2990").unwrap();
    let expected_max = BigDecimal::from_str("3010").unwrap();

    assert!(
        net_worth >= expected_min && net_worth <= expected_max,
        "Net worth should be approximately 3000 EUR (got {})",
        net_worth
    );
}

// ============================================================================
// Multi-Currency Budget Tests
// ============================================================================

/// Test that budget spending is calculated correctly with transactions in different currencies.
///
/// Scenario:
/// - Create EUR account and USD account
/// - Create budget with 1000 EUR limit
/// - Add 300 EUR spending and 324 USD spending (= 300 EUR at mock rate 1.08)
///
/// With mock rates: total spending should be exactly 600 EUR.
#[tokio::test]
async fn test_multi_currency_budget_tracking() {
    let server = create_test_server().await;
    let timestamp = Utc::now().timestamp_nanos_opt().unwrap();

    let auth = register_test_user(
        &server,
        &format!("budgetmulti_{}", timestamp),
        &format!("budgetmulti_{}@example.com", timestamp),
        "SecurePass123!",
        "Budget Multi Currency User",
    )
    .await;

    // Create category
    let category = create_test_category(&server, &auth.token, "Shopping").await;
    let category_id = category["id"].as_str().unwrap();

    // Create accounts in different currencies
    let eur_account = create_account_with_currency(
        &server,
        &auth.token,
        "EUR Account",
        "CHECKING",
        "EUR",
        2000.0,
    )
    .await;
    let eur_account_id = eur_account["id"].as_str().unwrap();

    let usd_account = create_account_with_currency(
        &server,
        &auth.token,
        "USD Account",
        "CHECKING",
        "USD",
        2000.0,
    )
    .await;
    let usd_account_id = usd_account["id"].as_str().unwrap();

    // Create budget with 1000 EUR limit
    create_test_budget(
        &server,
        &auth.token,
        "Shopping Budget",
        Some(category_id),
        1000.0,
    )
    .await;

    // Create transactions in different currencies
    // 300 EUR spending
    create_test_transaction(
        &server,
        &auth.token,
        eur_account_id,
        -300.0,
        "EUR Shopping",
        Some(category_id),
    )
    .await;

    // 324 USD spending: 324 / 1.08 = 300 EUR
    create_test_transaction(
        &server,
        &auth.token,
        usd_account_id,
        -324.0,
        "USD Shopping",
        Some(category_id),
    )
    .await;

    // Get dashboard
    let response = get_authenticated(&server, "/api/v1/dashboard", &auth.token).await;
    assert_status(&response, 200);

    let dashboard = extract_dashboard(response);

    // Verify budget status
    let budget_statuses = dashboard["budget_statuses"].as_array().unwrap();
    assert_eq!(budget_statuses.len(), 1, "Should have 1 budget status");

    let budget_status = &budget_statuses[0];

    // Current spending should be exactly 600 EUR (300 EUR + 324 USD / 1.08 = 300 EUR)
    let current_spending =
        BigDecimal::from_str(budget_status["current_spending"].as_str().unwrap()).unwrap();
    let expected_min = BigDecimal::from_str("599").unwrap();
    let expected_max = BigDecimal::from_str("601").unwrap();

    assert!(
        current_spending >= expected_min && current_spending <= expected_max,
        "Current spending should be approximately 600 EUR (got {})",
        current_spending
    );

    // Budget should not be exceeded
    assert_eq!(
        budget_status["is_over_budget"].as_bool().unwrap(),
        false,
        "Should not be over budget"
    );

    // Percentage should be around 60%
    let percentage = budget_status["percentage_used"].as_f64().unwrap();
    assert!(
        percentage > 59.0 && percentage < 61.0,
        "Percentage should be around 60% (got {})",
        percentage
    );
}

// ============================================================================
// Multi-Currency Category Breakdown Tests
// ============================================================================

/// Test that category breakdown correctly aggregates spending across different currencies.
///
/// Scenario:
/// - Create accounts in EUR, USD, and GBP
/// - Create transactions in the same category but different currencies
///   - 500 EUR
///   - 540 USD (= 500 EUR at mock rate 1.08)
///   - 425 GBP (= 500 EUR at mock rate 0.85)
///
/// With mock rates: total category spending should be exactly 1500 EUR.
#[tokio::test]
async fn test_multi_currency_category_breakdown() {
    let server = create_test_server().await;
    let timestamp = Utc::now().timestamp_nanos_opt().unwrap();

    let auth = register_test_user(
        &server,
        &format!("catmulti_{}", timestamp),
        &format!("catmulti_{}@example.com", timestamp),
        "SecurePass123!",
        "Category Multi Currency User",
    )
    .await;

    // Create category
    let category = create_test_category(&server, &auth.token, "Travel").await;
    let category_id = category["id"].as_str().unwrap();

    // Create accounts in different currencies
    let eur_account = create_account_with_currency(
        &server,
        &auth.token,
        "EUR Account",
        "CHECKING",
        "EUR",
        5000.0,
    )
    .await;
    let eur_account_id = eur_account["id"].as_str().unwrap();

    let usd_account = create_account_with_currency(
        &server,
        &auth.token,
        "USD Account",
        "CHECKING",
        "USD",
        5000.0,
    )
    .await;
    let usd_account_id = usd_account["id"].as_str().unwrap();

    let gbp_account = create_account_with_currency(
        &server,
        &auth.token,
        "GBP Account",
        "CHECKING",
        "GBP",
        5000.0,
    )
    .await;
    let gbp_account_id = gbp_account["id"].as_str().unwrap();

    // Create transactions in the same category but different currencies
    // 500 EUR
    create_test_transaction(
        &server,
        &auth.token,
        eur_account_id,
        -500.0,
        "EUR Travel Expense",
        Some(category_id),
    )
    .await;

    // 540 USD: 540 / 1.08 = 500 EUR
    create_test_transaction(
        &server,
        &auth.token,
        usd_account_id,
        -540.0,
        "USD Travel Expense",
        Some(category_id),
    )
    .await;

    // 425 GBP: 425 / 0.85 = 500 EUR
    create_test_transaction(
        &server,
        &auth.token,
        gbp_account_id,
        -425.0,
        "GBP Travel Expense",
        Some(category_id),
    )
    .await;

    // Get dashboard
    let response = get_authenticated(&server, "/api/v1/dashboard", &auth.token).await;
    assert_status(&response, 200);

    let dashboard = extract_dashboard(response);

    // Verify category breakdown
    let category_breakdown = dashboard["category_breakdown"].as_array().unwrap();
    assert!(
        category_breakdown.len() >= 1,
        "Should have at least 1 category"
    );

    // Find travel category
    let travel_breakdown = category_breakdown
        .iter()
        .find(|c| c["category_name"].as_str() == Some("Travel"))
        .expect("Should have Travel category");

    // Total should be exactly 1500 EUR (500 + 500 + 500)
    let travel_total = BigDecimal::from_str(travel_breakdown["total"].as_str().unwrap()).unwrap();
    let expected_min = BigDecimal::from_str("1499").unwrap();
    let expected_max = BigDecimal::from_str("1501").unwrap();

    assert!(
        travel_total >= expected_min && travel_total <= expected_max,
        "Travel spending should be approximately 1500 EUR (got {})",
        travel_total
    );
}

// ============================================================================
// Mixed Currency Scenario Test
// ============================================================================

/// Test comprehensive scenario with multiple currencies across all features.
///
/// Scenario:
/// - Create accounts in EUR, USD, and GBP
/// - Create transactions in all currencies
/// - Create budgets and verify they track spending correctly
/// - Verify category breakdown aggregates correctly
///
/// With mock rates (EUR base: USD=1.08, GBP=0.85):
/// - 10000 EUR + 10800 USD (=10000 EUR) + 8500 GBP (=10000 EUR) = 30000 EUR initial
/// - Food: 200 EUR + 216 USD (=200 EUR) + 170 GBP (=200 EUR) = 600 EUR
/// - Transport: 100 EUR + 108 USD (=100 EUR) = 200 EUR
/// - Net worth ≈ 30000 - 600 - 200 = 29200 EUR
#[tokio::test]
async fn test_comprehensive_multi_currency_scenario() {
    let server = create_test_server().await;
    let timestamp = Utc::now().timestamp_nanos_opt().unwrap();

    let auth = register_test_user(
        &server,
        &format!("comprehensive_{}", timestamp),
        &format!("comprehensive_{}@example.com", timestamp),
        "SecurePass123!",
        "Comprehensive Multi Currency User",
    )
    .await;

    // Create categories
    let food = create_test_category(&server, &auth.token, "Food").await;
    let food_id = food["id"].as_str().unwrap();

    let transport = create_test_category(&server, &auth.token, "Transport").await;
    let transport_id = transport["id"].as_str().unwrap();

    // Create accounts in different currencies with initial balances
    // Using exact multiples of mock rates for deterministic results
    let eur_account = create_account_with_currency(
        &server,
        &auth.token,
        "EUR Checking",
        "CHECKING",
        "EUR",
        10000.0,
    )
    .await;
    let eur_account_id = eur_account["id"].as_str().unwrap();

    let usd_account = create_account_with_currency(
        &server,
        &auth.token,
        "USD Savings",
        "SAVINGS",
        "USD",
        10800.0, // 10800 / 1.08 = 10000 EUR
    )
    .await;
    let usd_account_id = usd_account["id"].as_str().unwrap();

    let gbp_account = create_account_with_currency(
        &server,
        &auth.token,
        "GBP Investment",
        "INVESTMENT",
        "GBP",
        8500.0, // 8500 / 0.85 = 10000 EUR
    )
    .await;
    let gbp_account_id = gbp_account["id"].as_str().unwrap();

    // Create budget for food (1000 EUR limit)
    create_test_budget(&server, &auth.token, "Food Budget", Some(food_id), 1000.0).await;

    // Create transactions in different currencies
    // Food expenses
    create_test_transaction(
        &server,
        &auth.token,
        eur_account_id,
        -200.0,
        "EUR Restaurant",
        Some(food_id),
    )
    .await;

    // 216 USD / 1.08 = 200 EUR
    create_test_transaction(
        &server,
        &auth.token,
        usd_account_id,
        -216.0,
        "USD Groceries",
        Some(food_id),
    )
    .await;

    // 170 GBP / 0.85 = 200 EUR
    create_test_transaction(
        &server,
        &auth.token,
        gbp_account_id,
        -170.0,
        "GBP Takeout",
        Some(food_id),
    )
    .await;

    // Transport expenses
    create_test_transaction(
        &server,
        &auth.token,
        eur_account_id,
        -100.0,
        "EUR Gas",
        Some(transport_id),
    )
    .await;

    // 108 USD / 1.08 = 100 EUR
    create_test_transaction(
        &server,
        &auth.token,
        usd_account_id,
        -108.0,
        "USD Uber",
        Some(transport_id),
    )
    .await;

    // Get dashboard
    let response = get_authenticated(&server, "/api/v1/dashboard", &auth.token).await;
    assert_status(&response, 200);

    let dashboard = extract_dashboard(response);

    // Verify net worth: 30000 - 600 (food) - 200 (transport) = 29200 EUR
    let net_worth = BigDecimal::from_str(dashboard["net_worth"].as_str().unwrap()).unwrap();
    let expected_min = BigDecimal::from_str("29190").unwrap();
    let expected_max = BigDecimal::from_str("29210").unwrap();

    assert!(
        net_worth >= expected_min && net_worth <= expected_max,
        "Net worth should be approximately 29200 EUR (got {})",
        net_worth
    );

    // Verify budget status
    let budget_statuses = dashboard["budget_statuses"].as_array().unwrap();
    assert_eq!(budget_statuses.len(), 1, "Should have 1 budget status");

    let budget_status = &budget_statuses[0];

    // Food spending should be exactly 600 EUR (200 + 200 + 200)
    let current_spending =
        BigDecimal::from_str(budget_status["current_spending"].as_str().unwrap()).unwrap();
    let spending_min = BigDecimal::from_str("599").unwrap();
    let spending_max = BigDecimal::from_str("601").unwrap();

    assert!(
        current_spending >= spending_min && current_spending <= spending_max,
        "Food spending should be approximately 600 EUR (got {})",
        current_spending
    );

    // Verify category breakdown
    let category_breakdown = dashboard["category_breakdown"].as_array().unwrap();
    assert!(
        category_breakdown.len() >= 2,
        "Should have at least 2 categories"
    );

    // Find food category
    let food_breakdown = category_breakdown
        .iter()
        .find(|c| c["category_name"].as_str() == Some("Food"))
        .expect("Should have Food category");

    let food_total = BigDecimal::from_str(food_breakdown["total"].as_str().unwrap()).unwrap();

    // Food total should be approximately 600 EUR
    assert!(
        food_total >= spending_min && food_total <= spending_max,
        "Food total should be approximately 600 EUR (got {})",
        food_total
    );

    // Find transport category
    let transport_breakdown = category_breakdown
        .iter()
        .find(|c| c["category_name"].as_str() == Some("Transport"))
        .expect("Should have Transport category");

    let transport_total =
        BigDecimal::from_str(transport_breakdown["total"].as_str().unwrap()).unwrap();

    // Transport total should be approximately 200 EUR
    let transport_min = BigDecimal::from_str("199").unwrap();
    let transport_max = BigDecimal::from_str("201").unwrap();

    assert!(
        transport_total >= transport_min && transport_total <= transport_max,
        "Transport total should be approximately 200 EUR (got {})",
        transport_total
    );
}

// ============================================================================
// Currency Conversion Accuracy Tests
// ============================================================================

/// Test that same-currency transactions don't get converted (no conversion overhead).
///
/// Verifies that:
/// - Transactions in primary currency (EUR) are not converted
/// - Amounts remain exact without rounding errors
#[tokio::test]
async fn test_same_currency_no_conversion() {
    let server = create_test_server().await;
    let timestamp = Utc::now().timestamp_nanos_opt().unwrap();

    let auth = register_test_user(
        &server,
        &format!("samecurrency_{}", timestamp),
        &format!("samecurrency_{}@example.com", timestamp),
        "SecurePass123!",
        "Same Currency User",
    )
    .await;

    // Create EUR account (primary currency)
    let account = create_account_with_currency(
        &server,
        &auth.token,
        "EUR Account",
        "CHECKING",
        "EUR",
        1234.56,
    )
    .await;
    let account_id = account["id"].as_str().unwrap();

    // Create precise transaction
    create_test_transaction(
        &server,
        &auth.token,
        account_id,
        -123.45,
        "Precise Amount",
        None,
    )
    .await;

    // Get dashboard
    let response = get_authenticated(&server, "/api/v1/dashboard", &auth.token).await;
    assert_status(&response, 200);

    let dashboard = extract_dashboard(response);

    // Verify net worth is exact (no conversion rounding)
    let net_worth = BigDecimal::from_str(dashboard["net_worth"].as_str().unwrap()).unwrap();
    let expected = BigDecimal::from_str("1111.11").unwrap();

    assert_eq!(
        net_worth, expected,
        "Net worth should be exact for same currency"
    );
}
