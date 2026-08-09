//! Health check handler for container health monitoring.
//!
//! Provides a lightweight endpoint that verifies the server process is alive
//! and can reach the database. Used by Docker health checks and load balancers.

use axum::{Json, extract::State, http::StatusCode};
use serde_json::Value;

use crate::AppState;

/// Health check handler — verifies the server can obtain a DB connection.
///
/// Returns 200 OK with `{"status": "healthy"}` if the DB pool is reachable,
/// or 503 Service Unavailable with `{"status": "unhealthy", "error": "..."}` otherwise.
///
/// Deliberately does NOT report the build version: this endpoint is public
/// (outside `/api/v1` auth), and the repo is public, so exposing the commit sha
/// here would point anyone at the exact deployed source. Version/commit live on
/// the authenticated `GET /api/v1/version` route instead (issue #83).
pub async fn check(State(state): State<AppState>) -> (StatusCode, Json<Value>) {
    match state.db.get() {
        Ok(_conn) => (
            StatusCode::OK,
            Json(serde_json::json!({
                "status": "healthy",
                "service": "server"
            })),
        ),
        Err(e) => (
            StatusCode::SERVICE_UNAVAILABLE,
            Json(serde_json::json!({
                "status": "unhealthy",
                "service": "server",
                "error": e.to_string()
            })),
        ),
    }
}
