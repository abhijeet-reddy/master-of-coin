use crate::{
    AppState,
    auth::context::AuthContext,
    errors::ApiError,
    models::NewSplitProvider,
    repositories,
    services::splitwise_oauth::{SplitwiseOAuth, SplitwiseOAuthError},
    utils,
};
use axum::{
    Json,
    extract::{Extension, Query, State},
    response::{IntoResponse, Redirect, Response},
};
use serde::{Deserialize, Serialize};

/// Response with OAuth authorization URL
#[derive(Debug, Serialize)]
pub struct AuthUrlResponse {
    pub auth_url: String,
    pub state: String,
}

/// OAuth callback query parameters
#[derive(Debug, Deserialize)]
pub struct OAuthCallbackQuery {
    pub code: String,
    pub state: String,
}

/// Splitwise friend from API
#[derive(Debug, Serialize, Deserialize)]
pub struct SplitwiseFriend {
    pub id: i64,
    pub first_name: String,
    pub last_name: String,
    pub email: String,
}

/// Get Splitwise OAuth authorization URL
/// GET /api/v1/integrations/splitwise/auth-url
///
/// Generates a Splitwise OAuth URL with a signed state parameter that embeds
/// the user_id. This allows the callback (which is a public endpoint) to
/// identify the user without requiring authentication.
pub async fn get_auth_url(
    State(_state): State<AppState>,
    Extension(auth_context): Extension<AuthContext>,
) -> Result<Json<AuthUrlResponse>, ApiError> {
    let user_id = auth_context.user_id();
    tracing::info!("Generating Splitwise auth URL for user {}", user_id);

    // Create OAuth service
    let oauth = SplitwiseOAuth::from_env().map_err(|e| ApiError::Configuration(e.to_string()))?;

    // Generate signed state that embeds user_id (encrypted with ENCRYPTION_KEY)
    let state = utils::create_signed_state(user_id).map_err(|e| {
        ApiError::InternalWithMessage(format!("Failed to create OAuth state: {}", e))
    })?;

    // Generate authorization URL
    let auth_url = oauth.generate_auth_url(state.clone());

    Ok(Json(AuthUrlResponse { auth_url, state }))
}

/// Handle Splitwise OAuth callback (PUBLIC endpoint - no auth required)
/// GET /api/v1/integrations/splitwise/callback?code=XXX&state=YYY
///
/// This endpoint is called by Splitwise after the user authorizes the app.
/// Since it's a browser redirect from Splitwise, there's no auth token.
/// The user_id is extracted from the encrypted state parameter instead.
///
/// Exchanges the authorization code for tokens, fetches user info,
/// encrypts and stores credentials, then redirects to Settings page.
pub async fn oauth_callback(
    State(state): State<AppState>,
    Query(query): Query<OAuthCallbackQuery>,
) -> Result<Response, ApiError> {
    tracing::info!("Handling Splitwise OAuth callback");

    // Verify and extract user_id from the signed state parameter
    let user_id = utils::verify_signed_state(&query.state).map_err(|e| {
        tracing::error!("OAuth state verification failed: {}", e);
        ApiError::BadRequest(format!("Invalid OAuth state: {}", e))
    })?;

    tracing::info!("OAuth state verified for user_id: {}", user_id);

    // Create OAuth service
    let oauth = SplitwiseOAuth::from_env().map_err(|e| ApiError::Configuration(e.to_string()))?;

    // Exchange code for tokens
    let tokens = oauth
        .exchange_code_for_tokens(query.code)
        .await
        .map_err(|e| map_oauth_error(e))?;

    // Get Splitwise user info
    let splitwise_user = oauth
        .get_splitwise_user_info(tokens.access_token.clone())
        .await
        .map_err(|e| map_oauth_error(e))?;

    tracing::info!(
        "Successfully authenticated Splitwise user {} for Master of Coin user {}",
        splitwise_user.id,
        user_id
    );

    // Build credentials JSON
    let credentials_json = SplitwiseOAuth::build_credentials(&tokens, splitwise_user.id);

    // Encrypt credentials
    let encrypted_credentials = utils::encrypt_credentials(&credentials_json).map_err(|e| {
        ApiError::InternalWithMessage(format!("Failed to encrypt credentials: {}", e))
    })?;

    // Store credentials as base64 string in JSONB (Diesel expects serde_json::Value)
    let credentials_value = serde_json::json!({
        "encrypted": encrypted_credentials
    });

    // Upsert split_provider record
    let new_provider = NewSplitProvider {
        user_id,
        provider_type: "splitwise".to_string(),
        credentials: credentials_value,
        is_active: true,
    };

    repositories::split_provider::upsert_provider(&state.db, user_id, new_provider).await?;

    // Redirect to Settings page with success message
    let redirect_url = "/settings?tab=split&status=connected";

    Ok(Redirect::to(redirect_url).into_response())
}

