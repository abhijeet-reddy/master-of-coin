use axum::{body::Body, extract::Request, middleware::Next, response::Response};
use tracing::Instrument;
use uuid::Uuid;

/// Middleware to log incoming requests and their responses
///
/// This middleware:
/// - Generates a unique request ID for each request
/// - Creates a tracing span that propagates the request_id to all logs within the request
/// - Logs request details (method, URI, request_id)
/// - Measures request duration
/// - Logs response status and duration
pub async fn log_request(req: Request<Body>, next: Next) -> Response {
    let request_id = Uuid::new_v4();
    let method = req.method().clone();
    let uri = req.uri().clone();

    // Create a span that will propagate request_id to all logs within this request
    let span = tracing::info_span!(
        "request",
        request_id = %request_id,
        method = %method,
        uri = %uri,
    );

    // Enter the span for the entire request lifecycle
    async move {
        tracing::info!("Incoming request");

        let start = std::time::Instant::now();
        let response = next.run(req).await;
        let duration = start.elapsed();

        tracing::info!(
            status = response.status().as_u16(),
            duration_ms = duration.as_millis(),
            "Request completed"
        );

        response
    }
    .instrument(span)
    .await
}
