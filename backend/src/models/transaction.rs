use bigdecimal::BigDecimal;
use chrono::{DateTime, Utc};
use diesel::{Identifiable, Insertable, Queryable, Selectable};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::schema::transactions;

#[derive(Debug, Clone, Serialize, Deserialize, Queryable, Selectable, Identifiable)]
#[diesel(table_name = transactions)]
pub struct Transaction {
    pub id: Uuid,
    pub user_id: Uuid,
    pub account_id: Uuid,
    pub category_id: Option<Uuid>,
    pub title: String,
    pub amount: BigDecimal,
    pub date: DateTime<Utc>,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Insertable)]
#[diesel(table_name = transactions)]
pub struct NewTransaction<'a> {
    pub user_id: Uuid,
    pub account_id: Uuid,
    pub category_id: Option<Uuid>,
    pub title: &'a str,
    pub amount: BigDecimal,
    pub date: DateTime<Utc>,
    pub notes: Option<&'a str>,
}

#[derive(Debug, Deserialize)]
pub struct CreateTransaction {
    pub account_id: Uuid,
    pub category_id: Option<Uuid>,
    pub title: String,
    pub amount: BigDecimal,
    pub date: DateTime<Utc>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateTransaction {
    pub account_id: Option<Uuid>,
    pub category_id: Option<Uuid>,
    pub title: Option<String>,
    pub amount: Option<BigDecimal>,
    pub date: Option<DateTime<Utc>>,
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum TransactionType {
    Income,
    Expense,
    Transfer,
}

// Request DTOs
#[derive(Debug, Deserialize, validator::Validate)]
pub struct CreateTransactionRequest {
    pub account_id: Uuid,
    #[validate(range(min = 0.01))]
    pub amount: f64,
    pub transaction_type: TransactionType,
    #[validate(length(min = 1, max = 200))]
    pub description: String,
    pub category_id: Option<Uuid>,
    pub transaction_date: DateTime<Utc>,
    pub person_id: Option<Uuid>,
    #[validate(length(max = 1000))]
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize, validator::Validate)]
pub struct UpdateTransactionRequest {
    #[validate(length(min = 1, max = 200))]
    pub description: Option<String>,
    pub category_id: Option<Uuid>,
    pub person_id: Option<Uuid>,
    #[validate(length(max = 1000))]
    pub notes: Option<String>,
}

// Response DTOs
#[derive(Debug, Serialize)]
pub struct TransactionResponse {
    pub id: Uuid,
    pub user_id: Uuid,
    pub account_id: Uuid,
    pub category_id: Option<Uuid>,
    pub title: String,
    pub amount: String, // BigDecimal as string for JSON
    pub transaction_type: TransactionType,
    pub date: DateTime<Utc>,
    pub person_id: Option<Uuid>,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

// Filter for querying transactions
#[derive(Debug, Deserialize, validator::Validate)]
pub struct TransactionFilter {
    pub account_id: Option<Uuid>,
    pub category_id: Option<Uuid>,
    pub transaction_type: Option<TransactionType>,
    pub person_id: Option<Uuid>,
    pub start_date: Option<DateTime<Utc>>,
    pub end_date: Option<DateTime<Utc>>,
    #[validate(range(min = 1, max = 100))]
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}
