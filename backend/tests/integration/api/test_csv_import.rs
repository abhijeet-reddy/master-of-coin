//! Integration tests for CSV import functionality
//!
//! These tests verify:
//! - CSV parsing with various formats
//! - Duplicate detection logic
//! - Validation of parsed transactions
//! - Error handling for invalid CSV files

use bigdecimal::BigDecimal;
use chrono::Utc;
use master_of_coin_backend::{
    config::ImportConfig,
    models::{
        ParsedTransaction,
        parser_error::{ParserError, ValidationError},
    },
    services::csv_parser_service::{CSVStatementParser, ParserFactory, StatementParser},
    types::ConfidenceLevel,
};
use std::str::FromStr;

/// Helper to create test import config
fn test_import_config() -> ImportConfig {
    ImportConfig {
        max_file_size: 5 * 1024 * 1024,
        max_transactions: 1000,
        duplicate_confidence_threshold: "MEDIUM".to_string(),
    }
}

#[test]
fn test_parse_valid_csv() {
    let csv_data = b"id,time,merchant,type,amount,card
UHOYQ4D4,2026-01-03 03:27:50,Amazon.co.uk,Purchase,\xE2\x82\xAC-108.12,\xE2\x80\xA2\xE2\x80\xA2\xE2\x80\xA2\xE2\x80\xA2 2133
V1GQX4AU,2026-01-02 12:18:23,JOSEPH ABELL,Purchase,\xE2\x82\xAC-23.84,\xE2\x80\xA2\xE2\x80\xA2\xE2\x80\xA2\xE2\x80\xA2 2133";

    let parser = CSVStatementParser;
    let config = test_import_config();
    let result = parser.parse(csv_data, &config);

    assert!(result.is_ok());
    let transactions = result.unwrap();
    assert_eq!(transactions.len(), 2);

    // Check first transaction
    assert_eq!(transactions[0].title, "Amazon.co.uk");
    assert_eq!(
        transactions[0].amount,
        BigDecimal::from_str("-108.12").unwrap()
    );
    assert!(transactions[0].notes.as_ref().unwrap().contains("UHOYQ4D4"));
    assert!(transactions[0].notes.as_ref().unwrap().contains("2133"));
}

#[test]
fn test_parse_refund_transaction() {
    let csv_data = b"id,time,merchant,type,amount,card
TEST123,2026-01-29 03:44:24,AMAZON UK,Refund,\xC2\xA389.45,\xE2\x80\xA2\xE2\x80\xA2\xE2\x80\xA2\xE2\x80\xA2 2133";

    let parser = CSVStatementParser;
    let config = test_import_config();
    let result = parser.parse(csv_data, &config);

    assert!(result.is_ok());
    let transactions = result.unwrap();
    assert_eq!(transactions.len(), 1);

    // Refund should be positive
    assert_eq!(
        transactions[0].amount,
        BigDecimal::from_str("89.45").unwrap()
    );
    assert!(transactions[0].amount > BigDecimal::from(0));
}

#[test]
fn test_parse_different_currencies() {
    let csv_data = b"id,time,merchant,type,amount,card
ID1,2026-01-03 03:27:50,Merchant1,Purchase,\xE2\x82\xAC-100.00,\xE2\x80\xA2\xE2\x80\xA2\xE2\x80\xA2\xE2\x80\xA2 2133
ID2,2026-01-04 03:27:50,Merchant2,Purchase,\xC2\xA3-50.00,\xE2\x80\xA2\xE2\x80\xA2\xE2\x80\xA2\xE2\x80\xA2 2133
ID3,2026-01-05 03:27:50,Merchant3,Purchase,$-75.00,\xE2\x80\xA2\xE2\x80\xA2\xE2\x80\xA2\xE2\x80\xA2 2133";

    let parser = CSVStatementParser;
    let config = test_import_config();
    let result = parser.parse(csv_data, &config);

    assert!(result.is_ok());
    let transactions = result.unwrap();
    assert_eq!(transactions.len(), 3);

    // EUR transaction
    assert_eq!(transactions[0].original_currency, None);
    assert_eq!(transactions[0].original_amount, None);

    // GBP transaction
    assert_eq!(transactions[1].original_currency, Some("GBP".to_string()));
    assert!(transactions[1].original_amount.is_some());

    // USD transaction
    assert_eq!(transactions[2].original_currency, Some("USD".to_string()));
    assert!(transactions[2].original_amount.is_some());
}

#[test]
fn test_parse_empty_csv() {
    let csv_data = b"id,time,merchant,type,amount,card";

    let parser = CSVStatementParser;
    let config = test_import_config();
    let result = parser.parse(csv_data, &config);

    assert!(result.is_err());
    assert!(matches!(result.unwrap_err(), ParserError::EmptyFile));
}

#[test]
fn test_parse_missing_field() {
    let csv_data = b"id,time,merchant,type,amount,card
ID1,2026-01-03 03:27:50,Amazon.co.uk,Purchase";

    let parser = CSVStatementParser;
    let config = test_import_config();
    let result = parser.parse(csv_data, &config);

    assert!(result.is_err());
    // CSV parser will detect missing fields when trying to access them
    // The error could be MissingField for "amount" or "card"
    match result.unwrap_err() {
        ParserError::MissingField { field, line } => {
            // Either amount or card could be missing
            assert!(field == "amount" || field == "card");
            assert_eq!(line, 2);
        }
        ParserError::CsvError { line, .. } => {
            // CSV library might detect the issue first
            assert_eq!(line, 2);
        }
        other => panic!("Expected MissingField or CsvError, got: {:?}", other),
    }
}

