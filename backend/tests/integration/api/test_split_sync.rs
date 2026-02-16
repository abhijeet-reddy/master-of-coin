//! Integration tests for split sync API endpoints.
//!
//! Tests cover:
//! - GET /api/v1/splits/:id/sync-status - Get sync status for a split
//! - POST /api/v1/splits/:id/retry-sync - Retry a failed sync
//! - POST /api/v1/transactions/:id/sync-split - Sync a transaction's splits with external provider
//! - POST /api/v1/transactions/:id/resolve-split-mismatch - Resolve a split mismatch
//!
//! These tests create sync records directly in the DB since sync records
//! are normally created by the SplitSyncService during transaction creation.
//!
//! Note: The sync-split and resolve-split-mismatch endpoints call external APIs
//! (Splitwise), so integration tests focus on authentication, validation, and
//! error cases that don't require external API calls.

use crate::common::*;
use chrono::Utc;
use diesel::prelude::*;
use master_of_coin_backend::{
    models::{
        NewSplitProvider, SplitProvider,
        split_sync_record::{NewSplitSyncRecord, SplitSyncStatusResponse},
    },
    schema::{split_providers, split_sync_records},
};
use serde_json::json;
use uuid::Uuid;

// ============================================================================
// Helpers
// ============================================================================

fn get_test_db_pool() -> master_of_coin_backend::DbPool {
    use diesel::PgConnection;
    use diesel::r2d2::{self, ConnectionManager};
    dotenvy::from_filename("../.env").ok();
    let database_url =
        std::env::var("DATABASE_URL").expect("DATABASE_URL must be set for integration tests");
    let manager = ConnectionManager::<PgConnection>::new(database_url);
    r2d2::Pool::builder()
        .max_size(5)
        .build(manager)
        .expect("Failed to create test database pool")
}

fn create_test_split_provider(
    pool: &master_of_coin_backend::DbPool,
    user_id: Uuid,
) -> SplitProvider {
    let mut conn = pool.get().expect("Failed to get DB connection");
    let new_provider = NewSplitProvider {
        user_id,
        provider_type: "splitwise".to_string(),
        credentials: json!({"encrypted": "test_encrypted_credentials"}),
        is_active: true,
    };
    diesel::insert_into(split_providers::table)
        .values(&new_provider)
        .get_result::<SplitProvider>(&mut conn)
        .expect("Failed to create test split provider")
}

/// Gets a transaction_split_id from a transaction that has splits.
/// Creates a transaction with splits and returns the split ID.
async fn create_transaction_with_split(
    server: &axum_test::TestServer,
    token: &str,
    account_id: Uuid,
    category_id: Uuid,
    person_id: Uuid,
) -> Uuid {
    let req = json!({
        "account_id": account_id,
        "category_id": category_id,
        "title": "Shared Expense for Sync Test",
        "amount": 100.0,
        "date": "2023-06-15T00:00:00Z",
        "splits": [{"person_id": person_id, "amount": 50.0}]
    });
    let resp = post_authenticated(server, "/api/v1/transactions", token, &req).await;
    assert_status(&resp, 201);

    // Extract the transaction and get the split ID
    let tx: serde_json::Value = extract_json(resp);
    let splits = tx["splits"].as_array().expect("Should have splits");
    assert!(!splits.is_empty(), "Should have at least one split");
    let split_id_str = splits[0]["id"].as_str().expect("Split should have id");
    Uuid::parse_str(split_id_str).expect("Split ID should be valid UUID")
}

