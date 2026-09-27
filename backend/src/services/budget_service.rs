use bigdecimal::BigDecimal;
use chrono::{NaiveDate, Utc, Weekday};
use std::collections::HashMap;
use uuid::Uuid;
use validator::Validate;

use crate::{
    DbPool,
    errors::ApiError,
    models::{
        BudgetRangeResponse, BudgetResponse, CreateBudgetRangeRequest, CreateBudgetRequest,
        NewBudget, NewBudgetRange, UpdateBudgetRequest,
        budget::{BUDGET_WARNING_PERCENT, Budget, BudgetHealth},
        budget_range::BudgetRange,
    },
    repositories,
    services::{exchange_rate_service::ExchangeRateProvider, preferences_service},
    types::{BudgetPeriod, CurrencyCode},
    utils::decimal,
};

/// Compute the current period window for a budget range.
///
/// Returns `(start, end)` clamped to the range's own `start_date`/`end_date`
/// so the window never extends outside the budget's lifetime. Weekly windows
/// start on the user's `week_start`.
fn current_period_window(
    range: &BudgetRange,
    today: NaiveDate,
    week_start: Weekday,
) -> (NaiveDate, NaiveDate) {
    let (mut start, mut end) = range
        .period
        .current_window_with_week_start(today, week_start);
    if start < range.start_date {
        start = range.start_date;
    }
    if let Some(range_end) = range.end_date
        && end > range_end
    {
        end = range_end;
    }
    (start, end)
}

/// Fetch the IDs of the user's categories that are excluded from analysis.
///
/// Used to keep overall (no-category) budget spend consistent with the
/// category breakdown, which also drops these categories.
pub(crate) async fn excluded_category_ids(
    pool: &DbPool,
    user_id: Uuid,
) -> Result<Vec<Uuid>, ApiError> {
    let categories = repositories::category::list_by_user(pool, user_id).await?;
    Ok(categories
        .into_iter()
        .filter(|c| c.is_excluded_from_analysis)
        .map(|c| c.id)
        .collect())
}

/// Budget status information (dashboard).
#[derive(Debug, serde::Serialize)]
pub struct BudgetStatus {
    pub budget_id: Uuid,
    pub name: String,
    pub current_spending: String,
    pub limit_amount: String,
    pub remaining: String,
    pub percentage_used: f64,
    pub is_over_budget: bool,
    pub status: BudgetHealth,
    pub period: BudgetPeriod,
    pub period_start: NaiveDate,
    pub period_end: NaiveDate,
    pub days_left: i64,
    pub currency: CurrencyCode,
}

/// Everything computed for one budget's current period.
struct PeriodSpend {
    window_start: NaiveDate,
    window_end: NaiveDate,
    spent: BigDecimal,
    percentage_used: f64,
    status: BudgetHealth,
    days_left: i64,
}

/// Shared inputs for computing budget spend, loaded once per request.
struct SpendContext<'a> {
    user_id: Uuid,
    today: NaiveDate,
    week_start: Weekday,
    currency: CurrencyCode,
    exclude_category_ids: Vec<Uuid>,
    provider: &'a dyn ExchangeRateProvider,
}

impl<'a> SpendContext<'a> {
    async fn load(
        pool: &DbPool,
        user_id: Uuid,
        provider: &'a dyn ExchangeRateProvider,
    ) -> Result<SpendContext<'a>, ApiError> {
        let (currency, week_start) = preferences_service::user_settings(pool, user_id).await;
        Ok(SpendContext {
            user_id,
            today: Utc::now().date_naive(),
            week_start,
            currency,
            exclude_category_ids: excluded_category_ids(pool, user_id).await?,
            provider,
        })
    }
}

fn filter_uuid(filters: &serde_json::Value, key: &str) -> Option<Uuid> {
    filters
        .get(key)
        .and_then(|v| v.as_str())
        .and_then(|s| Uuid::parse_str(s).ok())
}

