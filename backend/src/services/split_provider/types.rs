use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use thiserror::Error;

/// Request to create an expense on an external platform
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateExternalExpense {
    /// Transaction description/title
    pub description: String,
    /// Total transaction amount as string (e.g., "100.00")
    pub cost: String,
    /// Currency code (e.g., "USD", "EUR")
    pub currency_code: String,
    /// Transaction date
    pub date: DateTime<Utc>,
    /// Optional group ID (Splitwise-specific)
    pub group_id: Option<i64>,
    /// All users involved in the expense (payer + owed users)
    pub users: Vec<ExpenseUser>,
    /// Optional notes
    pub notes: Option<String>,
}

/// User involved in an expense
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExpenseUser {
    /// External user ID on the platform (e.g., Splitwise user ID)
    pub external_user_id: String,
    /// Amount this user paid (e.g., "100.00")
    pub paid_share: String,
    /// Amount this user owes (e.g., "30.00")
    pub owed_share: String,
}

/// Request to update an expense on an external platform
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateExternalExpense {
    /// Updated description
    pub description: Option<String>,
    /// Updated total cost
    pub cost: Option<String>,
    /// Updated date
    pub date: Option<DateTime<Utc>>,
    /// Updated users list (if provided, replaces all users)
    pub users: Option<Vec<ExpenseUser>>,
    /// Updated notes
    pub notes: Option<String>,
}

/// Result of creating/updating an expense
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExternalExpenseResult {
    /// ID of the expense on the external platform
    pub external_expense_id: String,
    /// Optional URL to view the expense
    pub external_url: Option<String>,
}

/// Errors that can occur when interacting with split providers
#[derive(Debug, Error)]
pub enum SplitProviderError {
    #[error("Authentication failed: {0}")]
    AuthenticationFailed(String),

    #[error("Access token expired")]
    TokenExpired,

    #[error("Rate limit exceeded. Retry after: {0:?}")]
    RateLimited(Option<DateTime<Utc>>),

    #[error("Resource not found: {0}")]
    NotFound(String),

    #[error("API error: {0}")]
    ApiError(String),

    #[error("Network error: {0}")]
    NetworkError(String),

    #[error("Invalid response from provider: {0}")]
    InvalidResponse(String),

    #[error("Configuration error: {0}")]
    ConfigurationError(String),
}

impl SplitProviderError {
    /// Check if this error is retryable
    pub fn is_retryable(&self) -> bool {
        matches!(
            self,
            SplitProviderError::NetworkError(_)
                | SplitProviderError::RateLimited(_)
                | SplitProviderError::TokenExpired
        )
    }

    /// Check if this error requires re-authentication
    pub fn requires_reauth(&self) -> bool {
        matches!(
            self,
            SplitProviderError::AuthenticationFailed(_) | SplitProviderError::TokenExpired
        )
    }
}
