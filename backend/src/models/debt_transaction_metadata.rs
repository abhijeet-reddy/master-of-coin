use chrono::{DateTime, Utc};
use diesel::{Identifiable, Insertable, Queryable, Selectable};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::schema::debt_transaction_metadata;

/// Database model for debt transaction metadata.
/// Links a transaction (on a DEBT account) to the person who paid for it.
#[derive(Debug, Clone, Serialize, Deserialize, Queryable, Selectable, Identifiable)]
#[diesel(table_name = debt_transaction_metadata)]
#[diesel(check_for_backend(diesel::pg::Pg))]
pub struct DebtTransactionMetadata {
    pub id: Uuid,
    pub transaction_id: Uuid,
    pub payer_person_id: Uuid,
    pub created_at: DateTime<Utc>,
}

/// Insertable struct for creating new debt transaction metadata.
#[derive(Debug, Insertable)]
#[diesel(table_name = debt_transaction_metadata)]
pub struct NewDebtTransactionMetadata {
    pub transaction_id: Uuid,
    pub payer_person_id: Uuid,
}

/// Request DTO for creating a "paid by others" transaction.
#[derive(Debug, Clone, Deserialize, validator::Validate)]
pub struct CreateDebtTransactionRequest {
    /// The person who paid for this expense
    pub payer_person_id: Uuid,

    /// Currency for the DEBT account (defaults to EUR if not provided)
    pub currency: Option<crate::types::CurrencyCode>,

    /// Optional category for budget tracking
    pub category_id: Option<Uuid>,

    /// Title of the transaction
    #[validate(length(
        min = 1,
        max = 255,
        message = "Title must be between 1 and 255 characters"
    ))]
    pub title: String,

    /// Amount: negative for expenses paid by others, positive for money collected on your behalf
    pub amount: f64,

    /// Date of the transaction
    pub date: DateTime<Utc>,

    /// Optional notes
    #[validate(length(max = 1000, message = "Notes must not exceed 1000 characters"))]
    pub notes: Option<String>,
}

/// Response DTO for debt metadata, grouped as an object in TransactionResponse.
/// Null for normal transactions, populated for "paid by others" transactions.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DebtMetadataResponse {
    pub payer_person_id: Uuid,
    pub payer_person_name: String,
}
