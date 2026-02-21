//! Integration tests for the drift detection classify() function.
//!
//! Tests the core classification logic with constructed data — no external API
//! calls or database needed. These tests verify:
//! - All synced scenario
//! - Drifted items scenario
//! - Missing on external scenario
//! - Missing on local scenario
//! - Unmapped users scenario
//! - Count invariants hold

use bigdecimal::BigDecimal;
use chrono::Utc;
use master_of_coin_backend::models::drift_detection::{LocalSplitRow, LocalTransactionGroup};
use master_of_coin_backend::services::drift_detection_service::classify;
use master_of_coin_backend::services::split_provider::{
    ExternalExpenseDetail, ExternalExpenseUser,
};
use std::collections::HashMap;
use std::str::FromStr;
use uuid::Uuid;

// ============================================================================
// Helpers
// ============================================================================

/// Build a local transaction group with one split that has a sync record.
fn make_local_txn(
    title: &str,
    amount: &str,
    person_name: &str,
    external_user_id: &str,
    split_amount: &str,
    external_expense_id: Option<&str>,
) -> LocalTransactionGroup {
    LocalTransactionGroup {
        transaction_id: Uuid::new_v4(),
        transaction_title: title.to_string(),
        transaction_amount: BigDecimal::from_str(amount).unwrap(),
        transaction_date: Utc::now(),
        splits: vec![LocalSplitRow {
            _split_id: Uuid::new_v4(),
            person_name: person_name.to_string(),
            split_amount: BigDecimal::from_str(split_amount).unwrap(),
            external_user_id: external_user_id.to_string(),
            _provider_id: Uuid::new_v4(),
            external_expense_id: external_expense_id.map(|s| s.to_string()),
            _sync_status: external_expense_id.map(|_| "synced".to_string()),
        }],
    }
}

/// Build an external expense with specified users.
fn make_external_expense(
    expense_id: &str,
    description: &str,
    cost: &str,
    users: Vec<ExternalExpenseUser>,
) -> ExternalExpenseDetail {
    ExternalExpenseDetail {
        external_expense_id: expense_id.to_string(),
        description: description.to_string(),
        cost: cost.to_string(),
        currency_code: "USD".to_string(),
        date: "2026-01-15".to_string(),
        users,
    }
}

/// Build an external expense user.
fn make_ext_user(
    user_id: &str,
    first_name: &str,
    last_name: &str,
    paid_share: &str,
    owed_share: &str,
) -> ExternalExpenseUser {
    ExternalExpenseUser {
        external_user_id: user_id.to_string(),
        first_name: first_name.to_string(),
        last_name: last_name.to_string(),
        paid_share: paid_share.to_string(),
        owed_share: owed_share.to_string(),
    }
}

// ============================================================================
// Tests
// ============================================================================

/// All local transactions have matching external expenses with identical splits → all synced.
#[test]
fn test_classify_all_synced() {
    // Local: transaction of -100, split of 50 to Alice (ext user "111")
    // Payer (current user "999") owes 50
    let local = vec![make_local_txn(
        "Dinner",
        "-100.00",
        "Alice",
        "111",
        "50.00",
        Some("ext_1"),
    )];

    // External: expense ext_1 with cost 100, Alice owes 50, current user owes 50
    let external = vec![make_external_expense(
        "ext_1",
        "Dinner",
        "100.00",
        vec![
            make_ext_user("111", "Alice", "Smith", "0.00", "50.00"),
            make_ext_user("999", "You", "", "100.00", "50.00"),
        ],
    )];

    let mut mapping = HashMap::new();
    mapping.insert("111".to_string(), "Alice".to_string());

    let report = classify(&local, &external, &mapping, Some("999"));

    assert_eq!(report.summary.synced, 1);
    assert_eq!(report.summary.drifted, 0);
    assert_eq!(report.summary.missing_on_external, 0);
    assert_eq!(report.summary.missing_on_local, 0);
}

