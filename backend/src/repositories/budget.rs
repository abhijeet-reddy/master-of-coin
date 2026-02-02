use chrono::NaiveDate;
use diesel::prelude::*;
use uuid::Uuid;

use crate::{
    DbPool,
    errors::ApiError,
    models::{
        budget::{Budget, NewBudget, UpdateBudget},
        budget_range::{BudgetRange, NewBudgetRange},
    },
    schema::{budget_ranges, budgets},
};

/// Create a new budget
pub async fn create_budget(
    pool: &DbPool,
    user_id: Uuid,
    new_budget: NewBudget,
) -> Result<Budget, ApiError> {
    let mut conn = pool.get().map_err(|e| {
        tracing::error!("Failed to get DB connection: {}", e);
        ApiError::Internal
    })?;

    tokio::task::spawn_blocking(move || {
        diesel::insert_into(budgets::table)
            .values(&new_budget)
            .get_result(&mut conn)
            .map_err(|e| {
                tracing::error!("Failed to create budget for user {}: {}", user_id, e);
                ApiError::from(e)
            })
    })
    .await
    .map_err(|e| {
        tracing::error!("Task join error: {}", e);
        ApiError::Internal
    })?
}

/// Find budget by ID
pub async fn find_by_id(pool: &DbPool, budget_id: Uuid) -> Result<Budget, ApiError> {
    let mut conn = pool.get().map_err(|e| {
        tracing::error!("Failed to get DB connection: {}", e);
        ApiError::Internal
    })?;

    tokio::task::spawn_blocking(move || {
        budgets::table
            .find(budget_id)
            .first(&mut conn)
            .map_err(|e| {
                tracing::error!("Failed to find budget by id {}: {}", budget_id, e);
                ApiError::from(e)
            })
    })
    .await
    .map_err(|e| {
        tracing::error!("Task join error: {}", e);
        ApiError::Internal
    })?
}

/// List all budgets for a user
pub async fn list_by_user(pool: &DbPool, user_id: Uuid) -> Result<Vec<Budget>, ApiError> {
    let mut conn = pool.get().map_err(|e| {
        tracing::error!("Failed to get DB connection: {}", e);
        ApiError::Internal
    })?;

    tokio::task::spawn_blocking(move || {
        budgets::table
            .filter(budgets::user_id.eq(user_id))
            .order(budgets::created_at.desc())
            .load(&mut conn)
            .map_err(|e| {
                tracing::error!("Failed to list budgets for user {}: {}", user_id, e);
                ApiError::from(e)
            })
    })
    .await
    .map_err(|e| {
        tracing::error!("Task join error: {}", e);
        ApiError::Internal
    })?
}

/// Update budget
pub async fn update_budget(
    pool: &DbPool,
    budget_id: Uuid,
    updates: UpdateBudget,
) -> Result<Budget, ApiError> {
    let mut conn = pool.get().map_err(|e| {
        tracing::error!("Failed to get DB connection: {}", e);
        ApiError::Internal
    })?;

    tokio::task::spawn_blocking(move || {
        // Apply updates one at a time
        if let Some(name) = updates.name {
            diesel::update(budgets::table.find(budget_id))
                .set(budgets::name.eq(name))
                .execute(&mut conn)
                .map_err(|e| {
                    tracing::error!("Failed to update budget name {}: {}", budget_id, e);
                    ApiError::from(e)
                })?;
        }
        if let Some(filters) = updates.filters {
            diesel::update(budgets::table.find(budget_id))
                .set(budgets::filters.eq(filters))
                .execute(&mut conn)
                .map_err(|e| {
                    tracing::error!("Failed to update budget filters {}: {}", budget_id, e);
                    ApiError::from(e)
                })?;
        }

        // Return the updated budget
        budgets::table
            .find(budget_id)
            .first(&mut conn)
            .map_err(|e| {
                tracing::error!("Failed to fetch updated budget {}: {}", budget_id, e);
                ApiError::from(e)
            })
    })
    .await
    .map_err(|e| {
        tracing::error!("Task join error: {}", e);
        ApiError::Internal
    })?
}

/// Delete budget
pub async fn delete_budget(pool: &DbPool, budget_id: Uuid) -> Result<(), ApiError> {
    let mut conn = pool.get().map_err(|e| {
        tracing::error!("Failed to get DB connection: {}", e);
        ApiError::Internal
    })?;

    tokio::task::spawn_blocking(move || {
        diesel::delete(budgets::table.find(budget_id))
            .execute(&mut conn)
            .map_err(|e| {
                tracing::error!("Failed to delete budget {}: {}", budget_id, e);
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

/// Create a budget range
pub async fn create_range(
    pool: &DbPool,
    budget_id: Uuid,
    range: NewBudgetRange,
) -> Result<BudgetRange, ApiError> {
    let mut conn = pool.get().map_err(|e| {
        tracing::error!("Failed to get DB connection: {}", e);
        ApiError::Internal
    })?;

    tokio::task::spawn_blocking(move || {
        diesel::insert_into(budget_ranges::table)
            .values(&range)
            .get_result(&mut conn)
            .map_err(|e| {
                tracing::error!("Failed to create range for budget {}: {}", budget_id, e);
                ApiError::from(e)
            })
    })
    .await
    .map_err(|e| {
        tracing::error!("Task join error: {}", e);
        ApiError::Internal
    })?
}

/// Get active budget range for a specific date
pub async fn get_active_range(
    pool: &DbPool,
    budget_id: Uuid,
    date: NaiveDate,
) -> Result<Option<BudgetRange>, ApiError> {
    let mut conn = pool.get().map_err(|e| {
        tracing::error!("Failed to get DB connection: {}", e);
        ApiError::Internal
    })?;

    tokio::task::spawn_blocking(move || {
        budget_ranges::table
            .filter(budget_ranges::budget_id.eq(budget_id))
            .filter(budget_ranges::start_date.le(date))
            // If end_date is NULL, the budget is active indefinitely
            // If end_date is set, it must be >= date
            .filter(
                budget_ranges::end_date
                    .is_null()
                    .or(budget_ranges::end_date.ge(date)),
            )
            .first(&mut conn)
            .optional()
            .map_err(|e| {
                tracing::error!(
                    "Failed to get active range for budget {} on date {}: {}",
                    budget_id,
                    date,
                    e
                );
                ApiError::from(e)
            })
    })
    .await
    .map_err(|e| {
        tracing::error!("Task join error: {}", e);
        ApiError::Internal
    })?
}

/// List all ranges for a budget
pub async fn list_ranges_for_budget(
    pool: &DbPool,
    budget_id: Uuid,
) -> Result<Vec<BudgetRange>, ApiError> {
    let mut conn = pool.get().map_err(|e| {
        tracing::error!("Failed to get DB connection: {}", e);
        ApiError::Internal
    })?;

    tokio::task::spawn_blocking(move || {
        budget_ranges::table
            .filter(budget_ranges::budget_id.eq(budget_id))
            .order(budget_ranges::start_date.desc())
            .load(&mut conn)
            .map_err(|e| {
                tracing::error!("Failed to list ranges for budget {}: {}", budget_id, e);
                ApiError::from(e)
            })
    })
    .await
    .map_err(|e| {
        tracing::error!("Task join error: {}", e);
        ApiError::Internal
    })?
}
