//! CSV statement parser service
//!
//! This module provides CSV parsing functionality for bank statement imports.
//! It uses a trait-based design to allow for future extension to other formats (PDF, etc.).

use bigdecimal::BigDecimal;
use chrono::{DateTime, NaiveDateTime, Utc};
use csv::Reader;
use std::str::FromStr;
use uuid::Uuid;

use crate::config::ImportConfig;
use crate::models::{
    ParsedTransaction,
    parser_error::{ParserError, ValidationError},
};
use crate::types::CurrencyCode;

/// Generic trait for parsing financial statements
///
/// This trait allows for multiple parser implementations (CSV, PDF, etc.)
/// while maintaining a consistent interface.
pub trait StatementParser: Send + Sync {
    /// Parse statement content and return transactions
    fn parse(
        &self,
        content: &[u8],
        config: &ImportConfig,
    ) -> Result<Vec<ParsedTransaction>, ParserError>;

    /// Validate a parsed transaction
    fn validate(&self, transaction: &ParsedTransaction) -> Vec<ValidationError>;

    /// Get supported file extensions
    fn supported_extensions(&self) -> Vec<&'static str>;

    /// Get parser name/description
    fn name(&self) -> &'static str;
}

/// CSV statement parser implementation
pub struct CSVStatementParser;

impl StatementParser for CSVStatementParser {
    fn parse(
        &self,
        content: &[u8],
        config: &ImportConfig,
    ) -> Result<Vec<ParsedTransaction>, ParserError> {
        let mut reader = Reader::from_reader(content);
        let mut transactions = Vec::new();

        for (index, result) in reader.records().enumerate() {
            // Check transaction limit
            if transactions.len() >= config.max_transactions {
                return Err(ParserError::TooManyTransactions {
                    found: index + 1,
                    max: config.max_transactions,
                });
            }

            let record = result.map_err(|e| ParserError::CsvError {
                line: index + 2, // +2 for header and 0-indexing
                error: e.to_string(),
            })?;

            let transaction = self.parse_record(&record, index + 2)?;
            transactions.push(transaction);
        }

        if transactions.is_empty() {
            return Err(ParserError::EmptyFile);
        }

        Ok(transactions)
    }

    fn validate(&self, transaction: &ParsedTransaction) -> Vec<ValidationError> {
        let mut errors = Vec::new();

        // Title validation
        if transaction.title.trim().is_empty() {
            errors.push(ValidationError::EmptyTitle);
        }
        if transaction.title.len() > 255 {
            errors.push(ValidationError::TitleTooLong);
        }

        // Amount validation
        if transaction.amount == BigDecimal::from(0) {
            errors.push(ValidationError::ZeroAmount);
        }

        // Date validation
        if transaction.date > Utc::now() {
            errors.push(ValidationError::FutureDate);
        }

        errors
    }

    fn supported_extensions(&self) -> Vec<&'static str> {
        vec![".csv"]
    }

    fn name(&self) -> &'static str {
        "CSV Statement Parser"
    }
}

impl CSVStatementParser {
    /// Parse a single CSV record into a ParsedTransaction
    ///
    /// Expected CSV format: id,time,merchant,type,amount,card
    ///
    /// # Arguments
    ///
    /// * `record` - CSV record to parse
    /// * `line_number` - Line number for error reporting
    ///
    /// # Returns
    ///
    /// Returns a `ParsedTransaction` on success
    ///
    /// # Errors
    ///
    /// Returns `ParserError` if any field is missing or invalid
    fn parse_record(
        &self,
        record: &csv::StringRecord,
        line_number: usize,
    ) -> Result<ParsedTransaction, ParserError> {
        // Parse statement ID (column 0)
        let statement_id = record
            .get(0)
            .ok_or(ParserError::MissingField {
                field: "id",
                line: line_number,
            })?
            .trim()
            .to_string();

        // Parse timestamp (column 1)
        let time_str = record.get(1).ok_or(ParserError::MissingField {
            field: "time",
            line: line_number,
        })?;
        let date = self.parse_timestamp(time_str, line_number)?;

        // Parse merchant (column 2)
        let title = record
            .get(2)
            .ok_or(ParserError::MissingField {
                field: "merchant",
                line: line_number,
            })?
            .trim()
            .to_string();

        // Parse type (column 3)
        let transaction_type = record.get(3).ok_or(ParserError::MissingField {
            field: "type",
            line: line_number,
        })?;

        // Parse amount (column 4)
        let amount_str = record.get(4).ok_or(ParserError::MissingField {
            field: "amount",
            line: line_number,
        })?;
        let (amount, currency) = self.parse_amount(amount_str, line_number)?;

        // Parse card (column 5)
        let card = record
            .get(5)
            .ok_or(ParserError::MissingField {
                field: "card",
                line: line_number,
            })?
            .trim()
            .to_string();

        // Store original amount before adjustment
        let original_amount_value = amount.clone();

        // Adjust amount based on type
        // Refunds should be positive, Purchases keep their sign
        let final_amount = if transaction_type == "Refund" {
            amount.abs()
        } else {
            amount
        };

        // Build notes: "Statement ID: {id} | Card: {card}"
        let notes = Some(format!("Statement ID: {} | Card: {}", statement_id, card));

        // Store original currency if different from EUR
        let (original_currency, original_amount) = if currency != CurrencyCode::Eur {
            (
                Some(currency.as_str().to_string()),
                Some(original_amount_value),
            )
        } else {
            (None, None)
        };

        Ok(ParsedTransaction {
            temp_id: Uuid::new_v4().to_string(),
            title,
            amount: final_amount,
            date,
            notes,
            original_currency,
            original_amount,
            is_valid: true,
            validation_errors: None,
            is_potential_duplicate: false,
            duplicate_match: None,
        })
    }

