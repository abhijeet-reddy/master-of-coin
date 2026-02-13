use chrono::{Duration, Utc};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use std::env;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum SplitwiseOAuthError {
    #[error("OAuth configuration error: {0}")]
    ConfigurationError(String),

    #[error("Network error: {0}")]
    NetworkError(String),

    #[error("Invalid response: {0}")]
    InvalidResponse(String),

    #[error("OAuth error: {0}")]
    OAuthError(String),
}

/// Splitwise OAuth2 token response
#[derive(Debug, Serialize, Deserialize)]
pub struct SplitwiseTokens {
    pub access_token: String,
    pub refresh_token: String,
    pub expires_in: i64,
    pub token_type: String,
}

/// Splitwise user information
#[derive(Debug, Serialize, Deserialize)]
pub struct SplitwiseUser {
    pub id: i64,
    pub first_name: String,
    pub last_name: String,
    pub email: String,
}

/// Splitwise OAuth2 service
pub struct SplitwiseOAuth {
    http_client: Client,
    client_id: String,
    client_secret: String,
    redirect_uri: String,
}

impl SplitwiseOAuth {
    const AUTHORIZE_URL: &'static str = "https://secure.splitwise.com/oauth/authorize";
    const TOKEN_URL: &'static str = "https://secure.splitwise.com/oauth/token";
    const USER_INFO_URL: &'static str = "https://secure.splitwise.com/api/v3.0/get_current_user";

    /// Create a new SplitwiseOAuth instance from environment variables
    ///
    /// # Errors
    ///
    /// Returns `SplitwiseOAuthError::ConfigurationError` if required environment variables are not set
    pub fn from_env() -> Result<Self, SplitwiseOAuthError> {
        let client_id = env::var("SPLITWISE_CLIENT_ID").map_err(|_| {
            SplitwiseOAuthError::ConfigurationError("SPLITWISE_CLIENT_ID not set".to_string())
        })?;
        let client_secret = env::var("SPLITWISE_CLIENT_SECRET").map_err(|_| {
            SplitwiseOAuthError::ConfigurationError("SPLITWISE_CLIENT_SECRET not set".to_string())
        })?;
        let redirect_uri = env::var("SPLITWISE_REDIRECT_URI").map_err(|_| {
            SplitwiseOAuthError::ConfigurationError("SPLITWISE_REDIRECT_URI not set".to_string())
        })?;

        Ok(Self {
            http_client: Client::new(),
            client_id,
            client_secret,
            redirect_uri,
        })
    }

    /// Generate the Splitwise OAuth authorization URL
    ///
    /// # Arguments
    ///
    /// * `state` - CSRF protection state parameter (should be cryptographically random)
    ///
    /// # Returns
    ///
    /// Full authorization URL to redirect the user to
    pub fn generate_auth_url(&self, state: String) -> String {
        format!(
            "{}?client_id={}&response_type=code&redirect_uri={}&state={}",
            Self::AUTHORIZE_URL,
            urlencoding::encode(&self.client_id),
            urlencoding::encode(&self.redirect_uri),
            urlencoding::encode(&state)
        )
    }

    /// Exchange authorization code for access tokens
    ///
    /// # Arguments
    ///
    /// * `code` - Authorization code from OAuth callback
    ///
    /// # Returns
    ///
    /// Access token, refresh token, and expiration info
    ///
    /// # Errors
    ///
    /// Returns error if token exchange fails
    pub async fn exchange_code_for_tokens(
        &self,
        code: String,
    ) -> Result<SplitwiseTokens, SplitwiseOAuthError> {
        let params = [
            ("grant_type", "authorization_code"),
            ("code", &code),
            ("client_id", &self.client_id),
            ("client_secret", &self.client_secret),
            ("redirect_uri", &self.redirect_uri),
        ];

        let response = self
            .http_client
            .post(Self::TOKEN_URL)
            .form(&params)
            .send()
            .await
            .map_err(|e| SplitwiseOAuthError::NetworkError(e.to_string()))?;

        let status = response.status();
        let body = response
            .text()
            .await
            .unwrap_or_else(|_| "Failed to read response body".to_string());

        if !status.is_success() {
            return Err(SplitwiseOAuthError::OAuthError(format!(
                "Token exchange failed: HTTP {}: {}",
                status, body
            )));
        }

        serde_json::from_str(&body).map_err(|e| SplitwiseOAuthError::InvalidResponse(e.to_string()))
    }

    /// Refresh an expired access token
    ///
    /// # Arguments
    ///
    /// * `refresh_token` - Refresh token from previous authorization
    ///
    /// # Returns
    ///
    /// New access token and refresh token
    pub async fn refresh_access_token(
        &self,
        refresh_token: String,
    ) -> Result<SplitwiseTokens, SplitwiseOAuthError> {
        let params = [
            ("grant_type", "refresh_token"),
            ("refresh_token", &refresh_token),
            ("client_id", &self.client_id),
            ("client_secret", &self.client_secret),
        ];

        let response = self
            .http_client
            .post(Self::TOKEN_URL)
            .form(&params)
            .send()
            .await
            .map_err(|e| SplitwiseOAuthError::NetworkError(e.to_string()))?;

        let status = response.status();
        let body = response
            .text()
            .await
            .unwrap_or_else(|_| "Failed to read response body".to_string());

        if !status.is_success() {
            return Err(SplitwiseOAuthError::OAuthError(format!(
                "Token refresh failed: HTTP {}: {}",
                status, body
            )));
        }

        serde_json::from_str(&body).map_err(|e| SplitwiseOAuthError::InvalidResponse(e.to_string()))
    }

    /// Get Splitwise user information
    ///
    /// # Arguments
    ///
    /// * `access_token` - Valid Splitwise access token
    ///
    /// # Returns
    ///
    /// User ID, name, and email
    pub async fn get_splitwise_user_info(
        &self,
        access_token: String,
    ) -> Result<SplitwiseUser, SplitwiseOAuthError> {
        let response = self
            .http_client
            .get(Self::USER_INFO_URL)
            .bearer_auth(&access_token)
            .send()
            .await
            .map_err(|e| SplitwiseOAuthError::NetworkError(e.to_string()))?;

        let status = response.status();
        let body = response
            .text()
            .await
            .unwrap_or_else(|_| "Failed to read response body".to_string());

        if !status.is_success() {
            return Err(SplitwiseOAuthError::OAuthError(format!(
                "Failed to get user info: HTTP {}: {}",
                status, body
            )));
        }

        // Parse response - user is nested under "user" key
        let json_response: Value = serde_json::from_str(&body)
            .map_err(|e| SplitwiseOAuthError::InvalidResponse(e.to_string()))?;

        let user_data = json_response.get("user").ok_or_else(|| {
            SplitwiseOAuthError::InvalidResponse("Missing 'user' field".to_string())
        })?;

        serde_json::from_value(user_data.clone())
            .map_err(|e| SplitwiseOAuthError::InvalidResponse(e.to_string()))
    }

    /// Build complete credentials JSON from tokens and user info
    ///
    /// # Arguments
    ///
    /// * `tokens` - OAuth tokens from Splitwise
    /// * `user_id` - Splitwise user ID
    ///
    /// # Returns
    ///
    /// JSON value ready to be encrypted and stored
    pub fn build_credentials(tokens: &SplitwiseTokens, user_id: i64) -> Value {
        let expires_at = Utc::now() + Duration::seconds(tokens.expires_in);

        json!({
            "access_token": tokens.access_token,
            "refresh_token": tokens.refresh_token,
            "token_expires_at": expires_at.to_rfc3339(),
            "splitwise_user_id": user_id
        })
    }
}
