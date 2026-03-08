use async_trait::async_trait;
use reqwest::{Client, StatusCode};
use serde_json::{Value, json};

use super::superjson;
use super::{
    CreateExternalExpense, ExternalExpenseDetail, ExternalExpenseResult, ExternalExpenseUser,
    SplitProvider, SplitProviderError, UpdateExternalExpense,
};

/// SplitPro API provider implementation.
///
/// Communicates with a self-hosted SplitPro instance via raw HTTP calls
/// to its tRPC endpoints. Authentication uses a long-lived NextAuth session
/// token stored as a cookie.
///
/// SplitPro uses tRPC with SuperJSON transformer, so all requests must be
/// SuperJSON-encoded and responses must be SuperJSON-decoded.
pub struct SplitProProvider {
    http_client: Client,
}

impl SplitProProvider {
    /// Create a new SplitPro provider instance
    pub fn new() -> Self {
        Self {
            http_client: Client::new(),
        }
    }

    /// Extract base URL from credentials
    fn get_base_url(credentials: &Value) -> Result<String, SplitProviderError> {
        credentials
            .get("base_url")
            .and_then(|v| v.as_str())
            .map(|s| s.trim_end_matches('/').to_string())
            .ok_or_else(|| {
                SplitProviderError::ConfigurationError(
                    "Missing base_url in credentials".to_string(),
                )
            })
    }

    /// Extract session token from credentials
    fn get_session_token(credentials: &Value) -> Result<String, SplitProviderError> {
        credentials
            .get("session_token")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
            .ok_or_else(|| {
                SplitProviderError::ConfigurationError(
                    "Missing session_token in credentials".to_string(),
                )
            })
    }

    /// Extract SplitPro user ID from credentials
    fn get_splitpro_user_id(credentials: &Value) -> Result<i64, SplitProviderError> {
        credentials
            .get("splitpro_user_id")
            .and_then(|v| v.as_i64())
            .ok_or_else(|| {
                SplitProviderError::ConfigurationError(
                    "Missing splitpro_user_id in credentials".to_string(),
                )
            })
    }

    /// Build a tRPC endpoint URL
    fn build_trpc_url(base_url: &str, procedure: &str) -> String {
        format!("{}/api/trpc/{}", base_url, procedure)
    }

    /// Make a tRPC mutation request (POST)
    async fn make_mutation_request(
        &self,
        base_url: &str,
        session_token: &str,
        procedure: &str,
        body: Value,
    ) -> Result<Value, SplitProviderError> {
        let url = Self::build_trpc_url(base_url, procedure);

        let response = self
            .http_client
            .post(&url)
            .header("Content-Type", "application/json")
            .header(
                "Cookie",
                format!("next-auth.session-token={}", session_token),
            )
            .json(&body)
            .send()
            .await
            .map_err(|e| SplitProviderError::NetworkError(e.to_string()))?;

        let status = response.status();
        let body_text = response
            .text()
            .await
            .unwrap_or_else(|_| "Failed to read response body".to_string());

        if !status.is_success() {
            return Err(Self::map_http_error(status, &body_text));
        }

        let json_response: Value = serde_json::from_str(&body_text)
            .map_err(|e| SplitProviderError::InvalidResponse(e.to_string()))?;

        // Check for tRPC-level errors
        if let Some((code, message)) = superjson::decode_error(&json_response) {
            return Err(Self::map_trpc_error(&code, &message));
        }

        Ok(json_response)
    }

