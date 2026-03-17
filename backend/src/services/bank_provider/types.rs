use bigdecimal::BigDecimal;
use chrono::{DateTime, Utc};
use thiserror::Error;

/// OAuth tokens returned by a bank provider
#[derive(Debug, Clone)]
pub struct BankTokens {
    pub access_token: String,
    pub refresh_token: Option<String>,
    /// When the access token expires
    pub expires_at: Option<DateTime<Utc>>,
}

/// A bank account as returned by the provider
#[derive(Debug, Clone)]
pub struct BankAccount {
    /// Provider-specific account ID
    pub account_id: String,
    /// Display name (e.g., "Current Account")
    pub display_name: String,
    /// Account type (e.g., "TRANSACTION", "SAVINGS")
    pub account_type: String,
    /// ISO 4217 currency code
    pub currency: String,
    /// Account number (if available)
    pub account_number: Option<String>,
    /// Sort code / routing number (if available)
    pub sort_code: Option<String>,
}

/// A transaction as returned by the provider
#[derive(Debug, Clone)]
pub struct BankTransaction {
    /// Provider-specific transaction ID (for deduplication)
    pub transaction_id: String,
    /// Transaction description
    pub description: String,
    /// Transaction amount (negative for debits, positive for credits)
    pub amount: BigDecimal,
    /// ISO 4217 currency code
    pub currency: String,
    /// Transaction date
    pub timestamp: DateTime<Utc>,
    /// "DEBIT" or "CREDIT"
    pub transaction_type: String,
    /// Merchant name (if available)
    pub merchant_name: Option<String>,
    /// Provider-assigned category (if available)
    pub category: Option<String>,
}

/// Balance information as returned by the provider
#[derive(Debug, Clone)]
pub struct BankBalance {
    /// Current balance
    pub current: BigDecimal,
    /// Available balance (may differ from current due to pending transactions)
    pub available: Option<BigDecimal>,
    /// ISO 4217 currency code
    pub currency: String,
    /// When this balance was last updated
    pub updated_at: DateTime<Utc>,
}

/// Errors that can occur when interacting with bank providers
#[derive(Debug, Error)]
pub enum BankProviderError {
    #[error("Configuration error: {0}")]
    ConfigurationError(String),

    #[error("Authentication failed: {0}")]
    AuthenticationFailed(String),

    #[error("Token expired — user must re-authenticate")]
    TokenExpired,

    #[error("Rate limit exceeded. Retry after: {0:?}")]
    RateLimited(Option<DateTime<Utc>>),

    #[error("API error: {0}")]
    ApiError(String),

    #[error("Network error: {0}")]
    NetworkError(String),

    #[error("Invalid response from provider: {0}")]
    InvalidResponse(String),
}

impl BankProviderError {
    /// Check if this error is retryable (transient failures)
    pub fn is_retryable(&self) -> bool {
        matches!(
            self,
            BankProviderError::NetworkError(_) | BankProviderError::RateLimited(_)
        )
    }
}
