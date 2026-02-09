//! Import-related data models for CSV parsing

use bigdecimal::BigDecimal;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::types::ConfidenceLevel;

/// Parsed transaction from CSV file
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParsedTransaction {
    /// Temporary ID for frontend tracking (not stored in database)
    pub temp_id: String,
    /// Transaction title (merchant name)
    pub title: String,
    /// Transaction amount (negative for expenses, positive for income)
    pub amount: BigDecimal,
    /// Transaction date and time
    pub date: DateTime<Utc>,
    /// Notes (includes statement ID and card number)
    pub notes: Option<String>,
    /// Original currency if different from account currency
    pub original_currency: Option<String>,
    /// Original amount before currency conversion
    pub original_amount: Option<BigDecimal>,
    /// Whether the transaction passed validation
    pub is_valid: bool,
    /// Validation error messages if any
    pub validation_errors: Option<Vec<String>>,
    /// Whether this might be a duplicate
    pub is_potential_duplicate: bool,
    /// Duplicate match details if found
    pub duplicate_match: Option<DuplicateMatch>,
}

/// Information about a potential duplicate transaction
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DuplicateMatch {
    /// ID of the existing transaction in database
    pub transaction_id: Uuid,
    /// Confidence level of the match
    pub confidence: ConfidenceLevel,
    /// Fields that matched
    pub matched_on: Vec<String>,
    /// Date of the existing transaction
    pub matched_date: DateTime<Utc>,
}

/// Summary statistics for parsed transactions
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImportSummary {
    /// Total number of transactions
    pub total: usize,
    /// Number of income transactions
    pub income: usize,
    /// Number of expense transactions
    pub expenses: usize,
    /// Number of potential duplicates
    pub duplicates: usize,
    /// Number of invalid transactions
    pub invalid: usize,
}

/// Response from parse CSV endpoint
#[derive(Debug, Serialize, Deserialize)]
pub struct ParseResponse {
    pub success: bool,
    pub data: ParseData,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub errors: Option<Vec<String>>,
}

/// Data payload for parse response
#[derive(Debug, Serialize, Deserialize)]
pub struct ParseData {
    pub account_id: Uuid,
    pub transactions: Vec<ParsedTransaction>,
    pub summary: ImportSummary,
}
