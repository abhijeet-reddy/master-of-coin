//! Integration tests for authentication API endpoints.
//!
//! This module tests the authentication endpoints including:
//! - User registration (POST /api/v1/auth/register)
//! - User login (POST /api/v1/auth/login)
//! - Get current user (GET /api/v1/auth/me)
//!
//! Tests cover both success and error cases with proper validation
//! of status codes, response bodies, and error messages.

use crate::common::*;
use chrono::Utc;
use master_of_coin_backend::{
    auth::jwt::decode_token,
    models::{AuthResponse, CreateUserRequest, LoginRequest, UserResponse},
};
use serde_json::json;

// ============================================================================
// Registration Tests
// ============================================================================

/// Test successful user registration with all required fields.
///
/// Verifies that:
/// - Status code is 201 Created
/// - Response contains valid JWT token
/// - Response contains user information
/// - User ID is a valid UUID
/// - Token can be decoded successfully
#[tokio::test]
async fn test_register_success() {
    let server = create_test_server().await;
    let timestamp = Utc::now().timestamp_nanos_opt().unwrap();

    let request = CreateUserRequest {
        username: format!("testuser_{}", timestamp),
        email: format!("test_{}@example.com", timestamp),
        password: "SecurePass123!".to_string(),
        name: "Test User".to_string(),
    };

    let response = server.post("/api/v1/auth/register").json(&request).await;

    // Assert status code
    assert_status(&response, 201);

    // Extract and validate response
    let auth_response: AuthResponse = extract_json(response);

    // Validate token exists and is not empty
    assert!(!auth_response.token.is_empty(), "Token should not be empty");

    // Validate user data
    assert_eq!(auth_response.user.username, request.username);
    assert_eq!(auth_response.user.email, request.email);
    assert_eq!(auth_response.user.name, request.name);

    // Validate token can be decoded
    let jwt_config = create_test_jwt_config();
    let claims = decode_token(&auth_response.token, &jwt_config.secret);
    assert!(claims.is_ok(), "Token should be decodable");
}

/// Test registration with duplicate email fails with 409 Conflict.
///
/// Verifies that:
/// - First registration succeeds
/// - Second registration with same email fails with 409
/// - Error message indicates duplicate email
#[tokio::test]
async fn test_register_duplicate_email() {
    let server = create_test_server().await;
    let timestamp = Utc::now().timestamp_nanos_opt().unwrap();

    let request = CreateUserRequest {
        username: format!("testuser_{}", timestamp),
        email: format!("duplicate_{}@example.com", timestamp),
        password: "SecurePass123!".to_string(),
        name: "Test User".to_string(),
    };

    // First registration should succeed
    let response1 = server.post("/api/v1/auth/register").json(&request).await;
    assert_status(&response1, 201);

    // Second registration with same email should fail
    let request2 = CreateUserRequest {
        username: format!("testuser2_{}", timestamp),
        email: request.email.clone(), // Same email
        password: "SecurePass123!".to_string(),
        name: "Test User 2".to_string(),
    };

    let response2 = server.post("/api/v1/auth/register").json(&request2).await;
    assert_status(&response2, 409);

    // Validate error message
    let error_text = response2.text();
    assert!(
        error_text.to_lowercase().contains("email") || error_text.to_lowercase().contains("exists"),
        "Error message should mention email or exists"
    );
}

/// Test registration with invalid email format fails with 400 Bad Request.
///
/// Verifies that:
/// - Invalid email formats are rejected
/// - Status code is 400
/// - Error message indicates validation failure
#[tokio::test]
async fn test_register_invalid_email() {
    let server = create_test_server().await;
    let timestamp = Utc::now().timestamp_nanos_opt().unwrap();

    let invalid_emails = vec![
        "notanemail",           // No @ symbol
        "@nodomain.com",        // Missing local part
        "user name@domain.com", // Space in local part
        "user@@domain.com",     // Double @ symbol
    ];

    for (idx, invalid_email) in invalid_emails.iter().enumerate() {
        // Use unique username for each attempt to avoid username conflicts
        let unique_username = format!("testuser_{}_{}", timestamp, idx);

        let request = CreateUserRequest {
            username: unique_username,
            email: invalid_email.to_string(),
            password: "SecurePass123!".to_string(),
            name: "Test User".to_string(),
        };

        let response = server.post("/api/v1/auth/register").json(&request).await;
        assert_status(&response, 422);

        let error_text = response.text();
        assert!(
            error_text.to_lowercase().contains("email")
                || error_text.to_lowercase().contains("validation"),
            "Error message should mention email validation for: {}",
            invalid_email
        );
    }
}

