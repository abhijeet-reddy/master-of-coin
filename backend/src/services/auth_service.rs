use validator::Validate;

use crate::{
    auth::{jwt, password},
    config::JwtConfig,
    db::DbPool,
    errors::ApiError,
    models::user::{AuthResponse, CreateUserRequest, LoginRequest, NewUser, UserResponse},
    repositories::user,
};

/// Register a new user
///
/// # Arguments
/// * `pool` - Database connection pool
/// * `config` - JWT configuration
/// * `request` - User registration request
///
/// # Returns
/// * `Result<AuthResponse, ApiError>` - Auth response with user and token
///
/// # Errors
/// - Validation errors if request data is invalid
/// - Conflict errors if username or email already exists
/// - Internal errors for database or hashing failures
pub async fn register(
    pool: &DbPool,
    config: &JwtConfig,
    request: CreateUserRequest,
) -> Result<AuthResponse, ApiError> {
    // Validate request
    request.validate().map_err(|e| {
        tracing::warn!("Validation error during registration: {}", e);
        ApiError::Validation(format!("Invalid registration data: {}", e))
    })?;

    // Check if username already exists
    match user::find_by_username(pool, &request.username).await {
        Ok(_) => {
            tracing::warn!(
                "Registration attempt with existing username: {}",
                request.username
            );
            return Err(ApiError::Validation("Username already exists".to_string()));
        }
        Err(ApiError::Database(diesel::result::Error::NotFound)) => {
            // Username doesn't exist, continue
        }
        Err(e) => return Err(e),
    }

    // Check if email already exists
    match user::find_by_email(pool, &request.email).await {
        Ok(_) => {
            tracing::warn!(
                "Registration attempt with existing email: {}",
                request.email
            );
            return Err(ApiError::Validation("Email already exists".to_string()));
        }
        Err(ApiError::Database(diesel::result::Error::NotFound)) => {
            // Email doesn't exist, continue
        }
        Err(e) => return Err(e),
    }

    // Hash password
    let password_hash = password::hash_password(&request.password)?;

    // Create new user
    let new_user = NewUser {
        username: request.username,
        email: request.email,
        password_hash,
        name: request.name,
    };

    let user = user::create_user(pool, new_user).await?;

    tracing::info!("User registered successfully: {}", user.id);

    // Generate JWT token
    let token = jwt::generate_token(&user, config)?;

    Ok(AuthResponse {
        token,
        user: UserResponse::from(user),
    })
}

/// Login a user
///
/// # Arguments
/// * `pool` - Database connection pool
/// * `config` - JWT configuration
/// * `request` - Login request
///
/// # Returns
/// * `Result<AuthResponse, ApiError>` - Auth response with user and token
///
/// # Errors
/// - Validation errors if request data is invalid
/// - Unauthorized errors if credentials are invalid
/// - Internal errors for database failures
pub async fn login(
    pool: &DbPool,
    config: &JwtConfig,
    request: LoginRequest,
) -> Result<AuthResponse, ApiError> {
    // Validate request
    request.validate().map_err(|e| {
        tracing::warn!("Validation error during login: {}", e);
        ApiError::Validation(format!("Invalid login data: {}", e))
    })?;

    // Find user by email
    let user = user::find_by_email(pool, &request.email)
        .await
        .map_err(|e| match e {
            ApiError::Database(diesel::result::Error::NotFound) => {
                tracing::warn!("Login attempt with non-existent email: {}", request.email);
                ApiError::Unauthorized("Invalid email or password".to_string())
            }
            _ => e,
        })?;

    // Verify password
    let is_valid = password::verify_password(&request.password, &user.password_hash)?;

    if !is_valid {
        tracing::warn!("Failed login attempt for user: {}", user.id);
        return Err(ApiError::Unauthorized(
            "Invalid email or password".to_string(),
        ));
    }

    tracing::info!("User logged in successfully: {}", user.id);

    // Generate JWT token
    let token = jwt::generate_token(&user, config)?;

    Ok(AuthResponse {
        token,
        user: UserResponse::from(user),
    })
}

/// Get current user information
///
/// # Arguments
/// * `pool` - Database connection pool
/// * `user_id` - User ID from JWT token
///
/// # Returns
/// * `Result<UserResponse, ApiError>` - User information
///
/// # Errors
/// - NotFound if user doesn't exist
/// - Internal errors for database failures
pub async fn get_current_user(
    pool: &DbPool,
    user_id: uuid::Uuid,
) -> Result<UserResponse, ApiError> {
    let user = user::find_by_id(pool, user_id).await?;
    Ok(UserResponse::from(user))
}
