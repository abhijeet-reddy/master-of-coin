//! Error handling for the API.
//!
//! This module defines the error types used throughout the application and implements
//! conversion to HTTP responses with appropriate status codes and error messages.
//!
//! ## Error Types
//!
//! - [`ApiError::Database`]: Database operation errors (Diesel errors)
//! - [`ApiError::NotFound`]: Resource not found errors (404)
//! - [`ApiError::Unauthorized`]: Authentication/authorization errors (401)
//! - [`ApiError::Validation`]: Input validation errors (400)
//! - [`ApiError::Conflict`]: Resource conflict errors (409)
//! - [`ApiError::Internal`]: Internal server errors (500)
//!
//! All errors are automatically logged with appropriate severity levels and
//! converted to JSON responses for the client.

use axum::Json;
use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use serde::Serialize;
use tracing::error;

/// API error types with automatic HTTP response conversion
#[derive(Debug, thiserror::Error)]
pub enum ApiError {
    #[error("Database error: {0}")]
    Database(#[from] diesel::result::Error),

    #[error("Not found: {0}")]
    NotFound(String),

    #[error("Unauthorized: {0}")]
    Unauthorized(String),

    #[error("Validation error: {0}")]
    Validation(String),

    #[error("Conflict: {0}")]
    Conflict(String),

    #[error("Internal server error")]
    Internal,
}

/// Error response structure for JSON responses
#[derive(Debug, Serialize)]
pub struct ErrorResponse {
    pub error: String,
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        let (status, error_message) = match &self {
            ApiError::Database(e) => {
                error!("Database error: {:?}", e);
                match e {
                    diesel::result::Error::NotFound => {
                        (StatusCode::NOT_FOUND, "Resource not found".to_string())
                    }
                    _ => (
                        StatusCode::INTERNAL_SERVER_ERROR,
                        "An internal database error occurred".to_string(),
                    ),
                }
            }
            ApiError::NotFound(msg) => {
                tracing::warn!("Not found: {}", msg);
                (StatusCode::NOT_FOUND, msg.clone())
            }
            ApiError::Unauthorized(msg) => {
                tracing::warn!("Unauthorized: {}", msg);
                (StatusCode::UNAUTHORIZED, msg.clone())
            }
            ApiError::Validation(msg) => {
                tracing::warn!("Validation error: {}", msg);
                (StatusCode::BAD_REQUEST, msg.clone())
            }
            ApiError::Conflict(msg) => {
                tracing::warn!("Conflict: {}", msg);
                (StatusCode::CONFLICT, msg.clone())
            }
            ApiError::Internal => {
                error!("Internal server error");
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "Internal server error".to_string(),
                )
            }
        };

        let body = Json(ErrorResponse {
            error: error_message,
        });

        (status, body).into_response()
    }
}

/// Result type alias for API operations
pub type ApiResult<T> = Result<T, ApiError>;
