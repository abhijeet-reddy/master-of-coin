//! HTTP request builders and utilities for API integration tests.
//!
//! This module provides convenient wrapper functions for making HTTP requests
//! with proper headers, authentication, and JSON serialization/deserialization.

use axum_test::{TestResponse, TestServer};
use http::HeaderValue;
use serde::{Serialize, de::DeserializeOwned};

/// Makes an authenticated GET request to the specified path.
///
/// # Arguments
///
/// * `server` - Reference to the test server
/// * `path` - The API path to request (e.g., "/api/v1/accounts")
/// * `token` - JWT authentication token
///
/// # Returns
///
/// A [`TestResponse`] that can be used to assert status codes and extract response data
///
/// # Example
///
/// ```no_run
/// use integration::common::request_helpers::get_authenticated;
/// use integration::common::test_server::create_test_server;
///
/// #[tokio::test]
/// async fn test_get_accounts() {
///     let server = create_test_server().await;
///     let token = "valid_jwt_token";
///     let response = get_authenticated(&server, "/api/v1/accounts", token).await;
///     assert_eq!(response.status_code(), 200);
/// }
/// ```
pub async fn get_authenticated(server: &TestServer, path: &str, token: &str) -> TestResponse {
    server
        .get(path)
        .add_header(
            http::header::AUTHORIZATION,
            HeaderValue::from_str(&format!("Bearer {}", token)).unwrap(),
        )
        .await
}

/// Makes an authenticated POST request with JSON body.
///
/// # Arguments
///
/// * `server` - Reference to the test server
/// * `path` - The API path to request
/// * `token` - JWT authentication token
/// * `body` - Request body that will be serialized to JSON
///
/// # Returns
///
/// A [`TestResponse`] that can be used to assert status codes and extract response data
///
/// # Example
///
/// ```no_run
/// use integration::common::request_helpers::post_authenticated;
/// use serde_json::json;
///
/// #[tokio::test]
/// async fn test_create_account() {
///     let server = /* create test server */;
///     let token = "valid_jwt_token";
///     let body = json!({
///         "name": "Savings Account",
///         "account_type": "Savings"
///     });
///     let response = post_authenticated(&server, "/api/v1/accounts", token, &body).await;
///     assert_eq!(response.status_code(), 201);
/// }
/// ```
pub async fn post_authenticated<T: Serialize>(
    server: &TestServer,
    path: &str,
    token: &str,
    body: &T,
) -> TestResponse {
    server
        .post(path)
        .add_header(
            http::header::AUTHORIZATION,
            HeaderValue::from_str(&format!("Bearer {}", token)).unwrap(),
        )
        .json(body)
        .await
}

/// Makes an authenticated PUT request with JSON body.
///
/// # Arguments
///
/// * `server` - Reference to the test server
/// * `path` - The API path to request
/// * `token` - JWT authentication token
/// * `body` - Request body that will be serialized to JSON
///
/// # Returns
///
/// A [`TestResponse`] that can be used to assert status codes and extract response data
///
/// # Example
///
/// ```no_run
/// use integration::common::request_helpers::put_authenticated;
/// use serde_json::json;
///
/// #[tokio::test]
/// async fn test_update_account() {
///     let server = /* create test server */;
///     let token = "valid_jwt_token";
///     let body = json!({
///         "name": "Updated Account Name"
///     });
///     let response = put_authenticated(&server, "/api/v1/accounts/123", token, &body).await;
///     assert_eq!(response.status_code(), 200);
/// }
/// ```
pub async fn put_authenticated<T: Serialize>(
    server: &TestServer,
    path: &str,
    token: &str,
    body: &T,
) -> TestResponse {
    server
        .put(path)
        .add_header(
            http::header::AUTHORIZATION,
            HeaderValue::from_str(&format!("Bearer {}", token)).unwrap(),
        )
        .json(body)
        .await
}

/// Makes an authenticated DELETE request.
///
/// # Arguments
///
/// * `server` - Reference to the test server
/// * `path` - The API path to request
/// * `token` - JWT authentication token
///
/// # Returns
///
/// A [`TestResponse`] that can be used to assert status codes
///
/// # Example
///
/// ```no_run
/// use integration::common::request_helpers::delete_authenticated;
///
/// #[tokio::test]
/// async fn test_delete_account() {
///     let server = /* create test server */;
///     let token = "valid_jwt_token";
///     let response = delete_authenticated(&server, "/api/v1/accounts/123", token).await;
///     assert_eq!(response.status_code(), 204);
/// }
/// ```
pub async fn delete_authenticated(server: &TestServer, path: &str, token: &str) -> TestResponse {
    server
        .delete(path)
        .add_header(
            http::header::AUTHORIZATION,
            HeaderValue::from_str(&format!("Bearer {}", token)).unwrap(),
        )
        .await
}

/// Makes an unauthenticated GET request.
///
/// # Arguments
///
/// * `server` - Reference to the test server
/// * `path` - The API path to request
///
/// # Returns
///
/// A [`TestResponse`] that can be used to assert status codes and extract response data
///
/// # Example
///
/// ```no_run
/// use integration::common::request_helpers::get_unauthenticated;
///
/// #[tokio::test]
/// async fn test_public_endpoint() {
///     let server = /* create test server */;
///     let response = get_unauthenticated(&server, "/api/v1/health").await;
///     assert_eq!(response.status_code(), 200);
/// }
/// ```
pub async fn get_unauthenticated(server: &TestServer, path: &str) -> TestResponse {
    server.get(path).await
}

