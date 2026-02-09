//! Integration tests for duplicate detection in CSV import
//!
//! These tests verify the duplicate detection logic against actual database transactions

use bigdecimal::BigDecimal;
use chrono::{Duration, Utc};
use diesel::prelude::*;
use master_of_coin_backend::{
    db::{create_pool, run_migrations},
    models::{NewTransaction, ParsedTransaction},
    schema::transactions,
    services::import_service,
    types::ConfidenceLevel,
};
use serial_test::serial;
use std::str::FromStr;
use uuid::Uuid;

#[path = "../common/mod.rs"]
mod common;

/// Helper to create a test transaction in the database (synchronous)
fn create_test_transaction_in_db(
    conn: &mut diesel::PgConnection,
    user_id: Uuid,
    account_id: Uuid,
    title: &str,
    amount: &str,
    date: chrono::DateTime<Utc>,
) -> Uuid {
    let new_transaction = NewTransaction {
        user_id,
        account_id,
        category_id: None,
        title: title.to_string(),
        amount: BigDecimal::from_str(amount).unwrap(),
        date,
        notes: Some("Test transaction".to_string()),
    };

    diesel::insert_into(transactions::table)
        .values(&new_transaction)
        .returning(transactions::id)
        .get_result(conn)
        .unwrap()
}

#[test]
#[serial]
fn test_duplicate_detection_high_confidence() {
    let database_url = common::get_test_database_url();
    let pool = create_pool(&database_url, 5).expect("Failed to create pool");
    let mut conn = pool.get().expect("Failed to get connection");

    run_migrations(&mut conn).expect("Failed to run migrations");
    common::cleanup_test_data(&mut conn);

    // Create test user and account
    let user = common::create_test_user(&mut conn, "duplicate_test_high").unwrap();
    let account = common::AccountFactory::new(user.id).build(&mut conn);

    // Create existing transaction in DB
    let test_date = Utc::now() - Duration::days(5);
    create_test_transaction_in_db(
        &mut conn,
        user.id,
        account.id,
        "Amazon.co.uk",
        "-108.12",
        test_date,
    );

    // Create parsed transaction with exact same date, time, and amount
    let mut parsed_transactions = vec![ParsedTransaction {
        temp_id: Uuid::new_v4().to_string(),
        title: "Amazon.co.uk".to_string(),
        amount: BigDecimal::from_str("-108.12").unwrap(),
        date: test_date,
        notes: Some("Statement ID: TEST123 | Card: •••• 2133".to_string()),
        original_currency: None,
        original_amount: None,
        is_valid: true,
        validation_errors: None,
        is_potential_duplicate: false,
        duplicate_match: None,
    }];

    // Run duplicate detection (async function, so use runtime)
    let runtime = tokio::runtime::Runtime::new().unwrap();
    let result = runtime.block_on(import_service::check_duplicates(
        &pool,
        user.id,
        account.id,
        &mut parsed_transactions,
    ));
    assert!(result.is_ok());

    // Verify HIGH confidence duplicate detected
    assert!(parsed_transactions[0].is_potential_duplicate);
    let duplicate_match = parsed_transactions[0].duplicate_match.as_ref().unwrap();
    assert_eq!(duplicate_match.confidence, ConfidenceLevel::High);
    assert_eq!(duplicate_match.matched_on, vec!["date", "time", "amount"]);

    common::cleanup_test_data(&mut conn);
}