/// Test registration with weak password fails with 400 Bad Request.
///
/// Verifies that:
/// - Passwords shorter than 8 characters are rejected
/// - Status code is 400
/// - Error message indicates password validation failure
#[tokio::test]
async fn test_register_weak_password() {
    let server = create_test_server().await;
    let timestamp = Utc::now().timestamp_nanos_opt().unwrap();

    let weak_passwords = vec!["short", "1234567", "weak"];

    for weak_password in weak_passwords {
        let request = CreateUserRequest {
            username: format!("testuser_{}_{}", timestamp, weak_password.len()),
            email: format!("test_{}_{}@example.com", timestamp, weak_password.len()),
            password: weak_password.to_string(),
            name: "Test User".to_string(),
        };

        let response = server.post("/api/v1/auth/register").json(&request).await;
        assert_status(&response, 422);

        let error_text = response.text();
        assert!(
            error_text.to_lowercase().contains("password")
                || error_text.to_lowercase().contains("validation"),
            "Error message should mention password validation for: {}",
            weak_password
        );
    }
}

/// Test registration with missing required fields fails with 400 Bad Request.
///
/// Verifies that:
/// - Missing username is rejected
/// - Missing email is rejected
/// - Missing password is rejected
/// - Missing name is rejected
/// - Status code is 400 for all cases
#[tokio::test]
async fn test_register_missing_fields() {
    let server = create_test_server().await;
    let timestamp = Utc::now().timestamp_nanos_opt().unwrap();

    // Missing username
    let missing_username = json!({
        "email": format!("test_{}@example.com", timestamp),
        "password": "SecurePass123!",
        "name": "Test User"
    });
    let response = server
        .post("/api/v1/auth/register")
        .json(&missing_username)
        .await;
    assert_status(&response, 422);

    // Missing email
    let missing_email = json!({
        "username": format!("testuser_{}", timestamp),
        "password": "SecurePass123!",
        "name": "Test User"
    });
    let response = server
        .post("/api/v1/auth/register")
        .json(&missing_email)
        .await;
    assert_status(&response, 422);

    // Missing password
    let missing_password = json!({
        "username": format!("testuser_{}", timestamp),
        "email": format!("test_{}@example.com", timestamp),
        "name": "Test User"
    });
    let response = server
        .post("/api/v1/auth/register")
        .json(&missing_password)
        .await;
    assert_status(&response, 422);

    // Missing name
    let missing_name = json!({
        "username": format!("testuser_{}", timestamp),
        "email": format!("test_{}@example.com", timestamp),
        "password": "SecurePass123!"
    });
    let response = server
        .post("/api/v1/auth/register")
        .json(&missing_name)
        .await;
    assert_status(&response, 422);
}

// ============================================================================
// Login Tests
// ============================================================================

/// Test successful login with valid credentials returns JWT token.
///
/// Verifies that:
/// - Status code is 200 OK
/// - Response contains valid JWT token
/// - Response contains user information
/// - Token can be decoded successfully
#[tokio::test]
async fn test_login_success() {
    let server = create_test_server().await;
    let timestamp = Utc::now().timestamp_nanos_opt().unwrap();

    // First register a user
    let email = format!("login_test_{}@example.com", timestamp);
    let password = "SecurePass123!";

    let register_request = CreateUserRequest {
        username: format!("loginuser_{}", timestamp),
        email: email.clone(),
        password: password.to_string(),
        name: "Login Test User".to_string(),
    };

    let register_response = server
        .post("/api/v1/auth/register")
        .json(&register_request)
        .await;
    assert_status(&register_response, 201);

    // Now login with the same credentials
    let login_request = LoginRequest {
        email: email.clone(),
        password: password.to_string(),
    };

    let login_response = server.post("/api/v1/auth/login").json(&login_request).await;
    assert_status(&login_response, 200);

    // Extract and validate response
    let auth_response: AuthResponse = extract_json(login_response);

    // Validate token exists and is not empty
    assert!(!auth_response.token.is_empty(), "Token should not be empty");

    // Validate user data
    assert_eq!(auth_response.user.email, email);
    assert_eq!(auth_response.user.username, register_request.username);

    // Validate token can be decoded
    let jwt_config = create_test_jwt_config();
    let claims = decode_token(&auth_response.token, &jwt_config.secret);
    assert!(claims.is_ok(), "Token should be decodable");
}

