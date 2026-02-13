//! Integration tests for split sync status API endpoints.
//!
//! Tests cover:
//! - GET /api/v1/splits/:id/sync-status - Get sync status for a split
//! - POST /api/v1/splits/:id/retry-sync - Retry a failed sync
//!
//! These tests create sync records directly in the DB since sync records
//! are normally created by the SplitSyncService during transaction creation.

use crate::common::*;
use chrono::Utc;
use diesel::prelude::*;
use master_of_coin_backend::{
    models::{
        NewSplitProvider, SplitProvider,
        split_sync_record::{NewSplitSyncRecord, SplitSyncStatusResponse},
    },
    schema::{split_providers, split_sync_records, transaction_splits},
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
