//! TrueLayer implementation of the BankProvider trait.
//!
//! Uses TrueLayer's Data API v1 to fetch accounts, transactions, and balances
//! via Open Banking. Supports both sandbox and production environments.

use async_trait::async_trait;
use bigdecimal::BigDecimal;
use chrono::{DateTime, Duration, Utc};
use reqwest::Client;
use serde::Deserialize;
use std::env;
use std::str::FromStr;

use super::BankProvider;
use super::types::{BankAccount, BankBalance, BankProviderError, BankTokens, BankTransaction};
use crate::types::BankProviderType;

/// TrueLayer environment configuration
#[derive(Debug, Clone)]
enum TrueLayerEnvironment {
    Sandbox,
    Production,
}

impl TrueLayerEnvironment {
    fn auth_url(&self) -> &str {
        match self {
            TrueLayerEnvironment::Sandbox => "https://auth.truelayer-sandbox.com",
            TrueLayerEnvironment::Production => "https://auth.truelayer.com",
        }
    }

    fn api_url(&self) -> &str {
        match self {
            TrueLayerEnvironment::Sandbox => "https://api.truelayer-sandbox.com",
            TrueLayerEnvironment::Production => "https://api.truelayer.com",
        }
    }
}

/// TrueLayer bank provider implementation
pub struct TrueLayerProvider {
    http_client: Client,
    client_id: String,
    client_secret: String,
    environment: TrueLayerEnvironment,
}

// --- TrueLayer API response types ---

#[derive(Debug, Deserialize)]
struct TrueLayerTokenResponse {
    access_token: String,
    #[serde(default)]
    refresh_token: Option<String>,
    #[serde(default)]
    expires_in: Option<i64>,
    #[allow(dead_code)]
    token_type: Option<String>,
}

#[derive(Debug, Deserialize)]
struct TrueLayerResultsWrapper<T> {
    results: Vec<T>,
}

#[derive(Debug, Deserialize)]
struct TrueLayerAccount {
    account_id: String,
    #[serde(default)]
    display_name: Option<String>,
    #[serde(default)]
    account_type: Option<String>,
    #[serde(default)]
    currency: Option<String>,
    #[serde(default)]
    account_number: Option<TrueLayerAccountNumber>,
}

#[derive(Debug, Deserialize)]
struct TrueLayerAccountNumber {
    #[serde(default)]
    number: Option<String>,
    #[serde(default)]
    sort_code: Option<String>,
}

#[derive(Debug, Deserialize)]
struct TrueLayerTransaction {
    transaction_id: String,
    #[serde(default)]
    description: Option<String>,
    amount: f64,
    currency: String,
    timestamp: String,
    transaction_type: String,
    #[serde(default)]
    merchant_name: Option<String>,
    #[serde(default)]
    transaction_category: Option<String>,
}

#[derive(Debug, Deserialize)]
struct TrueLayerBalance {
    current: f64,
    #[serde(default)]
    available: Option<f64>,
    currency: String,
    #[serde(default)]
    update_timestamp: Option<String>,
}

#[derive(Debug, Deserialize)]
struct TrueLayerErrorResponse {
    #[serde(default)]
    error: Option<String>,
    #[serde(default)]
    error_description: Option<String>,
}

impl TrueLayerProvider {
    /// Create a new TrueLayerProvider from environment variables
    ///
    /// Required env vars:
    /// - `TRUELAYER_CLIENT_ID`
    /// - `TRUELAYER_CLIENT_SECRET`
    ///
    /// Optional:
    /// - `TRUELAYER_ENVIRONMENT` — "sandbox" (default) or "production"
    pub fn from_env() -> Result<Self, BankProviderError> {
        let client_id = env::var("TRUELAYER_CLIENT_ID").map_err(|_| {
            BankProviderError::ConfigurationError("TRUELAYER_CLIENT_ID not set".to_string())
        })?;
        let client_secret = env::var("TRUELAYER_CLIENT_SECRET").map_err(|_| {
            BankProviderError::ConfigurationError("TRUELAYER_CLIENT_SECRET not set".to_string())
        })?;

        let environment = match env::var("TRUELAYER_ENVIRONMENT")
            .unwrap_or_else(|_| "sandbox".to_string())
            .to_lowercase()
            .as_str()
        {
            "production" | "prod" => TrueLayerEnvironment::Production,
            _ => TrueLayerEnvironment::Sandbox,
        };

        tracing::info!(
            "TrueLayer provider configured for {:?} environment",
            environment
        );

        Ok(Self {
            http_client: Client::new(),
            client_id,
            client_secret,
            environment,
        })
    }

    /// Build the token endpoint URL
    fn token_url(&self) -> String {
        format!("{}/connect/token", self.environment.auth_url())
    }

    /// Build a Data API URL
    fn data_url(&self, path: &str) -> String {
        format!("{}/data/v1{}", self.environment.api_url(), path)
    }