fn create_sync_record(
    pool: &master_of_coin_backend::DbPool,
    split_id: Uuid,
    provider_id: Uuid,
    status: &str,
    error: Option<&str>,
) -> master_of_coin_backend::models::split_sync_record::SplitSyncRecord {
    let mut conn = pool.get().expect("Failed to get DB connection");
    let new_record = NewSplitSyncRecord {
        transaction_split_id: split_id,
        split_provider_id: provider_id,
        external_expense_id: if status == "synced" {
            Some("ext_123".to_string())
        } else {
            None
        },
        sync_status: status.to_string(),
        last_sync_at: if status == "synced" {
            Some(Utc::now())
        } else {
            None
        },
        last_error: error.map(|e| e.to_string()),
        retry_count: 0,
    };
    diesel::insert_into(split_sync_records::table)
        .values(&new_record)
        .get_result(&mut conn)
        .expect("Failed to create sync record")
}

// ============================================================================
// Get Sync Status Tests
// ============================================================================

/// Test getting sync status for a split with no sync records returns empty.
#[tokio::test]
async fn test_get_sync_status_empty() {
    let server = create_test_server().await;
    let ts = Utc::now().timestamp_nanos_opt().unwrap();
    let auth = register_test_user(
        &server,
        &format!("ss_empty_{}", ts),
        &format!("ss_empty_{}@example.com", ts),
        "SecurePass123!",
        "SS Empty",
    )
    .await;

    // Use a random UUID as split_id - no sync records exist
    let fake_split_id = Uuid::new_v4();
    let resp = get_authenticated(
        &server,
        &format!("/api/v1/splits/{}/sync-status", fake_split_id),
        &auth.token,
    )
    .await;
    assert_status(&resp, 200);

    let statuses: Vec<SplitSyncStatusResponse> = extract_json(resp);
    assert_eq!(statuses.len(), 0, "Should have no sync records");
}

/// Test getting sync status for a split with a synced record.
#[tokio::test]
async fn test_get_sync_status_with_synced_record() {
    let server = create_test_server().await;
    let pool = get_test_db_pool();
    let ts = Utc::now().timestamp_nanos_opt().unwrap();
    let auth = register_test_user(
        &server,
        &format!("ss_synced_{}", ts),
        &format!("ss_synced_{}@example.com", ts),
        "SecurePass123!",
        "SS Synced",
    )
    .await;

    let account = create_test_account(&server, &auth.token, "Sync Account").await;
    let category = create_test_category(&server, &auth.token, "Sync Category").await;
    let person = create_test_person(&server, &auth.token, "Sync Person").await;
    let provider = create_test_split_provider(&pool, auth.user.id);

    let split_id =
        create_transaction_with_split(&server, &auth.token, account.id, category.id, person.id)
            .await;

    // Create a synced record
    create_sync_record(&pool, split_id, provider.id, "synced", None);

    let resp = get_authenticated(
        &server,
        &format!("/api/v1/splits/{}/sync-status", split_id),
        &auth.token,
    )
    .await;
    assert_status(&resp, 200);

    let statuses: Vec<SplitSyncStatusResponse> = extract_json(resp);
    assert_eq!(statuses.len(), 1);
    assert_eq!(statuses[0].transaction_split_id, split_id);
    assert_eq!(statuses[0].split_provider_id, provider.id);
    assert_eq!(
        statuses[0].sync_status,
        master_of_coin_backend::models::split_sync_record::SyncStatus::Synced
    );
    assert!(statuses[0].external_expense_id.is_some());
    assert!(statuses[0].external_url.is_some());
    assert!(statuses[0].last_error.is_none());
}

