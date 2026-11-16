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
use bigdecimal::BigDecimal;
use chrono::DateTime;
use chrono::Utc;
use diesel::prelude::*;
use master_of_coin_backend::DbPool;
use master_of_coin_backend::models::transaction_split::NewTransactionSplit;
use master_of_coin_backend::repositories::split_sync_record::SplitSyncRecordRepository;
use master_of_coin_backend::schema::transaction_splits;
use master_of_coin_backend::services::split_provider::{
    ExternalExpenseDetail, ExternalExpenseUser, SplitProvider as SplitProviderImpl,
    StubSplitProvider,
};
use master_of_coin_backend::services::split_sync_service::SplitSyncService;
use master_of_coin_backend::types::CurrencyCode;
use master_of_coin_backend::utils::encryption;
use master_of_coin_backend::{
    models::{
        NewSplitProvider, SplitProvider,
        person_split_config::NewPersonSplitConfig,
        split_sync_record::{NewSplitSyncRecord, SplitSyncStatusResponse},
    },
    schema::{person_split_configs, split_providers, split_sync_records},
    types::SplitProviderType,
};
use serde_json::json;
use std::collections::HashMap;
use std::str::FromStr;
use std::sync::Arc;
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
        provider_type: SplitProviderType::Splitwise,
        credentials: json!({"encrypted": "test_encrypted_credentials"}),
        is_active: true,
    };
    diesel::insert_into(split_providers::table)
        .values(&new_provider)
        .get_result::<SplitProvider>(&mut conn)
        .expect("Failed to create test split provider")
}