    /// Make a tRPC query request (GET)
    async fn make_query_request(
        &self,
        base_url: &str,
        session_token: &str,
        procedure: &str,
        input: &Value,
        bigint_paths: &[&str],
    ) -> Result<Value, SplitProviderError> {
        let encoded_input = superjson::encode_query_input(input, bigint_paths);
        let url = format!(
            "{}?input={}",
            Self::build_trpc_url(base_url, procedure),
            encoded_input
        );

        tracing::debug!(
            "SplitPro query request: {} with cookie: next-auth.session-token={}...{}",
            url,
            &session_token[..std::cmp::min(8, session_token.len())],
            if session_token.len() > 8 {
                "(truncated)"
            } else {
                ""
            }
        );

        let response = self
            .http_client
            .get(&url)
            .header(
                "Cookie",
                format!("next-auth.session-token={}", session_token),
            )
            .send()
            .await
            .map_err(|e| SplitProviderError::NetworkError(e.to_string()))?;

        let status = response.status();
        let body_text = response
            .text()
            .await
            .unwrap_or_else(|_| "Failed to read response body".to_string());

        tracing::debug!(
            "SplitPro query response for {}: status={}, body={}",
            procedure,
            status,
            &body_text[..std::cmp::min(500, body_text.len())]
        );

        if !status.is_success() {
            tracing::warn!(
                "SplitPro query {} failed: HTTP {} - {}",
                procedure,
                status,
                &body_text[..std::cmp::min(200, body_text.len())]
            );
            return Err(Self::map_http_error(status, &body_text));
        }

        let json_response: Value = serde_json::from_str(&body_text)
            .map_err(|e| SplitProviderError::InvalidResponse(e.to_string()))?;

        // Check for tRPC-level errors
        if let Some((code, message)) = superjson::decode_error(&json_response) {
            return Err(Self::map_trpc_error(&code, &message));
        }

        Ok(json_response)
    }

    /// Map HTTP status code to SplitProviderError
    fn map_http_error(status: StatusCode, body: &str) -> SplitProviderError {
        match status {
            StatusCode::UNAUTHORIZED => SplitProviderError::AuthenticationFailed(body.to_string()),
            StatusCode::NOT_FOUND => SplitProviderError::NotFound(body.to_string()),
            StatusCode::TOO_MANY_REQUESTS => SplitProviderError::RateLimited(None),
            _ => SplitProviderError::ApiError(format!("HTTP {}: {}", status, body)),
        }
    }

    /// Map tRPC error code to SplitProviderError
    fn map_trpc_error(code: &str, message: &str) -> SplitProviderError {
        match code {
            "UNAUTHORIZED" => SplitProviderError::AuthenticationFailed(message.to_string()),
            "NOT_FOUND" => SplitProviderError::NotFound(message.to_string()),
            "FORBIDDEN" => SplitProviderError::AuthenticationFailed(message.to_string()),
            "TOO_MANY_REQUESTS" => SplitProviderError::RateLimited(None),
            _ => SplitProviderError::ApiError(format!("tRPC {}: {}", code, message)),
        }
    }

    /// Determine the payer from the expense users list.
    /// The payer is the user with a non-zero paid_share.
    fn determine_payer(users: &[super::ExpenseUser], default_user_id: i64) -> i64 {
        for user in users {
            if let Ok(paid) = user.paid_share.parse::<f64>() {
                if paid > 0.0 {
                    return user.external_user_id.parse().unwrap_or(default_user_id);
                }
            }
        }
        default_user_id
    }