/// List Splitwise friends for the authenticated user
/// GET /api/v1/integrations/splitwise/friends
///
/// Fetches the user's Splitwise friends list for mapping to People.
pub async fn list_splitwise_friends(
    State(state): State<AppState>,
    Extension(auth_context): Extension<AuthContext>,
) -> Result<Json<Vec<SplitwiseFriend>>, ApiError> {
    let user_id = auth_context.user_id();
    tracing::info!("Fetching Splitwise friends for user {}", user_id);

    // Get user's Splitwise provider
    let provider =
        repositories::split_provider::find_by_user_and_type(&state.db, user_id, "splitwise")
            .await?
            .ok_or_else(|| ApiError::NotFound("Splitwise not connected".to_string()))?;

    if !provider.is_active {
        return Err(ApiError::BadRequest(
            "Splitwise provider is inactive. Please reconnect.".to_string(),
        ));
    }

    // Decrypt credentials
    let encrypted = provider
        .credentials
        .get("encrypted")
        .and_then(|v| v.as_str())
        .ok_or_else(|| ApiError::InternalWithMessage("Invalid credentials format".to_string()))?;

    let credentials = utils::decrypt_credentials(encrypted).map_err(|e| {
        ApiError::InternalWithMessage(format!("Failed to decrypt credentials: {}", e))
    })?;

    // Get access token
    let access_token = credentials
        .get("access_token")
        .and_then(|v| v.as_str())
        .ok_or_else(|| ApiError::InternalWithMessage("Missing access_token".to_string()))?;

    // Fetch friends from Splitwise API
    let http_client = reqwest::Client::new();
    let response = http_client
        .get("https://secure.splitwise.com/api/v3.0/get_friends")
        .bearer_auth(access_token)
        .send()
        .await
        .map_err(|e| ApiError::External(format!("Splitwise API error: {}", e)))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(ApiError::External(format!(
            "Splitwise API error: HTTP {}: {}",
            status, body
        )));
    }

    // Parse response
    let body = response
        .text()
        .await
        .map_err(|e| ApiError::External(format!("Failed to read response: {}", e)))?;

    let json_response: serde_json::Value = serde_json::from_str(&body)
        .map_err(|e| ApiError::External(format!("Invalid JSON response: {}", e)))?;

    // Extract friends array
    let friends_array = json_response
        .get("friends")
        .and_then(|v| v.as_array())
        .ok_or_else(|| ApiError::External("Missing 'friends' array in response".to_string()))?;

    // Parse each friend
    let friends: Vec<SplitwiseFriend> = friends_array
        .iter()
        .filter_map(|friend| {
            Some(SplitwiseFriend {
                id: friend.get("id")?.as_i64()?,
                first_name: friend.get("first_name")?.as_str()?.to_string(),
                last_name: friend.get("last_name")?.as_str()?.to_string(),
                email: friend.get("email")?.as_str()?.to_string(),
            })
        })
        .collect();

    tracing::info!(
        "Found {} Splitwise friends for user {}",
        friends.len(),
        user_id
    );

    Ok(Json(friends))
}

/// Map SplitwiseOAuthError to ApiError
fn map_oauth_error(error: SplitwiseOAuthError) -> ApiError {
    match error {
        SplitwiseOAuthError::ConfigurationError(msg) => ApiError::Configuration(msg),
        SplitwiseOAuthError::NetworkError(msg) => {
            ApiError::External(format!("Network error: {}", msg))
        }
        SplitwiseOAuthError::InvalidResponse(msg) => {
            ApiError::External(format!("Invalid response: {}", msg))
        }
        SplitwiseOAuthError::OAuthError(msg) => ApiError::External(format!("OAuth error: {}", msg)),
    }
}
