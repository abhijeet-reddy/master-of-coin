//! Bank provider module.
//!
//! Defines the `BankProvider` trait for Open Banking integrations and
//! provides implementations for TrueLayer (and future providers like Plaid).

pub mod truelayer;
pub mod types;

pub use truelayer::TrueLayerProvider;
pub use types::{BankAccount, BankBalance, BankProviderError, BankTokens, BankTransaction};

use async_trait::async_trait;
use chrono::{DateTime, Utc};
use std::collections::HashMap;
use std::sync::Arc;

use crate::types::BankProviderType;

/// Trait for bank provider implementations (TrueLayer, Plaid, etc.)
///
/// This trait defines the interface that all bank providers must implement
/// to connect bank accounts and fetch transactions/balances via Open Banking.
#[async_trait]
pub trait BankProvider: Send + Sync {
    /// Provider type identifier
    fn provider_type(&self) -> BankProviderType;

    /// Generate OAuth authorization URL for bank connection
    ///
    /// # Arguments
    ///
    /// * `state` - CSRF protection state parameter
    /// * `redirect_uri` - Where to redirect after auth
    ///
    /// # Returns
    ///
    /// Full authorization URL to redirect the user to
    fn generate_auth_url(
        &self,
        state: &str,
        redirect_uri: &str,
    ) -> Result<String, BankProviderError>;

    /// Exchange authorization code for access/refresh tokens
    ///
    /// # Arguments
    ///
    /// * `code` - Authorization code from OAuth callback
    /// * `redirect_uri` - Must match the redirect_uri used in auth URL
    ///
    /// # Returns
    ///
    /// Access token, refresh token, and expiration info
    async fn exchange_code(
        &self,
        code: &str,
        redirect_uri: &str,
    ) -> Result<BankTokens, BankProviderError>;

    /// Refresh an expired access token
    ///
    /// # Arguments
    ///
    /// * `refresh_token` - Refresh token from previous authorization
    ///
    /// # Returns
    ///
    /// New access token and refresh token
    async fn refresh_token(&self, refresh_token: &str) -> Result<BankTokens, BankProviderError>;

    /// Fetch all accounts from the connected bank
    ///
    /// # Arguments
    ///
    /// * `access_token` - Valid access token
    ///
    /// # Returns
    ///
    /// List of bank accounts available for the connection
    async fn fetch_accounts(
        &self,
        access_token: &str,
    ) -> Result<Vec<BankAccount>, BankProviderError>;

    /// Fetch transactions for a specific bank account
    ///
    /// # Arguments
    ///
    /// * `access_token` - Valid access token
    /// * `account_id` - Provider-specific account ID
    /// * `from` - Start of date range (inclusive)
    /// * `to` - End of date range (inclusive)
    ///
    /// # Returns
    ///
    /// List of transactions in the date range
    async fn fetch_transactions(
        &self,
        access_token: &str,
        account_id: &str,
        from: DateTime<Utc>,
        to: DateTime<Utc>,
    ) -> Result<Vec<BankTransaction>, BankProviderError>;

    /// Fetch balance for a specific bank account
    ///
    /// # Arguments
    ///
    /// * `access_token` - Valid access token
    /// * `account_id` - Provider-specific account ID
    ///
    /// # Returns
    ///
    /// Current and available balance
    async fn fetch_balance(
        &self,
        access_token: &str,
        account_id: &str,
    ) -> Result<BankBalance, BankProviderError>;
}

/// Canonical registry of all bank providers.
///
/// Adding a new provider only requires adding it here — the worker and
/// handlers will pick it up automatically via this registry.
pub fn all_bank_providers() -> HashMap<BankProviderType, Arc<dyn BankProvider>> {
    let mut providers: HashMap<BankProviderType, Arc<dyn BankProvider>> = HashMap::new();

    // Register TrueLayer provider (only if configured)
    match TrueLayerProvider::from_env() {
        Ok(provider) => {
            providers.insert(BankProviderType::TrueLayer, Arc::new(provider));
            tracing::info!("TrueLayer bank provider registered");
        }
        Err(e) => {
            tracing::warn!(
                "TrueLayer bank provider not configured: {}. Skipping registration.",
                e
            );
        }
    }

    // Future: providers.insert(BankProviderType::Plaid, Arc::new(PlaidProvider::from_env()));

    providers
}