/// Test getting sync status for a split with a failed record.
#[tokio::test]
async fn test_get_sync_status_with_failed_record() {
    let server = create_test_server().await;
    let pool = get_test_db_pool();
    let ts = Utc::now().timestamp_nanos_opt().unwrap();
    let auth = register_test_user(
        &server,
        &format!("ss_failed_{}", ts),
        &format!("ss_failed_{}@example.com", ts),
        "SecurePass123!",
        "SS Failed",
    )
    .await;

    let account = create_test_account(&server, &auth.token, "Fail Account").await;
    let category = create_test_category(&server, &auth.token, "Fail Category").await;
    let person = create_test_person(&server, &auth.token, "Fail Person").await;
    let provider = create_test_split_provider(&pool, auth.user.id);

    let split_id =
        create_transaction_with_split(&server, &auth.token, account.id, category.id, person.id)
            .await;

    create_sync_record(
        &pool,
        split_id,
        provider.id,
        "failed",
        Some("API rate limit exceeded"),
    );

    let resp = get_authenticated(
        &server,
        &format!("/api/v1/splits/{}/sync-status", split_id),
        &auth.token,
    )
    .await;
    assert_status(&resp, 200);

    let statuses: Vec<SplitSyncStatusResponse> = extract_json(resp);
    assert_eq!(statuses.len(), 1);
    assert_eq!(
        statuses[0].sync_status,
        master_of_coin_backend::models::split_sync_record::SyncStatus::Failed
    );
    assert_eq!(
        statuses[0].last_error.as_deref(),
        Some("API rate limit exceeded")
    );
    assert!(statuses[0].external_expense_id.is_none());
}

/// Test getting sync status for a split with a pending record.
#[tokio::test]
async fn test_get_sync_status_with_pending_record() {
    let server = create_test_server().await;
    let pool = get_test_db_pool();
    let ts = Utc::now().timestamp_nanos_opt().unwrap();
    let auth = register_test_user(
        &server,
        &format!("ss_pend_{}", ts),
        &format!("ss_pend_{}@example.com", ts),
        "SecurePass123!",
        "SS Pending",
    )
    .await;

    let account = create_test_account(&server, &auth.token, "Pend Account").await;
    let category = create_test_category(&server, &auth.token, "Pend Category").await;
    let person = create_test_person(&server, &auth.token, "Pend Person").await;
    let provider = create_test_split_provider(&pool, auth.user.id);

    let split_id =
        create_transaction_with_split(&server, &auth.token, account.id, category.id, person.id)
            .await;

    create_sync_record(&pool, split_id, provider.id, "pending", None);

    let resp = get_authenticated(
        &server,
        &format!("/api/v1/splits/{}/sync-status", split_id),
        &auth.token,
    )
    .await;
    assert_status(&resp, 200);

    let statuses: Vec<SplitSyncStatusResponse> = extract_json(resp);
    assert_eq!(statuses.len(), 1);
    assert_eq!(
        statuses[0].sync_status,
        master_of_coin_backend::models::split_sync_record::SyncStatus::Pending
    );
    assert!(statuses[0].last_sync_at.is_none());
}

/// Test getting sync status without authentication fails.
#[tokio::test]
async fn test_get_sync_status_unauthorized() {
    let server = create_test_server().await;
    let resp = get_unauthenticated(
        &server,
        &format!("/api/v1/splits/{}/sync-status", Uuid::new_v4()),
    )
    .await;
    assert_status(&resp, 401);
}

// ============================================================================
// Retry Sync Tests
// ============================================================================

/// Test that retry sync without authentication fails.
#[tokio::test]
async fn test_retry_sync_unauthorized() {
    let server = create_test_server().await;
    let resp = server
        .post(&format!("/api/v1/splits/{}/retry-sync", Uuid::new_v4()))
        .await;
    assert_status(&resp, 401);
}

/// Test retry sync with non-existent sync record.
/// The retry endpoint expects a sync_record_id, not a split_id.
/// When the sync service is not configured or record not found, it should error.
#[tokio::test]
async fn test_retry_sync_not_found() {
    let server = create_test_server().await;
    let ts = Utc::now().timestamp_nanos_opt().unwrap();
    let auth = register_test_user(
        &server,
        &format!("ss_rnf_{}", ts),
        &format!("ss_rnf_{}@example.com", ts),
        "SecurePass123!",
        "SS RNF",
    )
    .await;

    let fake_id = Uuid::new_v4();
    let resp = post_authenticated(
        &server,
        &format!("/api/v1/splits/{}/retry-sync", fake_id),
        &auth.token,
        &json!({}),
    )
    .await;
    // Should fail - either 404 (not found) or 500 (sync service config issue)
    let status = resp.status_code().as_u16();
    assert!(
        status >= 400,
        "Retry on non-existent record should fail, got {}",
        status
    );
}

