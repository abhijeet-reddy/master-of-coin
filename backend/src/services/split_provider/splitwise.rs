use async_trait::async_trait;
use chrono::{DateTime, Utc};
use reqwest::{Client, StatusCode};
use serde::Deserialize;
use serde_json::{Value, json};

use crate::types::SplitProviderType;

use super::{
    CreateExternalExpense, ExpenseUser, ExternalExpenseDetail, ExternalExpenseResult,
    ExternalExpenseUser, SplitProvider, SplitProviderError, UpdateExternalExpense,
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
                format!("users__{}__user_id", i),
                user.external_user_id.clone(),
            ));
            params.push((format!("users__{}__paid_share", i), user.paid_share.clone()));
            params.push((format!("users__{}__owed_share", i), user.owed_share.clone()));
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
    fn provider_type(&self) -> SplitProviderType {
        SplitProviderType::Splitwise
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
            (
                "date".to_string(),
                request.date.format("%Y-%m-%dT%H:%M:%S").to_string(),
            ),
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
        // Splitwise returns "errors": {} on success, so we need to check for non-empty errors
        if let Some(errors) = json_response.errors {
            let has_errors = match &errors {
                Value::Object(map) => !map.is_empty(),
                Value::Array(arr) => !arr.is_empty(),
                Value::Null => false,
                _ => true,
            };
            if has_errors {
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
            params.push((
                "date".to_string(),
                date.format("%Y-%m-%dT%H:%M:%S").to_string(),
            ));
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

        // Check for errors (Splitwise returns "errors": {} on success)
        if let Some(errors) = json_response.errors {
            let has_errors = match &errors {
                Value::Object(map) => !map.is_empty(),
                Value::Array(arr) => !arr.is_empty(),
                Value::Null => false,
                _ => true,
            };
            if has_errors {
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

    async fn get_expenses(
        &self,
        credentials: &Value,
        friend_id: Option<&str>,
        dated_after: Option<&str>,
        dated_before: Option<&str>,
        limit: Option<u32>,
    ) -> Result<Vec<ExternalExpenseDetail>, SplitProviderError> {
        let access_token = Self::get_access_token(credentials)?;

        let mut params: Vec<(&str, String)> = Vec::new();

        if let Some(fid) = friend_id {
            params.push(("friend_id", fid.to_string()));
        }
        if let Some(after) = dated_after {
            params.push(("dated_after", after.to_string()));
        }
        if let Some(before) = dated_before {
            params.push(("dated_before", before.to_string()));
        }
        let lim = limit.unwrap_or(50);
        params.push(("limit", lim.to_string()));

        let response = self
            .http_client
            .get(format!("{}/get_expenses", Self::BASE_URL))
            .bearer_auth(&access_token)
            .query(&params)
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

        let json_response: SplitwiseGetExpensesResponse = serde_json::from_str(&body)
            .map_err(|e| SplitProviderError::InvalidResponse(e.to_string()))?;

        let expenses = json_response.expenses.unwrap_or_default();

        let result: Vec<ExternalExpenseDetail> = expenses
            .into_iter()
            .filter(|exp| exp.deleted_at.is_none())
            .map(|exp| {
                let users = exp
                    .users
                    .unwrap_or_default()
                    .into_iter()
                    .map(|u| ExternalExpenseUser {
                        external_user_id: u.user.id.to_string(),
                        first_name: u.user.first_name.unwrap_or_default(),
                        last_name: u.user.last_name.unwrap_or_default(),
                        paid_share: u.paid_share.unwrap_or_else(|| "0.00".to_string()),
                        owed_share: u.owed_share.unwrap_or_else(|| "0.00".to_string()),
                    })
                    .collect();

                ExternalExpenseDetail {
                    external_expense_id: exp.id.to_string(),
                    description: exp.description.unwrap_or_default(),
                    cost: exp.cost.unwrap_or_else(|| "0.00".to_string()),
                    currency_code: exp.currency_code.unwrap_or_else(|| "USD".to_string()),
                    date: exp.date.unwrap_or_default(),
                    users,
                    provider_type: SplitProviderType::Splitwise,
                }
            })
            .collect();

        Ok(result)
    }

    async fn get_expense_by_id(
        &self,
        credentials: &Value,
        external_expense_id: &str,
    ) -> Result<Option<ExternalExpenseDetail>, SplitProviderError> {
        let access_token = Self::get_access_token(credentials)?;

        let response = self
            .http_client
            .get(format!(
                "{}/get_expense/{}",
                Self::BASE_URL,
                external_expense_id
            ))
            .bearer_auth(&access_token)
            .send()
            .await
            .map_err(|e| SplitProviderError::NetworkError(e.to_string()))?;

        let status = response.status();

        if status == reqwest::StatusCode::NOT_FOUND {
            return Ok(None);
        }

        let body = response
            .text()
            .await
            .unwrap_or_else(|_| "Failed to read response body".to_string());

        if !status.is_success() {
            return Err(Self::map_status_error(status, &body));
        }

        // Splitwise returns { "expense": { ... } } for single expense
        let json: Value = serde_json::from_str(&body)
            .map_err(|e| SplitProviderError::InvalidResponse(e.to_string()))?;

        let expense_val = json.get("expense").ok_or_else(|| {
            SplitProviderError::InvalidResponse("Missing 'expense' field".to_string())
        })?;

        // Check if deleted
        if expense_val
            .get("deleted_at")
            .and_then(|v| v.as_str())
            .is_some()
        {
            return Ok(None);
        }

        let id = expense_val.get("id").and_then(|v| v.as_i64()).unwrap_or(0);
        let description = expense_val
            .get("description")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();
        let cost = expense_val
            .get("cost")
            .and_then(|v| v.as_str())
            .unwrap_or("0.00")
            .to_string();
        let currency_code = expense_val
            .get("currency_code")
            .and_then(|v| v.as_str())
            .unwrap_or("USD")
            .to_string();
        let date = expense_val
            .get("date")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();

        // Parse users array
        let users = expense_val
            .get("users")
            .and_then(|v| v.as_array())
            .map(|arr| {
                arr.iter()
                    .filter_map(|u| {
                        let user_obj = u.get("user")?;
                        Some(ExternalExpenseUser {
                            external_user_id: user_obj
                                .get("id")
                                .and_then(|v| v.as_i64())
                                .map(|id| id.to_string())
                                .unwrap_or_default(),
                            first_name: user_obj
                                .get("first_name")
                                .and_then(|v| v.as_str())
                                .unwrap_or("")
                                .to_string(),
                            last_name: user_obj
                                .get("last_name")
                                .and_then(|v| v.as_str())
                                .unwrap_or("")
                                .to_string(),
                            paid_share: u
                                .get("paid_share")
                                .and_then(|v| v.as_str())
                                .unwrap_or("0.00")
                                .to_string(),
                            owed_share: u
                                .get("owed_share")
                                .and_then(|v| v.as_str())
                                .unwrap_or("0.00")
                                .to_string(),
                        })
                    })
                    .collect()
            })
            .unwrap_or_default();

        Ok(Some(ExternalExpenseDetail {
            external_expense_id: id.to_string(),
            description,
            cost,
            currency_code,
            date,
            users,
            provider_type: SplitProviderType::Splitwise,
        }))
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

/// Minimal expense for create/update responses
#[derive(Debug, Deserialize)]
struct SplitwiseExpense {
    id: i64,
    #[serde(default)]
    description: Option<String>,
    #[serde(default)]
    cost: Option<String>,
    #[serde(default)]
    currency_code: Option<String>,
    #[serde(default)]
    date: Option<String>,
    #[serde(default)]
    deleted_at: Option<String>,
    #[serde(default)]
    users: Option<Vec<SplitwiseExpenseUser>>,
}

#[derive(Debug, Deserialize)]
struct SplitwiseExpenseUser {
    user: SplitwiseUserInfo,
    #[serde(default)]
    paid_share: Option<String>,
    #[serde(default)]
    owed_share: Option<String>,
}

#[derive(Debug, Deserialize)]
struct SplitwiseUserInfo {
    id: i64,
    #[serde(default)]
    first_name: Option<String>,
    #[serde(default)]
    last_name: Option<String>,
}

/// Response for GET /get_expenses
#[derive(Debug, Deserialize)]
struct SplitwiseGetExpensesResponse {
    expenses: Option<Vec<SplitwiseExpense>>,
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
