//! Import service for handling transaction imports
//!
//! This module provides functionality for:
//! - Duplicate detection against existing transactions
//! - Summary calculation for parsed transactions
//! - Import validation and orchestration

use bigdecimal::BigDecimal;
use chrono::{DateTime, Utc};
use std::str::FromStr;
use uuid::Uuid;

use crate::{
    db::DbPool,
    errors::ApiError,
    models::{DuplicateMatch, ImportSummary, ParsedTransaction, TransactionFilter},
    services::transaction_service,
    types::ConfidenceLevel,
};

/// Check for potential duplicate transactions against database
///
/// Strategy:
/// - NO duplicate detection within CSV file (assume CSV has no internal duplicates)
/// - ONLY check against existing transactions in database
/// - Scoring system:
///   - HIGH confidence: date + time + amount all match
///   - MEDIUM confidence: date + amount match, time differs
///   - LOW confidence: no match
///
/// # Arguments
///
/// * `pool` - Database connection pool
/// * `user_id` - User ID for filtering transactions
/// * `account_id` - Account ID for filtering transactions
/// * `transactions` - Mutable slice of parsed transactions to check
///
/// # Errors
///
/// Returns `ApiError` if database query fails
pub async fn check_duplicates(
    pool: &DbPool,
    user_id: Uuid,
    account_id: Uuid,
    transactions: &mut [ParsedTransaction],
) -> Result<(), ApiError> {
    if transactions.is_empty() {
        return Ok(());
    }

    // Get date range from parsed transactions
    // Extend by 1 day on each side for LOW confidence matching
    let start_date = transactions
        .iter()
        .map(|t| t.date.date_naive())
        .min()
        .unwrap_or_else(|| Utc::now().date_naive())
        .pred_opt() // Subtract 1 day
        .unwrap_or_else(|| Utc::now().date_naive());

    let end_date = transactions
        .iter()
        .map(|t| t.date.date_naive())
        .max()
        .unwrap_or_else(|| Utc::now().date_naive())
        .succ_opt() // Add 1 day
        .unwrap_or_else(|| Utc::now().date_naive());

    // Fetch existing transactions for the account in the extended date range
    let existing = transaction_service::list_transactions(
        pool,
        user_id,
        TransactionFilter {
            account_id: Some(account_id),
            category_id: None,
            start_date: Some(start_date.and_hms_opt(0, 0, 0).unwrap().and_utc()),
            end_date: Some(end_date.and_hms_opt(23, 59, 59).unwrap().and_utc()),
            min_amount: None,
            max_amount: None,
            search: None,
            limit: None,
            offset: None,
        },
    )
    .await?;

    // Check each parsed transaction against existing ones
    for parsed in transactions.iter_mut() {
        let mut best_match: Option<(Uuid, ConfidenceLevel, Vec<String>, DateTime<Utc>)> = None;

        for existing_tx in &existing {
            let existing_amount =
                BigDecimal::from_str(&existing_tx.amount).map_err(|_| ApiError::Internal)?;

            // Check amount match first (most distinctive)
            if parsed.amount != existing_amount {
                continue;
            }

            // Amount matches, now check date and time
            let parsed_date = parsed.date.date_naive();
            let existing_date = existing_tx.date.date_naive();

            // Calculate date difference
            let date_diff = (parsed_date - existing_date).num_days().abs();

            // Determine confidence level based on date and time match
            let (confidence, matched_fields) = if date_diff == 0 {
                // Same date - check time for confidence level
                let _parsed_time = parsed.date.time();
                let _existing_time = existing_tx.date.time();

                let parsed_time = parsed.date.time();
                let existing_time = existing_tx.date.time();

                if parsed_time == existing_time {
                    // HIGH confidence: date + time + amount all match
                    (
                        ConfidenceLevel::High,
                        vec!["date".to_string(), "time".to_string(), "amount".to_string()],
                    )
                } else {
                    // MEDIUM confidence: date + amount match, time differs
                    (
                        ConfidenceLevel::Medium,
                        vec!["date".to_string(), "amount".to_string()],
                    )
                }
            } else if date_diff == 1 {
                // LOW confidence: amount matches, date is +/- 1 day
                (ConfidenceLevel::Low, vec!["amount".to_string()])
            } else {
                continue; // Date difference > 1 day, not a duplicate
            };

            // Update best match if this is better than current best
            let should_update = if let Some((_, current_confidence, _, _)) = &best_match {
                // Prefer higher confidence levels
                matches!(
                    (current_confidence, &confidence),
                    (ConfidenceLevel::Low, ConfidenceLevel::Medium)
                        | (ConfidenceLevel::Low, ConfidenceLevel::High)
                        | (ConfidenceLevel::Medium, ConfidenceLevel::High)
                )
            } else {
                true // No match yet
            };

            if should_update {
                best_match = Some((existing_tx.id, confidence, matched_fields, existing_tx.date));
            }
        }

        // Flag as duplicate if confidence meets threshold
        if let Some((tx_id, confidence, matched_on, matched_date)) = best_match {
            if confidence.is_duplicate() {
                parsed.is_potential_duplicate = true;
                parsed.duplicate_match = Some(DuplicateMatch {
                    transaction_id: tx_id,
                    confidence,
                    matched_on,
                    matched_date,
                });
            }
        }
    }

    Ok(())
}

/// Calculate summary statistics for parsed transactions
///
/// # Arguments
///
/// * `transactions` - Slice of parsed transactions
///
/// # Returns
///
/// Returns `ImportSummary` with statistics
pub fn calculate_summary(transactions: &[ParsedTransaction]) -> ImportSummary {
    let total = transactions.len();
    let income = transactions
        .iter()
        .filter(|t| t.amount > BigDecimal::from(0))
        .count();
    let expenses = transactions
        .iter()
        .filter(|t| t.amount < BigDecimal::from(0))
        .count();
    let duplicates = transactions
        .iter()
        .filter(|t| t.is_potential_duplicate)
        .count();
    let invalid = transactions.iter().filter(|t| !t.is_valid).count();

    ImportSummary {
        total,
        income,
        expenses,
        duplicates,
        invalid,
    }
}
