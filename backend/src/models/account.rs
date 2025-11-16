use chrono::{DateTime, Utc};
use diesel::{Identifiable, Insertable, Queryable, Selectable};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::schema::accounts;
use crate::types::{AccountType, CurrencyCode};

#[derive(Debug, Clone, Serialize, Deserialize, Queryable, Selectable, Identifiable)]
#[diesel(table_name = accounts)]
#[diesel(check_for_backend(diesel::pg::Pg))]
pub struct Account {
    pub id: Uuid,
    pub user_id: Uuid,
    pub name: String,
    #[diesel(column_name = type_)]
    pub account_type: AccountType,
    pub currency: CurrencyCode,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Insertable)]
#[diesel(table_name = accounts)]
pub struct NewAccount {
    pub user_id: Uuid,
    pub name: String,
    #[diesel(column_name = type_)]
    pub account_type: AccountType,
    pub currency: CurrencyCode,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateAccount {
    pub name: String,
    pub account_type: AccountType,
    pub currency: CurrencyCode,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateAccount {
    pub name: Option<String>,
    pub notes: Option<String>,
}

// Request DTOs
#[derive(Debug, Deserialize, validator::Validate)]
pub struct CreateAccountRequest {
    #[validate(length(min = 1, max = 100))]
    pub name: String,
    pub account_type: AccountType,
    pub currency: Option<CurrencyCode>,
    #[validate(range(min = 0.0))]
    pub initial_balance: Option<f64>,
    #[validate(length(max = 500))]
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize, validator::Validate)]
pub struct UpdateAccountRequest {
    #[validate(length(min = 1, max = 100))]
    pub name: Option<String>,
    pub is_active: Option<bool>,
    #[validate(length(max = 500))]
    pub notes: Option<String>,
}

// Response DTOs
#[derive(Debug, Serialize, Deserialize)]
pub struct AccountResponse {
    pub id: Uuid,
    pub user_id: Uuid,
    pub name: String,
    pub account_type: AccountType,
    pub currency: CurrencyCode,
    pub balance: f64,
    pub is_active: bool,
    pub notes: Option<String>,
}