/// Spend for the range's current period window, in the user's currency.
async fn period_spend(
    pool: &DbPool,
    ctx: &SpendContext<'_>,
    filters: &serde_json::Value,
    range: &BudgetRange,
) -> Result<PeriodSpend, ApiError> {
    // Narrow the range's stored bounds to the calendar-aligned period
    // containing today (e.g. MONTHLY: 1st to last day of the current month),
    // so spending resets at each period boundary.
    let (window_start, window_end) = current_period_window(range, ctx.today, ctx.week_start);
    let start_date = window_start.and_hms_opt(0, 0, 0).map(|d| d.and_utc());
    let end_date = window_end.and_hms_opt(23, 59, 59).map(|d| d.and_utc());

    // Categories excluded from analysis are dropped from overall
    // (no-category) budgets; the repository guards this so category-scoped
    // budgets are unaffected.
    let spending_by_currency = repositories::budget::calculate_spending_by_currency(
        pool,
        ctx.user_id,
        filter_uuid(filters, "category_id"),
        filter_uuid(filters, "account_id"),
        start_date,
        end_date,
        ctx.exclude_category_ids.clone(),
    )
    .await?;

    let mut spent = BigDecimal::from(0);
    for row in &spending_by_currency {
        spent += ctx
            .provider
            .convert_currency(&row.total_user_spending, row.currency, ctx.currency)
            .await?;
    }

    let percentage_used = if range.limit_amount > 0 {
        decimal::to_f64(&(&spent / &range.limit_amount))? * 100.0
    } else {
        0.0
    };
    let status = if spent > range.limit_amount {
        BudgetHealth::Over
    } else if percentage_used >= BUDGET_WARNING_PERCENT {
        BudgetHealth::Warning
    } else {
        BudgetHealth::OnTrack
    };
    let days_left = if ctx.today > window_end {
        0
    } else {
        (window_end - ctx.today).num_days() + 1
    };

    Ok(PeriodSpend {
        window_start,
        window_end,
        spent,
        percentage_used,
        status,
        days_left,
    })
}

/// Fill a budget response with its active range and current-period spend.
async fn enrich_response(
    pool: &DbPool,
    ctx: &SpendContext<'_>,
    budget: Budget,
    range: Option<&BudgetRange>,
) -> Result<BudgetResponse, ApiError> {
    let mut response: BudgetResponse = budget.into();
    let Some(range) = range else {
        return Ok(response);
    };
    let spend = period_spend(pool, ctx, &response.filters, range).await?;

    // Return the current period window (not the raw stored range) so clients
    // filter transactions to the same window the spending total reflects.
    let mut range_response: BudgetRangeResponse = range.clone().into();
    range_response.start_date = spend.window_start;
    range_response.end_date = Some(spend.window_end);
    response.active_range = Some(range_response);
    response.remaining = Some((&range.limit_amount - &spend.spent).to_string());
    response.current_spending = Some(spend.spent.to_string());
    response.percentage_used = Some(spend.percentage_used);
    response.status = Some(spend.status);
    response.days_left = Some(spend.days_left);
    response.currency = Some(ctx.currency);
    Ok(response)
}

/// Load a budget the user owns; another user's budget is a 404.
async fn find_owned_budget(
    pool: &DbPool,
    budget_id: Uuid,
    user_id: Uuid,
) -> Result<Budget, ApiError> {
    let budget = repositories::budget::find_by_id(pool, budget_id).await?;
    if budget.user_id != user_id {
        return Err(ApiError::NotFound("Budget not found".to_string()));
    }
    Ok(budget)
}

/// Reject a range whose [start, end] intersects another range of the budget
/// (open-ended ranges run forever). `ignore` skips the range being edited.
async fn ensure_no_overlap(
    pool: &DbPool,
    budget_id: Uuid,
    start: NaiveDate,
    end: Option<NaiveDate>,
    ignore: Option<Uuid>,
) -> Result<(), ApiError> {
    let end = end.unwrap_or(NaiveDate::MAX);
    let ranges = repositories::budget::list_ranges_for_budget(pool, budget_id).await?;
    if let Some(clash) = ranges.iter().find(|r| {
        Some(r.id) != ignore && r.start_date <= end && start <= r.end_date.unwrap_or(NaiveDate::MAX)
    }) {
        return Err(ApiError::Conflict(format!(
            "Range overlaps an existing range ({} to {})",
            clash.start_date,
            clash
                .end_date
                .map(|d| d.to_string())
                .unwrap_or_else(|| "open".to_string())
        )));
    }
    Ok(())
}

