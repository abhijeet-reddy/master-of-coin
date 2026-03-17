//! Bulk transaction operations models

use serde::{Deserialize, Serialize};
use uuid::Uuid;

use super::{CreateTransactionRequest, TransactionResponse};

/// Request for bulk create transactions
#[derive(Debug, Deserialize)]
pub struct BulkCreateRequest {
    pub account_id: Uuid,
    pub transactions: Vec<CreateTransactionRequest>,
    /// Optional bank sync metadata for creating bank_sync_records alongside transactions.
    /// When present, each created transaction is linked to its external bank transaction ID.
    #[serde(default)]
    pub bank_sync_metadata: Option<BankSyncMetadata>,
}

/// Bank sync metadata to link imported transactions to their external bank IDs.
///
/// The `external_transaction_ids` array must be parallel to the `transactions` array
/// in `BulkCreateRequest` — i.e. `external_transaction_ids[i]` corresponds to
/// `transactions[i]`.
#[derive(Debug, Deserialize)]
pub struct BankSyncMetadata {
    /// The bank provider that sourced these transactions
    pub bank_provider_id: Uuid,
    /// External transaction IDs from the bank, parallel to the transactions array
    pub external_transaction_ids: Vec<String>,
}

/// Response from bulk create endpoint
#[derive(Debug, Serialize, Deserialize)]
pub struct BulkCreateResponse {
    pub success: bool,
    pub data: BulkCreateData,
}

/// Data payload for bulk create response
#[derive(Debug, Serialize, Deserialize)]
pub struct BulkCreateData {
    /// Number of successfully created transactions
    pub created: usize,
    /// Number of failed transactions
    pub failed: usize,
    /// Successfully created transactions
    pub transactions: Vec<TransactionResponse>,
    /// Errors for failed transactions
    #[serde(skip_serializing_if = "Option::is_none")]
    pub errors: Option<Vec<BulkCreateError>>,
}

/// Error information for a failed transaction in bulk create
#[derive(Debug, Serialize, Deserialize)]
pub struct BulkCreateError {
    /// Index of the transaction in the request array
    pub index: usize,
    /// Error message
    pub error: String,
}
