use validator::Validate;

use crate::{
    auth::{jwt, password},
    config::JwtConfig,
    db::DbPool,
    errors::ApiError,
    models::user::{
        AuthResponse, ChangePasswordRequest, CreateUserRequest, LoginRequest, NewUser,
        UpdateProfileRequest, UpdateUser, UserResponse,
    },
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
            return Err(ApiError::Conflict("Username already exists".to_string()));
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
            return Err(ApiError::Conflict("Email already exists".to_string()));
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

/// Update the current user's name and/or email. A taken email is a 409.
pub async fn update_profile(
    pool: &DbPool,
    user_id: uuid::Uuid,
    request: UpdateProfileRequest,
) -> Result<UserResponse, ApiError> {
    request
        .validate()
        .map_err(|e| ApiError::Validation(format!("Invalid profile data: {}", e)))?;

    let name = request.name.map(|n| n.trim().to_string());
    if matches!(&name, Some(n) if n.is_empty()) {
        return Err(ApiError::Validation("Name cannot be blank".to_string()));
    }
    let email = request.email.map(|e| e.trim().to_string());

    if let Some(email) = &email {
        match user::find_by_email(pool, email).await {
            Ok(existing) if existing.id != user_id => {
                return Err(ApiError::Conflict("Email already exists".to_string()));
            }
            Ok(_) | Err(ApiError::Database(diesel::result::Error::NotFound)) => {}
            Err(e) => return Err(e),
        }
    }

    let updated = user::update_user(
        pool,
        user_id,
        UpdateUser {
            username: None,
            email,
            name,
        },
    )
    .await?;

    tracing::info!("Updated profile for user {}", user_id);
    Ok(UserResponse::from(updated))
}

/// Change the current user's password after verifying the current one.
pub async fn change_password(
    pool: &DbPool,
    user_id: uuid::Uuid,
    request: ChangePasswordRequest,
) -> Result<(), ApiError> {
    request
        .validate()
        .map_err(|e| ApiError::Validation(format!("Invalid password data: {}", e)))?;

    let existing = user::find_by_id(pool, user_id).await?;
    if !password::verify_password(&request.current_password, &existing.password_hash)? {
        tracing::warn!(
            "Wrong current password on change-password for user {}",
            user_id
        );
        return Err(ApiError::Validation(
            "Current password is incorrect".to_string(),
        ));
    }

    let hash = password::hash_password(&request.new_password)?;
    user::update_password_hash(pool, user_id, hash).await?;
    tracing::info!("Changed password for user {}", user_id);
    Ok(())
}
