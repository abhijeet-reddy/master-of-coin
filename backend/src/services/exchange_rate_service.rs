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
#[derive(Debug, Clone)]
struct CachedRates {
    rates: HashMap<CurrencyCode, BigDecimal>,
    timestamp: std::time::Instant,
}

/// Exchange rate service with caching
/// Fetches rates from exchangerate-api.com and caches them for 1 hour
pub struct ExchangeRateService {
    cache: Arc<RwLock<Option<CachedRates>>>,
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
            cache: Arc::new(RwLock::new(None)),
            api_key,
            cache_duration: std::time::Duration::from_secs(86400), // 24 hours
        })
    }

    /// Get exchange rates with specified base currency
    /// Uses cached rates if available and not expired
    pub async fn get_exchange_rates(
        &self,
        base_currency: CurrencyCode,
    ) -> Result<HashMap<CurrencyCode, BigDecimal>, ApiError> {
        // Check cache first
        {
            let cache_read = self.cache.read().await;
            if let Some(cached) = cache_read.as_ref() {
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

        // Update cache
        {
            let mut cache_write = self.cache.write().await;
            *cache_write = Some(CachedRates {
                rates: rates.clone(),
                timestamp: std::time::Instant::now(),
            });
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
    /// Uses primary currency as the intermediate currency for conversion
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

        let rates = self.get_exchange_rates(PRIMARY_CURRENCY).await?;

        // Get exchange rates for both currencies
        let from_rate = rates
            .get(&from_currency)
            .cloned()
            .unwrap_or_else(|| BigDecimal::from(1));
        let to_rate = rates
            .get(&to_currency)
            .cloned()
            .unwrap_or_else(|| BigDecimal::from(1));

        // Convert: amount_in_from -> amount_in_primary -> amount_in_to
        // amount_in_primary = amount_in_from / from_rate
        // amount_in_to = amount_in_primary * to_rate
        let amount_in_primary = amount / &from_rate;
        let converted_amount = amount_in_primary * &to_rate;

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
