use bigdecimal::BigDecimal;
use chrono::Utc;
use std::str::FromStr;
use uuid::Uuid;
use validator::Validate;

use crate::{
    DbPool,
    errors::ApiError,
    models::{
        BudgetRangeResponse, BudgetResponse, CreateBudgetRangeRequest, CreateBudgetRequest,
        NewBudget, NewBudgetRange, TransactionFilter, UpdateBudgetRequest,
    },
    repositories,
    services::exchange_rate_service::ExchangeRateService,
};

/// Budget status information
#[derive(Debug, serde::Serialize)]
pub struct BudgetStatus {
    pub budget_id: Uuid,
    pub current_spending: String,
    pub limit_amount: String,
    pub percentage_used: f64,
    pub is_over_budget: bool,
}

/// Create a new budget
pub async fn create_budget(
    pool: &DbPool,
    user_id: Uuid,
    request: CreateBudgetRequest,
) -> Result<BudgetResponse, ApiError> {
    // Validate request
    request.validate().map_err(|e| {
        tracing::warn!("Budget validation failed: {}", e);
        ApiError::Validation(e.to_string())
    })?;

    // Create budget
    let new_budget = NewBudget {
        user_id,
        name: request.name.clone(),
        filters: request.filters.clone(),
    };

    let budget = repositories::budget::create_budget(pool, user_id, new_budget).await?;

    tracing::info!("Created budget {} for user {}", budget.id, user_id);

    Ok(budget.into())
}

/// Get a budget with current spending status
pub async fn get_budget(
    pool: &DbPool,
    budget_id: Uuid,
    user_id: Uuid,
) -> Result<BudgetResponse, ApiError> {
    // Fetch budget
    let budget = repositories::budget::find_by_id(pool, budget_id).await?;

    // Verify ownership
    if budget.user_id != user_id {
        tracing::warn!(
            "User {} attempted to access budget {} owned by {}",
            user_id,
            budget_id,
            budget.user_id
        );
        return Err(ApiError::Forbidden(
            "Budget does not belong to user".to_string(),
        ));
    }

    Ok(budget.into())
}

/// List all budgets for a user
pub async fn list_budgets(pool: &DbPool, user_id: Uuid) -> Result<Vec<BudgetResponse>, ApiError> {
    let budgets = repositories::budget::list_by_user(pool, user_id).await?;

    let responses = budgets.into_iter().map(|budget| budget.into()).collect();

    Ok(responses)
}

/// Update a budget
pub async fn update_budget(
    pool: &DbPool,
    budget_id: Uuid,
    user_id: Uuid,
    request: UpdateBudgetRequest,
) -> Result<BudgetResponse, ApiError> {
    // Validate request
    request.validate().map_err(|e| {
        tracing::warn!("Budget update validation failed: {}", e);
        ApiError::Validation(e.to_string())
    })?;

    // Fetch and verify ownership
    let budget = repositories::budget::find_by_id(pool, budget_id).await?;
    if budget.user_id != user_id {
        tracing::warn!(
            "User {} attempted to update budget {} owned by {}",
            user_id,
            budget_id,
            budget.user_id
        );
        return Err(ApiError::Forbidden(
            "Budget does not belong to user".to_string(),
        ));
    }

    // Create update struct
    let updates = crate::models::UpdateBudget {
        name: request.name,
        filters: request.filters,
    };

    // Update budget
    let updated = repositories::budget::update_budget(pool, budget_id, updates).await?;

    tracing::info!("Updated budget {} for user {}", budget_id, user_id);

    Ok(updated.into())
}

/// Delete a budget
pub async fn delete_budget(pool: &DbPool, budget_id: Uuid, user_id: Uuid) -> Result<(), ApiError> {
    // Fetch and verify ownership
    let budget = repositories::budget::find_by_id(pool, budget_id).await?;
    if budget.user_id != user_id {
        tracing::warn!(
            "User {} attempted to delete budget {} owned by {}",
            user_id,
            budget_id,
            budget.user_id
        );
        return Err(ApiError::Forbidden(
            "Budget does not belong to user".to_string(),
        ));
    }

    // Delete budget (ranges will be cascade deleted by database)
    repositories::budget::delete_budget(pool, budget_id).await?;

    tracing::info!("Deleted budget {} for user {}", budget_id, user_id);

    Ok(())
}

