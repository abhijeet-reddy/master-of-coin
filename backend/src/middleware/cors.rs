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
    use axum::http::header::{ACCEPT, AUTHORIZATION, CONTENT_TYPE};

    // For development, allow localhost origins
    // In production, this should be configured via environment variables
    let allowed_origins = [
        "http://localhost:3000".parse().unwrap(),
        "http://127.0.0.1:3000".parse().unwrap(),
    ];

    CorsLayer::new()
        .allow_origin(allowed_origins)
        .allow_methods([
            Method::GET,
            Method::POST,
            Method::PUT,
            Method::DELETE,
            Method::OPTIONS,
        ])
        .allow_headers([AUTHORIZATION, CONTENT_TYPE, ACCEPT])
        .allow_credentials(true)
}
