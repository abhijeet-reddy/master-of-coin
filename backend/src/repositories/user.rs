use diesel::prelude::*;
use uuid::Uuid;

use crate::{
    DbPool,
    errors::ApiError,
    models::user::{NewUser, UpdateUser, User},
    schema::users,
};

/// Create a new user
pub async fn create_user(pool: &DbPool, new_user: NewUser) -> Result<User, ApiError> {
    let mut conn = pool.get().map_err(|e| {
        tracing::error!("Failed to get DB connection: {}", e);
        ApiError::Internal
    })?;

    tokio::task::spawn_blocking(move || {
        diesel::insert_into(users::table)
            .values(&new_user)
            .get_result(&mut conn)
            .map_err(|e| {
                tracing::error!("Failed to create user: {}", e);
                ApiError::from(e)
            })
    })
    .await
    .map_err(|e| {
        tracing::error!("Task join error: {}", e);
        ApiError::Internal
    })?
}

/// Find user by ID
pub async fn find_by_id(pool: &DbPool, user_id: Uuid) -> Result<User, ApiError> {
    let mut conn = pool.get().map_err(|e| {
        tracing::error!("Failed to get DB connection: {}", e);
        ApiError::Internal
    })?;

    tokio::task::spawn_blocking(move || {
        users::table.find(user_id).first(&mut conn).map_err(|e| {
            tracing::error!("Failed to find user by id {}: {}", user_id, e);
            ApiError::from(e)
        })
    })
    .await
    .map_err(|e| {
        tracing::error!("Task join error: {}", e);
        ApiError::Internal
    })?
}

/// Find user by username
pub async fn find_by_username(pool: &DbPool, username: &str) -> Result<User, ApiError> {
    let username = username.to_string();
    let mut conn = pool.get().map_err(|e| {
        tracing::error!("Failed to get DB connection: {}", e);
        ApiError::Internal
    })?;

    tokio::task::spawn_blocking(move || {
        users::table
            .filter(users::username.eq(&username))
            .first(&mut conn)
            .map_err(|e| {
                tracing::error!("Failed to find user by username {}: {}", username, e);
                ApiError::from(e)
            })
    })
    .await
    .map_err(|e| {
        tracing::error!("Task join error: {}", e);
        ApiError::Internal
    })?
}

/// Find user by email
pub async fn find_by_email(pool: &DbPool, email: &str) -> Result<User, ApiError> {
    let email = email.to_string();
    let mut conn = pool.get().map_err(|e| {
        tracing::error!("Failed to get DB connection: {}", e);
        ApiError::Internal
    })?;

    tokio::task::spawn_blocking(move || {
        users::table
            .filter(users::email.eq(&email))
            .first(&mut conn)
            .map_err(|e| {
                tracing::error!("Failed to find user by email {}: {}", email, e);
                ApiError::from(e)
            })
    })
    .await
    .map_err(|e| {
        tracing::error!("Task join error: {}", e);
        ApiError::Internal
    })?
}

/// Update user
pub async fn update_user(
    pool: &DbPool,
    user_id: Uuid,
    updates: UpdateUser,
) -> Result<User, ApiError> {
    let mut conn = pool.get().map_err(|e| {
        tracing::error!("Failed to get DB connection: {}", e);
        ApiError::Internal
    })?;

    tokio::task::spawn_blocking(move || {
        // Apply updates one at a time
        if let Some(username) = updates.username {
            diesel::update(users::table.find(user_id))
                .set(users::username.eq(username))
                .execute(&mut conn)
                .map_err(|e| {
                    tracing::error!("Failed to update user username {}: {}", user_id, e);
                    ApiError::from(e)
                })?;
        }
        if let Some(email) = updates.email {
            diesel::update(users::table.find(user_id))
                .set(users::email.eq(email))
                .execute(&mut conn)
                .map_err(|e| {
                    tracing::error!("Failed to update user email {}: {}", user_id, e);
                    ApiError::from(e)
                })?;
        }
        if let Some(name) = updates.name {
            diesel::update(users::table.find(user_id))
                .set(users::name.eq(name))
                .execute(&mut conn)
                .map_err(|e| {
                    tracing::error!("Failed to update user name {}: {}", user_id, e);
                    ApiError::from(e)
                })?;
        }

        // Return the updated user
        users::table.find(user_id).first(&mut conn).map_err(|e| {
            tracing::error!("Failed to fetch updated user {}: {}", user_id, e);
            ApiError::from(e)
        })
    })
    .await
    .map_err(|e| {
        tracing::error!("Task join error: {}", e);
        ApiError::Internal
    })?
}

/// Delete user
pub async fn delete_user(pool: &DbPool, user_id: Uuid) -> Result<(), ApiError> {
    let mut conn = pool.get().map_err(|e| {
        tracing::error!("Failed to get DB connection: {}", e);
        ApiError::Internal
    })?;

    tokio::task::spawn_blocking(move || {
        diesel::delete(users::table.find(user_id))
            .execute(&mut conn)
            .map_err(|e| {
                tracing::error!("Failed to delete user {}: {}", user_id, e);
                ApiError::from(e)
            })
            .map(|_| ())
    })
    .await
    .map_err(|e| {
        tracing::error!("Task join error: {}", e);
        ApiError::Internal
    })?
}