    /// Build the participants array for SplitPro from expense users.
    ///
    /// SplitPro participants have `userId` (number) and `amount` (BigInt).
    /// The amount represents the signed share:
    /// - Positive = person gets money back (payer's net receivable)
    /// - Negative = person owes money
    ///
    /// For a $120 expense where You paid, split equally:
    /// - You: +6000 (you get $60 back)
    /// - Arpit: -6000 (Arpit owes $60)
    fn build_participants(
        users: &[super::ExpenseUser],
    ) -> Result<(Vec<Value>, Vec<String>), SplitProviderError> {
        let mut participants = Vec::new();
        let mut bigint_paths = Vec::new();

        for (i, user) in users.iter().enumerate() {
            let user_id: i64 = user.external_user_id.parse().map_err(|_| {
                SplitProviderError::ConfigurationError(format!(
                    "Invalid SplitPro user ID: {}",
                    user.external_user_id
                ))
            })?;

            let paid_bigint = superjson::amount_to_bigint(&user.paid_share).map_err(|e| {
                SplitProviderError::ApiError(format!("Failed to convert paid_share: {}", e))
            })?;

            let owed_bigint = superjson::amount_to_bigint(&user.owed_share).map_err(|e| {
                SplitProviderError::ApiError(format!("Failed to convert owed_share: {}", e))
            })?;

            // SplitPro amount = paid_share - owed_share
            // Payer: paid 1200, owes 600 → amount = +600 (gets 600 back)
            // Non-payer: paid 0, owes 600 → amount = -600 (owes 600)
            let amount = paid_bigint - owed_bigint;

            participants.push(json!({
                "userId": user_id,
                "amount": amount.to_string()
            }));

            bigint_paths.push(format!("participants.{}.amount", i));
        }

        Ok((participants, bigint_paths))
    }

    /// Parse an expense from SplitPro's response format into ExternalExpenseDetail.
    fn parse_expense(expense: &Value) -> Option<ExternalExpenseDetail> {
        let id = expense.get("id").and_then(|v| v.as_str()).unwrap_or("");
        if id.is_empty() {
            return None;
        }

        // Check if deleted
        if expense.get("deletedAt").is_some()
            && !expense["deletedAt"].is_null()
            && expense.get("deletedBy").is_some()
            && !expense["deletedBy"].is_null()
        {
            return None;
        }

        let name = expense
            .get("name")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();

        // Amount is BigInt - comes as a number or string from SuperJSON
        let amount_bigint = expense
            .get("amount")
            .and_then(|v| {
                v.as_i64()
                    .or_else(|| v.as_str().and_then(|s| s.parse::<i64>().ok()))
            })
            .unwrap_or(0);
        let cost = superjson::bigint_to_amount(amount_bigint);

        let currency = expense
            .get("currency")
            .and_then(|v| v.as_str())
            .unwrap_or("USD")
            .to_string();

        let date = expense
            .get("expenseDate")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();

        // Parse participants
        let users = expense
            .get("expenseParticipants")
            .and_then(|v| v.as_array())
            .map(|arr| {
                arr.iter()
                    .filter_map(|p| {
                        let user_id = p.get("userId").and_then(|v| v.as_i64())?;

                        let amount = p
                            .get("amount")
                            .and_then(|v| {
                                v.as_i64()
                                    .or_else(|| v.as_str().and_then(|s| s.parse::<i64>().ok()))
                            })
                            .unwrap_or(0);

                        // Get user details if available (from included user relation)
                        let (first_name, last_name) = if let Some(user) = p.get("user") {
                            (
                                user.get("name")
                                    .and_then(|v| v.as_str())
                                    .unwrap_or("")
                                    .to_string(),
                                String::new(),
                            )
                        } else {
                            (String::new(), String::new())
                        };

                        // Determine paid_share vs owed_share from SplitPro's signed amount.
                        // SplitPro amount: positive = gets money back, negative = owes money
                        // For payer who paid 1200, split 600/600: amount = +600 (gets 600 back)
                        // For non-payer: amount = -600 (owes 600)
                        //
                        // Convert to Splitwise format:
                        // paid_share = how much they actually paid (total for payer, 0 for others)
                        // owed_share = their share of the expense
                        //   For payer: owed_share = total - amount (1200 - 600 = 600)
                        //   For non-payer: owed_share = abs(amount) (600)
                        let paid_by = expense.get("paidBy").and_then(|v| v.as_i64()).unwrap_or(0);
                        let (paid_share, owed_share) = if user_id == paid_by {
                            // Payer: paid the full amount, owes (total - amount_received)
                            let owed = amount_bigint - amount; // 1200 - 600 = 600
                            (
                                superjson::bigint_to_amount(amount_bigint),
                                superjson::bigint_to_amount(owed),
                            )
                        } else {
                            // Non-payer: paid nothing, owes abs(amount)
                            (
                                "0.00".to_string(),
                                superjson::bigint_to_amount(amount.abs()),
                            )
                        };

                        Some(ExternalExpenseUser {
                            external_user_id: user_id.to_string(),
                            first_name,
                            last_name,
                            paid_share,
                            owed_share,
                        })
                    })
                    .collect()
            })
            .unwrap_or_default();

        Some(ExternalExpenseDetail {
            external_expense_id: id.to_string(),
            description: name,
            cost,
            currency_code: currency,
            date,
            users,
        })
    }
}

