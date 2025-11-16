//! Authentication utilities for API integration tests.
//!
//! This module provides helpers for JWT token generation, user registration,
//! and authenticated request building for integration tests.

use axum_test::TestServer;
use master_of_coin_backend::{
    auth::jwt::{Claims, generate_token, verify_token as jwt_verify_token},
    config::JwtConfig,
    errors::ApiError,
    models::{AuthResponse, CreateUserRequest, LoginRequest, User},
};
use serde_json::json;

/// Generates a JWT token for a test user.
///
/// This function creates a valid JWT token that can be used in test requests
/// requiring authentication. The token is signed with the test JWT secret.
///
/// # Arguments
///
/// * `user` - The user to generate a token for
/// * `jwt_config` - JWT configuration (secret and expiration)
///
/// # Returns
///
/// A valid JWT token string
///
/// # Example
///
/// ```no_run
/// use integration::common::auth_helpers::generate_test_token;
/// use master_of_coin_backend::models::User;
///
/// let user = User { /* ... */ };
/// let config = /* test jwt config */;
/// let token = generate_test_token(&user, &config);
/// ```
pub fn generate_test_token(user: &User, jwt_config: &JwtConfig) -> String {
    generate_token(user, jwt_config).expect("Failed to generate test token")
}

/// Creates a test JWT configuration with a known secret.
///
/// This is useful when you need to generate tokens outside of the test server
/// context or when you need consistent JWT configuration across tests.
///
/// # Returns
///
/// A [`JwtConfig`] instance configured for testing
pub fn create_test_jwt_config() -> JwtConfig {
    // Load .env file from parent directory (same as test_server.rs does)
    dotenvy::from_filename("../.env").ok();

    let jwt_secret = std::env::var("JWT_SECRET")
        .unwrap_or_else(|_| "test_secret_key_at_least_32_characters_long_for_testing".to_string());

    JwtConfig {
        secret: jwt_secret,
        expiration_hours: 24,
    }
}

/// Verifies and decodes a JWT token for testing purposes.
///
/// This function validates the token signature and expiration,
/// ensuring the token is fully valid.
///
/// # Arguments
///
/// * `token` - The JWT token to verify
/// * `secret` - The secret key used to sign the token
///
/// # Returns
///
/// A [`Result`] containing the decoded [`Claims`] or an [`ApiError`]
pub fn decode_token(token: &str, secret: &str) -> Result<Claims, ApiError> {
    jwt_verify_token(token, secret)
}

/// Registers a new test user via the API.
///
/// This function makes an HTTP POST request to the registration endpoint
/// and returns the authentication response containing the user and token.
///
/// # Arguments
///
/// * `server` - Reference to the test server
/// * `username` - Username for the new user
/// * `email` - Email for the new user
/// * `password` - Password for the new user
/// * `name` - Display name for the new user
///
/// # Returns
///
/// An [`AuthResponse`] containing the created user and JWT token
///
/// # Example
///
/// ```no_run
/// use integration::common::auth_helpers::register_test_user;
/// use integration::common::test_server::create_test_server;
///
/// #[tokio::test]
/// async fn test_user_registration() {
///     let server = create_test_server().await;
///     let auth = register_test_user(
///         &server,
///         "testuser",
///         "test@example.com",
///         "password123",
///         "Test User"
///     ).await;
///     assert!(!auth.token.is_empty());
/// }
/// ```
pub async fn register_test_user(
    server: &TestServer,
    username: &str,
    email: &str,
    password: &str,
    name: &str,
) -> AuthResponse {
    let request = CreateUserRequest {
        username: username.to_string(),
        email: email.to_string(),
        password: password.to_string(),
        name: name.to_string(),
    };

    let response = server.post("/api/v1/auth/register").json(&request).await;

    response.json::<AuthResponse>()
}

/// Logs in a test user via the API.
///
/// This function makes an HTTP POST request to the login endpoint
/// and returns the authentication response containing the user and token.
///
/// # Arguments
///
/// * `server` - Reference to the test server
/// * `email` - Email of the user to login
/// * `password` - Password of the user
///
/// # Returns
///
/// An [`AuthResponse`] containing the user and JWT token
///
/// # Example
///
/// ```no_run
/// use integration::common::auth_helpers::{register_test_user, login_test_user};
/// use integration::common::test_server::create_test_server;
///
/// #[tokio::test]
/// async fn test_user_login() {
///     let server = create_test_server().await;
///     
///     // First register a user
///     register_test_user(&server, "testuser", "test@example.com", "password123", "Test User").await;
///     
///     // Then login
///     let auth = login_test_user(&server, "test@example.com", "password123").await;
///     assert!(!auth.token.is_empty());
/// }
/// ```
pub async fn login_test_user(server: &TestServer, email: &str, password: &str) -> AuthResponse {
    let request = LoginRequest {
        email: email.to_string(),
        password: password.to_string(),
    };

    let response = server.post("/api/v1/auth/login").json(&request).await;

    response.json::<AuthResponse>()
}