#[test]
#[serial]
fn test_duplicate_detection_medium_confidence() {
    let database_url = common::get_test_database_url();
    let pool = create_pool(&database_url, 5).expect("Failed to create pool");
    let mut conn = pool.get().expect("Failed to get connection");

    run_migrations(&mut conn).expect("Failed to run migrations");
    common::cleanup_test_data(&mut conn);

    let user = common::create_test_user(&mut conn, "duplicate_test_medium").unwrap();
    let account = common::AccountFactory::new(user.id).build(&mut conn);

    // Create existing transaction at noon to avoid midnight boundary issues
    use chrono::NaiveDate;
    let base_date = (Utc::now() - Duration::days(5)).date_naive();
    let test_date = base_date.and_hms_opt(12, 0, 0).unwrap().and_utc();

    let tx_id =
        create_test_transaction_in_db(&mut conn, user.id, account.id, "TESCO", "-31.60", test_date);
    println!(
        "Created transaction in DB: id={}, date={:?}, amount=-31.60",
        tx_id, test_date
    );

    // Create parsed transaction with same date and amount, but different time (3 hours later, still same day)
    let different_time = test_date + Duration::hours(3);
    println!("Parsed transaction date: {:?}", different_time);
    let mut parsed_transactions = vec![ParsedTransaction {
        temp_id: Uuid::new_v4().to_string(),
        title: "TESCO STORES 4752".to_string(),
        amount: BigDecimal::from_str("-31.60").unwrap(),
        date: different_time,
        notes: Some("Statement ID: TEST456 | Card: •••• 2133".to_string()),
        original_currency: None,
        original_amount: None,
        is_valid: true,
        validation_errors: None,
        is_potential_duplicate: false,
        duplicate_match: None,
    }];

    // Run duplicate detection
    let runtime = tokio::runtime::Runtime::new().unwrap();
    let result = runtime.block_on(import_service::check_duplicates(
        &pool,
        user.id,
        account.id,
        &mut parsed_transactions,
    ));
    assert!(result.is_ok());

    // Debug: print the result
    println!(
        "Is duplicate: {}",
        parsed_transactions[0].is_potential_duplicate
    );
    if let Some(ref dm) = parsed_transactions[0].duplicate_match {
        println!("Confidence: {:?}", dm.confidence);
        println!("Matched on: {:?}", dm.matched_on);
    }

    // Verify MEDIUM confidence duplicate detected
    assert!(
        parsed_transactions[0].is_potential_duplicate,
        "Expected transaction to be flagged as duplicate. Date: {:?}, Amount: {:?}",
        parsed_transactions[0].date, parsed_transactions[0].amount
    );
    let duplicate_match = parsed_transactions[0].duplicate_match.as_ref().unwrap();
    assert_eq!(duplicate_match.confidence, ConfidenceLevel::Medium);
    assert_eq!(duplicate_match.matched_on, vec!["date", "amount"]);

    common::cleanup_test_data(&mut conn);
}

#[test]
#[serial]
fn test_duplicate_detection_low_confidence_not_flagged() {
    let database_url = common::get_test_database_url();
    let pool = create_pool(&database_url, 5).expect("Failed to create pool");
    let mut conn = pool.get().expect("Failed to get connection");

    run_migrations(&mut conn).expect("Failed to run migrations");
    common::cleanup_test_data(&mut conn);

    let user = common::create_test_user(&mut conn, "duplicate_test_low").unwrap();
    let account = common::AccountFactory::new(user.id).build(&mut conn);

    // Create existing transaction
    let test_date = Utc::now() - Duration::days(5);
    create_test_transaction_in_db(
        &mut conn,
        user.id,
        account.id,
        "Merchant A",
        "-50.00",
        test_date,
    );

    // Create parsed transaction with same amount but 1 day later
    let next_day = test_date + Duration::days(1);
    let mut parsed_transactions = vec![ParsedTransaction {
        temp_id: Uuid::new_v4().to_string(),
        title: "Merchant B".to_string(),
        amount: BigDecimal::from_str("-50.00").unwrap(),
        date: next_day,
        notes: Some("Statement ID: TEST789 | Card: •••• 2133".to_string()),
        original_currency: None,
        original_amount: None,
        is_valid: true,
        validation_errors: None,
        is_potential_duplicate: false,
        duplicate_match: None,
    }];

    // Run duplicate detection
    let runtime = tokio::runtime::Runtime::new().unwrap();
    let result = runtime.block_on(import_service::check_duplicates(
        &pool,
        user.id,
        account.id,
        &mut parsed_transactions,
    ));
    assert!(result.is_ok());

    // LOW confidence should NOT be flagged as duplicate (is_duplicate() returns false)
    assert!(!parsed_transactions[0].is_potential_duplicate);

    common::cleanup_test_data(&mut conn);
}

