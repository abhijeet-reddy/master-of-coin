use axum::{
    Json,
    body::Body,
    extract::{Request, State},
    http::{StatusCode, header},
    middleware::Next,
    response::{IntoResponse, Response},
};
use serde_json::json;

use crate::{
    auth::{context::AuthContext, jwt},
    db::DbPool,
    repositories::user,
    services::api_key_service,
};

/// Authentication middleware that supports both JWT tokens and API keys
///
/// This middleware:
/// 1. Extracts the Bearer token from the Authorization header
/// 2. Determines if it's a JWT token or API key based on prefix
/// 3. Verifies the token/key and fetches the user
/// 4. Adds AuthContext to request extensions for use in handlers
///
/// # Returns
/// - `Ok(Response)` if authentication succeeds
/// - Error response if authentication fails
///
/// # Security
/// - Validates Bearer token format
/// - Verifies JWT signature/expiration or API key hash/status
/// - Ensures user still exists in database
/// - Logs authentication failures for security monitoring
pub async fn require_auth(
    State(pool): State<DbPool>,
    mut req: Request<Body>,
    next: Next,
) -> Result<Response, StatusCode> {
    // Extract Authorization header
    let auth_header = req
        .headers()
        .get(header::AUTHORIZATION)
        .and_then(|h| h.to_str().ok());

    let auth_header = match auth_header {
        Some(header) => header,
        None => {
            tracing::warn!("Missing Authorization header");
            return Ok((
                StatusCode::UNAUTHORIZED,
                Json(json!({"error": "Missing authentication token"})),
            )
                .into_response());
        }
    };

    // Extract Bearer token
    let token = match auth_header.strip_prefix("Bearer ") {
        Some(token) => token,
        None => {
            tracing::warn!("Invalid Authorization header format");
            return Ok((
                StatusCode::UNAUTHORIZED,
                Json(json!({"error": "Invalid authorization header format"})),
            )
                .into_response());
        }
    };

    // Determine authentication type and create AuthContext
    let auth_context = if token.starts_with("moc_") {
        // API Key authentication
        authenticate_with_api_key(&pool, token).await?
    } else {
        // JWT authentication
        authenticate_with_jwt(&pool, token).await?
    };

    // Add AuthContext to request extensions
    req.extensions_mut().insert(auth_context);

    // Continue to next middleware/handler
    Ok(next.run(req).await)
}

/// Authenticate with JWT token
async fn authenticate_with_jwt(pool: &DbPool, token: &str) -> Result<AuthContext, StatusCode> {
    // Get JWT secret from environment
    let jwt_secret = std::env::var("JWT_SECRET").map_err(|_| {
        tracing::error!("JWT_SECRET not configured");
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    // Verify token
    let claims = match jwt::verify_token(token, &jwt_secret) {
        Ok(claims) => claims,
        Err(e) => {
            tracing::warn!("JWT verification failed: {}", e);
            return Err(StatusCode::UNAUTHORIZED);
        }
    };

    // Fetch user from database
    let user = match user::find_by_id(pool, claims.sub).await {
        Ok(user) => user,
        Err(e) => {
            tracing::warn!("User not found for JWT: {}", e);
            return Err(StatusCode::UNAUTHORIZED);
        }
    };

    Ok(AuthContext::Jwt { user })
}

/// Authenticate with API key
async fn authenticate_with_api_key(
    pool: &DbPool,
    api_key: &str,
) -> Result<AuthContext, StatusCode> {
    // Verify API key and get user + scopes
    let (api_key_record, scopes) = match api_key_service::verify_and_get_key(pool, api_key).await {
        Ok(result) => result,
        Err(e) => {
            tracing::warn!("API key verification failed: {}", e);
            return Err(StatusCode::UNAUTHORIZED);
        }
    };

    // Fetch user from database
    let user = match user::find_by_id(pool, api_key_record.user_id).await {
        Ok(user) => user,
        Err(e) => {
            tracing::warn!("User not found for API key: {}", e);
            return Err(StatusCode::UNAUTHORIZED);
        }
    };

    Ok(AuthContext::ApiKey {
        user,
        api_key_id: api_key_record.id,
        scopes,
    })
}
