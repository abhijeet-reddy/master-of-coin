//! Trading 212 investment provider implementation.
//!
//! Uses the `authWithSecretKey` scheme (HTTP Basic Auth with API Key as username
//! and API Secret as password) to call the Trading 212 Public API.
//!
//! Endpoint: `GET /api/v0/equity/account/cash`
//! Stock value calculation: `total - free + pieCash`

use async_trait::async_trait;
use base64::Engine;
use bigdecimal::BigDecimal;
use chrono::Utc;
use reqwest::Client;
use serde::Deserialize;
use std::str::FromStr;

use crate::types::InvestmentProviderType;

use super::InvestmentProvider;
use super::types::{InvestmentProviderError, PortfolioSnapshot};

/// Trading 212 API response for `/equity/account/cash`
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CashResponse {
    /// Total account value (stocks + cash)
    total: f64,
    /// Uninvested cash available
    free: f64,
    /// Original amount invested (cost basis)
    invested: f64,
    /// Cash allocated to pies but not yet invested
    pie_cash: f64,
}

/// Trading 212 investment provider.
///
/// Fetches portfolio stock value (excluding uninvested cash) from the
/// Trading 212 Public API using the `authWithSecretKey` Basic Auth scheme.
pub struct Trading212Provider {
    client: Client,
}

impl Trading212Provider {
    pub fn new() -> Self {
        Self {
            client: Client::new(),
        }
    }

    /// Build the base URL from the environment setting.
    /// Defaults to "live" if not specified.
    fn base_url(environment: &str) -> &str {
        match environment {
            "demo" => "https://demo.trading212.com",
            _ => "https://live.trading212.com",
        }
    }

    /// Build the Basic Auth header value from API key and secret.
    /// Format: `Basic base64(api_key:api_secret)`
    fn build_auth_header(api_key: &str, api_secret: &str) -> String {
        let credentials = format!("{}:{}", api_key, api_secret);
        let encoded = base64::engine::general_purpose::STANDARD.encode(credentials.as_bytes());
        format!("Basic {}", encoded)
    }
}

#[async_trait]
impl InvestmentProvider for Trading212Provider {
    fn provider_type(&self) -> InvestmentProviderType {
        InvestmentProviderType::Trading212
    }

    async fn get_portfolio_value(
        &self,
        credentials: &serde_json::Value,
    ) -> Result<PortfolioSnapshot, InvestmentProviderError> {
        // Extract credentials from JSON
        let api_key = credentials
            .get("api_key")
            .and_then(|v| v.as_str())
            .ok_or_else(|| {
                InvestmentProviderError::InvalidResponse(
                    "Missing api_key in credentials".to_string(),
                )
            })?;

        let api_secret = credentials
            .get("api_secret")
            .and_then(|v| v.as_str())
            .ok_or_else(|| {
                InvestmentProviderError::InvalidResponse(
                    "Missing api_secret in credentials".to_string(),
                )
            })?;

        let environment = credentials
            .get("environment")
            .and_then(|v| v.as_str())
            .unwrap_or("live");

        let base_url = Self::base_url(environment);
        let auth_header = Self::build_auth_header(api_key, api_secret);

        // Call GET /api/v0/equity/account/cash
        let url = format!("{}/api/v0/equity/account/cash", base_url);

        let response = self
            .client
            .get(&url)
            .header("Authorization", &auth_header)
            .send()
            .await
            .map_err(|e| InvestmentProviderError::NetworkError(e.to_string()))?;

        // Handle HTTP errors
        let status = response.status();
        if !status.is_success() {
            let body = response.text().await.unwrap_or_default();
            return match status.as_u16() {
                401 => Err(InvestmentProviderError::AuthenticationFailed(format!(
                    "Trading 212 returned 401: {}",
                    body
                ))),
                429 => {
                    // TODO: Parse x-ratelimit-reset header for retry timing
                    Err(InvestmentProviderError::RateLimited(None))
                }
                _ => Err(InvestmentProviderError::ApiError(format!(
                    "Trading 212 returned {}: {}",
                    status, body
                ))),
            };
        }

        // Parse response
        let cash: CashResponse = response.json().await.map_err(|e| {
            InvestmentProviderError::InvalidResponse(format!(
                "Failed to parse Trading 212 cash response: {}",
                e
            ))
        })?;

        // Calculate stock value: total - free + pieCash
        // This gives us the current market value of stock positions only,
        // excluding uninvested cash sitting in the brokerage account.
        let stock_value_f64 = cash.total - cash.free + cash.pie_cash;

        let stock_value =
            BigDecimal::from_str(&format!("{:.2}", stock_value_f64)).map_err(|e| {
                InvestmentProviderError::InvalidResponse(format!(
                    "Failed to convert stock value to BigDecimal: {}",
                    e
                ))
            })?;

        let invested_amount =
            BigDecimal::from_str(&format!("{:.2}", cash.invested)).map_err(|e| {
                InvestmentProviderError::InvalidResponse(format!(
                    "Failed to convert invested amount to BigDecimal: {}",
                    e
                ))
            })?;

        Ok(PortfolioSnapshot {
            stock_value,
            invested_amount,
            // Trading 212 returns values in the account's primary currency
            // We don't know the currency from this endpoint, so we use a placeholder
            // that will be matched against the account's currency in the sync service
            currency: "EUR".to_string(),
            timestamp: Utc::now(),
        })
    }
}
