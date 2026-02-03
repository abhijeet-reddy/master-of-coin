use bigdecimal::BigDecimal;
use serde::Deserialize;
use std::collections::HashMap;
use std::env;
use std::str::FromStr;
use std::sync::Arc;
use tokio::sync::RwLock;

use crate::errors::ApiError;
use crate::types::CurrencyCode;

/// Primary currency for the application
/// TODO: Fetch from user settings in database
pub const PRIMARY_CURRENCY: CurrencyCode = CurrencyCode::Eur;

/// Exchange rate API response structure
#[derive(Debug, Deserialize)]
struct ExchangeRateResponse {
    result: String,
    conversion_rates: Option<HashMap<String, f64>>,
    #[serde(rename = "error-type")]
    error_type: Option<String>,
}

/// Cached exchange rates with timestamp
/// Key is the base currency, value is the rates for that base
#[derive(Debug, Clone)]
struct CachedRates {
    rates: HashMap<CurrencyCode, BigDecimal>,
    timestamp: std::time::Instant,
}

/// Exchange rate service with caching
/// Fetches rates from exchangerate-api.com and caches them for 1 hour
/// Maintains separate caches for different base currencies
pub struct ExchangeRateService {
    cache: Arc<RwLock<HashMap<CurrencyCode, CachedRates>>>,
    api_key: String,
    cache_duration: std::time::Duration,
}

impl ExchangeRateService {
    /// Create a new exchange rate service
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

    /// Get exchange rates with specified base currency
    /// Uses cached rates if available and not expired
    /// Maintains separate caches for each base currency
    pub async fn get_exchange_rates(
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

    /// Fetch exchange rates from the API
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

        let data: ExchangeRateResponse = response.json().await.map_err(|e| {
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

    /// Convert an amount from one currency to another
    /// Fetches exchange rates with the source currency as base for direct conversion
    /// This eliminates compounding errors from intermediate conversions
    pub async fn convert_currency(
        &self,
        amount: &BigDecimal,
        from_currency: CurrencyCode,
        to_currency: CurrencyCode,
    ) -> Result<BigDecimal, ApiError> {
        // If currencies are the same, return the amount as-is
        if from_currency == to_currency {
            return Ok(amount.clone());
        }

        // Fetch rates with source currency as base for direct conversion
        let rates = self.get_exchange_rates(from_currency).await?;

        // Get the direct conversion rate from source to target
        let to_rate = rates.get(&to_currency).ok_or_else(|| {
            tracing::error!(
                "No exchange rate found for {} to {}",
                from_currency.as_str(),
                to_currency.as_str()
            );
            ApiError::Internal
        })?;

        // Direct conversion: amount_in_from * rate_to_target
        let converted_amount = amount * to_rate;

        tracing::debug!(
            "Converted {} {} to {} {} (rate: {})",
            amount,
            from_currency.as_str(),
            converted_amount,
            to_currency.as_str(),
            to_rate
        );

        Ok(converted_amount)
    }

    /// Convert an amount to the primary currency
    pub async fn convert_to_primary_currency(
        &self,
        amount: &BigDecimal,
        from_currency: CurrencyCode,
    ) -> Result<BigDecimal, ApiError> {
        self.convert_currency(amount, from_currency, PRIMARY_CURRENCY)
            .await
    }
}

impl Default for ExchangeRateService {
    fn default() -> Self {
        Self::new().expect("Failed to create ExchangeRateService")
    }
}