#[test]
#[serial]
fn test_no_duplicate_two_days_apart() {
    let database_url = common::get_test_database_url();
    let pool = create_pool(&database_url, 5).expect("Failed to create pool");
    let mut conn = pool.get().expect("Failed to get connection");

    run_migrations(&mut conn).expect("Failed to run migrations");
    common::cleanup_test_data(&mut conn);

    let user = common::create_test_user(&mut conn, "duplicate_test_2days").unwrap();
    let account = common::AccountFactory::new(user.id).build(&mut conn);

    // Create existing transaction
    let test_date = Utc::now() - Duration::days(5);
    create_test_transaction_in_db(
        &mut conn,
        user.id,
        account.id,
        "Merchant X",
        "-75.50",
        test_date,
    );

    // Create parsed transaction with same amount but 2 days later
    let two_days_later = test_date + Duration::days(2);
    let mut parsed_transactions = vec![ParsedTransaction {
        temp_id: Uuid::new_v4().to_string(),
        title: "Merchant Y".to_string(),
        amount: BigDecimal::from_str("-75.50").unwrap(),
        date: two_days_later,
        notes: Some("Statement ID: TEST2DAY | Card: •••• 2133".to_string()),
        original_currency: None,
        original_amount: None,
        is_valid: true,
        validation_errors: None,
        is_potential_duplicate: false,
        duplicate_match: None,
    }];

    // Run duplicate detection
    let runtime = tokio::runtime::Runtime::new().unwrap();
    let result = runtime.block_on(import_service::check_duplicates(
        &pool,
        user.id,
        account.id,
        &mut parsed_transactions,
    ));
    assert!(result.is_ok());

    // Should NOT be flagged as duplicate (2 days apart)
    assert!(!parsed_transactions[0].is_potential_duplicate);

    common::cleanup_test_data(&mut conn);
}

#[test]
#[serial]
fn test_timezone_same_date_different_timezone() {
    let database_url = common::get_test_database_url();
    let pool = create_pool(&database_url, 5).expect("Failed to create pool");
    let mut conn = pool.get().expect("Failed to get connection");

    run_migrations(&mut conn).expect("Failed to run migrations");
    common::cleanup_test_data(&mut conn);

    let user = common::create_test_user(&mut conn, "duplicate_test_tz").unwrap();
    let account = common::AccountFactory::new(user.id).build(&mut conn);

    // Create existing transaction at 23:30 UTC
    use chrono::NaiveDate;
    let date1 = NaiveDate::from_ymd_opt(2026, 1, 15)
        .unwrap()
        .and_hms_opt(23, 30, 0)
        .unwrap()
        .and_utc();

    create_test_transaction_in_db(
        &mut conn,
        user.id,
        account.id,
        "Late Night Purchase",
        "-45.00",
        date1,
    );

    // Create parsed transaction at 00:30 UTC next day (same local time in different timezone)
    // This is technically a different date in UTC but could be same day in local timezone
    let date2 = NaiveDate::from_ymd_opt(2026, 1, 16)
        .unwrap()
        .and_hms_opt(0, 30, 0)
        .unwrap()
        .and_utc();

    let mut parsed_transactions = vec![ParsedTransaction {
        temp_id: Uuid::new_v4().to_string(),
        title: "Late Night Purchase".to_string(),
        amount: BigDecimal::from_str("-45.00").unwrap(),
        date: date2,
        notes: Some("Statement ID: TESTTZ | Card: •••• 2133".to_string()),
        original_currency: None,
        original_amount: None,
        is_valid: true,
        validation_errors: None,
        is_potential_duplicate: false,
        duplicate_match: None,
    }];

    // Run duplicate detection
    let runtime = tokio::runtime::Runtime::new().unwrap();
    let result = runtime.block_on(import_service::check_duplicates(
        &pool,
        user.id,
        account.id,
        &mut parsed_transactions,
    ));
    assert!(result.is_ok());

    // Should be flagged as LOW confidence (1 day apart, same amount)
    // Note: In UTC these are different dates, so it's a LOW confidence match
    assert!(!parsed_transactions[0].is_potential_duplicate); // LOW is not flagged

    common::cleanup_test_data(&mut conn);
}

