//! Integration tests for exchange rates API endpoint.
//!
//! This module tests the exchange rates endpoint:
//! - GET /api/v1/exchange-rates - Get current exchange rates
//!
//! Tests cover:
//! - Successful retrieval of exchange rates with default base currency
//! - Successful retrieval with custom base currency
//! - Response format validation
//! - Authentication requirement
//! - Supported currency codes

use crate::common::*;
use serde_json::Value;

// ============================================================================
// Helper Functions
// ============================================================================

/// Helper to extract exchange rates from response
fn extract_exchange_rates(response: axum_test::TestResponse) -> Value {
    extract_json(response)
}

// ============================================================================
// Basic Exchange Rates Tests
// ============================================================================

/// Test that authenticated users can retrieve exchange rates with default base currency.
///
/// Verifies that:
/// - Status code is 200 OK
/// - Response has correct structure
/// - Base currency defaults to EUR
/// - Conversion rates are included
/// - All supported currencies are present
#[tokio::test]
async fn test_get_exchange_rates_default_base() {
    let server = create_test_server().await;
    let timestamp = chrono::Utc::now().timestamp_nanos_opt().unwrap();

    let auth = register_test_user(
        &server,
        &format!("exchangeuser_{}", timestamp),
        &format!("exchange_{}@example.com", timestamp),
        "SecurePass123!",
        "Exchange Rate User",
    )
    .await;

    // Get exchange rates without specifying base currency
    let response = get_authenticated(&server, "/api/v1/exchange-rates", &auth.token).await;
    assert_status(&response, 200);

    let data = extract_exchange_rates(response);

    // Verify response structure
    assert_eq!(data["result"].as_str().unwrap(), "success");
    assert_eq!(data["base_code"].as_str().unwrap(), "EUR");

    // Verify conversion_rates object exists
    let rates = data["conversion_rates"].as_object().unwrap();
    assert!(rates.len() > 0, "Should have conversion rates");

    // Verify all supported currencies are present
    let supported_currencies = vec!["USD", "EUR", "GBP", "JPY", "CAD", "AUD", "INR"];
    for currency in supported_currencies {
        assert!(
            rates.contains_key(currency),
            "Should include {} currency",
            currency
        );

        // Verify rate is a valid number string
        let rate_str = rates[currency].as_str().unwrap();
        let rate: f64 = rate_str.parse().expect("Rate should be a valid number");
        assert!(rate > 0.0, "{} rate should be positive", currency);
    }
}

/// Test that users can retrieve exchange rates with a custom base currency.
///
/// Verifies that:
/// - Status code is 200 OK
/// - Base currency matches the requested currency
/// - Conversion rates are relative to the specified base
#[tokio::test]
async fn test_get_exchange_rates_custom_base() {
    let server = create_test_server().await;
    let timestamp = chrono::Utc::now().timestamp_nanos_opt().unwrap();

    let auth = register_test_user(
        &server,
        &format!("usduser_{}", timestamp),
        &format!("usd_{}@example.com", timestamp),
        "SecurePass123!",
        "USD Exchange User",
    )
    .await;

    // Get exchange rates with USD as base currency
    let response = get_authenticated(&server, "/api/v1/exchange-rates?base=USD", &auth.token).await;
    assert_status(&response, 200);

    let data = extract_exchange_rates(response);

    // Verify base currency is USD
    assert_eq!(data["result"].as_str().unwrap(), "success");
    assert_eq!(data["base_code"].as_str().unwrap(), "USD");

    // Verify conversion rates are present
    let rates = data["conversion_rates"].as_object().unwrap();
    assert!(rates.len() > 0, "Should have conversion rates");

    // USD rate should be 1.0 when USD is the base
    let usd_rate_str = rates["USD"].as_str().unwrap();
    let usd_rate: f64 = usd_rate_str.parse().unwrap();
    assert!(
        (usd_rate - 1.0).abs() < 0.0001,
        "USD rate should be 1.0 when USD is base"
    );
}

/// Test that different base currencies return different exchange rates.
///
/// Verifies that:
/// - EUR and GBP as base currencies return different rates
/// - Response structure is consistent across different bases
#[tokio::test]
async fn test_get_exchange_rates_different_bases() {
    let server = create_test_server().await;
    let timestamp = chrono::Utc::now().timestamp_nanos_opt().unwrap();

    let auth = register_test_user(
        &server,
        &format!("multiuser_{}", timestamp),
        &format!("multi_{}@example.com", timestamp),
        "SecurePass123!",
        "Multi Currency User",
    )
    .await;

    // Get rates with EUR base
    let response_eur =
        get_authenticated(&server, "/api/v1/exchange-rates?base=EUR", &auth.token).await;
    assert_status(&response_eur, 200);
    let data_eur = extract_exchange_rates(response_eur);

    // Get rates with GBP base
    let response_gbp =
        get_authenticated(&server, "/api/v1/exchange-rates?base=GBP", &auth.token).await;
    assert_status(&response_gbp, 200);
    let data_gbp = extract_exchange_rates(response_gbp);

    // Verify both responses are successful
    assert_eq!(data_eur["result"].as_str().unwrap(), "success");
    assert_eq!(data_gbp["result"].as_str().unwrap(), "success");

    // Verify base codes are different
    assert_eq!(data_eur["base_code"].as_str().unwrap(), "EUR");
    assert_eq!(data_gbp["base_code"].as_str().unwrap(), "GBP");

    // Verify rates are different (EUR rate in EUR base vs GBP base)
    let eur_in_eur = data_eur["conversion_rates"]["EUR"].as_str().unwrap();
    let eur_in_gbp = data_gbp["conversion_rates"]["EUR"].as_str().unwrap();

    assert_ne!(
        eur_in_eur, eur_in_gbp,
        "EUR rates should differ between EUR and GBP bases"
    );
}

