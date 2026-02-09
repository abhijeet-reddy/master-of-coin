//! Integration tests for import service functionality
//!
//! These tests verify:
//! - Summary calculation for parsed transactions
//! - Confidence level logic
//! - Import service utilities

use bigdecimal::BigDecimal;
use chrono::Utc;
use master_of_coin_backend::{
    models::ParsedTransaction, services::import_service, types::ConfidenceLevel,
};

#[test]
fn test_import_summary_calculation() {
    let transactions = vec![
        ParsedTransaction {
            temp_id: "1".to_string(),
            title: "Income Transaction".to_string(),
            amount: BigDecimal::from(100),
            date: Utc::now(),
            notes: None,
            original_currency: None,
            original_amount: None,
            is_valid: true,
            validation_errors: None,
            is_potential_duplicate: false,
            duplicate_match: None,
        },
        ParsedTransaction {
            temp_id: "2".to_string(),
            title: "Expense Transaction".to_string(),
            amount: BigDecimal::from(-50),
            date: Utc::now(),
            notes: None,
            original_currency: None,
            original_amount: None,
            is_valid: true,
            validation_errors: None,
            is_potential_duplicate: true, // Marked as duplicate
            duplicate_match: None,
        },
        ParsedTransaction {
            temp_id: "3".to_string(),
            title: "Invalid Transaction".to_string(),
            amount: BigDecimal::from(0),
            date: Utc::now(),
            notes: None,
            original_currency: None,
            original_amount: None,
            is_valid: false, // Invalid
            validation_errors: Some(vec!["Zero amount".to_string()]),
            is_potential_duplicate: false,
            duplicate_match: None,
        },
        ParsedTransaction {
            temp_id: "4".to_string(),
            title: "Another Expense".to_string(),
            amount: BigDecimal::from(-75),
            date: Utc::now(),
            notes: None,
            original_currency: None,
            original_amount: None,
            is_valid: true,
            validation_errors: None,
            is_potential_duplicate: false,
            duplicate_match: None,
        },
    ];

    let summary = import_service::calculate_summary(&transactions);

    assert_eq!(summary.total, 4);
    assert_eq!(summary.income, 1);
    assert_eq!(summary.expenses, 2);
    assert_eq!(summary.duplicates, 1);
    assert_eq!(summary.invalid, 1);
}

#[test]
fn test_import_summary_empty() {
    let transactions = vec![];
    let summary = import_service::calculate_summary(&transactions);

    assert_eq!(summary.total, 0);
    assert_eq!(summary.income, 0);
    assert_eq!(summary.expenses, 0);
    assert_eq!(summary.duplicates, 0);
    assert_eq!(summary.invalid, 0);
}

#[test]
fn test_import_summary_all_income() {
    let transactions = vec![
        ParsedTransaction {
            temp_id: "1".to_string(),
            title: "Income 1".to_string(),
            amount: BigDecimal::from(100),
            date: Utc::now(),
            notes: None,
            original_currency: None,
            original_amount: None,
            is_valid: true,
            validation_errors: None,
            is_potential_duplicate: false,
            duplicate_match: None,
        },
        ParsedTransaction {
            temp_id: "2".to_string(),
            title: "Income 2".to_string(),
            amount: BigDecimal::from(200),
            date: Utc::now(),
            notes: None,
            original_currency: None,
            original_amount: None,
            is_valid: true,
            validation_errors: None,
            is_potential_duplicate: false,
            duplicate_match: None,
        },
    ];

    let summary = import_service::calculate_summary(&transactions);

    assert_eq!(summary.total, 2);
    assert_eq!(summary.income, 2);
    assert_eq!(summary.expenses, 0);
}

#[test]
fn test_confidence_level_is_duplicate() {
    assert!(ConfidenceLevel::High.is_duplicate());
    assert!(ConfidenceLevel::Medium.is_duplicate());
    assert!(!ConfidenceLevel::Low.is_duplicate());
}

#[test]
fn test_confidence_level_min_threshold() {
    assert_eq!(
        ConfidenceLevel::min_duplicate_threshold(),
        ConfidenceLevel::Medium
    );
}
