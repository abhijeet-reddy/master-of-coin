use crate::{
    DbPool,
    errors::ApiError,
    models::{NewPersonSplitConfig, PersonSplitConfig},
    schema::person_split_configs,
};
use diesel::prelude::*;
use uuid::Uuid;

/// Find person split config by person ID
pub async fn find_by_person_id(
    pool: &DbPool,
    person_id: Uuid,
) -> Result<Option<PersonSplitConfig>, ApiError> {
    let mut conn = pool.get().map_err(|e| {
        tracing::error!("Failed to get DB connection: {}", e);
        ApiError::InternalWithMessage("Failed to get database connection".to_string())
    })?;

    tokio::task::spawn_blocking(move || {
        person_split_configs::table
            .filter(person_split_configs::person_id.eq(person_id))
            .first::<PersonSplitConfig>(&mut conn)
            .optional()
    })
    .await
    .map_err(|e| {
        tracing::error!("Task join error: {}", e);
        ApiError::InternalWithMessage("Task execution error".to_string())
    })?
    .map_err(|e| {
        tracing::error!("Database error: {}", e);
        ApiError::from(e)
    })
}

/// Create or update person split config (upsert)
pub async fn upsert_config(
    pool: &DbPool,
    new_config: NewPersonSplitConfig,
) -> Result<PersonSplitConfig, ApiError> {
    let mut conn = pool.get().map_err(|e| {
        tracing::error!("Failed to get DB connection: {}", e);
        ApiError::InternalWithMessage("Failed to get database connection".to_string())
    })?;

    tokio::task::spawn_blocking(move || {
        diesel::insert_into(person_split_configs::table)
            .values(&new_config)
            .on_conflict(person_split_configs::person_id)
            .do_update()
            .set((
                person_split_configs::split_provider_id.eq(&new_config.split_provider_id),
                person_split_configs::external_user_id.eq(&new_config.external_user_id),
                person_split_configs::updated_at.eq(diesel::dsl::now),
            ))
            .get_result::<PersonSplitConfig>(&mut conn)
    })
    .await
    .map_err(|e| {
        tracing::error!("Task join error: {}", e);
        ApiError::InternalWithMessage("Task execution error".to_string())
    })?
    .map_err(|e| {
        tracing::error!("Failed to upsert person split config: {}", e);
        ApiError::from(e)
    })
}

/// Delete person split config
pub async fn delete_config(pool: &DbPool, person_id: Uuid) -> Result<(), ApiError> {
    let mut conn = pool.get().map_err(|e| {
        tracing::error!("Failed to get DB connection: {}", e);
        ApiError::InternalWithMessage("Failed to get database connection".to_string())
    })?;

    let deleted = tokio::task::spawn_blocking(move || {
        diesel::delete(
            person_split_configs::table.filter(person_split_configs::person_id.eq(person_id)),
        )
        .execute(&mut conn)
    })
    .await
    .map_err(|e| {
        tracing::error!("Task join error: {}", e);
        ApiError::InternalWithMessage("Task execution error".to_string())
    })?
    .map_err(|e| {
        tracing::error!("Failed to delete person split config: {}", e);
        ApiError::from(e)
    })?;

    if deleted == 0 {
        return Err(ApiError::NotFound(
            "Person split config not found".to_string(),
        ));
    }

    Ok(())
}
