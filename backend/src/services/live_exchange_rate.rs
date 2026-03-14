//! Live exchange rate provider that fetches from exchangerate-api.com.
//!
//! This module contains the production implementation of `ExchangeRateProvider`.
//! It fetches real exchange rates from the API and caches them for 24 hours
//! per base currency.

use async_trait::async_trait;
use bigdecimal::BigDecimal;
use serde::Deserialize;
use std::collections::HashMap;
use std::env;
use std::str::FromStr;
use std::sync::Arc;
use tokio::sync::RwLock;

use crate::errors::ApiError;
use crate::types::CurrencyCode;

use super::exchange_rate_service::ExchangeRateProvider;

/// Exchange rate API response structure
#[derive(Debug, Deserialize)]
struct ExchangeRateApiResponse {
    result: String,
    conversion_rates: Option<HashMap<String, f64>>,
    #[serde(rename = "error-type")]
    error_type: Option<String>,
}

/// Cached exchange rates with timestamp
#[derive(Debug, Clone)]
struct CachedRates {
    rates: HashMap<CurrencyCode, BigDecimal>,
    timestamp: std::time::Instant,
}

/// Live exchange rate provider that fetches from exchangerate-api.com.
///
/// Caches rates for 24 hours per base currency.
/// Should be created once and shared via `AppState` for effective caching.
///
/// # Errors
///
/// Returns `ApiError::Internal` if:
/// - `EXCHANGE_RATE_API_KEY` environment variable is not set
/// - The external API returns an error
/// - Rate parsing fails
pub struct LiveExchangeRateProvider {
    cache: Arc<RwLock<HashMap<CurrencyCode, CachedRates>>>,
    api_key: String,
    cache_duration: std::time::Duration,
}

impl LiveExchangeRateProvider {
    /// Create a new live exchange rate provider.
    ///
    /// # Errors
    ///
    /// Returns `ApiError::Internal` if `EXCHANGE_RATE_API_KEY` environment variable is not set.
    pub fn new() -> Result<Self, ApiError> {
        let api_key = env::var("EXCHANGE_RATE_API_KEY").map_err(|_| {
            tracing::error!("EXCHANGE_RATE_API_KEY environment variable not set");
            ApiError::Internal
        })?;

        Ok(Self {
            cache: Arc::new(RwLock::new(HashMap::new())),
            api_key,
            cache_duration: std::time::Duration::from_secs(86400), // 24 hours
        })
    }

    /// Fetch exchange rates from the external API.
    async fn fetch_rates(
        &self,
        base_currency: CurrencyCode,
    ) -> Result<HashMap<CurrencyCode, BigDecimal>, ApiError> {
        let url = format!(
            "https://v6.exchangerate-api.com/v6/{}/latest/{}",
            self.api_key,
            base_currency.as_str()
        );

        let response = reqwest::get(&url).await.map_err(|e| {
            tracing::error!("Failed to fetch exchange rates: {}", e);
            ApiError::Internal
        })?;

        if !response.status().is_success() {
            tracing::error!(
                "Exchange rate API returned error status: {}",
                response.status()
            );
            return Err(ApiError::Internal);
        }

        let data: ExchangeRateApiResponse = response.json().await.map_err(|e| {
            tracing::error!("Failed to parse exchange rate response: {}", e);
            ApiError::Internal
        })?;

        if data.result != "success" {
            tracing::error!("Exchange rate API returned error: {:?}", data.error_type);
            return Err(ApiError::Internal);
        }

        let conversion_rates = data.conversion_rates.ok_or_else(|| {
            tracing::error!("No conversion rates in API response");
            ApiError::Internal
        })?;

        // Convert to our format - iterate through all supported currency codes
        let mut rates = HashMap::new();

        let supported_currencies = [
            CurrencyCode::Eur,
            CurrencyCode::Usd,
            CurrencyCode::Gbp,
            CurrencyCode::Jpy,
            CurrencyCode::Cad,
            CurrencyCode::Aud,
            CurrencyCode::Inr,
        ];

        for currency in supported_currencies {
            if let Some(&rate) = conversion_rates.get(currency.as_str()) {
                // Convert f64 to BigDecimal properly to preserve decimal places
                let rate_str = rate.to_string();
                let rate_decimal = BigDecimal::from_str(&rate_str).map_err(|e| {
                    tracing::error!("Failed to convert rate {} to BigDecimal: {}", rate, e);
                    ApiError::Internal
                })?;
                rates.insert(currency, rate_decimal);
            }
        }

        Ok(rates)
    }
}

#[async_trait]
impl ExchangeRateProvider for LiveExchangeRateProvider {
    async fn get_exchange_rates(
        &self,
        base_currency: CurrencyCode,
    ) -> Result<HashMap<CurrencyCode, BigDecimal>, ApiError> {
        // Check cache first
        {
            let cache_read = self.cache.read().await;
            if let Some(cached) = cache_read.get(&base_currency) {
                if cached.timestamp.elapsed() < self.cache_duration {
                    tracing::debug!(
                        "Using cached exchange rates for base {}",
                        base_currency.as_str()
                    );
                    return Ok(cached.rates.clone());
                }
            }
        }

        // Fetch fresh rates
        tracing::info!(
            "Fetching fresh exchange rates from API for base {}",
            base_currency.as_str()
        );
        let rates = self.fetch_rates(base_currency).await?;

        // Update cache for this specific base currency
        {
            let mut cache_write = self.cache.write().await;
            cache_write.insert(
                base_currency,
                CachedRates {
                    rates: rates.clone(),
                    timestamp: std::time::Instant::now(),
                },
            );
        }

        Ok(rates)
    }
}
