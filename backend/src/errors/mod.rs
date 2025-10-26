use axum::Json;
use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use serde_json::json;
use tracing::error;

/// Comprehensive error types for the API
#[derive(Debug)]
pub enum ApiError {
    /// Database-related errors
    DatabaseError(diesel::result::Error),
    /// Connection pool errors
    PoolError(diesel::r2d2::Error),
    /// Resource not found
    NotFound(String),
    /// Bad request with validation or parsing errors
    BadRequest(String),
    /// Unauthorized access
    Unauthorized(String),
    /// Internal server error
    InternalServerError(String),
    /// Validation error
    ValidationError(String),
}

impl std::fmt::Display for ApiError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ApiError::DatabaseError(e) => write!(f, "Database error: {}", e),
            ApiError::PoolError(e) => write!(f, "Connection pool error: {}", e),
            ApiError::NotFound(msg) => write!(f, "Not found: {}", msg),
            ApiError::BadRequest(msg) => write!(f, "Bad request: {}", msg),
            ApiError::Unauthorized(msg) => write!(f, "Unauthorized: {}", msg),
            ApiError::InternalServerError(msg) => write!(f, "Internal server error: {}", msg),
            ApiError::ValidationError(msg) => write!(f, "Validation error: {}", msg),
        }
    }
}

impl std::error::Error for ApiError {}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        let (status, error_message) = match &self {
            ApiError::DatabaseError(e) => {
                error!("Database error: {:?}", e);
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "An internal database error occurred".to_string(),
                )
            }
            ApiError::PoolError(e) => {
                error!("Connection pool error: {:?}", e);
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "Database connection error".to_string(),
                )
            }
            ApiError::NotFound(msg) => {
                tracing::warn!("Not found: {}", msg);
                (StatusCode::NOT_FOUND, msg.clone())
            }
            ApiError::BadRequest(msg) => {
                tracing::warn!("Bad request: {}", msg);
                (StatusCode::BAD_REQUEST, msg.clone())
            }
            ApiError::Unauthorized(msg) => {
                tracing::warn!("Unauthorized: {}", msg);
                (StatusCode::UNAUTHORIZED, msg.clone())
            }
            ApiError::InternalServerError(msg) => {
                error!("Internal server error: {}", msg);
                (StatusCode::INTERNAL_SERVER_ERROR, msg.clone())
            }
            ApiError::ValidationError(msg) => {
                tracing::warn!("Validation error: {}", msg);
                (StatusCode::BAD_REQUEST, msg.clone())
            }
        };

        let body = Json(json!({
            "error": error_message,
        }));

        (status, body).into_response()
    }
}

impl From<diesel::result::Error> for ApiError {
    fn from(error: diesel::result::Error) -> Self {
        match error {
            diesel::result::Error::NotFound => ApiError::NotFound("Resource not found".to_string()),
            _ => ApiError::DatabaseError(error),
        }
    }
}

impl From<diesel::r2d2::Error> for ApiError {
    fn from(error: diesel::r2d2::Error) -> Self {
        ApiError::PoolError(error)
    }
}

/// Result type alias for API operations
pub type ApiResult<T> = Result<T, ApiError>;
