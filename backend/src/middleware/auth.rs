use axum::{
    Json,
    body::Body,
    extract::{Request, State},
    http::{StatusCode, header},
    middleware::Next,
    response::{IntoResponse, Response},
};
use serde_json::json;

use crate::{auth::jwt, db::DbPool, repositories::user};

/// Authentication middleware that requires a valid JWT token
///
/// This middleware:
/// 1. Extracts the JWT token from the Authorization header
/// 2. Verifies the token signature and expiration
/// 3. Fetches the user from the database to ensure they still exist
/// 4. Adds the user to request extensions for use in handlers
///
/// # Returns
/// - `Ok(Response)` if authentication succeeds
/// - `Err(StatusCode::UNAUTHORIZED)` if authentication fails
///
/// # Security
/// - Validates Bearer token format
/// - Verifies JWT signature and expiration
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

    // Get JWT secret from environment
    let jwt_secret = std::env::var("JWT_SECRET").map_err(|_| {
        tracing::error!("JWT_SECRET not configured");
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    // Verify token
    let claims = match jwt::verify_token(token, &jwt_secret) {
        Ok(claims) => claims,
        Err(e) => {
            tracing::warn!("Token verification failed: {}", e);
            return Ok((
                StatusCode::UNAUTHORIZED,
                Json(json!({"error": "Invalid or expired token"})),
            )
                .into_response());
        }
    };

    // Fetch user from database to ensure they still exist
    let user = match user::find_by_id(&pool, claims.sub).await {
        Ok(user) => user,
        Err(e) => {
            tracing::warn!("User not found for token: {}", e);
            return Ok((
                StatusCode::UNAUTHORIZED,
                Json(json!({"error": "Invalid token: user not found"})),
            )
                .into_response());
        }
    };

    // Add user to request extensions
    req.extensions_mut().insert(user);

    // Continue to next middleware/handler
    Ok(next.run(req).await)
}