// ============================================================================
// Authentication Tests
// ============================================================================

/// Test that getting exchange rates without authentication fails.
///
/// Verifies that:
/// - Status code is 401 Unauthorized
/// - Error message indicates missing authentication
#[tokio::test]
async fn test_get_exchange_rates_unauthorized() {
    let server = create_test_server().await;

    let response = get_unauthenticated(&server, "/api/v1/exchange-rates").await;
    assert_status(&response, 401);

    let error_text = response.text();
    assert!(
        error_text.to_lowercase().contains("unauthorized")
            || error_text.to_lowercase().contains("token"),
        "Error message should indicate missing authentication"
    );
}

/// Test that invalid tokens are rejected.
///
/// Verifies that:
/// - Status code is 401 Unauthorized
/// - Invalid JWT tokens are not accepted
#[tokio::test]
async fn test_get_exchange_rates_invalid_token() {
    let server = create_test_server().await;

    let response = get_authenticated(&server, "/api/v1/exchange-rates", "invalid_token").await;
    assert_status(&response, 401);
}

// ============================================================================
// Response Format Tests
// ============================================================================

/// Test that the response format matches the expected structure.
///
/// Verifies that:
/// - All required fields are present
/// - Field types are correct
/// - Rates are valid numeric strings
#[tokio::test]
async fn test_exchange_rates_response_format() {
    let server = create_test_server().await;
    let timestamp = chrono::Utc::now().timestamp_nanos_opt().unwrap();

    let auth = register_test_user(
        &server,
        &format!("formatuser_{}", timestamp),
        &format!("format_{}@example.com", timestamp),
        "SecurePass123!",
        "Format Test User",
    )
    .await;

    let response = get_authenticated(&server, "/api/v1/exchange-rates", &auth.token).await;
    assert_status(&response, 200);

    let data = extract_exchange_rates(response);

    // Verify required fields exist
    assert!(data.get("result").is_some(), "Should have 'result' field");
    assert!(
        data.get("base_code").is_some(),
        "Should have 'base_code' field"
    );
    assert!(
        data.get("conversion_rates").is_some(),
        "Should have 'conversion_rates' field"
    );

    // Verify field types
    assert!(data["result"].is_string(), "'result' should be a string");
    assert!(
        data["base_code"].is_string(),
        "'base_code' should be a string"
    );
    assert!(
        data["conversion_rates"].is_object(),
        "'conversion_rates' should be an object"
    );

    // Verify conversion_rates contains valid numeric strings
    let rates = data["conversion_rates"].as_object().unwrap();
    for (currency, rate) in rates.iter() {
        assert!(rate.is_string(), "Rate for {} should be a string", currency);

        let rate_str = rate.as_str().unwrap();
        let parsed_rate: Result<f64, _> = rate_str.parse();
        assert!(
            parsed_rate.is_ok(),
            "Rate for {} should be parseable as a number",
            currency
        );
    }
}

// ============================================================================
// Currency Support Tests
// ============================================================================

/// Test that all supported currencies can be used as base currency.
///
/// Verifies that:
/// - Each supported currency can be used as base
/// - Response is successful for all supported currencies
#[tokio::test]
async fn test_all_supported_currencies_as_base() {
    let server = create_test_server().await;
    let timestamp = chrono::Utc::now().timestamp_nanos_opt().unwrap();

    let auth = register_test_user(
        &server,
        &format!("allcurruser_{}", timestamp),
        &format!("allcurr_{}@example.com", timestamp),
        "SecurePass123!",
        "All Currency User",
    )
    .await;

    let supported_currencies = vec!["USD", "EUR", "GBP", "JPY", "CAD", "AUD", "INR"];

    for currency in supported_currencies {
        let url = format!("/api/v1/exchange-rates?base={}", currency);
        let response = get_authenticated(&server, &url, &auth.token).await;
        assert_status(&response, 200);

        let data = extract_exchange_rates(response);
        assert_eq!(
            data["result"].as_str().unwrap(),
            "success",
            "Should succeed for {} base",
            currency
        );
        assert_eq!(
            data["base_code"].as_str().unwrap(),
            currency,
            "Base code should match requested currency"
        );
    }
}

/// Test that exchange rates are reasonable (basic sanity check).
///
/// Verifies that:
/// - Rates are positive numbers
/// - Rates are within reasonable bounds (not 0 or extremely large)
#[tokio::test]
async fn test_exchange_rates_sanity_check() {
    let server = create_test_server().await;
    let timestamp = chrono::Utc::now().timestamp_nanos_opt().unwrap();

    let auth = register_test_user(
        &server,
        &format!("sanityuser_{}", timestamp),
        &format!("sanity_{}@example.com", timestamp),
        "SecurePass123!",
        "Sanity Check User",
    )
    .await;

    let response = get_authenticated(&server, "/api/v1/exchange-rates", &auth.token).await;
    assert_status(&response, 200);

    let data = extract_exchange_rates(response);
    let rates = data["conversion_rates"].as_object().unwrap();

    for (currency, rate) in rates.iter() {
        let rate_str = rate.as_str().unwrap();
        let rate_value: f64 = rate_str.parse().unwrap();

        // Verify rate is positive
        assert!(rate_value > 0.0, "{} rate should be positive", currency);

        // Verify rate is within reasonable bounds (0.001 to 10000)
        // This catches obvious errors like 0 or infinity
        assert!(
            rate_value > 0.001 && rate_value < 10000.0,
            "{} rate {} should be within reasonable bounds",
            currency,
            rate_value
        );
    }
}
