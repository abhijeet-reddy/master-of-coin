use bigdecimal::BigDecimal;
use chrono::{DateTime, Utc};
use diesel::{Identifiable, Insertable, Queryable, Selectable};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use validator::Validate;

use super::transaction_split;
use crate::schema::transactions;

#[derive(Debug, Clone, Serialize, Deserialize, Queryable, Selectable, Identifiable)]
#[diesel(table_name = transactions)]
#[diesel(check_for_backend(diesel::pg::Pg))]
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
pub struct NewTransaction {
    pub user_id: Uuid,
    pub account_id: Uuid,
    pub category_id: Option<Uuid>,
    pub title: String,
    pub amount: BigDecimal,
    pub date: DateTime<Utc>,
    pub notes: Option<String>,
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

// Split information for transaction creation
#[derive(Debug, Clone, Deserialize, Validate)]
pub struct TransactionSplitInput {
    pub person_id: Uuid,
    /// Amount must be positive and non-zero
    #[validate(range(min = 0.01, message = "Split amount must be greater than 0"))]
    pub amount: f64,
}

// Request DTOs
#[derive(Debug, Deserialize, Validate)]
#[validate(schema(function = "validate_transaction_request"))]
pub struct CreateTransactionRequest {
    pub account_id: Uuid,
    pub category_id: Option<Uuid>,

    #[validate(length(
        min = 1,
        max = 255,
        message = "Title must be between 1 and 255 characters"
    ))]
    pub title: String,

    /// Amount must be non-zero (can be negative for expenses)
    #[validate(custom(function = "validate_amount_not_zero"))]
    pub amount: f64,

    pub date: DateTime<Utc>,

    #[validate(length(max = 1000, message = "Notes must not exceed 1000 characters"))]
    pub notes: Option<String>,

    /// Optional splits for shared transactions
    /// Each split must have a positive amount, and total splits must not exceed transaction amount
    #[validate(nested)]
    pub splits: Option<Vec<TransactionSplitInput>>,
}

// Custom validator for amount not being zero
fn validate_amount_not_zero(amount: f64) -> Result<(), validator::ValidationError> {
    if amount == 0.0 {
        let mut error = validator::ValidationError::new("amount_zero");
        error.message = Some("Transaction amount cannot be zero".into());
        return Err(error);
    }
    Ok(())
}

// Schema-level validation for CreateTransactionRequest
fn validate_transaction_request(
    req: &CreateTransactionRequest,
) -> Result<(), validator::ValidationError> {
    if let Some(ref splits) = req.splits {
        // Validate each split
        for split in splits {
            split.validate().map_err(|_| {
                let mut error = validator::ValidationError::new("invalid_split");
                error.message = Some("One or more splits are invalid".into());
                error
            })?;
        }

        // Validate splits sum using the function from transaction_split module
        let split_amounts: Vec<f64> = splits.iter().map(|s| s.amount).collect();
        transaction_split::validate_splits_sum(&split_amounts, req.amount)?;
    }
    Ok(())
}

#[derive(Debug, Deserialize, Validate)]
pub struct UpdateTransactionRequest {
    pub account_id: Option<Uuid>,
    pub category_id: Option<Uuid>,

    #[validate(length(
        min = 1,
        max = 255,
        message = "Title must be between 1 and 255 characters"
    ))]
    pub title: Option<String>,

    /// Amount must be non-zero if provided
    #[validate(custom(function = "validate_optional_amount_not_zero"))]
    pub amount: Option<f64>,

    pub date: Option<DateTime<Utc>>,

    #[validate(length(max = 1000, message = "Notes must not exceed 1000 characters"))]
    pub notes: Option<String>,
}

// Custom validator for optional amount not being zero
fn validate_optional_amount_not_zero(amount: f64) -> Result<(), validator::ValidationError> {
    if amount == 0.0 {
        let mut error = validator::ValidationError::new("amount_zero");
        error.message = Some("Transaction amount cannot be zero".into());
        return Err(error);
    }
    Ok(())
}

// Filter for querying transactions (renamed from TransactionFilters to match mod.rs export)
#[derive(Debug, Deserialize, Validate)]
pub struct TransactionFilter {
    pub account_id: Option<Uuid>,
    pub category_id: Option<Uuid>,
    pub start_date: Option<DateTime<Utc>>,
    pub end_date: Option<DateTime<Utc>>,

    /// Minimum amount filter (can be negative)
    pub min_amount: Option<f64>,

    /// Maximum amount filter (can be negative)
    pub max_amount: Option<f64>,

    /// Search term for title or notes
    #[validate(length(max = 100, message = "Search term must not exceed 100 characters"))]
    pub search: Option<String>,

    /// Pagination: limit (1-100)
    #[validate(range(min = 1, max = 100, message = "Limit must be between 1 and 100"))]
    pub limit: Option<i64>,

    /// Pagination: offset
    #[validate(range(min = 0, message = "Offset must be non-negative"))]
    pub offset: Option<i64>,
}

// Response DTOs
#[derive(Debug, Serialize)]
pub struct TransactionResponse {
    pub id: Uuid,
    pub user_id: Uuid,
    pub account_id: Uuid,
    pub category_id: Option<Uuid>,
    pub title: String,
    /// BigDecimal as string for JSON serialization
    pub amount: String,
    pub date: DateTime<Utc>,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    /// Splits associated with this transaction
    pub splits: Option<Vec<TransactionSplitResponse>>,
}

#[derive(Debug, Serialize)]
pub struct TransactionSplitResponse {
    pub id: Uuid,
    pub person_id: Uuid,
    pub amount: String,
}

impl From<Transaction> for TransactionResponse {
    fn from(transaction: Transaction) -> Self {
        TransactionResponse {
            id: transaction.id,
            user_id: transaction.user_id,
            account_id: transaction.account_id,
            category_id: transaction.category_id,
            title: transaction.title,
            amount: transaction.amount.to_string(),
            date: transaction.date,
            notes: transaction.notes,
            created_at: transaction.created_at,
            updated_at: transaction.updated_at,
            splits: None, // Populated separately when needed
        }
    }
}
