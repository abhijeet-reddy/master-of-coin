use axum::{
    body::Body,
    extract::{Request, State},
    http::{StatusCode, header},
    middleware::Next,
    response::Response,
};

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
            return Err(StatusCode::UNAUTHORIZED);
        }
    };

    // Extract Bearer token
    let token = match auth_header.strip_prefix("Bearer ") {
        Some(token) => token,
        None => {
            tracing::warn!("Invalid Authorization header format");
            return Err(StatusCode::UNAUTHORIZED);
        }
    };

    // Get JWT secret from environment
    let jwt_secret = std::env::var("JWT_SECRET").map_err(|_| {
        tracing::error!("JWT_SECRET not configured");
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    // Verify token
    let claims = jwt::verify_token(token, &jwt_secret).map_err(|e| {
        tracing::warn!("Token verification failed: {}", e);
        StatusCode::UNAUTHORIZED
    })?;

    // Fetch user from database to ensure they still exist
    let user = user::find_by_id(&pool, claims.sub).await.map_err(|e| {
        tracing::warn!("User not found for token: {}", e);
        StatusCode::UNAUTHORIZED
    })?;

    // Add user to request extensions
    req.extensions_mut().insert(user);

    // Continue to next middleware/handler
    Ok(next.run(req).await)
}
