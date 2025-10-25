use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
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

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "category_type", rename_all = "SCREAMING_SNAKE_CASE")]
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
