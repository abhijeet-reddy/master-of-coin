use chrono::{DateTime, Utc};
use diesel::{Identifiable, Insertable, Queryable, Selectable};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::schema::categories;

#[derive(Debug, Clone, Serialize, Deserialize, Queryable, Selectable, Identifiable)]
#[diesel(table_name = categories)]
#[diesel(check_for_backend(diesel::pg::Pg))]
pub struct Category {
    pub id: Uuid,
    pub user_id: Uuid,
    pub name: String,
    pub icon: Option<String>,
    pub color: Option<String>,
    pub parent_category_id: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Insertable)]
#[diesel(table_name = categories)]
pub struct NewCategory {
    pub user_id: Uuid,
    pub name: String,
    pub icon: Option<String>,
    pub color: Option<String>,
    pub parent_category_id: Option<Uuid>,
}

#[derive(Debug, Deserialize)]
pub struct CreateCategory {
    pub name: String,
    pub icon: Option<String>,
    pub color: Option<String>,
    pub parent_category_id: Option<Uuid>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateCategory {
    pub name: Option<String>,
    pub icon: Option<String>,
    pub color: Option<String>,
    pub parent_category_id: Option<Uuid>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum CategoryType {
    Income,
    Expense,
}

// Request DTOs
#[derive(Debug, Deserialize, validator::Validate)]
pub struct CreateCategoryRequest {
    #[validate(length(min = 1, max = 100))]
    pub name: String,
    pub category_type: CategoryType,
    pub parent_id: Option<Uuid>,
    #[validate(length(max = 50))]
    pub icon: Option<String>,
    #[validate(length(max = 20))]
    pub color: Option<String>,
}

#[derive(Debug, Deserialize, validator::Validate)]
pub struct UpdateCategoryRequest {
    #[validate(length(min = 1, max = 100))]
    pub name: Option<String>,
    pub is_active: Option<bool>,
    #[validate(length(max = 50))]
    pub icon: Option<String>,
    #[validate(length(max = 20))]
    pub color: Option<String>,
}

// Response DTOs
#[derive(Debug, Serialize)]
pub struct CategoryResponse {
    pub id: Uuid,
    pub user_id: Uuid,
    pub name: String,
    pub category_type: CategoryType,
    pub parent_id: Option<Uuid>,
    pub icon: Option<String>,
    pub color: Option<String>,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
}
