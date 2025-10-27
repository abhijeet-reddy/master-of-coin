use axum::{body::Body, extract::Request, middleware::Next, response::Response};
use uuid::Uuid;

/// Middleware to log incoming requests and their responses
///
/// This middleware:
/// - Generates a unique request ID for each request
/// - Logs request details (method, URI, request_id)
/// - Measures request duration
/// - Logs response status and duration
pub async fn log_request(req: Request<Body>, next: Next) -> Response {
    let request_id = Uuid::new_v4();
    let method = req.method().clone();
    let uri = req.uri().clone();

    tracing::info!(
        request_id = %request_id,
        method = %method,
        uri = %uri,
        "Incoming request"
    );

    let start = std::time::Instant::now();
    let response = next.run(req).await;
    let duration = start.elapsed();

    tracing::info!(
        request_id = %request_id,
        status = response.status().as_u16(),
        duration_ms = duration.as_millis(),
        "Request completed"
    );

    response
}