#[test]
fn test_parse_invalid_timestamp() {
    let csv_data = b"id,time,merchant,type,amount,card
ID1,invalid-date,Amazon.co.uk,Purchase,\xE2\x82\xAC-108.12,\xE2\x80\xA2\xE2\x80\xA2\xE2\x80\xA2\xE2\x80\xA2 2133";

    let parser = CSVStatementParser;
    let config = test_import_config();
    let result = parser.parse(csv_data, &config);

    assert!(result.is_err());
    assert!(matches!(
        result.unwrap_err(),
        ParserError::InvalidTimestamp { .. }
    ));
}

#[test]
fn test_parse_invalid_amount() {
    let csv_data = b"id,time,merchant,type,amount,card
ID1,2026-01-03 03:27:50,Amazon.co.uk,Purchase,\xE2\x82\xACinvalid,\xE2\x80\xA2\xE2\x80\xA2\xE2\x80\xA2\xE2\x80\xA2 2133";

    let parser = CSVStatementParser;
    let config = test_import_config();
    let result = parser.parse(csv_data, &config);

    assert!(result.is_err());
    assert!(matches!(
        result.unwrap_err(),
        ParserError::InvalidAmount { .. }
    ));
}

#[test]
fn test_parse_too_many_transactions() {
    let parser = CSVStatementParser;
    let mut config = test_import_config();
    config.max_transactions = 2;

    let csv_data = b"id,time,merchant,type,amount,card
ID1,2026-01-03 03:27:50,Merchant1,Purchase,\xE2\x82\xAC-10.00,\xE2\x80\xA2\xE2\x80\xA2\xE2\x80\xA2\xE2\x80\xA2 2133
ID2,2026-01-03 03:27:50,Merchant2,Purchase,\xE2\x82\xAC-20.00,\xE2\x80\xA2\xE2\x80\xA2\xE2\x80\xA2\xE2\x80\xA2 2133
ID3,2026-01-03 03:27:50,Merchant3,Purchase,\xE2\x82\xAC-30.00,\xE2\x80\xA2\xE2\x80\xA2\xE2\x80\xA2\xE2\x80\xA2 2133";

    let result = parser.parse(csv_data, &config);

    assert!(result.is_err());
    match result.unwrap_err() {
        ParserError::TooManyTransactions { found, max } => {
            assert_eq!(max, 2);
            assert_eq!(found, 3);
        }
        _ => panic!("Expected TooManyTransactions error"),
    }
}

#[test]
fn test_validation_empty_title() {
    let parser = CSVStatementParser;
    let transaction = ParsedTransaction {
        temp_id: "test".to_string(),
        title: "".to_string(),
        amount: BigDecimal::from(100),
        date: Utc::now(),
        notes: None,
        original_currency: None,
        original_amount: None,
        is_valid: true,
        validation_errors: None,
        is_potential_duplicate: false,
        duplicate_match: None,
    };

    let errors = parser.validate(&transaction);
    assert!(errors.contains(&ValidationError::EmptyTitle));
}

#[test]
fn test_validation_zero_amount() {
    let parser = CSVStatementParser;
    let transaction = ParsedTransaction {
        temp_id: "test".to_string(),
        title: "Test Merchant".to_string(),
        amount: BigDecimal::from(0),
        date: Utc::now(),
        notes: None,
        original_currency: None,
        original_amount: None,
        is_valid: true,
        validation_errors: None,
        is_potential_duplicate: false,
        duplicate_match: None,
    };

    let errors = parser.validate(&transaction);
    assert!(errors.contains(&ValidationError::ZeroAmount));
}

#[test]
fn test_validation_future_date() {
    let parser = CSVStatementParser;
    let future_date = Utc::now() + chrono::Duration::days(1);

    let transaction = ParsedTransaction {
        temp_id: "test".to_string(),
        title: "Test Merchant".to_string(),
        amount: BigDecimal::from(100),
        date: future_date,
        notes: None,
        original_currency: None,
        original_amount: None,
        is_valid: true,
        validation_errors: None,
        is_potential_duplicate: false,
        duplicate_match: None,
    };

    let errors = parser.validate(&transaction);
    assert!(errors.contains(&ValidationError::FutureDate));
}

#[test]
fn test_parser_factory_csv() {
    let result = ParserFactory::get_parser(".csv");
    assert!(result.is_ok());
}

#[test]
fn test_parser_factory_unsupported() {
    let result = ParserFactory::get_parser(".pdf");
    assert!(result.is_err());
    match result {
        Err(ParserError::UnsupportedFileType { .. }) => {} // Expected
        _ => panic!("Expected UnsupportedFileType error"),
    }
}

#[test]
fn test_confidence_level_is_duplicate() {
    assert!(ConfidenceLevel::High.is_duplicate());
    assert!(ConfidenceLevel::Medium.is_duplicate());
    assert!(!ConfidenceLevel::Low.is_duplicate());
}