/// Linked pair with different amounts → shows as drifted.
#[test]
fn test_classify_drifted() {
    // Local: split of 50 to Alice
    let local = vec![make_local_txn(
        "Dinner",
        "-100.00",
        "Alice",
        "111",
        "50.00",
        Some("ext_1"),
    )];

    // External: Alice owes 30 (different from local 50) → drifted
    let external = vec![make_external_expense(
        "ext_1",
        "Dinner",
        "100.00",
        vec![
            make_ext_user("111", "Alice", "Smith", "0.00", "30.00"),
            make_ext_user("999", "You", "", "100.00", "70.00"),
        ],
    )];

    let mut mapping = HashMap::new();
    mapping.insert("111".to_string(), "Alice".to_string());

    let report = classify(&local, &external, &mapping, Some("999"));

    assert_eq!(report.summary.synced, 0);
    assert_eq!(report.summary.drifted, 1);
    assert_eq!(report.summary.missing_on_external, 0);
    assert_eq!(report.summary.missing_on_local, 0);
    assert_eq!(report.drifted.len(), 1);
    assert_eq!(report.drifted[0].external_expense_id, "ext_1");
}

/// Local transaction with no sync record → missing on external.
#[test]
fn test_classify_missing_on_external() {
    // Local: no external_expense_id (no sync record)
    let local = vec![make_local_txn(
        "Groceries",
        "-80.00",
        "Bob",
        "222",
        "40.00",
        None, // No sync record
    )];

    let external: Vec<ExternalExpenseDetail> = vec![];

    let mut mapping = HashMap::new();
    mapping.insert("222".to_string(), "Bob".to_string());

    let report = classify(&local, &external, &mapping, Some("999"));

    assert_eq!(report.summary.synced, 0);
    assert_eq!(report.summary.drifted, 0);
    assert_eq!(report.summary.missing_on_external, 1);
    assert_eq!(report.summary.missing_on_local, 0);
    assert_eq!(report.missing_on_external.len(), 1);
    assert_eq!(report.missing_on_external[0].transaction_title, "Groceries");
}

/// External expense with no matching sync record → missing on local.
#[test]
fn test_classify_missing_on_local() {
    let local: Vec<LocalTransactionGroup> = vec![];

    // External expense that has no local match
    let external = vec![make_external_expense(
        "ext_99",
        "Taxi",
        "30.00",
        vec![
            make_ext_user("111", "Alice", "Smith", "30.00", "15.00"),
            make_ext_user("999", "You", "", "0.00", "15.00"),
        ],
    )];

    let mut mapping = HashMap::new();
    mapping.insert("111".to_string(), "Alice".to_string());

    let report = classify(&local, &external, &mapping, Some("999"));

    assert_eq!(report.summary.synced, 0);
    assert_eq!(report.summary.drifted, 0);
    assert_eq!(report.summary.missing_on_external, 0);
    assert_eq!(report.summary.missing_on_local, 1);
    assert_eq!(report.missing_on_local.len(), 1);
    assert_eq!(report.missing_on_local[0].external_expense_id, "ext_99");
    assert_eq!(report.missing_on_local[0].description, "Taxi");
}

/// External expense with user not in mapping → unmapped_users populated.
#[test]
fn test_classify_unmapped_users() {
    let local: Vec<LocalTransactionGroup> = vec![];

    // External expense with user "333" (Charlie) who has no local mapping
    let external = vec![make_external_expense(
        "ext_50",
        "Movie",
        "45.00",
        vec![
            make_ext_user("111", "Alice", "Smith", "45.00", "15.00"),
            make_ext_user("333", "Charlie", "Brown", "0.00", "15.00"),
            make_ext_user("999", "You", "", "0.00", "15.00"),
        ],
    )];

    // Only Alice is mapped; Charlie is NOT
    let mut mapping = HashMap::new();
    mapping.insert("111".to_string(), "Alice".to_string());

    let report = classify(&local, &external, &mapping, Some("999"));

    assert_eq!(report.summary.missing_on_local, 1);
    assert_eq!(report.missing_on_local.len(), 1);

    let missing = &report.missing_on_local[0];
    assert_eq!(missing.unmapped_users.len(), 1);
    assert_eq!(missing.unmapped_users[0].external_user_id, "333");
    assert_eq!(missing.unmapped_users[0].first_name, "Charlie");
    assert_eq!(missing.unmapped_users[0].last_name, "Brown");
}

