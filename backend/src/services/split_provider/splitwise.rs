use async_trait::async_trait;
use chrono::{DateTime, Utc};
use reqwest::{Client, StatusCode};
use serde::Deserialize;
use serde_json::{Value, json};

use super::{
    CreateExternalExpense, ExpenseUser, ExternalExpenseResult, SplitProvider, SplitProviderError,
    UpdateExternalExpense,
};

/// Splitwise API provider implementation
pub struct SplitwiseProvider {
    http_client: Client,
}

impl SplitwiseProvider {
    const BASE_URL: &'static str = "https://secure.splitwise.com/api/v3.0";
    const OAUTH_BASE_URL: &'static str = "https://secure.splitwise.com";

    /// Create a new Splitwise provider instance
    pub fn new() -> Self {
        Self {
            http_client: Client::new(),
        }
    }

    /// Extract access token from credentials
    fn get_access_token(credentials: &Value) -> Result<String, SplitProviderError> {
        credentials
            .get("access_token")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
            .ok_or_else(|| {
                SplitProviderError::ConfigurationError(
                    "Missing access_token in credentials".to_string(),
                )
            })
    }

    /// Extract refresh token from credentials
    fn get_refresh_token(credentials: &Value) -> Result<String, SplitProviderError> {
        credentials
            .get("refresh_token")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
            .ok_or_else(|| {
                SplitProviderError::ConfigurationError(
                    "Missing refresh_token in credentials".to_string(),
                )
            })
    }

    /// Check if token is expired
    fn is_token_expired(credentials: &Value) -> bool {
        if let Some(expires_at) = credentials.get("token_expires_at").and_then(|v| v.as_str()) {
            if let Ok(expires) = DateTime::parse_from_rfc3339(expires_at) {
                return Utc::now() >= expires.with_timezone(&Utc);
            }
        }
        false
    }

    /// Build flattened users array for Splitwise API
    /// Format: users__0__user_id, users__0__paid_share, users__0__owed_share, etc.
    fn build_users_params(users: &[ExpenseUser]) -> Vec<(String, String)> {
        let mut params = Vec::new();
        for (i, user) in users.iter().enumerate() {
            params.push((
                format!("users__{}_user_id", i),
                user.external_user_id.clone(),
            ));
            params.push((format!("users__{}_paid_share", i), user.paid_share.clone()));
            params.push((format!("users__{}_owed_share", i), user.owed_share.clone()));
        }
        params
    }

    /// Map HTTP status code to SplitProviderError
    fn map_status_error(status: StatusCode, body: &str) -> SplitProviderError {
        match status {
            StatusCode::UNAUTHORIZED => SplitProviderError::AuthenticationFailed(body.to_string()),
            StatusCode::NOT_FOUND => SplitProviderError::NotFound(body.to_string()),
            StatusCode::TOO_MANY_REQUESTS => SplitProviderError::RateLimited(None),
            _ => SplitProviderError::ApiError(format!("HTTP {}: {}", status, body)),
        }
    }
}

impl Default for SplitwiseProvider {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl SplitProvider for SplitwiseProvider {
    fn provider_type(&self) -> &str {
        "splitwise"
    }

    async fn create_expense(
        &self,
        credentials: &Value,
        request: CreateExternalExpense,
    ) -> Result<ExternalExpenseResult, SplitProviderError> {
        let access_token = Self::get_access_token(credentials)?;

        // Build request body with flattened users format
        let mut params = vec![
            ("cost".to_string(), request.cost),
            ("description".to_string(), request.description),
            ("currency_code".to_string(), request.currency_code),
            ("date".to_string(), request.date.to_rfc3339()),
        ];

        // Add group_id if provided
        if let Some(group_id) = request.group_id {
            params.push(("group_id".to_string(), group_id.to_string()));
        }

        // Add notes if provided
        if let Some(notes) = request.notes {
            params.push(("details".to_string(), notes));
        }

        // Add flattened users
        params.extend(Self::build_users_params(&request.users));

        // Make API request
        let response = self
            .http_client
            .post(format!("{}/create_expense", Self::BASE_URL))
            .bearer_auth(&access_token)
            .form(&params)
            .send()
            .await
            .map_err(|e| SplitProviderError::NetworkError(e.to_string()))?;

        let status = response.status();
        let body = response
            .text()
            .await
            .unwrap_or_else(|_| "Failed to read response body".to_string());

        if !status.is_success() {
            return Err(Self::map_status_error(status, &body));
        }

        // Parse response
        let json_response: SplitwiseExpenseResponse = serde_json::from_str(&body)
            .map_err(|e| SplitProviderError::InvalidResponse(e.to_string()))?;

        // Check for errors in response
        if let Some(errors) = json_response.errors {
            if !errors.is_null() {
                return Err(SplitProviderError::ApiError(format!(
                    "Splitwise errors: {}",
                    errors
                )));
            }
        }

        // Extract expense ID from first expense in response
        let expense = json_response
            .expenses
            .and_then(|mut exps| exps.pop())
            .ok_or_else(|| {
                SplitProviderError::InvalidResponse("No expense in response".to_string())
            })?;

        Ok(ExternalExpenseResult {
            external_expense_id: expense.id.to_string(),
            external_url: Some(format!(
                "https://secure.splitwise.com/expenses/{}",
                expense.id
            )),
        })
    }