    /// Make an authenticated GET request to the TrueLayer Data API
    async fn authenticated_get<T: serde::de::DeserializeOwned>(
        &self,
        access_token: &str,
        url: &str,
    ) -> Result<T, BankProviderError> {
        let response = self
            .http_client
            .get(url)
            .bearer_auth(access_token)
            .send()
            .await
            .map_err(|e| BankProviderError::NetworkError(e.to_string()))?;

        let status = response.status();
        let body = response
            .text()
            .await
            .unwrap_or_else(|_| "Failed to read response body".to_string());

        if status.as_u16() == 401 {
            // Check if this is a token expiry
            if let Ok(err_resp) = serde_json::from_str::<TrueLayerErrorResponse>(&body) {
                if err_resp.error.as_deref().map_or(false, |e| {
                    e.contains("expired") || e.contains("invalid_token")
                }) {
                    return Err(BankProviderError::TokenExpired);
                }
            }
            return Err(BankProviderError::AuthenticationFailed(format!(
                "HTTP 401: {}",
                body
            )));
        }

        if status.as_u16() == 429 {
            return Err(BankProviderError::RateLimited(None));
        }

        if !status.is_success() {
            return Err(BankProviderError::ApiError(format!(
                "HTTP {}: {}",
                status, body
            )));
        }

        serde_json::from_str(&body)
            .map_err(|e| BankProviderError::InvalidResponse(format!("{} (body: {})", e, body)))
    }
}

#[async_trait]
impl BankProvider for TrueLayerProvider {
    fn provider_type(&self) -> BankProviderType {
        BankProviderType::TrueLayer
    }

    fn generate_auth_url(
        &self,
        state: &str,
        redirect_uri: &str,
    ) -> Result<String, BankProviderError> {
        // Scopes: info (account holder info), accounts (account list),
        // balance (account balances), transactions (transaction history),
        // offline_access (refresh token for long-lived access)
        let scopes = "info accounts balance transactions offline_access";

        // For sandbox: include mock bank for testing
        // For production: omit providers param so TrueLayer shows country selector,
        // letting the user pick their country (UK, Ireland, etc.) and see all available banks
        let auth_url = match self.environment {
            TrueLayerEnvironment::Sandbox => {
                format!(
                    "{}/?response_type=code&client_id={}&redirect_uri={}&scope={}&state={}&providers={}",
                    self.environment.auth_url(),
                    urlencoding::encode(&self.client_id),
                    urlencoding::encode(redirect_uri),
                    urlencoding::encode(scopes),
                    urlencoding::encode(state),
                    urlencoding::encode("uk-cs-mock uk-ob-all"),
                )
            }
            TrueLayerEnvironment::Production => {
                // Include all supported Open Banking provider groups for multiple countries
                // This shows a country selector in the auth dialog
                let providers = "uk-ob-all ie-ob-all fr-ob-all de-ob-all es-ob-all it-ob-all nl-ob-all pl-ob-all pt-ob-all";
                format!(
                    "{}/?response_type=code&client_id={}&redirect_uri={}&scope={}&state={}&providers={}",
                    self.environment.auth_url(),
                    urlencoding::encode(&self.client_id),
                    urlencoding::encode(redirect_uri),
                    urlencoding::encode(scopes),
                    urlencoding::encode(state),
                    urlencoding::encode(providers),
                )
            }
        };

        Ok(auth_url)
    }

    async fn exchange_code(
        &self,
        code: &str,
        redirect_uri: &str,
    ) -> Result<BankTokens, BankProviderError> {
        let token_url = self.token_url();
        tracing::info!(
            "Exchanging TrueLayer authorization code for tokens (url: {}, client_id: {}, redirect_uri: {})",
            token_url,
            self.client_id,
            redirect_uri
        );

        let params = [
            ("grant_type", "authorization_code"),
            ("client_id", &self.client_id),
            ("client_secret", &self.client_secret),
            ("redirect_uri", redirect_uri),
            ("code", code),
        ];

        let response = self
            .http_client
            .post(&token_url)
            .form(&params)
            .send()
            .await
            .map_err(|e| BankProviderError::NetworkError(e.to_string()))?;

        let status = response.status();
        let body = response
            .text()
            .await
            .unwrap_or_else(|_| "Failed to read response body".to_string());

        tracing::info!("TrueLayer token response: HTTP {}", status);

        if !status.is_success() {
            return Err(BankProviderError::AuthenticationFailed(format!(
                "Token exchange failed: HTTP {}: {}",
                status, body
            )));
        }

        let token_resp: TrueLayerTokenResponse = serde_json::from_str(&body)
            .map_err(|e| BankProviderError::InvalidResponse(format!("{} (body: {})", e, body)))?;

        let expires_at = token_resp
            .expires_in
            .map(|secs| Utc::now() + Duration::seconds(secs));

        Ok(BankTokens {
            access_token: token_resp.access_token,
            refresh_token: token_resp.refresh_token,
            expires_at,
        })
    }

