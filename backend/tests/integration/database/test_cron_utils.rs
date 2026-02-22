//! Integration tests for cron utility functions.
//!
//! Tests cover:
//! - `compute_next_run` returns a future time for valid cron
//! - `compute_upcoming_runs` returns correct count
//! - `describe_cron` returns correct descriptions for presets
//! - `validate_cron` accepts valid and rejects invalid expressions
//! - `validate_min_frequency` rejects sub-hourly and accepts hourly+

use chrono::Utc;
use master_of_coin_backend::utils::cron::{
    compute_next_run, compute_next_run_after, compute_upcoming_runs, describe_cron, validate_cron,
    validate_min_frequency,
};

// ============================================================================
// compute_next_run
// ============================================================================

/// `compute_next_run` returns a future time for a valid cron expression.
#[test]
fn test_compute_next_run_returns_future_time() {
    let result = compute_next_run("0 * * * *"); // every hour
    assert!(result.is_ok(), "Should succeed for valid cron");
    let next = result.unwrap();
    assert!(
        next > Utc::now(),
        "Next run should be in the future, got {}",
        next
    );
}

/// `compute_next_run` returns an error for an invalid cron expression.
#[test]
fn test_compute_next_run_invalid_cron() {
    let result = compute_next_run("not a cron");
    assert!(result.is_err(), "Should fail for invalid cron");
    let err = result.unwrap_err();
    assert!(
        err.contains("Invalid cron expression"),
        "Error should mention invalid cron, got: {}",
        err
    );
}

// ============================================================================
// compute_next_run_after
// ============================================================================

/// `compute_next_run_after` returns a time after the given timestamp.
#[test]
fn test_compute_next_run_after_returns_time_after_given() {
    let after = Utc::now();
    let result = compute_next_run_after("0 0 * * *", after); // daily at midnight
    assert!(result.is_ok(), "Should succeed for valid cron");
    let next = result.unwrap();
    assert!(
        next > after,
        "Next run should be after the given time, got {}",
        next
    );
}

// ============================================================================
// compute_upcoming_runs
// ============================================================================

/// `compute_upcoming_runs` returns the correct number of occurrences.
#[test]
fn test_compute_upcoming_runs_returns_correct_count() {
    let result = compute_upcoming_runs("0 * * * *", 5); // every hour
    assert!(result.is_ok(), "Should succeed for valid cron");
    let runs = result.unwrap();
    assert_eq!(runs.len(), 5, "Should return exactly 5 upcoming runs");

    // Verify all runs are in the future and in ascending order
    let now = Utc::now();
    for (i, run) in runs.iter().enumerate() {
        assert!(*run > now, "Run {} should be in the future, got {}", i, run);
        if i > 0 {
            assert!(
                *run > runs[i - 1],
                "Run {} should be after run {}: {} vs {}",
                i,
                i - 1,
                run,
                runs[i - 1]
            );
        }
    }
}

/// `compute_upcoming_runs` returns 0 items when count is 0.
#[test]
fn test_compute_upcoming_runs_zero_count() {
    let result = compute_upcoming_runs("0 * * * *", 0);
    assert!(result.is_ok(), "Should succeed for valid cron");
    let runs = result.unwrap();
    assert!(runs.is_empty(), "Should return empty vec for count=0");
}

/// `compute_upcoming_runs` returns an error for invalid cron.
#[test]
fn test_compute_upcoming_runs_invalid_cron() {
    let result = compute_upcoming_runs("invalid", 5);
    assert!(result.is_err(), "Should fail for invalid cron");
}

// ============================================================================
// describe_cron
// ============================================================================

