//! Scope enforcement middleware for API key authorization.
//!
//! This middleware checks if the authenticated user has the required permissions
//! to access a resource. It works with both JWT and API key authentication:
//!
//! - JWT tokens: Always granted full access (return true from has_permission)
//! - API keys: Must have the specific scope for the resource and operation
//!
//! ## Usage
//!
//! Apply to routes that need scope checking. See the route configuration
//! in `api/routes.rs` for examples of how this middleware is used.

use axum::{Extension, extract::Request, middleware::Next, response::Response};

use crate::{
    auth::context::AuthContext,
    errors::ApiError,
    models::{OperationType, ResourceType},
};

/// Middleware to enforce scope-based authorization
///
/// This middleware checks if the authenticated user (via JWT or API key) has
/// the required permission to access a resource with a specific operation.
///
/// # Arguments
///
/// * `resource` - The resource type being accessed (e.g., Accounts, Transactions)
/// * `operation` - The operation type being performed (Read or Write)
/// * `request` - The incoming HTTP request
/// * `next` - The next middleware or handler in the chain
///
/// # Returns
///
/// * `Ok(Response)` - If permission is granted, proceeds to next handler
/// * `Err(ApiError)` - If permission is denied, returns 403 Forbidden
///
/// # Errors
///
/// Returns [`ApiError::Forbidden`] if:
/// - The user is authenticated via API key
/// - The API key does not have the required scope for the resource and operation
pub async fn require_scope(
    resource: ResourceType,
    operation: OperationType,
    Extension(auth_context): Extension<AuthContext>,
    request: Request,
    next: Next,
) -> Result<Response, ApiError> {
    // Check if the auth context has permission for this resource and operation
    if !auth_context.has_permission(resource, operation) {
        tracing::warn!(
            "Access denied: user {} attempted {:?} on {:?} without permission (API key: {})",
            auth_context.user_id(),
            operation,
            resource,
            auth_context
                .api_key_id()
                .map_or("N/A".to_string(), |id| id.to_string())
        );

        return Err(ApiError::Forbidden(format!(
            "Insufficient permissions: {:?} access to {:?} required",
            operation, resource
        )));
    }

    // Permission granted, proceed to the handler
    Ok(next.run(request).await)
}