/// Creates an authorization header value with a Bearer token.
///
/// This is a convenience function to format the Authorization header
/// correctly for authenticated requests.
///
/// # Arguments
///
/// * `token` - The JWT token to include in the header
///
/// # Returns
///
/// A formatted authorization header value (e.g., "Bearer <token>")
///
/// # Example
///
/// ```no_run
/// use integration::common::auth_helpers::bearer_token;
///
/// let token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...";
/// let auth_header = bearer_token(token);
/// assert_eq!(auth_header, "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...");
/// ```
pub fn bearer_token(token: &str) -> String {
    format!("Bearer {}", token)
}

/// Registers a test user with a unique suffix.
///
/// This is useful when you need to create multiple users in a single test
/// without worrying about username/email conflicts.
///
/// # Arguments
///
/// * `server` - Reference to the test server
/// * `suffix` - Unique suffix to append to username and email
///
/// # Returns
///
/// An [`AuthResponse`] containing the created user and JWT token
///
/// # Example
///
/// ```no_run
/// use integration::common::auth_helpers::register_unique_test_user;
/// use integration::common::test_server::create_test_server;
///
/// #[tokio::test]
/// async fn test_multiple_users() {
///     let server = create_test_server().await;
///     let user1 = register_unique_test_user(&server, "1").await;
///     let user2 = register_unique_test_user(&server, "2").await;
///     assert_ne!(user1.user.id, user2.user.id);
/// }
/// ```
pub async fn register_unique_test_user(server: &TestServer, suffix: &str) -> AuthResponse {
    register_test_user(
        server,
        &format!("testuser_{}", suffix),
        &format!("test_{}@example.com", suffix),
        "password123",
        &format!("Test User {}", suffix),
    )
    .await
}

/// Creates a test user directly in the database (bypassing API).
///
/// This is useful for setting up test data quickly without going through
/// the full registration flow. Note that this requires direct database access.
///
/// # Arguments
///
/// * `conn` - Database connection
/// * `username` - Username for the new user
/// * `email` - Email for the new user
/// * `password_hash` - Pre-hashed password
/// * `name` - Display name for the new user
///
/// # Returns
///
/// The created [`User`] instance
///
/// # Example
///
/// ```no_run
/// use integration::common::auth_helpers::create_test_user_in_db;
/// use integration::common::get_test_connection;
///
/// let pool = /* get test pool */;
/// let mut conn = get_test_connection(&pool);
/// let user = create_test_user_in_db(
///     &mut conn,
///     "testuser",
///     "test@example.com",
///     "hashed_password",
///     "Test User"
/// );
/// ```
pub fn create_test_user_in_db(
    conn: &mut diesel::PgConnection,
    username: &str,
    email: &str,
    password_hash: &str,
    name: &str,
) -> User {
    use diesel::prelude::*;
    use master_of_coin_backend::models::NewUser;
    use master_of_coin_backend::schema::users;

    let new_user = NewUser {
        username: username.to_string(),
        email: email.to_string(),
        password_hash: password_hash.to_string(),
        name: name.to_string(),
    };

    diesel::insert_into(users::table)
        .values(&new_user)
        .get_result(conn)
        .expect("Failed to create test user in database")
}

/// Creates a test account via the API.
///
/// # Arguments
///
/// * `server` - Reference to the test server
/// * `token` - JWT authentication token
/// * `name` - Name for the account
///
/// # Returns
///
/// An [`AccountResponse`] containing the created account
pub async fn create_test_account(
    server: &TestServer,
    token: &str,
    name: &str,
) -> master_of_coin_backend::models::AccountResponse {
    use crate::common::request_helpers::{assert_status, extract_json, post_authenticated};

    let request = json!({
        "name": name,
        "account_type": "CHECKING",
        "currency": "USD"
    });

    let response = post_authenticated(server, "/api/v1/accounts", token, &request).await;
    assert_status(&response, 201);
    extract_json(response)
}

/// Creates a test category via the API.
///
/// # Arguments
///
/// * `server` - Reference to the test server
/// * `token` - JWT authentication token
/// * `name` - Name for the category
///
/// # Returns
///
/// A [`CategoryResponse`] containing the created category
pub async fn create_test_category(
    server: &TestServer,
    token: &str,
    name: &str,
) -> master_of_coin_backend::models::CategoryResponse {
    use crate::common::request_helpers::{assert_status, extract_json, post_authenticated};

    let request = json!({
        "name": name
    });

    let response = post_authenticated(server, "/api/v1/categories", token, &request).await;
    assert_status(&response, 201);
    extract_json(response)
}

/// Creates a test person via the API.
///
/// # Arguments
///
/// * `server` - Reference to the test server
/// * `token` - JWT authentication token
/// * `name` - Name for the person
///
/// # Returns
///
/// A [`PersonResponse`] containing the created person
pub async fn create_test_person(
    server: &TestServer,
    token: &str,
    name: &str,
) -> master_of_coin_backend::models::PersonResponse {
    use crate::common::request_helpers::{assert_status, extract_json, post_authenticated};

    let request = json!({
        "name": name
    });

    let response = post_authenticated(server, "/api/v1/people", token, &request).await;
    assert_status(&response, 201);
    extract_json(response)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_bearer_token_format() {
        let token = "test_token_123";
        let result = bearer_token(token);
        assert_eq!(result, "Bearer test_token_123");
    }

    #[test]
    fn test_create_test_jwt_config() {
        let config = create_test_jwt_config();
        assert!(config.secret.len() >= 32);
        assert_eq!(config.expiration_hours, 24);
    }
}
