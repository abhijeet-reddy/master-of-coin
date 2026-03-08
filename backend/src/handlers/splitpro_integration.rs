use crate::{
    AppState, auth::context::AuthContext, errors::ApiError, models::NewSplitProvider, repositories,
    services::split_provider::SplitProProvider, utils,
};
use axum::{
    Json,
    extract::{Extension, State},
};
use serde::{Deserialize, Serialize};

/// Request to connect a SplitPro instance
#[derive(Debug, Deserialize)]
pub struct ConnectSplitProRequest {
    /// Email address of the user on SplitPro (used to look up user ID)
    pub email: String,
}

/// Response from connecting SplitPro
#[derive(Debug, Serialize)]
pub struct ConnectSplitProResponse {
    pub id: String,
    pub provider_type: String,
    pub is_active: bool,
    pub message: String,
}

/// Connect a SplitPro instance as a split provider
/// POST /api/v1/integrations/splitpro/connect
///
/// Automatically creates a long-lived session in SplitPro's database
/// using the SPLITPRO_DATABASE_URL environment variable. The user only
/// needs to provide the base URL and their email.
pub async fn connect_splitpro(
    State(state): State<AppState>,
    Extension(auth_context): Extension<AuthContext>,
    Json(request): Json<ConnectSplitProRequest>,
) -> Result<Json<ConnectSplitProResponse>, ApiError> {
    let user_id = auth_context.user_id();
    tracing::info!("Connecting SplitPro for user {}", user_id);

    // Get SplitPro base URL from environment
    let base_url = std::env::var("SPLITPRO_BASE_URL")
        .map(|u| u.trim_end_matches('/').to_string())
        .map_err(|_| {
            ApiError::Configuration(
                "SPLITPRO_BASE_URL not configured. Add it to your .env file.".to_string(),
            )
        })?;

    // Get SplitPro database URL from environment
    let splitpro_db_url = std::env::var("SPLITPRO_DATABASE_URL").map_err(|_| {
        ApiError::Configuration(
            "SPLITPRO_DATABASE_URL not configured. Add it to your .env file.".to_string(),
        )
    })?;

    // Connect to SplitPro's database directly
    tracing::info!(
        "Connecting to SplitPro database for email: {}",
        &request.email
    );
    let (splitpro_user_id, session_token) =
        create_splitpro_session(&splitpro_db_url, &request.email).await?;

    tracing::info!(
        "Created SplitPro session for user {} (SplitPro user {}), token_prefix={}",
        user_id,
        splitpro_user_id,
        &session_token[..std::cmp::min(12, session_token.len())]
    );

    // Build credentials JSON
    let credentials_json = serde_json::json!({
        "base_url": base_url,
        "session_token": session_token,
        "splitpro_user_id": splitpro_user_id,
    });

    tracing::info!(
        "Validating SplitPro credentials: base_url={}, splitpro_user_id={}, token_prefix={}",
        base_url,
        splitpro_user_id,
        &session_token[..std::cmp::min(12, session_token.len())]
    );

    // Validate credentials by calling user.me on the SplitPro instance
    let provider = SplitProProvider::new();
    use crate::services::split_provider::SplitProvider;
    let is_valid = provider
        .validate_credentials(&credentials_json)
        .await
        .map_err(|e| {
            tracing::error!("Failed to validate SplitPro credentials: {}", e);
            ApiError::External(format!("Failed to connect to SplitPro: {}", e))
        })?;

    tracing::info!(
        "SplitPro credential validation result: is_valid={}",
        is_valid
    );

    if !is_valid {
        return Err(ApiError::BadRequest(
            "Session was created but validation failed. Check that the SplitPro base URL is correct and reachable."
                .to_string(),
        ));
    }

    // Encrypt credentials
    let encrypted_credentials = utils::encrypt_credentials(&credentials_json).map_err(|e| {
        ApiError::InternalWithMessage(format!("Failed to encrypt credentials: {}", e))
    })?;

    // Store credentials as encrypted string in JSONB
    let credentials_value = serde_json::json!({
        "encrypted": encrypted_credentials
    });

    // Upsert split_provider record
    let new_provider = NewSplitProvider {
        user_id,
        provider_type: "splitpro".to_string(),
        credentials: credentials_value,
        is_active: true,
    };

    let saved_provider =
        repositories::split_provider::upsert_provider(&state.db, user_id, new_provider).await?;

    Ok(Json(ConnectSplitProResponse {
        id: saved_provider.id.to_string(),
        provider_type: "splitpro".to_string(),
        is_active: true,
        message: "SplitPro connected successfully".to_string(),
    }))
}