fn validate_range_request(request: &CreateBudgetRangeRequest) -> Result<BigDecimal, ApiError> {
    request.validate().map_err(|e| {
        tracing::warn!("Budget range validation failed: {}", e);
        ApiError::Validation(e.to_string())
    })?;
    if let Some(end_date) = request.end_date
        && end_date < request.start_date
    {
        return Err(ApiError::Validation(
            "End date must be after start date".to_string(),
        ));
    }
    decimal::from_f64(request.limit_amount)
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
    exchange_provider: &dyn ExchangeRateProvider,
) -> Result<BudgetResponse, ApiError> {
    let budget = repositories::budget::find_by_id(pool, budget_id).await?;
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

    let ctx = SpendContext::load(pool, user_id, exchange_provider).await?;
    let range = repositories::budget::get_active_range(pool, budget_id, ctx.today).await?;
    enrich_response(pool, &ctx, budget, range.as_ref()).await
}

/// List all budgets for a user, each with its active range and current-period
/// spend. Ranges load in one query and categories/preferences once; spend is
/// one grouped query per budget that has an active range.
pub async fn list_budgets(
    pool: &DbPool,
    user_id: Uuid,
    exchange_provider: &dyn ExchangeRateProvider,
) -> Result<Vec<BudgetResponse>, ApiError> {
    let budgets = repositories::budget::list_by_user(pool, user_id).await?;
    if budgets.is_empty() {
        return Ok(Vec::new());
    }
    let ctx = SpendContext::load(pool, user_id, exchange_provider).await?;
    let ranges =
        repositories::budget::list_ranges_for_budgets(pool, budgets.iter().map(|b| b.id).collect())
            .await?;
    let mut by_budget: HashMap<Uuid, Vec<BudgetRange>> = HashMap::new();
    for range in ranges {
        by_budget.entry(range.budget_id).or_default().push(range);
    }

    let mut responses = Vec::with_capacity(budgets.len());
    for budget in budgets {
        let active = by_budget
            .get(&budget.id)
            .and_then(|r| repositories::budget::pick_active_range(r, ctx.today))
            .cloned();
        responses.push(enrich_response(pool, &ctx, budget, active.as_ref()).await?);
    }
    Ok(responses)
}

