//! Investment provider module.
//!
//! Defines the `InvestmentProvider` trait for brokerage integrations and
//! provides implementations for Trading 212 and a mock provider for testing.

pub mod mock;
pub mod trading212;
pub mod types;

pub use mock::MockInvestmentProvider;
pub use trading212::Trading212Provider;
pub use types::{InvestmentProviderError, PortfolioSnapshot};

use async_trait::async_trait;

use crate::types::InvestmentProviderType;

/// Trait for investment provider implementations (Trading 212, etc.)
///
/// This trait defines the interface that all investment providers must implement
/// to fetch portfolio values from external brokerage APIs.
#[async_trait]
pub trait InvestmentProvider: Send + Sync {
    /// Provider type identifier
    fn provider_type(&self) -> InvestmentProviderType;

    /// Fetch the total invested stock value from the brokerage.
    ///
    /// Returns only the stock/position value (excludes uninvested cash).
    ///
    /// # Arguments
    ///
    /// * `credentials` - Provider-specific credentials (API key, secret, etc.)
    ///
    /// # Returns
    ///
    /// A `PortfolioSnapshot` with the current stock value, invested amount,
    /// currency, and timestamp.
    ///
    /// # Errors
    ///
    /// Returns `InvestmentProviderError` if:
    /// - Authentication fails (invalid API key/secret)
    /// - Rate limit is exceeded
    /// - API request fails
    /// - Network error occurs
    /// - Response cannot be parsed
    async fn get_portfolio_value(
        &self,
        credentials: &serde_json::Value,
    ) -> Result<PortfolioSnapshot, InvestmentProviderError>;
}
