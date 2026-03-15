use bigdecimal::BigDecimal;
use chrono::{DateTime, Utc};
use thiserror::Error;

/// Snapshot of a portfolio's current value returned by an investment provider.
/// Contains only stock/position values — uninvested cash is excluded.
#[derive(Debug, Clone)]
pub struct PortfolioSnapshot {
    /// Current market value of all stock positions
    pub stock_value: BigDecimal,
    /// Original cost basis (amount invested)
    pub invested_amount: BigDecimal,
    /// Account primary currency (e.g., "EUR", "GBP")
    pub currency: String,
    /// When the snapshot was taken
    pub timestamp: DateTime<Utc>,
}

/// Errors that can occur when interacting with investment providers
#[derive(Debug, Error)]
pub enum InvestmentProviderError {
    #[error("Authentication failed: {0}")]
    AuthenticationFailed(String),

    #[error("Rate limit exceeded. Retry after: {0:?}")]
    RateLimited(Option<DateTime<Utc>>),

    #[error("API error: {0}")]
    ApiError(String),

    #[error("Network error: {0}")]
    NetworkError(String),

    #[error("Invalid response from provider: {0}")]
    InvalidResponse(String),
}

impl InvestmentProviderError {
    /// Check if this error is retryable (transient failures)
    pub fn is_retryable(&self) -> bool {
        matches!(
            self,
            InvestmentProviderError::NetworkError(_) | InvestmentProviderError::RateLimited(_)
        )
    }
}
