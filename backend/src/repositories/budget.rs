use bigdecimal::BigDecimal;
use chrono::{DateTime, NaiveDate, Utc};
use diesel::prelude::*;
use diesel::sql_types::{Nullable, Numeric, Timestamptz, Uuid as DieselUuid};
use uuid::Uuid;

use crate::{
    DbPool,
    errors::ApiError,
    models::{
        budget::{Budget, NewBudget, UpdateBudget},
        budget_range::{BudgetRange, NewBudgetRange},
    },
    schema::{budget_ranges, budgets},
    types::CurrencyCode,
};

/// Result of budget spending aggregation grouped by currency.
/// Used by `calculate_spending_by_currency` to return split-adjusted
/// spending totals that the service layer converts to the primary currency.
#[derive(Debug, QueryableByName)]
pub struct CurrencySpending {
    #[diesel(sql_type = crate::schema::sql_types::CurrencyCode)]
    pub currency: CurrencyCode,
    #[diesel(sql_type = Numeric)]
    pub total_user_spending: BigDecimal,
}

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

/// Calculate budget spending grouped by currency, accounting for transaction splits.
///
/// Executes a single SQL query that:
/// 1. JOINs transactions with accounts (to get currency)
/// 2. Uses a correlated subquery on transaction_splits to compute positive split totals
/// 3. Computes user's share: ABS(amount) - COALESCE(positive_splits, 0)
/// 4. Groups by currency and sums the user's shares
///
/// Only positive splits (regular splits where friends owe the user) are subtracted.
/// Negative splits (debt transaction tracking) are ignored — the transaction amount
/// already represents the user's share for debt transactions.
pub async fn calculate_spending_by_currency(
    pool: &DbPool,
    user_id: Uuid,
    category_id: Option<Uuid>,
    account_id: Option<Uuid>,
    start_date: Option<DateTime<Utc>>,
    end_date: Option<DateTime<Utc>>,
) -> Result<Vec<CurrencySpending>, ApiError> {
    let mut conn = pool.get().map_err(|e| {
        tracing::error!("Failed to get DB connection: {}", e);
        ApiError::Internal
    })?;

    tokio::task::spawn_blocking(move || {
        diesel::sql_query(
            "SELECT \
                a.currency, \
                SUM( \
                    ABS(t.amount) - COALESCE( \
                        (SELECT SUM(ts.amount) \
                         FROM transaction_splits ts \
                         WHERE ts.transaction_id = t.id AND ts.amount > 0), \
                        0 \
                    ) \
                ) AS total_user_spending \
            FROM transactions t \
            JOIN accounts a ON a.id = t.account_id \
            WHERE t.user_id = $1 \
              AND t.amount < 0 \
              AND ($2::uuid IS NULL OR t.category_id = $2) \
              AND ($3::timestamptz IS NULL OR t.date >= $3) \
              AND ($4::timestamptz IS NULL OR t.date <= $4) \
              AND ($5::uuid IS NULL OR t.account_id = $5) \
            GROUP BY a.currency",
        )
        .bind::<DieselUuid, _>(user_id)
        .bind::<Nullable<DieselUuid>, _>(category_id)
        .bind::<Nullable<Timestamptz>, _>(start_date)
        .bind::<Nullable<Timestamptz>, _>(end_date)
        .bind::<Nullable<DieselUuid>, _>(account_id)
        .load::<CurrencySpending>(&mut conn)
        .map_err(|e| {
            tracing::error!(
                "Failed to calculate budget spending for user {}: {}",
                user_id,
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