/// Add a budget range
pub async fn add_range(
    pool: &DbPool,
    budget_id: Uuid,
    user_id: Uuid,
    request: CreateBudgetRangeRequest,
) -> Result<BudgetRangeResponse, ApiError> {
    // Validate request
    request.validate().map_err(|e| {
        tracing::warn!("Budget range validation failed: {}", e);
        ApiError::Validation(e.to_string())
    })?;

    // Verify budget ownership
    let budget = repositories::budget::find_by_id(pool, budget_id).await?;
    if budget.user_id != user_id {
        tracing::warn!(
            "User {} attempted to add range to budget {} owned by {}",
            user_id,
            budget_id,
            budget.user_id
        );
        return Err(ApiError::Forbidden(
            "Budget does not belong to user".to_string(),
        ));
    }

    // Validate date range if end_date is provided
    if let Some(end_date) = request.end_date {
        if end_date < request.start_date {
            return Err(ApiError::Validation(
                "End date must be after start date".to_string(),
            ));
        }
    }

    // Convert limit amount to BigDecimal
    let limit_amount = BigDecimal::from_str(&request.limit_amount.to_string()).map_err(|e| {
        tracing::error!("Failed to convert limit amount: {}", e);
        ApiError::Validation("Invalid limit amount".to_string())
    })?;

    // Create range
    let new_range = NewBudgetRange {
        budget_id,
        limit_amount,
        period: request.period,
        start_date: request.start_date,
        end_date: request.end_date,
    };

    let range = repositories::budget::create_range(pool, budget_id, new_range).await?;

    tracing::info!("Created range {} for budget {}", range.id, budget_id);

    Ok(range.into())
}

/// Calculate budget status for current period
pub async fn calculate_budget_status(
    pool: &DbPool,
    budget_id: Uuid,
    user_id: Uuid,
) -> Result<BudgetStatus, ApiError> {
    // Verify budget ownership
    let budget = repositories::budget::find_by_id(pool, budget_id).await?;
    if budget.user_id != user_id {
        return Err(ApiError::Forbidden(
            "Budget does not belong to user".to_string(),
        ));
    }

    // Get active range for today
    let today = Utc::now().date_naive();
    let range = repositories::budget::get_active_range(pool, budget_id, today).await?;

    let range = match range {
        Some(r) => r,
        None => {
            return Err(ApiError::NotFound(
                "No active budget range for current date".to_string(),
            ));
        }
    };

    // Parse budget filters to create transaction filter
    let mut filter = TransactionFilter {
        account_id: None,
        category_id: None,
        start_date: Some(range.start_date.and_hms_opt(0, 0, 0).unwrap().and_utc()), // Start of day (00:00:00)
        end_date: range
            .end_date
            .map(|d| d.and_hms_opt(23, 59, 59).unwrap().and_utc()), // End of day (23:59:59) if set
        min_amount: None,
        max_amount: None,
        search: None,
        limit: None,
        offset: None,
    };

    // Apply budget filters from JSON
    if let Some(account_id) = budget.filters.get("account_id").and_then(|v| v.as_str()) {
        if let Ok(uuid) = Uuid::parse_str(account_id) {
            filter.account_id = Some(uuid);
        }
    }
    if let Some(category_id) = budget.filters.get("category_id").and_then(|v| v.as_str()) {
        if let Ok(uuid) = Uuid::parse_str(category_id) {
            filter.category_id = Some(uuid);
        }
    }

    // Get transactions matching the filter
    let transactions = repositories::transaction::list_transactions(pool, user_id, filter).await?;

    // Initialize exchange rate service for currency conversion
    let exchange_service = ExchangeRateService::new()?;

    // Sum spending (only negative amounts for expenses), converting to primary currency
    let mut current_spending = BigDecimal::from(0);

    for transaction in transactions
        .iter()
        .filter(|t| t.amount < BigDecimal::from(0))
    {
        // Get the account to find its currency
        let account = repositories::account::find_by_id(pool, transaction.account_id).await?;

        // Convert transaction amount to primary currency
        let amount_abs = transaction.amount.abs();
        let converted_amount = exchange_service
            .convert_to_primary_currency(&amount_abs, account.currency)
            .await?;

        current_spending += converted_amount;
    }

    // current_spending is already positive (we used abs() above)
    let spending_abs = current_spending;

    // Calculate percentage
    let percentage_used = if range.limit_amount > BigDecimal::from(0) {
        let ratio = &spending_abs / &range.limit_amount;
        ratio.to_string().parse::<f64>().unwrap_or(0.0) * 100.0
    } else {
        0.0
    };

    let is_over_budget = spending_abs > range.limit_amount;

    Ok(BudgetStatus {
        budget_id,
        current_spending: spending_abs.to_string(),
        limit_amount: range.limit_amount.to_string(),
        percentage_used,
        is_over_budget,
    })
}