impl Default for SplitProProvider {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl SplitProvider for SplitProProvider {
    fn provider_type(&self) -> &str {
        "splitpro"
    }

    async fn create_expense(
        &self,
        credentials: &Value,
        request: CreateExternalExpense,
    ) -> Result<ExternalExpenseResult, SplitProviderError> {
        let base_url = Self::get_base_url(credentials)?;
        let session_token = Self::get_session_token(credentials)?;
        let splitpro_user_id = Self::get_splitpro_user_id(credentials)?;

        // Build participants
        let (participants, participant_bigint_paths) = Self::build_participants(&request.users)?;

        // Determine payer
        let paid_by = Self::determine_payer(&request.users, splitpro_user_id);

        // Convert total amount to BigInt
        let amount_bigint = superjson::amount_to_bigint(&request.cost).map_err(|e| {
            SplitProviderError::ApiError(format!("Failed to convert amount: {}", e))
        })?;

        // Build the expense data
        let expense_data = json!({
            "paidBy": paid_by,
            "name": request.description,
            "category": "general",
            "amount": amount_bigint.to_string(),
            "groupId": null,
            "splitType": "EXACT",
            "currency": request.currency_code,
            "participants": participants,
            "expenseDate": request.date.format("%Y-%m-%dT%H:%M:%S%.3fZ").to_string()
        });

        // Build BigInt paths
        let mut bigint_paths: Vec<&str> = vec!["amount"];
        let path_strings: Vec<String> = participant_bigint_paths;
        let path_refs: Vec<&str> = path_strings.iter().map(|s| s.as_str()).collect();
        bigint_paths.extend(path_refs);

        // Date paths for SuperJSON encoding
        let date_paths: Vec<&str> = vec!["expenseDate"];

        let body =
            superjson::encode_mutation_body_with_dates(&expense_data, &bigint_paths, &date_paths);

        // Make the tRPC call
        let response = self
            .make_mutation_request(&base_url, &session_token, "expense.addOrEditExpense", body)
            .await?;

        // Parse response - SplitPro returns the created expense(s)
        let data = superjson::decode_response(&response).ok_or_else(|| {
            SplitProviderError::InvalidResponse("Failed to decode tRPC response".to_string())
        })?;

        // Response is an array of expenses (since addOrEditExpense accepts arrays)
        let expense_id = if let Some(arr) = data.as_array() {
            arr.first()
                .and_then(|exp| exp.get("id"))
                .and_then(|id| id.as_str())
                .unwrap_or("")
                .to_string()
        } else {
            data.get("id")
                .and_then(|id| id.as_str())
                .unwrap_or("")
                .to_string()
        };

        if expense_id.is_empty() {
            return Err(SplitProviderError::InvalidResponse(
                "No expense ID in response".to_string(),
            ));
        }

        Ok(ExternalExpenseResult {
            external_expense_id: expense_id.clone(),
            external_url: Some(format!("{}/expenses/{}", base_url, expense_id)),
        })
    }