/// Create a long-lived session in SplitPro's database.
///
/// Connects directly to SplitPro's PostgreSQL database, looks up the user
/// by email, and creates a session that effectively never expires.
///
/// Returns (splitpro_user_id, session_token).
async fn create_splitpro_session(
    database_url: &str,
    email: &str,
) -> Result<(i64, String), ApiError> {
    use tokio_postgres::NoTls;

    // Connect to SplitPro's database
    let (client, connection) = tokio_postgres::connect(database_url, NoTls)
        .await
        .map_err(|e| {
            ApiError::External(format!(
                "Failed to connect to SplitPro database: {}. Check SPLITPRO_DATABASE_URL.",
                e
            ))
        })?;

    // Spawn the connection handler
    tokio::spawn(async move {
        if let Err(e) = connection.await {
            tracing::error!("SplitPro database connection error: {}", e);
        }
    });

    // Look up user by email
    let row = client
        .query_opt(
            r#"SELECT id FROM "User" WHERE email = $1"#,
            &[&email],
        )
        .await
        .map_err(|e| ApiError::External(format!("Failed to query SplitPro user: {}", e)))?
        .ok_or_else(|| {
            ApiError::BadRequest(format!(
                "No SplitPro user found with email '{}'. Make sure you've signed into SplitPro first.",
                email
            ))
        })?;

    let splitpro_user_id: i32 = row.get(0);

    // Generate a unique session token
    let session_id = format!("moc-session-{}", uuid::Uuid::new_v4());
    let session_token = format!("moc-{}", hex::encode(uuid::Uuid::new_v4().as_bytes()));

    // Check if we already have a session for this user from Master of Coin
    let existing = client
        .query_opt(
            r#"SELECT "id" FROM "Session" WHERE "id" LIKE 'moc-session-%' AND "userId" = $1"#,
            &[&splitpro_user_id],
        )
        .await
        .map_err(|e| ApiError::External(format!("Failed to check existing session: {}", e)))?;

    if let Some(existing_row) = existing {
        // Update existing session with new token and extended expiry
        let existing_id: String = existing_row.get(0);
        client
            .execute(
                r#"UPDATE "Session" SET "sessionToken" = $1, "expires" = '2099-12-31 23:59:59' WHERE "id" = $2"#,
                &[&session_token, &existing_id],
            )
            .await
            .map_err(|e| ApiError::External(format!("Failed to update session: {}", e)))?;

        tracing::info!(
            "Updated existing SplitPro session for user {}",
            splitpro_user_id
        );
    } else {
        // Create new session
        client
            .execute(
                r#"INSERT INTO "Session" ("id", "sessionToken", "userId", "expires") VALUES ($1, $2, $3, '2099-12-31 23:59:59')"#,
                &[&session_id, &session_token, &splitpro_user_id],
            )
            .await
            .map_err(|e| ApiError::External(format!("Failed to create session: {}", e)))?;

        tracing::info!("Created new SplitPro session for user {}", splitpro_user_id);
    }

    Ok((splitpro_user_id as i64, session_token))
}

/// List SplitPro friends for the authenticated user
/// GET /api/v1/integrations/splitpro/friends
///
/// Fetches the user's SplitPro friends list (users with balance relationships)
/// for mapping to People.
pub async fn list_splitpro_friends(
    State(state): State<AppState>,
    Extension(auth_context): Extension<AuthContext>,
) -> Result<Json<Vec<SplitProFriend>>, ApiError> {
    let user_id = auth_context.user_id();
    tracing::info!("Fetching SplitPro friends for user {}", user_id);

    // Get user's SplitPro provider
    let provider =
        repositories::split_provider::find_by_user_and_type(&state.db, user_id, "splitpro")
            .await?
            .ok_or_else(|| ApiError::NotFound("SplitPro not connected".to_string()))?;

    if !provider.is_active {
        return Err(ApiError::BadRequest(
            "SplitPro provider is inactive. Please reconnect.".to_string(),
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

    let base_url = credentials
        .get("base_url")
        .and_then(|v| v.as_str())
        .ok_or_else(|| ApiError::InternalWithMessage("Missing base_url".to_string()))?;

    let session_token = credentials
        .get("session_token")
        .and_then(|v| v.as_str())
        .ok_or_else(|| ApiError::InternalWithMessage("Missing session_token".to_string()))?;

    // Fetch friends from SplitPro via tRPC
    let http_client = reqwest::Client::new();
    let input = serde_json::json!({});
    let encoded_input = crate::services::split_provider::superjson::encode_query_input(&input, &[]);
    let url = format!(
        "{}/api/trpc/user.getFriends?input={}",
        base_url, encoded_input
    );

    // Send both cookie names to handle NextAuth HTTPS (__Secure- prefix) and HTTP configurations
    let cookie_header = format!(
        "next-auth.session-token={}; __Secure-next-auth.session-token={}",
        session_token, session_token
    );
    let response = http_client
        .get(&url)
        .header("Cookie", &cookie_header)
        .send()
        .await
        .map_err(|e| ApiError::External(format!("SplitPro API error: {}", e)))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(ApiError::External(format!(
            "SplitPro API error: HTTP {}: {}",
            status, body
        )));
    }

    let body = response
        .text()
        .await
        .map_err(|e| ApiError::External(format!("Failed to read response: {}", e)))?;

    let json_response: serde_json::Value = serde_json::from_str(&body)
        .map_err(|e| ApiError::External(format!("Invalid JSON response: {}", e)))?;

    // Decode SuperJSON response
    let data = crate::services::split_provider::superjson::decode_response(&json_response)
        .ok_or_else(|| ApiError::External("Failed to decode SplitPro response".to_string()))?;

    // Parse friends array
    let friends_array = data
        .as_array()
        .ok_or_else(|| ApiError::External("Expected array of friends from SplitPro".to_string()))?;

    let friends: Vec<SplitProFriend> = friends_array
        .iter()
        .filter_map(|friend| {
            let id = friend.get("id")?.as_i64()?;
            let name = friend
                .get("name")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            let email = friend
                .get("email")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();

            Some(SplitProFriend { id, name, email })
        })
        .collect();

    tracing::info!(
        "Found {} SplitPro friends for user {}",
        friends.len(),
        user_id
    );

    Ok(Json(friends))
}

/// SplitPro friend from the API
#[derive(Debug, Serialize, Deserialize)]
pub struct SplitProFriend {
    pub id: i64,
    pub name: String,
    pub email: String,
}