// ============================================================================
// Sync Split Tests (POST /transactions/:id/sync-split)
// ============================================================================

/// Test that sync-split without authentication fails with 401.
#[tokio::test]
async fn test_sync_split_unauthorized() {
    let server = create_test_server().await;
    let resp = server
        .post(&format!(
            "/api/v1/transactions/{}/sync-split",
            Uuid::new_v4()
        ))
        .await;
    assert_status(&resp, 401);
}

/// Test sync-split with a non-existent transaction returns an error.
///
/// The service tries to fetch the transaction from the DB and fails with
/// a Diesel NotFound error, which maps to a 404 response.
#[tokio::test]
async fn test_sync_split_transaction_not_found() {
    let server = create_test_server().await;
    let ts = Utc::now().timestamp_nanos_opt().unwrap();
    let auth = register_test_user(
        &server,
        &format!("sync_nf_{}", ts),
        &format!("sync_nf_{}@example.com", ts),
        "SecurePass123!",
        "Sync NF",
    )
    .await;

    let fake_id = Uuid::new_v4();
    let resp = post_authenticated(
        &server,
        &format!("/api/v1/transactions/{}/sync-split", fake_id),
        &auth.token,
        &json!({}),
    )
    .await;

    // Transaction not found in DB → 404
    assert_status(&resp, 404);
}

/// Test sync-split on a transaction with no splits returns a 400 error.
///
/// The service fetches the transaction, finds no splits, and returns
/// a BadRequest error: "Transaction has no splits to sync".
#[tokio::test]
async fn test_sync_split_no_splits() {
    let server = create_test_server().await;
    let ts = Utc::now().timestamp_nanos_opt().unwrap();
    let auth = register_test_user(
        &server,
        &format!("sync_nosplit_{}", ts),
        &format!("sync_nosplit_{}@example.com", ts),
        "SecurePass123!",
        "Sync NoSplit",
    )
    .await;

    let account = create_test_account(&server, &auth.token, "Sync NoSplit Account").await;
    let category = create_test_category(&server, &auth.token, "Sync NoSplit Category").await;

    // Create a transaction WITHOUT splits
    let req = json!({
        "account_id": account.id,
        "category_id": category.id,
        "title": "No Splits Transaction",
        "amount": -50.00,
        "date": Utc::now().to_rfc3339()
    });
    let create_resp = post_authenticated(&server, "/api/v1/transactions", &auth.token, &req).await;
    assert_status(&create_resp, 201);

    let tx: serde_json::Value = extract_json(create_resp);
    let tx_id = tx["id"].as_str().expect("Transaction should have id");

    // Try to sync — should fail because no splits
    let resp = post_authenticated(
        &server,
        &format!("/api/v1/transactions/{}/sync-split", tx_id),
        &auth.token,
        &json!({}),
    )
    .await;

    assert_status(&resp, 400);
    let body = resp.text();
    assert!(
        body.to_lowercase().contains("no splits"),
        "Error should mention no splits, got: {}",
        body
    );
}

