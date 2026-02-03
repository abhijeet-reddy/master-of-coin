use crate::{
    auth::context::AuthContext,
    errors::ApiError,
    models::{ExchangeRateQuery, ExchangeRateResponse},
    services::exchange_rate_service::{ExchangeRateService, PRIMARY_CURRENCY},
    types::CurrencyCode,
};
use axum::{
    Json,
    extract::{Extension, Query},
};
use bigdecimal::BigDecimal;
use std::collections::HashMap;

/// Get exchange rates with configurable base currency
/// GET /exchange-rates?base=EUR
///
/// Returns current exchange rates for all supported currencies.
/// Rates are cached for 24 hours to minimize API calls.
///
/// # Query Parameters
///
/// * `base` - Optional base currency code (defaults to EUR)
///
/// # Returns
///
/// * `ExchangeRateResponse` - Exchange rates for all supported currencies
///
/// # Errors
///
/// * `ApiError::Internal` - If exchange rate service fails
pub async fn get_exchange_rates(
    Extension(auth_context): Extension<AuthContext>,
    Query(query): Query<ExchangeRateQuery>,
) -> Result<Json<ExchangeRateResponse>, ApiError> {
    let user_id = auth_context.user_id();
    let base_currency = query.base.unwrap_or(PRIMARY_CURRENCY);

    tracing::info!(
        "Fetching exchange rates for user {} with base currency {}",
        user_id,
        base_currency.as_str()
    );

    // Get exchange rate service
    let exchange_rate_service = ExchangeRateService::new()?;

    // Fetch rates from service (uses cache if available)
    let rates: HashMap<CurrencyCode, BigDecimal> = exchange_rate_service
        .get_exchange_rates(base_currency)
        .await?;

    // Convert to response format
    let conversion_rates: HashMap<String, String> = rates
        .into_iter()
        .map(|(currency, rate)| (currency.as_str().to_string(), rate.to_string()))
        .collect();

    let response = ExchangeRateResponse {
        result: "success".to_string(),
        base_code: base_currency.as_str().to_string(),
        conversion_rates,
    };

    Ok(Json(response))
}