    async fn refresh_token(&self, refresh_token: &str) -> Result<BankTokens, BankProviderError> {
        tracing::info!("Refreshing TrueLayer access token");

        let params = [
            ("grant_type", "refresh_token"),
            ("client_id", &self.client_id),
            ("client_secret", &self.client_secret),
            ("refresh_token", refresh_token),
        ];

        let response = self
            .http_client
            .post(&self.token_url())
            .form(&params)
            .send()
            .await
            .map_err(|e| BankProviderError::NetworkError(e.to_string()))?;

        let status = response.status();
        let body = response
            .text()
            .await
            .unwrap_or_else(|_| "Failed to read response body".to_string());

        if !status.is_success() {
            // If refresh fails with 400/401, the consent has likely expired
            if status.as_u16() == 400 || status.as_u16() == 401 {
                return Err(BankProviderError::TokenExpired);
            }
            return Err(BankProviderError::AuthenticationFailed(format!(
                "Token refresh failed: HTTP {}: {}",
                status, body
            )));
        }

        let token_resp: TrueLayerTokenResponse = serde_json::from_str(&body)
            .map_err(|e| BankProviderError::InvalidResponse(format!("{} (body: {})", e, body)))?;

        let expires_at = token_resp
            .expires_in
            .map(|secs| Utc::now() + Duration::seconds(secs));

        Ok(BankTokens {
            access_token: token_resp.access_token,
            refresh_token: token_resp.refresh_token,
            expires_at,
        })
    }

    async fn fetch_accounts(
        &self,
        access_token: &str,
    ) -> Result<Vec<BankAccount>, BankProviderError> {
        let url = self.data_url("/accounts");
        tracing::info!("Fetching TrueLayer accounts from {}", url);

        let wrapper: TrueLayerResultsWrapper<TrueLayerAccount> =
            self.authenticated_get(access_token, &url).await?;

        let accounts = wrapper
            .results
            .into_iter()
            .map(|a| {
                let (account_number, sort_code) = match a.account_number {
                    Some(an) => (an.number, an.sort_code),
                    None => (None, None),
                };

                BankAccount {
                    account_id: a.account_id,
                    display_name: a.display_name.unwrap_or_else(|| "Unknown".to_string()),
                    account_type: a.account_type.unwrap_or_else(|| "UNKNOWN".to_string()),
                    currency: a.currency.unwrap_or_else(|| "GBP".to_string()),
                    account_number,
                    sort_code,
                }
            })
            .collect();

        Ok(accounts)
    }

    async fn fetch_transactions(
        &self,
        access_token: &str,
        account_id: &str,
        from: DateTime<Utc>,
        to: DateTime<Utc>,
    ) -> Result<Vec<BankTransaction>, BankProviderError> {
        let url = format!(
            "{}?from={}&to={}",
            self.data_url(&format!("/accounts/{}/transactions", account_id)),
            from.format("%Y-%m-%dT%H:%M:%SZ"),
            to.format("%Y-%m-%dT%H:%M:%SZ"),
        );
        tracing::info!("Fetching TrueLayer transactions from {}", url);

        let wrapper: TrueLayerResultsWrapper<TrueLayerTransaction> =
            self.authenticated_get(access_token, &url).await?;

        let transactions = wrapper
            .results
            .into_iter()
            .map(|t| {
                let timestamp = DateTime::parse_from_rfc3339(&t.timestamp)
                    .map(|dt| dt.with_timezone(&Utc))
                    .unwrap_or_else(|_| Utc::now());

                let amount = BigDecimal::from_str(&format!("{:.2}", t.amount))
                    .unwrap_or_else(|_| BigDecimal::from(0));

                BankTransaction {
                    transaction_id: t.transaction_id,
                    description: t
                        .description
                        .unwrap_or_else(|| "No description".to_string()),
                    amount,
                    currency: t.currency,
                    timestamp,
                    transaction_type: t.transaction_type,
                    merchant_name: t.merchant_name,
                    category: t.transaction_category,
                }
            })
            .collect();

        Ok(transactions)
    }

    async fn fetch_balance(
        &self,
        access_token: &str,
        account_id: &str,
    ) -> Result<BankBalance, BankProviderError> {
        let url = self.data_url(&format!("/accounts/{}/balance", account_id));
        tracing::info!("Fetching TrueLayer balance from {}", url);

        let wrapper: TrueLayerResultsWrapper<TrueLayerBalance> =
            self.authenticated_get(access_token, &url).await?;

        let balance = wrapper.results.into_iter().next().ok_or_else(|| {
            BankProviderError::InvalidResponse("No balance data returned".to_string())
        })?;

        let updated_at = balance
            .update_timestamp
            .and_then(|ts| DateTime::parse_from_rfc3339(&ts).ok())
            .map(|dt| dt.with_timezone(&Utc))
            .unwrap_or_else(Utc::now);

        let current = BigDecimal::from_str(&format!("{:.2}", balance.current))
            .unwrap_or_else(|_| BigDecimal::from(0));

        let available = balance.available.map(|a| {
            BigDecimal::from_str(&format!("{:.2}", a)).unwrap_or_else(|_| BigDecimal::from(0))
        });

        Ok(BankBalance {
            current,
            available,
            currency: balance.currency,
            updated_at,
        })
    }
}