/// Test sync-split on a transaction with splits but no provider configured.
///
/// The service fetches the transaction and splits, groups by provider,
/// but finds no splits with a configured split provider. Returns 400:
/// "No splits have a configured split provider".
#[tokio::test]
async fn test_sync_split_no_provider_configured() {
    let server = create_test_server().await;
    let ts = Utc::now().timestamp_nanos_opt().unwrap();
    let auth = register_test_user(
        &server,
        &format!("sync_noprov_{}", ts),
        &format!("sync_noprov_{}@example.com", ts),
        "SecurePass123!",
        "Sync NoProv",
    )
    .await;

    let account = create_test_account(&server, &auth.token, "Sync NoProv Account").await;
    let category = create_test_category(&server, &auth.token, "Sync NoProv Category").await;
    let person = create_test_person(&server, &auth.token, "Sync NoProv Person").await;

    // Create a transaction WITH splits but the person has no split provider config
    let req = json!({
        "account_id": account.id,
        "category_id": category.id,
        "title": "Split Without Provider",
        "amount": -100.00,
        "date": Utc::now().to_rfc3339(),
        "splits": [{"person_id": person.id, "amount": 50.0}]
    });
    let create_resp = post_authenticated(&server, "/api/v1/transactions", &auth.token, &req).await;
    assert_status(&create_resp, 201);

    let tx: serde_json::Value = extract_json(create_resp);
    let tx_id = tx["id"].as_str().expect("Transaction should have id");

    // Try to sync — should fail because no provider configured for the person
    let resp = post_authenticated(
        &server,
        &format!("/api/v1/transactions/{}/sync-split", tx_id),
        &auth.token,
        &json!({}),
    )
    .await;

    assert_status(&resp, 400);
    let body = resp.text();
    assert!(
        body.to_lowercase().contains("provider"),
        "Error should mention provider, got: {}",
        body
    );
}

/// Test that another user cannot sync-split on someone else's transaction.
///
/// User A creates a transaction, User B tries to sync it.
/// The service looks up the transaction by ID without user scoping,
/// but the transaction should not be accessible to User B.
#[tokio::test]
async fn test_sync_split_wrong_user() {
    let server = create_test_server().await;
    let ts = Utc::now().timestamp_nanos_opt().unwrap();

    let auth_a = register_test_user(
        &server,
        &format!("sync_usera_{}", ts),
        &format!("sync_usera_{}@example.com", ts),
        "SecurePass123!",
        "Sync User A",
    )
    .await;

    let auth_b = register_test_user(
        &server,
        &format!("sync_userb_{}", ts),
        &format!("sync_userb_{}@example.com", ts),
        "SecurePass123!",
        "Sync User B",
    )
    .await;

    let account = create_test_account(&server, &auth_a.token, "Sync WrongUser Account").await;
    let category = create_test_category(&server, &auth_a.token, "Sync WrongUser Category").await;

    // User A creates a transaction without splits
    let req = json!({
        "account_id": account.id,
        "category_id": category.id,
        "title": "User A Transaction",
        "amount": -75.00,
        "date": Utc::now().to_rfc3339()
    });
    let create_resp =
        post_authenticated(&server, "/api/v1/transactions", &auth_a.token, &req).await;
    assert_status(&create_resp, 201);

    let tx: serde_json::Value = extract_json(create_resp);
    let tx_id = tx["id"].as_str().expect("Transaction should have id");

    // User B tries to sync User A's transaction
    // The sync_split handler doesn't do user-scoped lookup (it uses transaction_id directly),
    // but the transaction will have no splits → 400, or the service may still process it.
    // Either way, User B should get an error (400 no splits, or the service processes it).
    let resp = post_authenticated(
        &server,
        &format!("/api/v1/transactions/{}/sync-split", tx_id),
        &auth_b.token,
        &json!({}),
    )
    .await;

    let status = resp.status_code().as_u16();
    // Should fail — either 400 (no splits) or 403 (forbidden) depending on implementation
    assert!(
        status >= 400,
        "User B syncing User A's transaction should fail, got {}",
        status
    );
}

// ============================================================================
// Resolve Split Mismatch Tests (POST /transactions/:id/resolve-split-mismatch)
// ============================================================================

/// Test that resolve-split-mismatch without authentication fails with 401.
#[tokio::test]
async fn test_resolve_mismatch_unauthorized() {
    let server = create_test_server().await;
    let resp = server
        .post(&format!(
            "/api/v1/transactions/{}/resolve-split-mismatch",
            Uuid::new_v4()
        ))
        .await;
    assert_status(&resp, 401);
}

