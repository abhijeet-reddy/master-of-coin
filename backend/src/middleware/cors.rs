use axum::http::Method;
use tower_http::cors::{Any, CorsLayer};

/// Creates a CORS layer for the application
///
/// This configuration:
/// - Allows all origins (should be restricted in production)
/// - Allows common HTTP methods (GET, POST, PUT, DELETE, OPTIONS)
/// - Allows all headers
/// - Allows credentials (cookies, authorization headers)
///
/// # Production Considerations
///
/// In production, you should:
/// - Restrict allowed origins to specific domains
/// - Use environment variables to configure allowed origins
/// - Consider using `allow_origin()` with specific origins instead of `Any`
pub fn create_cors_layer() -> CorsLayer {
    CorsLayer::new()
        .allow_origin(Any) // TODO: Restrict in production using environment variables
        .allow_methods([
            Method::GET,
            Method::POST,
            Method::PUT,
            Method::DELETE,
            Method::OPTIONS,
        ])
        .allow_headers(Any)
        .allow_credentials(true)
}