/// Makes an unauthenticated POST request with JSON body.
///
/// This is useful for testing public endpoints like registration and login.
///
/// # Arguments
///
/// * `server` - Reference to the test server
/// * `path` - The API path to request
/// * `body` - Request body that will be serialized to JSON
///
/// # Returns
///
/// A [`TestResponse`] that can be used to assert status codes and extract response data
///
/// # Example
///
/// ```no_run
/// use integration::common::request_helpers::post_unauthenticated;
/// use serde_json::json;
///
/// #[tokio::test]
/// async fn test_register() {
///     let server = /* create test server */;
///     let body = json!({
///         "username": "newuser",
///         "email": "new@example.com",
///         "password": "password123",
///         "name": "New User"
///     });
///     let response = post_unauthenticated(&server, "/api/v1/auth/register", &body).await;
///     assert_eq!(response.status_code(), 201);
/// }
/// ```
pub async fn post_unauthenticated<T: Serialize>(
    server: &TestServer,
    path: &str,
    body: &T,
) -> TestResponse {
    server.post(path).json(body).await
}

/// Extracts and deserializes JSON response body.
///
/// This is a convenience wrapper around the TestResponse json() method
/// with better error messages for debugging.
///
/// # Arguments
///
/// * `response` - The test response to extract JSON from
///
/// # Returns
///
/// The deserialized response body
///
/// # Panics
///
/// Panics if the response body cannot be deserialized to the target type
///
/// # Example
///
/// ```no_run
/// use integration::common::request_helpers::{get_authenticated, extract_json};
/// use serde::Deserialize;
///
/// #[derive(Deserialize)]
/// struct Account {
///     id: String,
///     name: String,
/// }
///
/// #[tokio::test]
/// async fn test_get_account() {
///     let server = /* create test server */;
///     let token = "valid_jwt_token";
///     let response = get_authenticated(&server, "/api/v1/accounts/123", token).await;
///     let account: Account = extract_json(response);
///     assert_eq!(account.name, "Test Account");
/// }
/// ```
pub fn extract_json<T: DeserializeOwned>(response: TestResponse) -> T {
    response.json::<T>()
}

/// Asserts that a response has the expected status code.
///
/// This provides a more descriptive error message than a simple assert_eq!
/// by including the response body in the error output.
///
/// # Arguments
///
/// * `response` - The test response to check
/// * `expected_status` - The expected HTTP status code
///
/// # Panics
///
/// Panics if the status code doesn't match, with a detailed error message
///
/// # Example
///
/// ```no_run
/// use integration::common::request_helpers::{get_authenticated, assert_status};
///
/// #[tokio::test]
/// async fn test_endpoint() {
///     let server = /* create test server */;
///     let token = "valid_jwt_token";
///     let response = get_authenticated(&server, "/api/v1/accounts", token).await;
///     assert_status(&response, 200);
/// }
/// ```
pub fn assert_status(response: &TestResponse, expected_status: u16) {
    let actual_status = response.status_code();
    if actual_status != expected_status {
        panic!(
            "Expected status {}, got {}. Response body: {:?}",
            expected_status,
            actual_status,
            response.text()
        );
    }
}

/// Asserts that a response is successful (2xx status code).
///
/// # Arguments
///
/// * `response` - The test response to check
///
/// # Panics
///
/// Panics if the status code is not in the 2xx range
///
/// # Example
///
/// ```no_run
/// use integration::common::request_helpers::{post_authenticated, assert_success};
///
/// #[tokio::test]
/// async fn test_create_resource() {
///     let server = /* create test server */;
///     let token = "valid_jwt_token";
///     let response = post_authenticated(&server, "/api/v1/accounts", token, &body).await;
///     assert_success(&response);
/// }
/// ```
pub fn assert_success(response: &TestResponse) {
    let status = response.status_code();
    if !(200..300).contains(&status.as_u16()) {
        panic!(
            "Expected success status (2xx), got {}. Response body: {:?}",
            status,
            response.text()
        );
    }
}

/// Asserts that a response is an error (4xx or 5xx status code).
///
/// # Arguments
///
/// * `response` - The test response to check
///
/// # Panics
///
/// Panics if the status code is not in the 4xx or 5xx range
///
/// # Example
///
/// ```no_run
/// use integration::common::request_helpers::{get_authenticated, assert_error};
///
/// #[tokio::test]
/// async fn test_unauthorized_access() {
///     let server = /* create test server */;
///     let response = get_authenticated(&server, "/api/v1/accounts", "invalid_token").await;
///     assert_error(&response);
/// }
/// ```
pub fn assert_error(response: &TestResponse) {
    let status = response.status_code();
    if status.as_u16() < 400 {
        panic!(
            "Expected error status (4xx or 5xx), got {}. Response body: {:?}",
            status,
            response.text()
        );
    }
}