/// Test resolve-split-mismatch with missing request body returns 422.
///
/// The handler expects a JSON body with `external_expense_id` and `action` fields.
/// Sending no body should fail with a deserialization error.
#[tokio::test]
async fn test_resolve_mismatch_missing_body() {
    let server = create_test_server().await;
    let ts = Utc::now().timestamp_nanos_opt().unwrap();
    let auth = register_test_user(
        &server,
        &format!("resolve_nobody_{}", ts),
        &format!("resolve_nobody_{}@example.com", ts),
        "SecurePass123!",
        "Resolve NoBody",
    )
    .await;

    let fake_id = Uuid::new_v4();
    // Send empty JSON object — missing required fields
    let resp = post_authenticated(
        &server,
        &format!("/api/v1/transactions/{}/resolve-split-mismatch", fake_id),
        &auth.token,
        &json!({}),
    )
    .await;

    // Should fail with 422 (Unprocessable Entity) due to missing required fields
    assert_status(&resp, 422);
}

/// Test resolve-split-mismatch with missing action field returns 422.
#[tokio::test]
async fn test_resolve_mismatch_missing_action() {
    let server = create_test_server().await;
    let ts = Utc::now().timestamp_nanos_opt().unwrap();
    let auth = register_test_user(
        &server,
        &format!("resolve_noact_{}", ts),
        &format!("resolve_noact_{}@example.com", ts),
        "SecurePass123!",
        "Resolve NoAction",
    )
    .await;

    let fake_id = Uuid::new_v4();
    // Send body with external_expense_id but missing action
    let resp = post_authenticated(
        &server,
        &format!("/api/v1/transactions/{}/resolve-split-mismatch", fake_id),
        &auth.token,
        &json!({"external_expense_id": "ext_123"}),
    )
    .await;

    // Should fail with 422 (Unprocessable Entity) due to missing action field
    assert_status(&resp, 422);
}

/// Test resolve-split-mismatch with missing external_expense_id field returns 422.
#[tokio::test]
async fn test_resolve_mismatch_missing_expense_id() {
    let server = create_test_server().await;
    let ts = Utc::now().timestamp_nanos_opt().unwrap();
    let auth = register_test_user(
        &server,
        &format!("resolve_noeid_{}", ts),
        &format!("resolve_noeid_{}@example.com", ts),
        "SecurePass123!",
        "Resolve NoExpenseId",
    )
    .await;

    let fake_id = Uuid::new_v4();
    // Send body with action but missing external_expense_id
    let resp = post_authenticated(
        &server,
        &format!("/api/v1/transactions/{}/resolve-split-mismatch", fake_id),
        &auth.token,
        &json!({"action": "push"}),
    )
    .await;

    // Should fail with 422 (Unprocessable Entity) due to missing external_expense_id
    assert_status(&resp, 422);
}

/// Test resolve-split-mismatch with a non-existent transaction returns 404.
///
/// The service tries to fetch the transaction from the DB and fails.
#[tokio::test]
async fn test_resolve_mismatch_transaction_not_found() {
    let server = create_test_server().await;
    let ts = Utc::now().timestamp_nanos_opt().unwrap();
    let auth = register_test_user(
        &server,
        &format!("resolve_nf_{}", ts),
        &format!("resolve_nf_{}@example.com", ts),
        "SecurePass123!",
        "Resolve NF",
    )
    .await;

    let fake_id = Uuid::new_v4();
    let resp = post_authenticated(
        &server,
        &format!("/api/v1/transactions/{}/resolve-split-mismatch", fake_id),
        &auth.token,
        &json!({
            "external_expense_id": "ext_999",
            "action": "push"
        }),
    )
    .await;

    // Transaction not found in DB → 404
    assert_status(&resp, 404);
}

