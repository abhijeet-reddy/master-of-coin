use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "budget_period", rename_all = "SCREAMING_SNAKE_CASE")]
pub enum BudgetPeriod {
    Daily,
    Weekly,
    Monthly,
    Quarterly,
    Yearly,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Budget {
    pub id: Uuid,
    pub user_id: Uuid,
    pub name: String,
    pub filters: JsonValue,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
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
#[derive(Debug, Serialize)]
pub struct BudgetResponse {
    pub id: Uuid,
    pub user_id: Uuid,
    pub name: String,
    pub filters: JsonValue,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}