    async fn update_expense(
        &self,
        credentials: &Value,
        external_expense_id: &str,
        request: UpdateExternalExpense,
    ) -> Result<ExternalExpenseResult, SplitProviderError> {
        let access_token = Self::get_access_token(credentials)?;

        let mut params = Vec::new();

        // Add updated fields
        if let Some(description) = request.description {
            params.push(("description".to_string(), description));
        }
        if let Some(cost) = request.cost {
            params.push(("cost".to_string(), cost));
        }
        if let Some(date) = request.date {
            params.push(("date".to_string(), date.to_rfc3339()));
        }
        if let Some(notes) = request.notes {
            params.push(("details".to_string(), notes));
        }

        // Add users if provided (replaces all users)
        if let Some(users) = request.users {
            params.extend(Self::build_users_params(&users));
        }

        // Make API request
        let response = self
            .http_client
            .post(format!(
                "{}/update_expense/{}",
                Self::BASE_URL,
                external_expense_id
            ))
            .bearer_auth(&access_token)
            .form(&params)
            .send()
            .await
            .map_err(|e| SplitProviderError::NetworkError(e.to_string()))?;

        let status = response.status();
        let body = response
            .text()
            .await
            .unwrap_or_else(|_| "Failed to read response body".to_string());

        if !status.is_success() {
            return Err(Self::map_status_error(status, &body));
        }

        // Parse response
        let json_response: SplitwiseExpenseResponse = serde_json::from_str(&body)
            .map_err(|e| SplitProviderError::InvalidResponse(e.to_string()))?;

        // Check for errors
        if let Some(errors) = json_response.errors {
            if !errors.is_null() {
                return Err(SplitProviderError::ApiError(format!(
                    "Splitwise errors: {}",
                    errors
                )));
            }
        }

        Ok(ExternalExpenseResult {
            external_expense_id: external_expense_id.to_string(),
            external_url: Some(format!(
                "https://secure.splitwise.com/expenses/{}",
                external_expense_id
            )),
        })
    }

    async fn delete_expense(
        &self,
        credentials: &Value,
        external_expense_id: &str,
    ) -> Result<(), SplitProviderError> {
        let access_token = Self::get_access_token(credentials)?;

        let response = self
            .http_client
            .post(format!(
                "{}/delete_expense/{}",
                Self::BASE_URL,
                external_expense_id
            ))
            .bearer_auth(&access_token)
            .send()
            .await
            .map_err(|e| SplitProviderError::NetworkError(e.to_string()))?;

        let status = response.status();
        let body = response
            .text()
            .await
            .unwrap_or_else(|_| "Failed to read response body".to_string());

        if !status.is_success() {
            return Err(Self::map_status_error(status, &body));
        }

        // Parse response to check for success
        let json_response: SplitwiseDeleteResponse = serde_json::from_str(&body)
            .map_err(|e| SplitProviderError::InvalidResponse(e.to_string()))?;

        if !json_response.success {
            return Err(SplitProviderError::ApiError(
                "Delete operation failed".to_string(),
            ));
        }

        Ok(())
    }

    async fn validate_credentials(&self, credentials: &Value) -> Result<bool, SplitProviderError> {
        let access_token = Self::get_access_token(credentials)?;

        let response = self
            .http_client
            .get(format!("{}/get_current_user", Self::BASE_URL))
            .bearer_auth(&access_token)
            .send()
            .await
            .map_err(|e| SplitProviderError::NetworkError(e.to_string()))?;

        Ok(response.status().is_success())
    }

    async fn refresh_credentials(
        &self,
        credentials: &Value,
    ) -> Result<Option<Value>, SplitProviderError> {
        // Check if token is expired
        if !Self::is_token_expired(credentials) {
            return Ok(None); // No refresh needed
        }

        let refresh_token = Self::get_refresh_token(credentials)?;

        // Get OAuth config from environment
        let client_id = std::env::var("SPLITWISE_CLIENT_ID").map_err(|_| {
            SplitProviderError::ConfigurationError("SPLITWISE_CLIENT_ID not set".to_string())
        })?;
        let client_secret = std::env::var("SPLITWISE_CLIENT_SECRET").map_err(|_| {
            SplitProviderError::ConfigurationError("SPLITWISE_CLIENT_SECRET not set".to_string())
        })?;

        // Request new tokens
        let params = [
            ("grant_type", "refresh_token"),
            ("refresh_token", &refresh_token),
            ("client_id", &client_id),
            ("client_secret", &client_secret),
        ];

        let response = self
            .http_client
            .post(format!("{}/oauth/token", Self::OAUTH_BASE_URL))
            .form(&params)
            .send()
            .await
            .map_err(|e| SplitProviderError::NetworkError(e.to_string()))?;

        let status = response.status();
        let body = response
            .text()
            .await
            .unwrap_or_else(|_| "Failed to read response body".to_string());

        if !status.is_success() {
            return Err(Self::map_status_error(status, &body));
        }

        // Parse token response
        let token_response: SplitwiseTokenResponse = serde_json::from_str(&body)
            .map_err(|e| SplitProviderError::InvalidResponse(e.to_string()))?;

        // Calculate expiration time
        let expires_at = Utc::now() + chrono::Duration::seconds(token_response.expires_in);

        // Build new credentials
        let new_credentials = json!({
            "access_token": token_response.access_token,
            "refresh_token": token_response.refresh_token.unwrap_or_else(|| refresh_token.clone()),
            "token_expires_at": expires_at.to_rfc3339(),
            "splitwise_user_id": credentials.get("splitwise_user_id")
        });

        Ok(Some(new_credentials))
    }
}

// Splitwise API response types

#[derive(Debug, Deserialize)]
struct SplitwiseExpenseResponse {
    expenses: Option<Vec<SplitwiseExpense>>,
    errors: Option<Value>,
}

#[derive(Debug, Deserialize)]
struct SplitwiseExpense {
    id: i64,
}

#[derive(Debug, Deserialize)]
struct SplitwiseDeleteResponse {
    success: bool,
}

#[derive(Debug, Deserialize)]
struct SplitwiseTokenResponse {
    access_token: String,
    refresh_token: Option<String>,
    expires_in: i64,
}
