use diesel::prelude::*;
use uuid::Uuid;

use crate::{
    DbPool,
    errors::ApiError,
    models::person::{NewPerson, Person, UpdatePerson},
    schema::people,
};

/// Create a new person
pub async fn create_person(
    pool: &DbPool,
    user_id: Uuid,
    new_person: NewPerson,
) -> Result<Person, ApiError> {
    let mut conn = pool.get().map_err(|e| {
        tracing::error!("Failed to get DB connection: {}", e);
        ApiError::Internal
    })?;

    tokio::task::spawn_blocking(move || {
        diesel::insert_into(people::table)
            .values(&new_person)
            .get_result(&mut conn)
            .map_err(|e| {
                tracing::error!("Failed to create person for user {}: {}", user_id, e);
                ApiError::from(e)
            })
    })
    .await
    .map_err(|e| {
        tracing::error!("Task join error: {}", e);
        ApiError::Internal
    })?
}

/// Find person by ID
pub async fn find_by_id(pool: &DbPool, person_id: Uuid) -> Result<Person, ApiError> {
    let mut conn = pool.get().map_err(|e| {
        tracing::error!("Failed to get DB connection: {}", e);
        ApiError::Internal
    })?;

    tokio::task::spawn_blocking(move || {
        people::table.find(person_id).first(&mut conn).map_err(|e| {
            tracing::error!("Failed to find person by id {}: {}", person_id, e);
            ApiError::from(e)
        })
    })
    .await
    .map_err(|e| {
        tracing::error!("Task join error: {}", e);
        ApiError::Internal
    })?
}

/// List all people for a user
pub async fn list_by_user(pool: &DbPool, user_id: Uuid) -> Result<Vec<Person>, ApiError> {
    let mut conn = pool.get().map_err(|e| {
        tracing::error!("Failed to get DB connection: {}", e);
        ApiError::Internal
    })?;

    tokio::task::spawn_blocking(move || {
        people::table
            .filter(people::user_id.eq(user_id))
            .order(people::name.asc())
            .load(&mut conn)
            .map_err(|e| {
                tracing::error!("Failed to list people for user {}: {}", user_id, e);
                ApiError::from(e)
            })
    })
    .await
    .map_err(|e| {
        tracing::error!("Task join error: {}", e);
        ApiError::Internal
    })?
}

/// Update person
pub async fn update_person(
    pool: &DbPool,
    person_id: Uuid,
    updates: UpdatePerson,
) -> Result<Person, ApiError> {
    let mut conn = pool.get().map_err(|e| {
        tracing::error!("Failed to get DB connection: {}", e);
        ApiError::Internal
    })?;

    tokio::task::spawn_blocking(move || {
        // Apply updates one at a time
        if let Some(name) = updates.name {
            diesel::update(people::table.find(person_id))
                .set(people::name.eq(name))
                .execute(&mut conn)
                .map_err(|e| {
                    tracing::error!("Failed to update person name {}: {}", person_id, e);
                    ApiError::from(e)
                })?;
        }
        if let Some(email) = updates.email {
            diesel::update(people::table.find(person_id))
                .set(people::email.eq(email))
                .execute(&mut conn)
                .map_err(|e| {
                    tracing::error!("Failed to update person email {}: {}", person_id, e);
                    ApiError::from(e)
                })?;
        }
        if let Some(phone) = updates.phone {
            diesel::update(people::table.find(person_id))
                .set(people::phone.eq(phone))
                .execute(&mut conn)
                .map_err(|e| {
                    tracing::error!("Failed to update person phone {}: {}", person_id, e);
                    ApiError::from(e)
                })?;
        }
        if let Some(notes) = updates.notes {
            diesel::update(people::table.find(person_id))
                .set(people::notes.eq(notes))
                .execute(&mut conn)
                .map_err(|e| {
                    tracing::error!("Failed to update person notes {}: {}", person_id, e);
                    ApiError::from(e)
                })?;
        }

        // Return the updated person
        people::table.find(person_id).first(&mut conn).map_err(|e| {
            tracing::error!("Failed to fetch updated person {}: {}", person_id, e);
            ApiError::from(e)
        })
    })
    .await
    .map_err(|e| {
        tracing::error!("Task join error: {}", e);
        ApiError::Internal
    })?
}

/// Delete person
pub async fn delete_person(pool: &DbPool, person_id: Uuid) -> Result<(), ApiError> {
    let mut conn = pool.get().map_err(|e| {
        tracing::error!("Failed to get DB connection: {}", e);
        ApiError::Internal
    })?;

    tokio::task::spawn_blocking(move || {
        diesel::delete(people::table.find(person_id))
            .execute(&mut conn)
            .map_err(|e| {
                tracing::error!("Failed to delete person {}: {}", person_id, e);
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

/// Get all splits for a person
pub async fn list_splits_for_person(
    pool: &DbPool,
    person_id: Uuid,
) -> Result<Vec<crate::models::TransactionSplit>, ApiError> {
    let mut conn = pool.get().map_err(|e| {
        tracing::error!("Failed to get DB connection: {}", e);
        ApiError::Internal
    })?;

    tokio::task::spawn_blocking(move || {
        use crate::schema::transaction_splits;

        transaction_splits::table
            .filter(transaction_splits::person_id.eq(person_id))
            .order(transaction_splits::created_at.asc())
            .load(&mut conn)
            .map_err(|e| {
                tracing::error!("Failed to get splits for person {}: {}", person_id, e);
                ApiError::from(e)
            })
    })
    .await
    .map_err(|e| {
        tracing::error!("Task join error: {}", e);
        ApiError::Internal
    })?
}
