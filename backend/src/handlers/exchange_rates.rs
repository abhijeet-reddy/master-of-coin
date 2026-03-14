use crate::{
    AppState,
    auth::context::AuthContext,
    errors::ApiError,
    models::{ExchangeRateQuery, ExchangeRateResponse},
    services::exchange_rate_service::PRIMARY_CURRENCY,
    types::CurrencyCode,
};
use axum::{
    Json,
    extract::{Extension, Query, State},
};
use bigdecimal::BigDecimal;
use std::collections::HashMap;

/// Get exchange rates with configurable base currency
/// GET /exchange-rates?base=EUR
///
/// Returns current exchange rates for all supported currencies.
/// Uses the shared exchange rate provider from AppState (cached for 24 hours in production).
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
/// * `ApiError::Internal` - If exchange rate provider fails
pub async fn get_exchange_rates(
    State(state): State<AppState>,
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

    // Use shared provider from AppState
    let rates: HashMap<CurrencyCode, BigDecimal> = state
        .exchange_rate_provider
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