    /// Parse timestamp string to DateTime<Utc>
    ///
    /// Expected format: "2026-01-03 03:27:50"
    fn parse_timestamp(
        &self,
        timestamp_str: &str,
        line: usize,
    ) -> Result<DateTime<Utc>, ParserError> {
        let naive =
            NaiveDateTime::parse_from_str(timestamp_str, "%Y-%m-%d %H:%M:%S").map_err(|_| {
                ParserError::InvalidTimestamp {
                    value: timestamp_str.to_string(),
                    line,
                }
            })?;

        Ok(DateTime::from_naive_utc_and_offset(naive, Utc))
    }

    /// Parse amount string and extract currency
    ///
    /// Supported formats: €-108.12, £89.45, $100.00
    /// If no currency symbol is found, defaults to EUR
    ///
    /// # Arguments
    ///
    /// * `amount_str` - Amount string with optional currency symbol
    /// * `line` - Line number for error reporting
    ///
    /// # Returns
    ///
    /// Returns tuple of (amount, currency_code)
    fn parse_amount(
        &self,
        amount_str: &str,
        line: usize,
    ) -> Result<(BigDecimal, CurrencyCode), ParserError> {
        let amount_str = amount_str.trim();

        // Extract currency symbol and map to CurrencyCode
        // Default to EUR if no symbol found
        let (currency, number_str) = if amount_str.starts_with('€') {
            (CurrencyCode::Eur, amount_str.trim_start_matches('€'))
        } else if amount_str.starts_with('£') {
            (CurrencyCode::Gbp, amount_str.trim_start_matches('£'))
        } else if amount_str.starts_with('$') {
            (CurrencyCode::Usd, amount_str.trim_start_matches('$'))
        } else {
            // No currency symbol found, default to EUR
            (CurrencyCode::Eur, amount_str)
        };

        // Parse number
        let number_str = number_str.trim();
        let amount = BigDecimal::from_str(number_str).map_err(|_| ParserError::InvalidAmount {
            value: amount_str.to_string(),
            line,
        })?;

        Ok((amount, currency))
    }
}

/// Parser factory for creating appropriate parser based on file type
pub struct ParserFactory;

impl ParserFactory {
    /// Get parser for the given file extension
    ///
    /// # Arguments
    ///
    /// * `file_extension` - File extension including the dot (e.g., ".csv")
    ///
    /// # Returns
    ///
    /// Returns a boxed parser implementation
    ///
    /// # Errors
    ///
    /// Returns `ParserError::UnsupportedFileType` if the extension is not supported
    pub fn get_parser(file_extension: &str) -> Result<Box<dyn StatementParser>, ParserError> {
        match file_extension.to_lowercase().as_str() {
            ".csv" => Ok(Box::new(CSVStatementParser)),
            _ => Err(ParserError::UnsupportedFileType {
                extension: file_extension.to_string(),
            }),
        }
    }

    /// Get list of all supported extensions
    pub fn supported_extensions() -> Vec<&'static str> {
        vec![".csv"] // Add ".pdf" when implemented
    }
}