#[test]
#[serial]
fn test_midnight_boundary_same_day() {
    let database_url = common::get_test_database_url();
    let pool = create_pool(&database_url, 5).expect("Failed to create pool");
    let mut conn = pool.get().expect("Failed to get connection");

    run_migrations(&mut conn).expect("Failed to run migrations");
    common::cleanup_test_data(&mut conn);

    let user = common::create_test_user(&mut conn, "duplicate_test_midnight").unwrap();
    let account = common::AccountFactory::new(user.id).build(&mut conn);

    // Create transaction at 23:59:59
    use chrono::NaiveDate;
    let date1 = NaiveDate::from_ymd_opt(2026, 1, 15)
        .unwrap()
        .and_hms_opt(23, 59, 59)
        .unwrap()
        .and_utc();

    create_test_transaction_in_db(
        &mut conn,
        user.id,
        account.id,
        "Midnight Purchase",
        "-25.00",
        date1,
    );

    // Create parsed transaction at 00:00:01 next day (1 minute later but different date)
    let date2 = NaiveDate::from_ymd_opt(2026, 1, 16)
        .unwrap()
        .and_hms_opt(0, 0, 1)
        .unwrap()
        .and_utc();

    let mut parsed_transactions = vec![ParsedTransaction {
        temp_id: Uuid::new_v4().to_string(),
        title: "Midnight Purchase".to_string(),
        amount: BigDecimal::from_str("-25.00").unwrap(),
        date: date2,
        notes: Some("Statement ID: TESTMID | Card: •••• 2133".to_string()),
        original_currency: None,
        original_amount: None,
        is_valid: true,
        validation_errors: None,
        is_potential_duplicate: false,
        duplicate_match: None,
    }];

    // Run duplicate detection
    let runtime = tokio::runtime::Runtime::new().unwrap();
    let result = runtime.block_on(import_service::check_duplicates(
        &pool,
        user.id,
        account.id,
        &mut parsed_transactions,
    ));
    assert!(result.is_ok());

    // Should be flagged as LOW confidence (1 day apart in date, but only 2 seconds in time)
    // Our logic uses date_naive() so this will be 1 day difference
    assert!(!parsed_transactions[0].is_potential_duplicate); // LOW is not flagged

    common::cleanup_test_data(&mut conn);
}

#[test]
#[serial]
fn test_no_duplicate_different_amount() {
    let database_url = common::get_test_database_url();
    let pool = create_pool(&database_url, 5).expect("Failed to create pool");
    let mut conn = pool.get().expect("Failed to get connection");

    run_migrations(&mut conn).expect("Failed to run migrations");
    common::cleanup_test_data(&mut conn);

    let user = common::create_test_user(&mut conn, "duplicate_test_diff_amount").unwrap();
    let account = common::AccountFactory::new(user.id).build(&mut conn);

    // Create existing transaction
    let test_date = Utc::now() - Duration::days(5);
    create_test_transaction_in_db(
        &mut conn, user.id, account.id, "Amazon", "-100.00", test_date,
    );

    // Create parsed transaction with same date but different amount
    let mut parsed_transactions = vec![ParsedTransaction {
        temp_id: Uuid::new_v4().to_string(),
        title: "Amazon".to_string(),
        amount: BigDecimal::from_str("-100.01").unwrap(), // Different amount
        date: test_date,
        notes: Some("Statement ID: TEST999 | Card: •••• 2133".to_string()),
        original_currency: None,
        original_amount: None,
        is_valid: true,
        validation_errors: None,
        is_potential_duplicate: false,
        duplicate_match: None,
    }];

    // Run duplicate detection
    let runtime = tokio::runtime::Runtime::new().unwrap();
    let result = runtime.block_on(import_service::check_duplicates(
        &pool,
        user.id,
        account.id,
        &mut parsed_transactions,
    ));
    assert!(result.is_ok());

    // Should NOT be flagged as duplicate
    assert!(!parsed_transactions[0].is_potential_duplicate);

    common::cleanup_test_data(&mut conn);
}
