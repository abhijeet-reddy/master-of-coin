use bigdecimal::BigDecimal;
use chrono::{DateTime, Utc};
use diesel::{Identifiable, Insertable, Queryable, Selectable};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use validator::Validate;

use crate::schema::transaction_splits;

#[derive(Debug, Clone, Serialize, Deserialize, Queryable, Selectable, Identifiable)]
#[diesel(table_name = transaction_splits)]
#[diesel(check_for_backend(diesel::pg::Pg))]
pub struct TransactionSplit {
    pub id: Uuid,
    pub transaction_id: Uuid,
    pub person_id: Uuid,
    pub amount: BigDecimal,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Insertable)]
#[diesel(table_name = transaction_splits)]
pub struct NewTransactionSplit {
    pub transaction_id: Uuid,
    pub person_id: Uuid,
    pub amount: BigDecimal,
}

#[derive(Debug, Deserialize)]
pub struct CreateTransactionSplit {
    pub transaction_id: Uuid,
    pub person_id: Uuid,
    pub amount: BigDecimal,
}

#[derive(Debug, Deserialize)]
pub struct UpdateTransactionSplit {
    pub person_id: Option<Uuid>,
    pub amount: Option<BigDecimal>,
}

// Request DTOs with validation
#[derive(Debug, Deserialize, Validate)]
pub struct CreateTransactionSplitRequest {
    pub transaction_id: Uuid,
    pub person_id: Uuid,

    /// Amount must be positive and non-zero
    #[validate(range(min = 0.01, message = "Split amount must be greater than 0"))]
    pub amount: f64,
}

#[derive(Debug, Deserialize, Validate)]
pub struct UpdateTransactionSplitRequest {
    pub person_id: Option<Uuid>,

    /// Amount must be positive and non-zero if provided
    #[validate(custom(function = "validate_optional_positive_amount"))]
    pub amount: Option<f64>,
}

// Custom validator for optional positive amount
fn validate_optional_positive_amount(amount: f64) -> Result<(), validator::ValidationError> {
    if amount <= 0.0 {
        let mut error = validator::ValidationError::new("amount_not_positive");
        error.message = Some("Split amount must be greater than 0".into());
        return Err(error);
    }
    Ok(())
}

pub fn validate_splits_sum(
    splits: &[f64],
    transaction_amount: f64,
) -> Result<(), validator::ValidationError> {
    if splits.is_empty() {
        return Ok(());
    }

    let total: f64 = splits.iter().sum();

    // Splits sum must not exceed transaction amount
    if total > transaction_amount.abs() {
        let mut error = validator::ValidationError::new("splits_exceed_amount");
        error.message = Some(
            format!(
                "Sum of splits ({:.2}) cannot exceed transaction amount ({:.2})",
                total,
                transaction_amount.abs()
            )
            .into(),
        );
        return Err(error);
    }

    Ok(())
}

// Response DTOs
#[derive(Debug, Serialize)]
pub struct TransactionSplitResponse {
    pub id: Uuid,
    pub person_id: Uuid,
    /// BigDecimal as string for JSON serialization
    pub amount: String,
}

impl From<TransactionSplit> for TransactionSplitResponse {
    fn from(split: TransactionSplit) -> Self {
        TransactionSplitResponse {
            id: split.id,
            person_id: split.person_id,
            amount: split.amount.to_string(),
        }
    }
}