/// `describe_cron` returns correct descriptions for known presets.
///
/// Note: The `cron` crate uses 1-7 for day-of-week (1=Sunday, 7=Saturday).
/// Both `describe_cron` and the frontend presets use this convention.
#[test]
fn test_describe_cron_presets() {
    assert_eq!(describe_cron("0 * * * *"), "Every hour");
    assert_eq!(describe_cron("0 0 * * *"), "Daily at 00:00");
    assert_eq!(describe_cron("0 0 * * 1"), "Every Sunday at 00:00");
    assert_eq!(describe_cron("0 0 * * 2"), "Every Monday at 00:00");
    assert_eq!(describe_cron("0 0 1 * *"), "Monthly on the 1st at 00:00");
}

/// `describe_cron` returns the raw expression for non-standard patterns.
#[test]
fn test_describe_cron_custom_expression() {
    let custom = "30 14 * * 3";
    assert_eq!(
        describe_cron(custom),
        custom,
        "Non-standard cron should return the raw expression"
    );
}

// ============================================================================
// validate_cron
// ============================================================================

/// `validate_cron` accepts valid 5-field cron expressions.
///
/// Note: The `cron` crate uses 1-7 for day-of-week (1=Sunday, 7=Saturday),
/// not the standard 0-6. So `0 0 * * 1` means "Every Sunday at 00:00".
#[test]
fn test_validate_cron_accepts_valid() {
    assert!(validate_cron("0 * * * *").is_ok(), "Every hour");
    assert!(validate_cron("0 0 * * *").is_ok(), "Daily at midnight");
    assert!(
        validate_cron("0 0 * * 1").is_ok(),
        "Weekly on Sunday (cron crate: 1=Sun)"
    );
    assert!(validate_cron("0 0 1 * *").is_ok(), "Monthly on the 1st");
    assert!(
        validate_cron("30 14 * * 2-6").is_ok(),
        "Weekdays at 14:30 (cron crate: 2=Mon..6=Fri)"
    );
    assert!(validate_cron("0 0,12 * * *").is_ok(), "Twice daily");
}

/// `validate_cron` rejects invalid expressions.
#[test]
fn test_validate_cron_rejects_invalid() {
    assert!(validate_cron("not a cron").is_err(), "Random text");
    assert!(validate_cron("").is_err(), "Empty string");
    assert!(validate_cron("* * *").is_err(), "Too few fields");
    assert!(
        validate_cron("60 * * * *").is_err(),
        "Minute out of range (60)"
    );
    assert!(
        validate_cron("0 25 * * *").is_err(),
        "Hour out of range (25)"
    );
}

// ============================================================================
// validate_min_frequency
// ============================================================================

/// `validate_min_frequency` rejects sub-hourly cron expressions.
#[test]
fn test_validate_min_frequency_rejects_sub_hourly() {
    // Every 5 minutes
    let result = validate_min_frequency("*/5 * * * *");
    assert!(
        result.is_err(),
        "Should reject every-5-minutes: {:?}",
        result
    );
    let err = result.unwrap_err();
    assert!(
        err.contains("frequency too high"),
        "Error should mention frequency, got: {}",
        err
    );

    // Every minute
    let result = validate_min_frequency("* * * * *");
    assert!(result.is_err(), "Should reject every-minute");

    // Every 30 minutes
    let result = validate_min_frequency("*/30 * * * *");
    assert!(result.is_err(), "Should reject every-30-minutes");
}

/// `validate_min_frequency` accepts hourly and less frequent expressions.
///
/// Note: The `cron` crate uses 1-7 for day-of-week (1=Sunday, 7=Saturday).
#[test]
fn test_validate_min_frequency_accepts_hourly_plus() {
    // Every hour
    assert!(
        validate_min_frequency("0 * * * *").is_ok(),
        "Should accept every hour"
    );

    // Daily at midnight
    assert!(
        validate_min_frequency("0 0 * * *").is_ok(),
        "Should accept daily"
    );

    // Weekly on Sunday (cron crate: 1=Sun)
    assert!(
        validate_min_frequency("0 0 * * 1").is_ok(),
        "Should accept weekly"
    );

    // Monthly on the 1st
    assert!(
        validate_min_frequency("0 0 1 * *").is_ok(),
        "Should accept monthly"
    );
}