/// Current-period status for every budget that has an active range (dashboard).
pub async fn list_budget_statuses(
    pool: &DbPool,
    user_id: Uuid,
    exchange_provider: &dyn ExchangeRateProvider,
) -> Result<Vec<BudgetStatus>, ApiError> {
    let budgets = repositories::budget::list_by_user(pool, user_id).await?;
    if budgets.is_empty() {
        return Ok(Vec::new());
    }
    let ctx = SpendContext::load(pool, user_id, exchange_provider).await?;
    let ranges =
        repositories::budget::list_ranges_for_budgets(pool, budgets.iter().map(|b| b.id).collect())
            .await?;
    let mut by_budget: HashMap<Uuid, Vec<BudgetRange>> = HashMap::new();
    for range in ranges {
        by_budget.entry(range.budget_id).or_default().push(range);
    }

    let mut statuses = Vec::new();
    for budget in budgets {
        let Some(range) = by_budget
            .get(&budget.id)
            .and_then(|r| repositories::budget::pick_active_range(r, ctx.today))
        else {
            continue;
        };
        let spend = period_spend(pool, &ctx, &budget.filters, range).await?;
        statuses.push(BudgetStatus {
            budget_id: budget.id,
            name: budget.name,
            current_spending: spend.spent.to_string(),
            limit_amount: range.limit_amount.to_string(),
            remaining: (&range.limit_amount - &spend.spent).to_string(),
            percentage_used: spend.percentage_used,
            is_over_budget: spend.status == BudgetHealth::Over,
            status: spend.status,
            period: range.period,
            period_start: spend.window_start,
            period_end: spend.window_end,
            days_left: spend.days_left,
            currency: ctx.currency,
        });
    }
    Ok(statuses)
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

/// Add a budget range. Overlapping an existing range is a 409.
pub async fn add_range(
    pool: &DbPool,
    budget_id: Uuid,
    user_id: Uuid,
    request: CreateBudgetRangeRequest,
) -> Result<BudgetRangeResponse, ApiError> {
    let limit_amount = validate_range_request(&request)?;

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

    ensure_no_overlap(pool, budget_id, request.start_date, request.end_date, None).await?;

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

/// Range history for a budget, newest start_date first.
pub async fn list_ranges(
    pool: &DbPool,
    budget_id: Uuid,
    user_id: Uuid,
) -> Result<Vec<BudgetRangeResponse>, ApiError> {
    find_owned_budget(pool, budget_id, user_id).await?;
    let ranges = repositories::budget::list_ranges_for_budget(pool, budget_id).await?;
    Ok(ranges.into_iter().map(Into::into).collect())
}

/// Replace a range (full PUT: `end_date: null` makes it open-ended).
/// Overlapping another range is a 409.
pub async fn update_range(
    pool: &DbPool,
    budget_id: Uuid,
    range_id: Uuid,
    user_id: Uuid,
    request: CreateBudgetRangeRequest,
) -> Result<BudgetRangeResponse, ApiError> {
    let limit_amount = validate_range_request(&request)?;
    find_owned_budget(pool, budget_id, user_id).await?;
    repositories::budget::find_range(pool, budget_id, range_id)
        .await?
        .ok_or_else(|| ApiError::NotFound("Budget range not found".to_string()))?;

    ensure_no_overlap(
        pool,
        budget_id,
        request.start_date,
        request.end_date,
        Some(range_id),
    )
    .await?;

    let range = repositories::budget::update_range(
        pool,
        range_id,
        limit_amount,
        request.period,
        request.start_date,
        request.end_date,
    )
    .await?;
    tracing::info!("Updated range {} of budget {}", range_id, budget_id);
    Ok(range.into())
}

/// Delete a range. The budget's last remaining range cannot be deleted (422).
pub async fn delete_range(
    pool: &DbPool,
    budget_id: Uuid,
    range_id: Uuid,
    user_id: Uuid,
) -> Result<(), ApiError> {
    find_owned_budget(pool, budget_id, user_id).await?;
    repositories::budget::find_range(pool, budget_id, range_id)
        .await?
        .ok_or_else(|| ApiError::NotFound("Budget range not found".to_string()))?;

    if !repositories::budget::delete_range_unless_last(pool, budget_id, range_id).await? {
        return Err(ApiError::Validation(
            "Cannot delete the only range of a budget".to_string(),
        ));
    }
    tracing::info!("Deleted range {} of budget {}", range_id, budget_id);
    Ok(())
}

/// Calculate one budget's status for its current period.
pub async fn calculate_budget_status(
    pool: &DbPool,
    budget_id: Uuid,
    user_id: Uuid,
    exchange_provider: &dyn ExchangeRateProvider,
) -> Result<BudgetStatus, ApiError> {
    let budget = repositories::budget::find_by_id(pool, budget_id).await?;
    if budget.user_id != user_id {
        return Err(ApiError::Forbidden(
            "Budget does not belong to user".to_string(),
        ));
    }

    let ctx = SpendContext::load(pool, user_id, exchange_provider).await?;
    let range = repositories::budget::get_active_range(pool, budget_id, ctx.today)
        .await?
        .ok_or_else(|| ApiError::NotFound("No active budget range for current date".to_string()))?;
    let spend = period_spend(pool, &ctx, &budget.filters, &range).await?;

    Ok(BudgetStatus {
        budget_id,
        name: budget.name,
        current_spending: spend.spent.to_string(),
        limit_amount: range.limit_amount.to_string(),
        remaining: (&range.limit_amount - &spend.spent).to_string(),
        percentage_used: spend.percentage_used,
        is_over_budget: spend.status == BudgetHealth::Over,
        status: spend.status,
        period: range.period,
        period_start: spend.window_start,
        period_end: spend.window_end,
        days_left: spend.days_left,
        currency: ctx.currency,
    })
}
