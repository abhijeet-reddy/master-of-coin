pub mod splitwise;
pub mod types;

pub use splitwise::SplitwiseProvider;
pub use types::{
    CreateExternalExpense, ExpenseUser, ExternalExpenseResult, SplitProviderError,
    UpdateExternalExpense,
};

use async_trait::async_trait;
use serde_json::Value;

/// Trait for split provider implementations (Splitwise, SplitPro, etc.)
///
/// This trait defines the interface that all split providers must implement
/// to sync transaction splits to external platforms.
#[async_trait]
pub trait SplitProvider: Send + Sync {
    /// Provider name identifier (e.g., "splitwise", "splitpro")
    fn provider_type(&self) -> &str;

    /// Create an expense on the external platform
    ///
    /// # Arguments
    ///
    /// * `credentials` - Provider-specific credentials (OAuth tokens, API keys, etc.)
    /// * `request` - Expense details including all users involved
    ///
    /// # Returns
    ///
    /// External expense ID and optional URL on success
    ///
    /// # Errors
    ///
    /// Returns `SplitProviderError` if:
    /// - Authentication fails or token is expired
    /// - API request fails
    /// - Rate limit is exceeded
    /// - Network error occurs
    async fn create_expense(
        &self,
        credentials: &Value,
        request: CreateExternalExpense,
    ) -> Result<ExternalExpenseResult, SplitProviderError>;

    /// Update an existing expense on the external platform
    ///
    /// # Arguments
    ///
    /// * `credentials` - Provider-specific credentials
    /// * `external_expense_id` - ID of the expense on the external platform
    /// * `request` - Updated expense details
    ///
    /// # Errors
    ///
    /// Returns `SplitProviderError` if:
    /// - Authentication fails
    /// - Expense not found
    /// - API request fails
    async fn update_expense(
        &self,
        credentials: &Value,
        external_expense_id: &str,
        request: UpdateExternalExpense,
    ) -> Result<ExternalExpenseResult, SplitProviderError>;

    /// Delete an expense from the external platform
    ///
    /// # Arguments
    ///
    /// * `credentials` - Provider-specific credentials
    /// * `external_expense_id` - ID of the expense to delete
    ///
    /// # Errors
    ///
    /// Returns `SplitProviderError` if:
    /// - Authentication fails
    /// - Expense not found
    /// - API request fails
    async fn delete_expense(
        &self,
        credentials: &Value,
        external_expense_id: &str,
    ) -> Result<(), SplitProviderError>;

    /// Validate that credentials are still valid
    ///
    /// # Arguments
    ///
    /// * `credentials` - Provider-specific credentials to validate
    ///
    /// # Returns
    ///
    /// `true` if credentials are valid, `false` otherwise
    async fn validate_credentials(&self, credentials: &Value) -> Result<bool, SplitProviderError>;

    /// Refresh credentials if needed (e.g., OAuth token refresh)
    ///
    /// # Arguments
    ///
    /// * `credentials` - Current credentials that may need refreshing
    ///
    /// # Returns
    ///
    /// New credentials if refresh was needed and successful, `None` if no refresh needed
    ///
    /// # Errors
    ///
    /// Returns `SplitProviderError` if refresh fails
    async fn refresh_credentials(
        &self,
        credentials: &Value,
    ) -> Result<Option<Value>, SplitProviderError>;
}
