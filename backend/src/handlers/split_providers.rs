use crate::{
    AppState, auth::context::AuthContext, errors::ApiError, models::SplitProviderResponse,
    repositories, utils,
};
use axum::{
    Json,
    extract::{Extension, Path, State},
    http::StatusCode,
};
use serde::Serialize;
use uuid::Uuid;

/// List all configured split providers for the authenticated user
/// GET /api/integrations/providers
pub async fn list_providers(
    State(state): State<AppState>,
    Extension(auth_context): Extension<AuthContext>,
) -> Result<Json<Vec<SplitProviderResponse>>, ApiError> {
    let user_id = auth_context.user_id();
    tracing::info!("Listing split providers for user {}", user_id);

    let providers = repositories::split_provider::list_by_user(&state.db, user_id).await?;

    let responses: Vec<SplitProviderResponse> = providers.into_iter().map(|p| p.into()).collect();

    Ok(Json(responses))
}

/// Disconnect a split provider
/// DELETE /api/integrations/providers/:id
///
/// Deletes the provider configuration. This will cascade delete:
/// - All person_split_configs using this provider
/// - All split_sync_records using this provider
pub async fn disconnect_provider(
    State(state): State<AppState>,
    Extension(auth_context): Extension<AuthContext>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, ApiError> {
    let user_id = auth_context.user_id();
    tracing::info!("Disconnecting provider {} for user {}", id, user_id);

    repositories::split_provider::delete_provider(&state.db, id, user_id).await?;

    tracing::info!(
        "Successfully disconnected provider {} for user {}",
        id,
        user_id
    );

    Ok(StatusCode::NO_CONTENT)
}

/// Splitwise friend response
#[derive(Debug, Serialize)]
pub struct SplitwiseFriendResponse {
    pub id: i64,
    pub first_name: String,
    pub last_name: String,
    pub email: String,
    pub full_name: String,
}

/// Get friends from a specific provider
/// GET /api/integrations/providers/:id/friends
///
/// Currently only supports Splitwise. Returns list of friends from the provider.
pub async fn get_provider_friends(
    State(state): State<AppState>,
    Extension(auth_context): Extension<AuthContext>,
    Path(provider_id): Path<Uuid>,
) -> Result<Json<Vec<SplitwiseFriendResponse>>, ApiError> {
    let user_id = auth_context.user_id();
    tracing::info!(
        "Fetching friends from provider {} for user {}",
        provider_id,
        user_id
    );

    // Get provider and verify ownership
    let provider = repositories::split_provider::find_by_id(&state.db, provider_id)
        .await?
        .ok_or_else(|| ApiError::NotFound("Provider not found".to_string()))?;

    if provider.user_id != user_id {
        return Err(ApiError::Forbidden(
            "Provider does not belong to user".to_string(),
        ));
    }

    if !provider.is_active {
        return Err(ApiError::BadRequest(
            "Provider is inactive. Please reconnect.".to_string(),
        ));
    }

    // Decrypt credentials
    let encrypted = provider
        .credentials
        .get("encrypted")
        .and_then(|v| v.as_str())
        .ok_or_else(|| ApiError::InternalWithMessage("Invalid credentials format".to_string()))?;

    let credentials = utils::decrypt_credentials(encrypted)
        .map_err(|e| ApiError::InternalWithMessage(format!("Failed to decrypt credentials: {}", e)))?;

    // Get access token
    let access_token = credentials
        .get("access_token")
        .and_then(|v| v.as_str())
        .ok_or_else(|| ApiError::InternalWithMessage("Missing access_token".to_string()))?;

    // Fetch friends based on provider type
    match provider.provider_type.as_str() {
        "splitwise" => fetch_splitwise_friends(access_token).await,
        _ => Err(ApiError::BadRequest(format!(
            "Provider type '{}' not supported",
            provider.provider_type
        ))),
    }
}

/// Fetch friends from Splitwise API
async fn fetch_splitwise_friends(
    access_token: &str,
) -> Result<Json<Vec<SplitwiseFriendResponse>>, ApiError> {
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
    let friends: Vec<SplitwiseFriendResponse> = friends_array
        .iter()
        .filter_map(|friend| {
            let id = friend.get("id")?.as_i64()?;
            let first_name = friend.get("first_name")?.as_str()?.to_string();
            let last_name = friend.get("last_name")?.as_str()?.to_string();
            let email = friend.get("email")?.as_str()?.to_string();
            let full_name = format!("{} {}", first_name, last_name);

            Some(SplitwiseFriendResponse {
                id,
                first_name,
                last_name,
                email,
                full_name,
            })
        })
        .collect();

    tracing::info!("Found {} Splitwise friends", friends.len());

    Ok(Json(friends))
}
