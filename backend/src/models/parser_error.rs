//! Parser errors and validation errors for import functionality

use thiserror::Error;

/// Errors that can occur during statement parsing
#[derive(Debug, Error)]
pub enum ParserError {
    #[error("CSV parsing error at line {line}: {error}")]
    CsvError { line: usize, error: String },

    #[error("Missing required field '{field}' at line {line}")]
    MissingField { field: &'static str, line: usize },

    #[error("Invalid timestamp '{value}' at line {line}. Expected format: YYYY-MM-DD HH:MM:SS")]
    InvalidTimestamp { value: String, line: usize },

    #[error("Invalid amount '{value}' at line {line}")]
    InvalidAmount { value: String, line: usize },

    #[error("Invalid or unsupported currency '{value}' at line {line}. Supported: €, £, $")]
    InvalidCurrency { value: String, line: usize },

    #[error("Unsupported file type: {extension}. Supported types: .csv")]
    UnsupportedFileType { extension: String },

    #[error("Too many transactions: found {found}, maximum allowed is {max}")]
    TooManyTransactions { found: usize, max: usize },

    #[error("Empty CSV file or no valid transactions found")]
    EmptyFile,
}

/// Validation errors for parsed transactions
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ValidationError {
    EmptyTitle,
    TitleTooLong,
    ZeroAmount,
    FutureDate,
}

impl std::fmt::Display for ValidationError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ValidationError::EmptyTitle => write!(f, "Title cannot be empty"),
            ValidationError::TitleTooLong => write!(f, "Title exceeds 255 characters"),
            ValidationError::ZeroAmount => write!(f, "Amount cannot be zero"),
            ValidationError::FutureDate => write!(f, "Date cannot be in the future"),
        }
    }
}
