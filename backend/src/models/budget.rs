use chrono::{DateTime, Utc};
use diesel::{Identifiable, Insertable, Queryable, Selectable};
use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;
use uuid::Uuid;

use crate::schema::budgets;

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
#[derive(Debug, Serialize)]
pub struct BudgetResponse {
    pub id: Uuid,
    pub user_id: Uuid,
    pub name: String,
    pub filters: JsonValue,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}
