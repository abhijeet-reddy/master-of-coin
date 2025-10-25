use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "account_type", rename_all = "SCREAMING_SNAKE_CASE")]
pub enum AccountType {
    Checking,
    Savings,
    CreditCard,
    Investment,
    Cash,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "currency_code", rename_all = "SCREAMING_SNAKE_CASE")]
pub enum CurrencyCode {
    Usd,
    Eur,
    Gbp,
    Inr,
    Jpy,
    Aud,
    Cad,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Account {
    pub id: Uuid,
    pub user_id: Uuid,
    pub name: String,
    #[sqlx(rename = "type")]
    pub account_type: AccountType,
    pub currency: CurrencyCode,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateAccount {
    pub name: String,
    pub account_type: AccountType,
    pub currency: Option<CurrencyCode>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateAccount {
    pub name: Option<String>,
    pub account_type: Option<AccountType>,
    pub currency: Option<CurrencyCode>,
    pub notes: Option<String>,
}

// Request DTOs
#[derive(Debug, Deserialize, validator::Validate)]
pub struct CreateAccountRequest {
    #[validate(length(min = 1, max = 100))]
    pub name: String,
    pub account_type: AccountType,
    pub currency: CurrencyCode,
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
#[derive(Debug, Serialize)]
pub struct AccountResponse {
    pub id: Uuid,
    pub user_id: Uuid,
    pub name: String,
    pub account_type: AccountType,
    pub currency: CurrencyCode,
    pub balance: f64,
    pub is_active: bool,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}
