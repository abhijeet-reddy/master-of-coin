//! Bulk transaction operations models

use serde::{Deserialize, Serialize};
use uuid::Uuid;

use super::{CreateTransactionRequest, TransactionResponse};

/// Request for bulk create transactions
#[derive(Debug, Deserialize)]
pub struct BulkCreateRequest {
    pub account_id: Uuid,
    pub transactions: Vec<CreateTransactionRequest>,
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