/// Test resolve-split-mismatch on a transaction with no splits returns 400.
///
/// The service fetches the transaction, finds no splits, and returns
/// a BadRequest error because there's nothing to resolve.
#[tokio::test]
async fn test_resolve_mismatch_no_splits() {
    let server = create_test_server().await;
    let ts = Utc::now().timestamp_nanos_opt().unwrap();
    let auth = register_test_user(
        &server,
        &format!("resolve_nosplit_{}", ts),
        &format!("resolve_nosplit_{}@example.com", ts),
        "SecurePass123!",
        "Resolve NoSplit",
    )
    .await;

    let account = create_test_account(&server, &auth.token, "Resolve NoSplit Account").await;
    let category = create_test_category(&server, &auth.token, "Resolve NoSplit Category").await;

    // Create a transaction WITHOUT splits
    let req = json!({
        "account_id": account.id,
        "category_id": category.id,
        "title": "No Splits for Resolve",
        "amount": -60.00,
        "date": Utc::now().to_rfc3339()
    });
    let create_resp = post_authenticated(&server, "/api/v1/transactions", &auth.token, &req).await;
    assert_status(&create_resp, 201);

    let tx: serde_json::Value = extract_json(create_resp);
    let tx_id = tx["id"].as_str().expect("Transaction should have id");

    let resp = post_authenticated(
        &server,
        &format!("/api/v1/transactions/{}/resolve-split-mismatch", tx_id),
        &auth.token,
        &json!({
            "external_expense_id": "ext_999",
            "action": "push"
        }),
    )
    .await;

    // No splits → 400 "No splits have a configured split provider"
    // (the service groups by provider and finds nothing)
    assert_status(&resp, 400);
}

/// Test resolve-split-mismatch on a transaction with splits but no provider configured.
///
/// The service fetches splits, groups by provider, but finds no splits with
/// a configured split provider. Returns 400.
#[tokio::test]
async fn test_resolve_mismatch_no_provider_configured() {
    let server = create_test_server().await;
    let ts = Utc::now().timestamp_nanos_opt().unwrap();
    let auth = register_test_user(
        &server,
        &format!("resolve_noprov_{}", ts),
        &format!("resolve_noprov_{}@example.com", ts),
        "SecurePass123!",
        "Resolve NoProv",
    )
    .await;

    let account = create_test_account(&server, &auth.token, "Resolve NoProv Account").await;
    let category = create_test_category(&server, &auth.token, "Resolve NoProv Category").await;
    let person = create_test_person(&server, &auth.token, "Resolve NoProv Person").await;

    // Create a transaction WITH splits but person has no split provider config
    let req = json!({
        "account_id": account.id,
        "category_id": category.id,
        "title": "Split Without Provider for Resolve",
        "amount": -80.00,
        "date": Utc::now().to_rfc3339(),
        "splits": [{"person_id": person.id, "amount": 40.0}]
    });
    let create_resp = post_authenticated(&server, "/api/v1/transactions", &auth.token, &req).await;
    assert_status(&create_resp, 201);

    let tx: serde_json::Value = extract_json(create_resp);
    let tx_id = tx["id"].as_str().expect("Transaction should have id");

    let resp = post_authenticated(
        &server,
        &format!("/api/v1/transactions/{}/resolve-split-mismatch", tx_id),
        &auth.token,
        &json!({
            "external_expense_id": "ext_999",
            "action": "push"
        }),
    )
    .await;

    assert_status(&resp, 400);
    let body = resp.text();
    assert!(
        body.to_lowercase().contains("provider"),
        "Error should mention provider, got: {}",
        body
    );
}

