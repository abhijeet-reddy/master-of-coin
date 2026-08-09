use bigdecimal::BigDecimal;
use chrono::{DateTime, Utc};
use diesel::{Identifiable, Insertable, Queryable, Selectable};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use validator::Validate;

use crate::models::TransactionResponse;
use crate::schema::transfers;

/// Database model — maps directly to the `transfers` table row.
#[derive(Debug, Clone, Serialize, Deserialize, Queryable, Selectable, Identifiable)]
#[diesel(table_name = transfers)]
#[diesel(check_for_backend(diesel::pg::Pg))]
pub struct Transfer {
    pub id: Uuid,
    pub from_transaction_id: Uuid,
    pub to_transaction_id: Uuid,
    pub exchange_rate: BigDecimal,
    pub created_at: DateTime<Utc>,
}

/// Insertable struct for creating new transfer rows.
#[derive(Debug, Insertable)]
#[diesel(table_name = transfers)]
pub struct NewTransfer {
    pub from_transaction_id: Uuid,
    pub to_transaction_id: Uuid,
    pub exchange_rate: BigDecimal,
}

/// Request DTO — what the API consumer sends to create a transfer.
#[derive(Debug, Deserialize, Validate)]
pub struct CreateTransferRequest {
    pub from_account_id: Uuid,
    pub to_account_id: Uuid,
    #[validate(range(min = 0.01, message = "Transfer amount must be positive"))]
    pub from_amount: f64,
    pub to_amount: Option<f64>,
    pub exchange_rate: Option<f64>,
    #[validate(length(min = 1, max = 255))]
    pub title: Option<String>,
    pub date: DateTime<Utc>,
    #[validate(length(max = 1000))]
    pub notes: Option<String>,
    pub category_id: Option<Uuid>,
}

/// Request DTO for converting an existing transaction into a transfer.
///
/// The transaction to convert is identified by the path; the caller supplies
/// the counterpart account. Direction is inferred from the original
/// transaction's amount sign (negative = money left the original account, so
/// the counterpart is the destination; positive = money arrived, so the
/// counterpart is the source), so it never needs to be stated.
#[derive(Debug, Deserialize, Validate)]
pub struct ConvertToTransferRequest {
    /// The counterpart account for the other leg of the transfer.
    pub account_id: Uuid,
    /// The absolute amount on the counterpart account's leg. Optional. When
    /// omitted the counterpart leg mirrors the original amount. When supplied it
    /// is honoured for same-currency transfers too, so the two legs can differ
    /// (e.g. a discounted gift-card top-up), not just cross-currency ones.
    pub counterpart_amount: Option<f64>,
    /// Alternative to `counterpart_amount` for cross-currency conversions.
    pub exchange_rate: Option<f64>,
    /// When set, LINK this existing transaction in the counterpart account as
    /// the other leg instead of CREATING a new one. The id must belong to the
    /// user, sit in `account_id`, have the opposite sign, and not already be a
    /// transfer, split, or soft-deleted (re-validated server-side). When absent
    /// the endpoint creates a new counterpart leg (the original behaviour).
    pub counterpart_transaction_id: Option<Uuid>,
}

/// A candidate transaction that could be linked as the counterpart leg of a
/// convert-to-transfer. Returned by the candidate-search endpoint so the user
/// can choose one rather than the server guessing.
#[derive(Debug, Serialize, Deserialize)]
pub struct TransferCandidate {
    pub id: Uuid,
    pub title: String,
    /// Signed amount, as a string to preserve decimal precision.
    pub amount: String,
    pub date: DateTime<Utc>,
}

/// Response DTO — what the API returns after creating a transfer.
#[derive(Debug, Serialize, Deserialize)]
pub struct TransferResponse {
    pub id: Uuid,
    pub from_transaction: TransactionResponse,
    pub to_transaction: TransactionResponse,
    pub exchange_rate: String,
    pub created_at: DateTime<Utc>,
}

/// Transfer metadata attached to transactions in listing responses.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TransferInfo {
    pub transfer_id: Uuid,
    pub linked_account_id: Uuid,
    pub linked_account_name: String,
    /// Signed amount of the LINKED (counterpart) leg, as a string to preserve
    /// decimal precision. Combined with this transaction's own amount it lets
    /// the UI show unequal-leg transfers (the delta) without another lookup.
    pub linked_amount: String,
}