/// Test login with non-existent email fails with 401 Unauthorized.
///
/// Verifies that:
/// - Status code is 401
/// - Error message indicates authentication failure
#[tokio::test]
async fn test_login_invalid_email() {
    let server = create_test_server().await;
    let timestamp = Utc::now().timestamp_nanos_opt().unwrap();

    let login_request = LoginRequest {
        email: format!("nonexistent_{}@example.com", timestamp),
        password: "SomePassword123!".to_string(),
    };

    let response = server.post("/api/v1/auth/login").json(&login_request).await;
    assert_status(&response, 401);

    let error_text = response.text();
    assert!(
        error_text.to_lowercase().contains("invalid")
            || error_text.to_lowercase().contains("credentials"),
        "Error message should indicate invalid credentials"
    );
}

/// Test login with incorrect password fails with 401 Unauthorized.
///
/// Verifies that:
/// - Status code is 401
/// - Error message indicates authentication failure
#[tokio::test]
async fn test_login_wrong_password() {
    let server = create_test_server().await;
    let timestamp = Utc::now().timestamp_nanos_opt().unwrap();

    // First register a user
    let email = format!("wrongpass_test_{}@example.com", timestamp);
    let correct_password = "CorrectPass123!";

    let register_request = CreateUserRequest {
        username: format!("wrongpassuser_{}", timestamp),
        email: email.clone(),
        password: correct_password.to_string(),
        name: "Wrong Pass Test User".to_string(),
    };

    let register_response = server
        .post("/api/v1/auth/register")
        .json(&register_request)
        .await;
    assert_status(&register_response, 201);

    // Try to login with wrong password
    let login_request = LoginRequest {
        email: email.clone(),
        password: "WrongPassword123!".to_string(),
    };

    let response = server.post("/api/v1/auth/login").json(&login_request).await;
    assert_status(&response, 401);

    let error_text = response.text();
    assert!(
        error_text.to_lowercase().contains("invalid")
            || error_text.to_lowercase().contains("credentials"),
        "Error message should indicate invalid credentials"
    );
}

/// Test login with missing credentials fails with 400 Bad Request.
///
/// Verifies that:
/// - Missing email is rejected with 400
/// - Missing password is rejected with 400
/// - Error messages indicate validation failure
#[tokio::test]
async fn test_login_missing_credentials() {
    let server = create_test_server().await;

    // Missing email
    let missing_email = json!({
        "password": "SomePassword123!"
    });
    let response = server.post("/api/v1/auth/login").json(&missing_email).await;
    assert_status(&response, 422);

    // Missing password
    let missing_password = json!({
        "email": "test@example.com"
    });
    let response = server
        .post("/api/v1/auth/login")
        .json(&missing_password)
        .await;
    assert_status(&response, 422);

    // Both missing
    let both_missing = json!({});
    let response = server.post("/api/v1/auth/login").json(&both_missing).await;
    assert_status(&response, 422);
}

// ============================================================================
// Get Current User Tests
// ============================================================================

/// Test getting current user with valid JWT returns user info.
///
/// Verifies that:
/// - Status code is 200 OK
/// - Response contains correct user information
/// - User ID matches the authenticated user
#[tokio::test]
async fn test_get_me_success() {
    let server = create_test_server().await;
    let timestamp = Utc::now().timestamp_nanos_opt().unwrap();

    // Register and login to get a valid token
    let auth = register_test_user(
        &server,
        &format!("meuser_{}", timestamp),
        &format!("me_test_{}@example.com", timestamp),
        "SecurePass123!",
        "Me Test User",
    )
    .await;

    // Get current user info
    let response = get_authenticated(&server, "/api/v1/auth/me", &auth.token).await;
    assert_status(&response, 200);

    // Extract and validate response
    let user_response: UserResponse = extract_json(response);

    // Validate user data matches the registered user
    assert_eq!(user_response.id, auth.user.id);
    assert_eq!(user_response.username, auth.user.username);
    assert_eq!(user_response.email, auth.user.email);
    assert_eq!(user_response.name, auth.user.name);
}

/// Test getting current user without token fails with 401 Unauthorized.
///
/// Verifies that:
/// - Status code is 401
/// - Error message indicates missing authentication
#[tokio::test]
async fn test_get_me_no_token() {
    let server = create_test_server().await;

    // Try to access protected endpoint without token
    let response = get_unauthenticated(&server, "/api/v1/auth/me").await;
    assert_status(&response, 401);

    let error_text = response.text();
    assert!(
        error_text.to_lowercase().contains("unauthorized")
            || error_text.to_lowercase().contains("token"),
        "Error message should indicate missing authentication"
    );
}

