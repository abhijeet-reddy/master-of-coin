use bigdecimal::BigDecimal;
use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

use super::budget::BudgetPeriod;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
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
