use chrono::{DateTime, Utc};
use diesel::{Identifiable, Insertable, Queryable, Selectable};
use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;
use uuid::Uuid;

use crate::models::budget_range::BudgetRangeResponse;
use crate::schema::budgets;
use crate::types::CurrencyCode;

#[derive(Debug, Clone, Serialize, Deserialize, Queryable, Selectable, Identifiable)]
#[diesel(table_name = budgets)]
#[diesel(check_for_backend(diesel::pg::Pg))]
pub struct Budget {
    pub id: Uuid,
    pub user_id: Uuid,
    pub name: String,
    pub filters: JsonValue,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Insertable)]
#[diesel(table_name = budgets)]
pub struct NewBudget {
    pub user_id: Uuid,
    pub name: String,
    pub filters: JsonValue,
}

#[derive(Debug, Deserialize)]
pub struct CreateBudget {
    pub name: String,
    pub filters: JsonValue,
}

#[derive(Debug, Deserialize)]
pub struct UpdateBudget {
    pub name: Option<String>,
    pub filters: Option<JsonValue>,
}

// Request DTOs
#[derive(Debug, Deserialize, validator::Validate)]
pub struct CreateBudgetRequest {
    #[validate(length(min = 1, max = 100))]
    pub name: String,
    pub filters: JsonValue,
}

#[derive(Debug, Deserialize, validator::Validate)]
pub struct UpdateBudgetRequest {
    #[validate(length(min = 1, max = 100))]
    pub name: Option<String>,
    pub filters: Option<JsonValue>,
}

// Response DTOs
#[derive(Debug, Serialize, Deserialize)]
pub struct BudgetResponse {
    pub id: Uuid,
    pub user_id: Uuid,
    pub name: String,
    pub filters: JsonValue,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub active_range: Option<BudgetRangeResponse>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub current_spending: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub percentage_used: Option<f64>,
    /// limit - spent for the current period (negative when over).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub remaining: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub status: Option<BudgetHealth>,
    /// Days left in the current period, counting today (0 once it has ended).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub days_left: Option<i64>,
    /// Currency of current_spending / remaining (the user's default currency).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub currency: Option<CurrencyCode>,
}

/// Budget health for the current period: `on_track` below 80%, `warning`
/// from 80% up to the limit, `over` once spending exceeds the limit.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum BudgetHealth {
    OnTrack,
    Warning,
    Over,
}

/// Percentage at which a budget turns from `on_track` to `warning`.
pub const BUDGET_WARNING_PERCENT: f64 = 80.0;

impl From<Budget> for BudgetResponse {
    fn from(budget: Budget) -> Self {
        Self {
            id: budget.id,
            user_id: budget.user_id,
            name: budget.name,
            filters: budget.filters,
            active_range: None,
            current_spending: None,
            percentage_used: None,
            remaining: None,
            status: None,
            days_left: None,
            currency: None,
        }
    }
}