/// Verify count invariants:
/// total_local = synced + drifted + missing_on_external
/// total_external = synced + drifted + missing_on_local
#[test]
fn test_classify_count_invariants() {
    // Mix of all categories:
    // 1 synced, 1 drifted, 1 missing_on_external, 2 missing_on_local

    // Synced: local txn linked to ext_1, amounts match
    let synced_txn = make_local_txn("Synced", "-60.00", "Alice", "111", "30.00", Some("ext_1"));

    // Drifted: local txn linked to ext_2, amounts differ
    let drifted_txn = make_local_txn("Drifted", "-80.00", "Bob", "222", "40.00", Some("ext_2"));

    // Missing on external: local txn with no sync record
    let missing_ext_txn = make_local_txn("NoSync", "-50.00", "Alice", "111", "25.00", None);

    let local = vec![synced_txn, drifted_txn, missing_ext_txn];

    // External expenses:
    // ext_1 matches synced_txn (Alice owes 30, current user owes 30)
    // ext_2 matches drifted_txn but with different amount (Bob owes 50 instead of 40)
    // ext_3 and ext_4 are unmatched → missing on local
    let external = vec![
        make_external_expense(
            "ext_1",
            "Synced",
            "60.00",
            vec![
                make_ext_user("111", "Alice", "Smith", "0.00", "30.00"),
                make_ext_user("999", "You", "", "60.00", "30.00"),
            ],
        ),
        make_external_expense(
            "ext_2",
            "Drifted",
            "80.00",
            vec![
                make_ext_user("222", "Bob", "Jones", "0.00", "50.00"), // 50 != 40 → drifted
                make_ext_user("999", "You", "", "80.00", "30.00"),
            ],
        ),
        make_external_expense(
            "ext_3",
            "Unmatched 1",
            "20.00",
            vec![
                make_ext_user("111", "Alice", "Smith", "20.00", "10.00"),
                make_ext_user("999", "You", "", "0.00", "10.00"),
            ],
        ),
        make_external_expense(
            "ext_4",
            "Unmatched 2",
            "15.00",
            vec![
                make_ext_user("222", "Bob", "Jones", "15.00", "7.50"),
                make_ext_user("999", "You", "", "0.00", "7.50"),
            ],
        ),
    ];

    let mut mapping = HashMap::new();
    mapping.insert("111".to_string(), "Alice".to_string());
    mapping.insert("222".to_string(), "Bob".to_string());

    let report = classify(&local, &external, &mapping, Some("999"));

    // Verify individual counts
    assert_eq!(report.summary.synced, 1, "Should have 1 synced");
    assert_eq!(report.summary.drifted, 1, "Should have 1 drifted");
    assert_eq!(
        report.summary.missing_on_external, 1,
        "Should have 1 missing on external"
    );
    assert_eq!(
        report.summary.missing_on_local, 2,
        "Should have 2 missing on local"
    );

    // Verify invariant: total_local = synced + drifted + missing_on_external
    let expected_total_local =
        report.summary.synced + report.summary.drifted + report.summary.missing_on_external;
    assert_eq!(
        report.summary.total_local, expected_total_local,
        "Invariant: total_local = synced + drifted + missing_on_external ({} != {})",
        report.summary.total_local, expected_total_local
    );
    assert_eq!(report.summary.total_local, 3);

    // Verify invariant: total_external = synced + drifted + missing_on_local
    let expected_total_external =
        report.summary.synced + report.summary.drifted + report.summary.missing_on_local;
    assert_eq!(
        report.summary.total_external, expected_total_external,
        "Invariant: total_external = synced + drifted + missing_on_local ({} != {})",
        report.summary.total_external, expected_total_external
    );
    assert_eq!(report.summary.total_external, 4);
}