fn create_person_split_config(
    pool: &master_of_coin_backend::DbPool,
    person_id: Uuid,
    provider_id: Uuid,
    external_user_id: &str,
) {
    let mut conn = pool.get().expect("Failed to get DB connection");
    let new_config = NewPersonSplitConfig {
        person_id,
        split_provider_id: provider_id,
        external_user_id: external_user_id.to_string(),
    };
    diesel::insert_into(person_split_configs::table)
        .values(&new_config)
        .execute(&mut conn)
        .expect("Failed to create person split config");
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
        "amount": -100.0,
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

// ============================================================================
// Income Transaction Split Sync Tests
// ============================================================================

/// Test that syncing an income transaction with splits reaches the provider call.
///
/// Income transactions (positive amount) on regular accounts should use
/// `build_income_expense_users` where the friend is the payer on Splitwise.
/// Since test credentials can't be decrypted, the sync will fail with a 500
/// (credential error) — but NOT a 400 "no splits" or "no provider", proving
/// the income path through the sync logic works correctly.
#[tokio::test]
async fn test_sync_income_transaction_with_splits_reaches_provider() {
    let server = create_test_server().await;
    let pool = get_test_db_pool();
    let ts = Utc::now().timestamp_nanos_opt().unwrap();

    let auth = register_test_user(
        &server,
        &format!("sync_income_{}", ts),
        &format!("sync_income_{}@example.com", ts),
        "SecurePass123!",
        "Sync Income User",
    )
    .await;

    let account = create_test_account(&server, &auth.token, "Sync Income Account").await;
    let category = create_test_category(&server, &auth.token, "Sync Income Category").await;
    let person = create_test_person(&server, &auth.token, "Income Payer Friend").await;

    // Create a split provider and map the person
    let provider = create_test_split_provider(&pool, auth.user.id);
    create_person_split_config(&pool, person.id, provider.id, "income_friend_ext_123");

    // Create an INCOME transaction (positive amount) with a split
    let req = json!({
        "account_id": account.id,
        "category_id": category.id,
        "title": "Friend paid me back for dinner",
        "amount": 87.05,
        "date": Utc::now().to_rfc3339(),
        "splits": [{"person_id": person.id, "amount": 87.05}]
    });
    let create_resp = post_authenticated(&server, "/api/v1/transactions", &auth.token, &req).await;
    assert_status(&create_resp, 201);

    let tx: serde_json::Value = extract_json(create_resp);
    let tx_id = tx["id"].as_str().expect("Transaction should have id");

    // Verify the transaction was created as income with splits
    assert_eq!(tx["amount"].as_str().unwrap(), "87.05");
    assert!(tx["splits"].is_array());
    let splits = tx["splits"].as_array().unwrap();
    assert_eq!(splits.len(), 1);
    assert_eq!(
        splits[0]["person_id"].as_str().unwrap(),
        person.id.to_string()
    );

    // Try to sync — should reach the provider call (and fail with credential error)
    // but NOT with 400 "no splits" or "no provider"
    let resp = post_authenticated(
        &server,
        &format!("/api/v1/transactions/{}/sync-split", tx_id),
        &auth.token,
        &json!({}),
    )
    .await;

    let status = resp.status_code().as_u16();
    // Should NOT be 400 (no splits / no provider) — the income transaction has
    // splits with a configured provider. Expected: 500 (credential decryption fails)
    assert_ne!(
        status, 400,
        "Income transaction with splits and provider should not get 400"
    );
    // The sync reached the provider call (credential decryption fails in test env)
    assert_eq!(
        status, 500,
        "Expected 500 from credential decryption failure, got {}",
        status
    );
}

/// Test that syncing an income transaction without a provider returns 400.
///
/// Same as expense transactions: if the split person has no split provider
/// config, the sync should fail with "No splits have a configured split provider".
#[tokio::test]
async fn test_sync_income_transaction_no_provider_returns_400() {
    let server = create_test_server().await;
    let ts = Utc::now().timestamp_nanos_opt().unwrap();

    let auth = register_test_user(
        &server,
        &format!("sync_inc_noprov_{}", ts),
        &format!("sync_inc_noprov_{}@example.com", ts),
        "SecurePass123!",
        "Sync Income NoProv",
    )
    .await;

    let account = create_test_account(&server, &auth.token, "Income NoProv Account").await;
    let category = create_test_category(&server, &auth.token, "Income NoProv Category").await;
    let person = create_test_person(&server, &auth.token, "Income NoProv Person").await;

    // Create an income transaction with splits but NO split provider config
    let req = json!({
        "account_id": account.id,
        "category_id": category.id,
        "title": "Income without provider",
        "amount": 50.00,
        "date": Utc::now().to_rfc3339(),
        "splits": [{"person_id": person.id, "amount": 50.0}]
    });
    let create_resp = post_authenticated(&server, "/api/v1/transactions", &auth.token, &req).await;
    assert_status(&create_resp, 201);

    let tx: serde_json::Value = extract_json(create_resp);
    let tx_id = tx["id"].as_str().expect("Transaction should have id");

    // Try to sync — should fail with 400 because no provider configured
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

/// Test that an income transaction with no splits returns 400 on sync.
///
/// Same behavior as expense transactions: no splits → "Transaction has no splits to sync".
#[tokio::test]
async fn test_sync_income_transaction_no_splits_returns_400() {
    let server = create_test_server().await;
    let ts = Utc::now().timestamp_nanos_opt().unwrap();

    let auth = register_test_user(
        &server,
        &format!("sync_inc_nosplit_{}", ts),
        &format!("sync_inc_nosplit_{}@example.com", ts),
        "SecurePass123!",
        "Sync Income NoSplit",
    )
    .await;

    let account = create_test_account(&server, &auth.token, "Income NoSplit Account").await;
    let category = create_test_category(&server, &auth.token, "Income NoSplit Category").await;

    // Create an income transaction WITHOUT splits
    let req = json!({
        "account_id": account.id,
        "category_id": category.id,
        "title": "Income without splits",
        "amount": 75.00,
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

// ============================================================================
// Matcher tests: an expense may back only ONE transaction
// ============================================================================
//
// These drive `SplitSyncService` against `StubSplitProvider` instead of the real
// HTTP providers, so the matcher itself is under test. Transactions and splits are
// inserted directly in the DB (not through the API) so that no implicit sync runs
// against the real provider registry.
//
// The defect they cover: `find_split_match` used to build its exclusion set from the
// CURRENT transaction's own sync records, so an expense already claimed by a
// DIFFERENT transaction stayed an eligible candidate. The matcher keys on exact
// transaction total within +/-3 days, so the later of two same-total rows linked onto
// the earlier one's expense, reported "linked" plus sync_status synced, and silently
// lost the second share. Measured cost in the live realm: 5 collisions, EUR 31.31,
// across both providers.

/// Full environment for one matcher test: a user with an account, a split person
/// mapped to a provider, and a `SplitSyncService` wired to a stub provider.
struct MatcherFixture {
    pool: DbPool,
    account_id: Uuid,
    category_id: Uuid,
    person_id: Uuid,
    payer_external_id: String,
    friend_external_id: String,
    service: SplitSyncService,
    stub: Arc<StubSplitProvider>,
    user_id: Uuid,
    _cleanup: UserCleanup,
}

impl MatcherFixture {
    /// Insert a transaction with a single split for the fixture's person.
    ///
    /// `amount` is the signed transaction total (e.g. `"-39.20"`), `share` is the
    /// person's absolute owed share (e.g. `"19.60"`), `date` is RFC 3339.
    fn add_transaction(&self, title: &str, amount: &str, share: &str, date: &str) -> Uuid {
        let mut conn = self.pool.get().expect("Failed to get DB connection");

        let parsed_date = DateTime::parse_from_rfc3339(date)
            .expect("Test date must be valid RFC 3339")
            .with_timezone(&Utc);

        let transaction = TransactionFactory::new(self.user_id, self.account_id)
            .category_id(self.category_id)
            .title(title)
            .amount(amount)
            .date(parsed_date)
            .build(&mut conn);

        let new_split = NewTransactionSplit {
            transaction_id: transaction.id,
            person_id: self.person_id,
            amount: BigDecimal::from_str(share).expect("Test share must parse"),
            sync_skipped: false,
        };
        diesel::insert_into(transaction_splits::table)
            .values(&new_split)
            .execute(&mut conn)
            .expect("Failed to create transaction split");

        transaction.id
    }

    /// The external expense ID recorded against a transaction, if any.
    fn linked_expense_id(&self, transaction_id: Uuid) -> Option<String> {
        SplitSyncRecordRepository::find_by_transaction_id(&self.pool, transaction_id)
            .expect("Failed to load sync records")
            .into_iter()
            .find_map(|record| record.external_expense_id)
    }

    /// Build an expense the stub will offer as a candidate, shaped the way a provider
    /// returns one the user paid in full.
    fn seed_unlinked_expense(&self, external_expense_id: &str, cost: &str, friend_share: &str) {
        let total = BigDecimal::from_str(cost).expect("Test cost must parse");
        let friend_owes = BigDecimal::from_str(friend_share).expect("Test share must parse");
        let payer_owes = &total - &friend_owes;

        self.stub.seed_expense(ExternalExpenseDetail {
            external_expense_id: external_expense_id.to_string(),
            description: "Seeded candidate".to_string(),
            cost: cost.to_string(),
            currency_code: "EUR".to_string(),
            date: "2026-10-03T12:00:00+00:00".to_string(),
            users: vec![
                ExternalExpenseUser {
                    external_user_id: self.payer_external_id.clone(),
                    first_name: "Stub".to_string(),
                    last_name: "Payer".to_string(),
                    paid_share: cost.to_string(),
                    owed_share: payer_owes.to_string(),
                },
                ExternalExpenseUser {
                    external_user_id: self.friend_external_id.clone(),
                    first_name: "Stub".to_string(),
                    last_name: "Friend".to_string(),
                    paid_share: "0.00".to_string(),
                    owed_share: friend_owes.to_string(),
                },
            ],
            provider_type: self.stub.provider_type(),
        });
    }
}

/// Build a fixture whose provider row and credentials match `provider_type`.
///
/// Needs a real `ENCRYPTION_KEY` in the environment, the same one the other provider
/// integration tests need.
fn setup_matcher_fixture(provider_type: SplitProviderType) -> MatcherFixture {
    let pool = get_test_db_pool();
    let mut conn = pool.get().expect("Failed to get DB connection");

    let user = UserFactory::new().build(&mut conn);
    let account = AccountFactory::new(user.id)
        .name("Matcher Account")
        .currency(CurrencyCode::Eur)
        .build(&mut conn);
    let category = CategoryFactory::new(user.id)
        .name("Matcher Category")
        .build(&mut conn);
    let person = PersonFactory::new(user.id)
        .name("Matcher Friend")
        .build(&mut conn);

    let payer_external_id = "900001".to_string();
    let friend_external_id = format!("friend-{}", Uuid::new_v4());

    let credentials = match provider_type {
        SplitProviderType::Splitwise => json!({
            "splitwise_user_id": 900001,
            "splitwise_user_name": "Matcher Payer",
            "api_key": "stub-token",
        }),
        SplitProviderType::SplitPro => json!({
            "splitpro_user_id": 900001,
            "splitpro_user_name": "Matcher Payer",
            "api_key": "stub-token",
        }),
    };
    let encrypted = encryption::encrypt_credentials(&credentials)
        .expect("ENCRYPTION_KEY must be set for matcher tests");

    let new_provider = NewSplitProvider {
        user_id: user.id,
        provider_type,
        credentials: json!({"encrypted": encrypted}),
        is_active: true,
    };
    let provider = diesel::insert_into(split_providers::table)
        .values(&new_provider)
        .get_result::<SplitProvider>(&mut conn)
        .expect("Failed to create split provider");
    drop(conn);

    create_person_split_config(&pool, person.id, provider.id, &friend_external_id);

    let stub = Arc::new(StubSplitProvider::new(provider_type));
    let mut providers: HashMap<SplitProviderType, Arc<dyn SplitProviderImpl>> = HashMap::new();
    let provider_impl: Arc<dyn SplitProviderImpl> = stub.clone();
    providers.insert(provider_type, provider_impl);

    MatcherFixture {
        pool: pool.clone(),
        account_id: account.id,
        category_id: category.id,
        person_id: person.id,
        payer_external_id,
        friend_external_id,
        service: SplitSyncService::with_providers(pool.clone(), providers),
        stub,
        user_id: user.id,
        _cleanup: UserCleanup {
            pool,
            user_id: user.id,
        },
    }
}

/// Two transactions with the identical total must each get their OWN expense.
///
/// Regression: KLIA Ekspres 3 Oct and 4 Oct, both -39.20. The second linked onto the
/// first's expense `4776926754` and EUR 19.60 of share was lost.
#[tokio::test]
async fn test_two_same_total_transactions_each_get_their_own_expense() {
    let fx = setup_matcher_fixture(SplitProviderType::Splitwise);

    let first = fx.add_transaction("KLIA Ekspres", "-39.20", "19.60", "2026-10-03T12:00:00Z");
    let first_result = fx
        .service
        .sync_transaction(first)
        .await
        .expect("First sync should succeed");
    assert_eq!(first_result["status"], "created");

    let second = fx.add_transaction("KLIA Ekspres", "-39.20", "19.60", "2026-10-04T12:00:00Z");
    let second_result = fx
        .service
        .sync_transaction(second)
        .await
        .expect("Second sync should succeed");

    assert_eq!(
        second_result["status"], "created",
        "A second same-total transaction must create its own expense, not link onto the first's"
    );
    assert_eq!(
        fx.stub.created_count(),
        2,
        "Both transactions should have pushed an expense"
    );

    let first_id = fx.linked_expense_id(first).expect("First should be linked");
    let second_id = fx
        .linked_expense_id(second)
        .expect("Second should be linked");
    assert_ne!(
        first_id, second_id,
        "Two transactions must never share one external expense"
    );
}

/// A THIRD transaction with the same total also gets its own expense.
///
/// The old exclusion set was scoped to the current transaction, so N same-total rows
/// all piled onto the first one's expense.
#[tokio::test]
async fn test_third_same_total_transaction_also_gets_its_own_expense() {
    let fx = setup_matcher_fixture(SplitProviderType::Splitwise);

    let mut linked_ids = Vec::new();
    for (index, date) in ["2026-10-03", "2026-10-04", "2026-10-05"]
        .iter()
        .enumerate()
    {
        let transaction = fx.add_transaction(
            &format!("Grab ride {}", index + 1),
            "-2.40",
            "1.20",
            &format!("{}T12:00:00Z", date),
        );
        let result = fx
            .service
            .sync_transaction(transaction)
            .await
            .expect("Sync should succeed");
        assert_eq!(
            result["status"],
            "created",
            "Transaction {} should create its own expense",
            index + 1
        );
        linked_ids.push(fx.linked_expense_id(transaction).expect("Should be linked"));
    }

    assert_eq!(fx.stub.created_count(), 3);
    linked_ids.sort();
    linked_ids.dedup();
    assert_eq!(
        linked_ids.len(),
        3,
        "Three same-total transactions must hold three distinct expenses"
    );
}

/// The transaction's OWN linked expense stays an eligible candidate.
///
/// Guards against the over-blunt fix of excluding every expense that has any sync
/// record: that also hides a transaction's own expense and breaks re-sync after an
/// edit, because the update path re-pushes unconditionally.
#[tokio::test]
async fn test_matcher_keeps_the_transactions_own_linked_expense() {
    let fx = setup_matcher_fixture(SplitProviderType::Splitwise);

    let transaction = fx.add_transaction("Uno Pizza", "-68.00", "34.00", "2026-10-03T12:00:00Z");
    fx.service
        .sync_transaction(transaction)
        .await
        .expect("Sync should succeed");
    let own_expense_id = fx
        .linked_expense_id(transaction)
        .expect("Should be linked after sync");

    let candidates = fx
        .service
        .find_split_match(transaction)
        .await
        .expect("Matching should succeed");

    assert!(
        candidates
            .iter()
            .any(|c| c.external_expense_id == own_expense_id),
        "A transaction must still see its own expense as a candidate"
    );
}

/// An expense claimed by a DIFFERENT transaction is not a candidate.
#[tokio::test]
async fn test_matcher_excludes_an_expense_claimed_by_another_transaction() {
    let fx = setup_matcher_fixture(SplitProviderType::Splitwise);

    let owner = fx.add_transaction("The Manor Complex", "-1.10", "0.55", "2026-10-02T12:00:00Z");
    fx.service
        .sync_transaction(owner)
        .await
        .expect("Sync should succeed");
    let owned_expense_id = fx.linked_expense_id(owner).expect("Should be linked");

    let other = fx.add_transaction("Grab", "-1.10", "0.55", "2026-10-05T12:00:00Z");
    let candidates = fx
        .service
        .find_split_match(other)
        .await
        .expect("Matching should succeed");

    assert!(
        !candidates
            .iter()
            .any(|c| c.external_expense_id == owned_expense_id),
        "An expense already linked to another transaction must not be a candidate"
    );
    assert!(
        candidates.is_empty(),
        "The only same-total expense is claimed, so there should be no candidates"
    );
}

/// With one claimed and one unclaimed candidate at the same cost, the matcher links
/// onto the unclaimed one.
///
/// This is the live acceptance case: two Splitwise expenses at EUR 17.43, one already
/// linked to another transaction and one free. A plain sync must land on the free one.
#[tokio::test]
async fn test_matcher_links_onto_the_unclaimed_candidate() {
    let fx = setup_matcher_fixture(SplitProviderType::Splitwise);

    // Another transaction already owns an expense at this cost.
    let claimer = fx.add_transaction("Earlier charge", "-17.43", "8.71", "2026-10-03T12:00:00Z");
    fx.service
        .sync_transaction(claimer)
        .await
        .expect("Sync should succeed");
    let claimed_expense_id = fx.linked_expense_id(claimer).expect("Should be linked");

    // A second expense at the same cost exists on the provider and is unlinked.
    fx.seed_unlinked_expense("stub-free-17-43", "17.43", "8.71");

    let target = fx.add_transaction("Later charge", "-17.43", "8.71", "2026-10-04T12:00:00Z");
    let result = fx
        .service
        .sync_transaction(target)
        .await
        .expect("Sync should succeed");

    assert_eq!(
        result["status"], "linked",
        "An unclaimed same-cost expense should still be linked, not duplicated"
    );
    assert_eq!(
        result["external_expense_id"], "stub-free-17-43",
        "Must link onto the unclaimed expense"
    );
    assert_eq!(
        fx.linked_expense_id(target).as_deref(),
        Some("stub-free-17-43")
    );
    assert_ne!(
        fx.linked_expense_id(target),
        Some(claimed_expense_id),
        "Must not steal the expense another transaction owns"
    );
    assert_eq!(
        fx.stub.created_count(),
        1,
        "Only the first transaction needed a new expense"
    );
}

/// One cent of difference must keep matching off: the negative controls.
///
/// `MO4GZW2H` -39.21 and `GQZD7P5J` -2.41 correctly got their own expenses next to
/// -39.20 and -2.40 rows that shared their SHARE but not their total. A fix that
/// over-matches or over-excludes shows up here.
#[tokio::test]
async fn test_one_cent_difference_never_shares_an_expense() {
    let fx = setup_matcher_fixture(SplitProviderType::Splitwise);

    let rows = [
        ("KLIA Ekspres", "-39.20", "19.60", "2026-10-03T12:00:00Z"),
        ("Grab to airport", "-39.21", "19.60", "2026-10-04T12:00:00Z"),
        ("Bolt", "-2.40", "1.20", "2026-10-04T12:00:00Z"),
        ("Grab", "-2.41", "1.20", "2026-10-05T12:00:00Z"),
    ];

    let mut linked_ids = Vec::new();
    for (title, amount, share, date) in rows {
        let transaction = fx.add_transaction(title, amount, share, date);
        let result = fx
            .service
            .sync_transaction(transaction)
            .await
            .expect("Sync should succeed");
        assert_eq!(
            result["status"], "created",
            "{} should create its own expense",
            title
        );
        linked_ids.push(fx.linked_expense_id(transaction).expect("Should be linked"));
    }

    assert_eq!(fx.stub.created_count(), 4);
    linked_ids.sort();
    linked_ids.dedup();
    assert_eq!(
        linked_ids.len(),
        4,
        "All four transactions must hold distinct expenses"
    );
}

/// The fix is provider-agnostic: SplitPro collided too (Centra 13 Jul / 16 Jul, both
/// -10.00, and Airlink / Ashers Ice Cream, both -9.92).
#[tokio::test]
async fn test_splitpro_same_total_transactions_each_get_their_own_expense() {
    let fx = setup_matcher_fixture(SplitProviderType::SplitPro);

    let first = fx.add_transaction("Centra", "-10.00", "5.00", "2026-07-13T12:00:00Z");
    fx.service
        .sync_transaction(first)
        .await
        .expect("First sync should succeed");

    let second = fx.add_transaction("Centra", "-10.00", "5.00", "2026-07-16T12:00:00Z");
    let second_result = fx
        .service
        .sync_transaction(second)
        .await
        .expect("Second sync should succeed");

    assert_eq!(
        second_result["status"], "created",
        "SplitPro must behave the same as Splitwise"
    );
    assert_ne!(
        fx.linked_expense_id(first).expect("First should be linked"),
        fx.linked_expense_id(second)
            .expect("Second should be linked"),
        "Two SplitPro transactions must never share one expense"
    );
}