    async fn update_expense(
        &self,
        credentials: &Value,
        external_expense_id: &str,
        request: UpdateExternalExpense,
    ) -> Result<ExternalExpenseResult, SplitProviderError> {
        let base_url = Self::get_base_url(credentials)?;
        let session_token = Self::get_session_token(credentials)?;
        let splitpro_user_id = Self::get_splitpro_user_id(credentials)?;

        // First, fetch the existing expense to get current values
        let existing = self
            .get_expense_by_id(credentials, external_expense_id)
            .await?
            .ok_or_else(|| {
                SplitProviderError::NotFound(format!("Expense {} not found", external_expense_id))
            })?;

        // Build updated expense data, merging with existing
        let description = request.description.unwrap_or(existing.description);
        let cost = request.cost.unwrap_or(existing.cost);

        let amount_bigint = superjson::amount_to_bigint(&cost).map_err(|e| {
            SplitProviderError::ApiError(format!("Failed to convert amount: {}", e))
        })?;

        // Build participants from request or existing
        let (participants, participant_bigint_paths) = if let Some(users) = &request.users {
            Self::build_participants(users)?
        } else {
            // Convert existing users back to participants format
            let mut parts = Vec::new();
            let mut paths = Vec::new();
            for (i, user) in existing.users.iter().enumerate() {
                let owed_bigint = superjson::amount_to_bigint(&user.owed_share).map_err(|e| {
                    SplitProviderError::ApiError(format!("Failed to convert owed_share: {}", e))
                })?;
                let user_id: i64 = user.external_user_id.parse().unwrap_or(0);
                parts.push(json!({
                    "userId": user_id,
                    "amount": owed_bigint.to_string()
                }));
                paths.push(format!("participants.{}.amount", i));
            }
            (parts, paths)
        };

        let paid_by = if let Some(users) = &request.users {
            Self::determine_payer(users, splitpro_user_id)
        } else {
            // Find payer from existing expense
            existing
                .users
                .iter()
                .find(|u| {
                    u.paid_share
                        .parse::<f64>()
                        .map(|v| v > 0.0)
                        .unwrap_or(false)
                })
                .and_then(|u| u.external_user_id.parse().ok())
                .unwrap_or(splitpro_user_id)
        };

        let date = request
            .date
            .map(|d| d.format("%Y-%m-%dT%H:%M:%S%.3fZ").to_string())
            .unwrap_or(existing.date);

        let expense_data = json!({
            "expenseId": external_expense_id,
            "paidBy": paid_by,
            "name": description,
            "category": "general",
            "amount": amount_bigint.to_string(),
            "groupId": null,
            "splitType": "EXACT",
            "currency": existing.currency_code,
            "participants": participants,
            "expenseDate": date
        });

        // Build BigInt paths
        let mut bigint_paths: Vec<&str> = vec!["amount"];
        let path_strings: Vec<String> = participant_bigint_paths;
        let path_refs: Vec<&str> = path_strings.iter().map(|s| s.as_str()).collect();
        bigint_paths.extend(path_refs);

        // Date paths for SuperJSON encoding
        let date_paths: Vec<&str> = vec!["expenseDate"];

        let body =
            superjson::encode_mutation_body_with_dates(&expense_data, &bigint_paths, &date_paths);

        // Make the tRPC call (same endpoint for create and edit)
        self.make_mutation_request(&base_url, &session_token, "expense.addOrEditExpense", body)
            .await?;

        Ok(ExternalExpenseResult {
            external_expense_id: external_expense_id.to_string(),
            external_url: Some(format!("{}/expenses/{}", base_url, external_expense_id)),
        })
    }