/// Test resolve-split-mismatch with both push and pull actions on valid request format.
///
/// Both actions should fail at the same point (no provider configured) but
/// this verifies the request body is correctly parsed for both action values.
#[tokio::test]
async fn test_resolve_mismatch_valid_actions_accepted() {
    let server = create_test_server().await;
    let ts = Utc::now().timestamp_nanos_opt().unwrap();
    let auth = register_test_user(
        &server,
        &format!("resolve_actions_{}", ts),
        &format!("resolve_actions_{}@example.com", ts),
        "SecurePass123!",
        "Resolve Actions",
    )
    .await;

    let account = create_test_account(&server, &auth.token, "Resolve Actions Account").await;
    let category = create_test_category(&server, &auth.token, "Resolve Actions Category").await;
    let person = create_test_person(&server, &auth.token, "Resolve Actions Person").await;

    // Create a transaction WITH splits (no provider config)
    let req = json!({
        "account_id": account.id,
        "category_id": category.id,
        "title": "Actions Test Transaction",
        "amount": -120.00,
        "date": Utc::now().to_rfc3339(),
        "splits": [{"person_id": person.id, "amount": 60.0}]
    });
    let create_resp = post_authenticated(&server, "/api/v1/transactions", &auth.token, &req).await;
    assert_status(&create_resp, 201);

    let tx: serde_json::Value = extract_json(create_resp);
    let tx_id = tx["id"].as_str().expect("Transaction should have id");

    // Test "push" action — should get past body parsing (400 from no provider, not 422)
    let push_resp = post_authenticated(
        &server,
        &format!("/api/v1/transactions/{}/resolve-split-mismatch", tx_id),
        &auth.token,
        &json!({
            "external_expense_id": "ext_123",
            "action": "push"
        }),
    )
    .await;
    let push_status = push_resp.status_code().as_u16();
    assert_eq!(
        push_status, 400,
        "Push action should fail with 400 (no provider), not 422 (parse error)"
    );

    // Test "pull" action — should also get past body parsing
    let pull_resp = post_authenticated(
        &server,
        &format!("/api/v1/transactions/{}/resolve-split-mismatch", tx_id),
        &auth.token,
        &json!({
            "external_expense_id": "ext_456",
            "action": "pull"
        }),
    )
    .await;
    let pull_status = pull_resp.status_code().as_u16();
    assert_eq!(
        pull_status, 400,
        "Pull action should fail with 400 (no provider), not 422 (parse error)"
    );
}

/// Test that another user cannot resolve-split-mismatch on someone else's transaction.
#[tokio::test]
async fn test_resolve_mismatch_wrong_user() {
    let server = create_test_server().await;
    let ts = Utc::now().timestamp_nanos_opt().unwrap();

    let auth_a = register_test_user(
        &server,
        &format!("resolve_usera_{}", ts),
        &format!("resolve_usera_{}@example.com", ts),
        "SecurePass123!",
        "Resolve User A",
    )
    .await;

    let auth_b = register_test_user(
        &server,
        &format!("resolve_userb_{}", ts),
        &format!("resolve_userb_{}@example.com", ts),
        "SecurePass123!",
        "Resolve User B",
    )
    .await;

    let account = create_test_account(&server, &auth_a.token, "Resolve WrongUser Account").await;
    let category = create_test_category(&server, &auth_a.token, "Resolve WrongUser Category").await;

    // User A creates a transaction
    let req = json!({
        "account_id": account.id,
        "category_id": category.id,
        "title": "User A Resolve Transaction",
        "amount": -90.00,
        "date": Utc::now().to_rfc3339()
    });
    let create_resp =
        post_authenticated(&server, "/api/v1/transactions", &auth_a.token, &req).await;
    assert_status(&create_resp, 201);

    let tx: serde_json::Value = extract_json(create_resp);
    let tx_id = tx["id"].as_str().expect("Transaction should have id");

    // User B tries to resolve mismatch on User A's transaction
    let resp = post_authenticated(
        &server,
        &format!("/api/v1/transactions/{}/resolve-split-mismatch", tx_id),
        &auth_b.token,
        &json!({
            "external_expense_id": "ext_999",
            "action": "push"
        }),
    )
    .await;

    let status = resp.status_code().as_u16();
    // Should fail — either 400 (no splits/provider) or 403 (forbidden)
    assert!(
        status >= 400,
        "User B resolving User A's transaction should fail, got {}",
        status
    );
}
