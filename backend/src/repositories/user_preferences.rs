use diesel::prelude::*;
use uuid::Uuid;

use crate::{
    DbPool,
    errors::ApiError,
    models::user_preferences::{NewUserPreferences, UserPreferences, UserPreferencesResponse},
    schema::user_preferences,
};

/// Load the stored preferences row, if the user has ever saved one.
pub async fn find(pool: &DbPool, user_id: Uuid) -> Result<Option<UserPreferences>, ApiError> {
    let mut conn = pool.get().map_err(|e| {
        tracing::error!("Failed to get DB connection: {}", e);
        ApiError::Internal
    })?;

    tokio::task::spawn_blocking(move || {
        user_preferences::table
            .find(user_id)
            .select(UserPreferences::as_select())
            .first(&mut conn)
            .optional()
            .map_err(|e| {
                tracing::error!("Failed to load preferences for user {}: {}", user_id, e);
                ApiError::from(e)
            })
    })
    .await
    .map_err(|e| {
        tracing::error!("Task join error: {}", e);
        ApiError::Internal
    })?
}

/// Stored preferences, or the defaults when no row exists (rows are created lazily).
pub async fn get_or_default(
    pool: &DbPool,
    user_id: Uuid,
) -> Result<UserPreferencesResponse, ApiError> {
    Ok(find(pool, user_id)
        .await?
        .map(UserPreferencesResponse::from)
        .unwrap_or_else(UserPreferencesResponse::defaults))
}

/// Insert or fully replace the user's preferences row.
pub async fn upsert(pool: &DbPool, prefs: NewUserPreferences) -> Result<UserPreferences, ApiError> {
    let mut conn = pool.get().map_err(|e| {
        tracing::error!("Failed to get DB connection: {}", e);
        ApiError::Internal
    })?;

    tokio::task::spawn_blocking(move || {
        let user_id = prefs.user_id;
        diesel::insert_into(user_preferences::table)
            .values(&prefs)
            .on_conflict(user_preferences::user_id)
            .do_update()
            .set((&prefs, user_preferences::updated_at.eq(diesel::dsl::now)))
            .returning(UserPreferences::as_returning())
            .get_result(&mut conn)
            .map_err(|e| {
                tracing::error!("Failed to upsert preferences for user {}: {}", user_id, e);
                ApiError::from(e)
            })
    })
    .await
    .map_err(|e| {
        tracing::error!("Task join error: {}", e);
        ApiError::Internal
    })?
}