    async fn delete_expense(
        &self,
        credentials: &Value,
        external_expense_id: &str,
    ) -> Result<(), SplitProviderError> {
        let base_url = Self::get_base_url(credentials)?;
        let session_token = Self::get_session_token(credentials)?;

        let delete_data = json!({
            "expenseId": external_expense_id
        });

        let body = superjson::encode_mutation_body(&delete_data, &[]);

        self.make_mutation_request(&base_url, &session_token, "expense.deleteExpense", body)
            .await?;

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
        let base_url = Self::get_base_url(credentials)?;
        let session_token = Self::get_session_token(credentials)?;

        // SplitPro requires a friend_id for getExpensesWithFriend
        let friend_id_num: i64 = friend_id
            .ok_or_else(|| {
                SplitProviderError::ConfigurationError(
                    "friend_id is required for SplitPro expense queries".to_string(),
                )
            })?
            .parse()
            .map_err(|_| {
                SplitProviderError::ConfigurationError("Invalid friend_id format".to_string())
            })?;

        let input = json!({ "friendId": friend_id_num });

        let response = self
            .make_query_request(
                &base_url,
                &session_token,
                "expense.getExpensesWithFriend",
                &input,
                &[],
            )
            .await?;

        let data = superjson::decode_response(&response).ok_or_else(|| {
            SplitProviderError::InvalidResponse("Failed to decode tRPC response".to_string())
        })?;

        let expenses_array = data.as_array().ok_or_else(|| {
            SplitProviderError::InvalidResponse("Expected array of expenses".to_string())
        })?;

        let mut expenses: Vec<ExternalExpenseDetail> = expenses_array
            .iter()
            .filter_map(Self::parse_expense)
            .collect();

        // Apply date filtering client-side
        if let Some(after) = dated_after {
            expenses.retain(|e| e.date.as_str() >= after);
        }
        if let Some(before) = dated_before {
            expenses.retain(|e| e.date.as_str() <= before);
        }

        // Apply limit
        if let Some(lim) = limit {
            expenses.truncate(lim as usize);
        }

        Ok(expenses)
    }

    async fn get_expense_by_id(
        &self,
        credentials: &Value,
        external_expense_id: &str,
    ) -> Result<Option<ExternalExpenseDetail>, SplitProviderError> {
        let base_url = Self::get_base_url(credentials)?;
        let session_token = Self::get_session_token(credentials)?;

        let input = json!({ "expenseId": external_expense_id });

        let response = self
            .make_query_request(
                &base_url,
                &session_token,
                "expense.getExpenseDetails",
                &input,
                &[],
            )
            .await;

        match response {
            Ok(resp) => {
                let data = superjson::decode_response(&resp);
                match data {
                    Some(expense_data) if !expense_data.is_null() => {
                        Ok(Self::parse_expense(&expense_data))
                    }
                    _ => Ok(None),
                }
            }
            Err(SplitProviderError::NotFound(_)) => Ok(None),
            Err(e) => Err(e),
        }
    }

    async fn validate_credentials(&self, credentials: &Value) -> Result<bool, SplitProviderError> {
        let base_url = Self::get_base_url(credentials)?;
        let session_token = Self::get_session_token(credentials)?;

        tracing::info!(
            "Validating SplitPro credentials: base_url={}, session_token_prefix={}",
            base_url,
            &session_token[..std::cmp::min(12, session_token.len())]
        );

        let input = json!({});

        let result = self
            .make_query_request(&base_url, &session_token, "user.me", &input, &[])
            .await;

        match &result {
            Ok(response) => {
                tracing::info!("SplitPro validate_credentials succeeded: {:?}", response);
            }
            Err(SplitProviderError::AuthenticationFailed(msg)) => {
                tracing::warn!("SplitPro validate_credentials auth failed: {}", msg);
            }
            Err(e) => {
                tracing::error!("SplitPro validate_credentials error: {:?}", e);
            }
        }

        match result {
            Ok(_) => Ok(true),
            Err(SplitProviderError::AuthenticationFailed(_)) => Ok(false),
            Err(e) => Err(e),
        }
    }

    async fn refresh_credentials(
        &self,
        _credentials: &Value,
    ) -> Result<Option<Value>, SplitProviderError> {
        // SplitPro sessions are long-lived and don't need refresh
        Ok(None)
    }
}