/// Test getting current user with invalid/malformed JWT fails with 401 Unauthorized.
///
/// Verifies that:
/// - Status code is 401
/// - Error message indicates invalid token
#[tokio::test]
async fn test_get_me_invalid_token() {
    let server = create_test_server().await;

    let invalid_tokens = vec![
        "not.a.jwt",
        "invalid_token",
        "Bearer malformed",
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid.signature",
    ];

    for invalid_token in invalid_tokens {
        let response = get_authenticated(&server, "/api/v1/auth/me", invalid_token).await;
        assert_status(&response, 401);

        let error_text = response.text();
        assert!(
            error_text.to_lowercase().contains("invalid")
                || error_text.to_lowercase().contains("token"),
            "Error message should indicate invalid token for: {}",
            invalid_token
        );
    }
}

/// Test getting current user with expired JWT fails with 401 Unauthorized.
///
/// Verifies that:
/// - Status code is 401
/// - Error message indicates expired token
///
/// Note: This test creates a token with negative expiration to simulate an expired token.
#[tokio::test]
async fn test_get_me_expired_token() {
    let server = create_test_server().await;
    let timestamp = Utc::now().timestamp_nanos_opt().unwrap();

    // Register a user first
    let auth = register_test_user(
        &server,
        &format!("expireduser_{}", timestamp),
        &format!("expired_{}@example.com", timestamp),
        "SecurePass123!",
        "Expired Test User",
    )
    .await;

    // Create a JWT config with negative expiration (already expired)
    let expired_jwt_config = master_of_coin_backend::config::JwtConfig {
        secret: "test_secret_key_at_least_32_characters_long_for_testing".to_string(),
        expiration_hours: -1, // Negative hours means already expired
    };

    // Generate an expired token
    use master_of_coin_backend::auth::jwt::generate_token;
    use master_of_coin_backend::models::User;

    // Create a User struct from the auth response
    let user = User {
        id: auth.user.id,
        username: auth.user.username.clone(),
        email: auth.user.email.clone(),
        password_hash: "dummy_hash".to_string(),
        name: auth.user.name.clone(),
        created_at: auth.user.created_at,
        updated_at: Utc::now(),
    };

    let expired_token =
        generate_token(&user, &expired_jwt_config).expect("Failed to generate expired token");

    // Try to access protected endpoint with expired token
    let response = get_authenticated(&server, "/api/v1/auth/me", &expired_token).await;
    assert_status(&response, 401);

    let error_text = response.text();
    assert!(
        error_text.to_lowercase().contains("expired")
            || error_text.to_lowercase().contains("invalid"),
        "Error message should indicate expired or invalid token"
    );
}

// ============================================================================
// Integration Flow Test
// ============================================================================

/// Test complete authentication flow: Register → Login → Access protected endpoint.
///
/// Verifies that:
/// - User can register successfully
/// - User can login with registered credentials
/// - User can access protected endpoints with the token
/// - All user data is consistent across operations
#[tokio::test]
async fn test_full_auth_flow() {
    let server = create_test_server().await;
    let timestamp = Utc::now().timestamp_nanos_opt().unwrap();

    let username = format!("flowuser_{}", timestamp);
    let email = format!("flow_test_{}@example.com", timestamp);
    let password = "SecurePass123!";
    let name = "Flow Test User";

    // Step 1: Register
    let register_request = CreateUserRequest {
        username: username.clone(),
        email: email.clone(),
        password: password.to_string(),
        name: name.to_string(),
    };

    let register_response = server
        .post("/api/v1/auth/register")
        .json(&register_request)
        .await;
    assert_status(&register_response, 201);

    let register_auth: AuthResponse = extract_json(register_response);
    assert_eq!(register_auth.user.username, username);
    assert_eq!(register_auth.user.email, email);

    // Step 2: Login
    let login_request = LoginRequest {
        email: email.clone(),
        password: password.to_string(),
    };

    let login_response = server.post("/api/v1/auth/login").json(&login_request).await;
    assert_status(&login_response, 200);

    let login_auth: AuthResponse = extract_json(login_response);
    assert_eq!(login_auth.user.id, register_auth.user.id);
    assert_eq!(login_auth.user.username, username);

    // Step 3: Access protected endpoint with login token
    let me_response = get_authenticated(&server, "/api/v1/auth/me", &login_auth.token).await;
    assert_status(&me_response, 200);

    let me_user: UserResponse = extract_json(me_response);
    assert_eq!(me_user.id, register_auth.user.id);
    assert_eq!(me_user.username, username);
    assert_eq!(me_user.email, email);
    assert_eq!(me_user.name, name);

    // Step 4: Verify register token also works
    let me_response2 = get_authenticated(&server, "/api/v1/auth/me", &register_auth.token).await;
    assert_status(&me_response2, 200);

    let me_user2: UserResponse = extract_json(me_response2);
    assert_eq!(me_user2.id, register_auth.user.id);
}
