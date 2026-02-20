use bigdecimal::BigDecimal;
use chrono::{DateTime, Utc};
use diesel::{Identifiable, Insertable, Queryable, Selectable};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::schema::debt_transaction_metadata;

/// Database model for debt transaction metadata.
/// Links a transaction (on a DEBT account) to the person who paid for it,
/// and optionally stores the full expense details (total cost, all participants).
#[derive(Debug, Clone, Serialize, Deserialize, Queryable, Selectable, Identifiable)]
#[diesel(table_name = debt_transaction_metadata)]
#[diesel(check_for_backend(diesel::pg::Pg))]
pub struct DebtTransactionMetadata {
    pub id: Uuid,
    pub transaction_id: Uuid,
    pub payer_person_id: Uuid,
    pub created_at: DateTime<Utc>,
    /// The full expense amount (e.g., 120.00 when split among 4 people).
    /// Defaults to 0 for legacy rows (before this column was added).
    pub total_cost: BigDecimal,
    /// JSONB array of all participants with their paid/owed shares.
    /// Null for manually created debt transactions without full details.
    pub expense_participants: Option<serde_json::Value>,
}

/// Insertable struct for creating new debt transaction metadata.
#[derive(Debug, Insertable)]
#[diesel(table_name = debt_transaction_metadata)]
pub struct NewDebtTransactionMetadata {
    pub transaction_id: Uuid,
    pub payer_person_id: Uuid,
    pub total_cost: BigDecimal,
    pub expense_participants: Option<serde_json::Value>,
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
    /// This is the user's share (e.g., -30 if the user owes 30)
    pub amount: f64,

    /// Date of the transaction
    pub date: DateTime<Utc>,

    /// Optional notes
    #[validate(length(max = 1000, message = "Notes must not exceed 1000 characters"))]
    pub notes: Option<String>,

    /// The full expense amount (e.g., 120.00 when split among 4 people).
    /// If not provided, defaults to the absolute value of `amount`.
    pub total_cost: Option<f64>,

    /// All participants in the expense with their paid/owed shares.
    /// Optional — only populated when importing from Splitwise or when the user
    /// provides full expense details.
    pub expense_participants: Option<Vec<ExpenseParticipantInput>>,
}

/// Input DTO for an expense participant.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExpenseParticipantInput {
    /// Display name of the participant
    pub name: String,
    /// External user ID on the split provider (e.g., Splitwise user ID)
    pub external_user_id: Option<String>,
    /// Amount this participant paid (e.g., "120.00" for the payer)
    pub paid_share: String,
    /// Amount this participant owes (e.g., "30.00" for their share)
    pub owed_share: String,
}

/// Response DTO for debt metadata, grouped as an object in TransactionResponse.
/// Null for normal transactions, populated for "paid by others" transactions.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DebtMetadataResponse {
    pub payer_person_id: Uuid,
    pub payer_person_name: String,
    /// The full expense amount. "0" for legacy rows without this data.
    pub total_cost: String,
    /// All participants with their shares. Null if not available.
    pub expense_participants: Option<Vec<ExpenseParticipantResponse>>,
}

/// Response DTO for an expense participant.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExpenseParticipantResponse {
    pub name: String,
    pub external_user_id: Option<String>,
    pub paid_share: String,
    pub owed_share: String,
}

/// Request DTO for updating expense details on an existing debt transaction.
#[derive(Debug, Clone, Deserialize)]
pub struct UpdateExpenseDetailsRequest {
    /// The full expense amount (sum of all owed_shares).
    pub total_cost: f64,
    /// All participants in the expense with their paid/owed shares.
    pub expense_participants: Vec<ExpenseParticipantInput>,
}
