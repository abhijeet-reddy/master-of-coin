use bigdecimal::BigDecimal;
use chrono::{DateTime, NaiveDate, Utc};
use diesel::{Identifiable, Insertable, Queryable, Selectable};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::schema::budget_ranges;
use crate::types::BudgetPeriod;

#[derive(Debug, Clone, Serialize, Deserialize, Queryable, Selectable, Identifiable)]
#[diesel(table_name = budget_ranges)]
pub struct BudgetRange {
    pub id: Uuid,
    pub budget_id: Uuid,
    pub limit_amount: BigDecimal,
    pub period: BudgetPeriod,
    pub start_date: NaiveDate,
    pub end_date: NaiveDate,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Insertable)]
#[diesel(table_name = budget_ranges)]
pub struct NewBudgetRange {
    pub budget_id: Uuid,
    pub limit_amount: BigDecimal,
    pub period: BudgetPeriod,
    pub start_date: NaiveDate,
    pub end_date: NaiveDate,
}

#[derive(Debug, Deserialize)]
pub struct CreateBudgetRange {
    pub budget_id: Uuid,
    pub limit_amount: BigDecimal,
    pub period: BudgetPeriod,
    pub start_date: NaiveDate,
    pub end_date: NaiveDate,
}

#[derive(Debug, Deserialize)]
pub struct UpdateBudgetRange {
    pub limit_amount: Option<BigDecimal>,
    pub period: Option<BudgetPeriod>,
    pub start_date: Option<NaiveDate>,
    pub end_date: Option<NaiveDate>,
}

// Request DTOs
#[derive(Debug, Deserialize, validator::Validate)]
pub struct CreateBudgetRangeRequest {
    pub budget_id: Uuid,
    #[validate(range(min = 0.01))]
    pub limit_amount: f64,
    pub period: BudgetPeriod,
    pub start_date: NaiveDate,
    pub end_date: NaiveDate,
}

#[derive(Debug, Deserialize, validator::Validate)]
pub struct UpdateBudgetRangeRequest {
    #[validate(range(min = 0.01))]
    pub limit_amount: Option<f64>,
    pub period: Option<BudgetPeriod>,
    pub start_date: Option<NaiveDate>,
    pub end_date: Option<NaiveDate>,
}

// Response DTOs
#[derive(Debug, Serialize)]
pub struct BudgetRangeResponse {
    pub id: Uuid,
    pub budget_id: Uuid,
    pub limit_amount: String, // BigDecimal as string for JSON
    pub period: BudgetPeriod,
    pub start_date: NaiveDate,
    pub end_date: NaiveDate,
}

impl From<BudgetRange> for BudgetRangeResponse {
    fn from(range: BudgetRange) -> Self {
        Self {
            id: range.id,
            budget_id: range.budget_id,
            limit_amount: range.limit_amount.to_string(),
            period: range.period,
            start_date: range.start_date,
            end_date: range.end_date,
        }
    }
}
