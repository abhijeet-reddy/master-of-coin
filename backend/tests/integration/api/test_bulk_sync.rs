//! Integration tests for bulk sync API endpoints.
//!
//! Tests cover:
//! - POST /api/v1/sync — Start a bulk sync job
//! - GET /api/v1/sync/:job_id — Get job status
//! - POST /api/v1/sync/:job_id/retry — Retry failed items from a completed job
//!
//! These tests validate the async job-based API pattern:
//! POST creates a PENDING job, GET returns the current status.
//! The worker binary (not tested here) processes jobs asynchronously.
//!
//! Retry tests require inserting COMPLETED jobs with result JSONB directly
//! into the database, since the worker is not running during tests.

use crate::common::*;
use chrono::Utc;
use diesel::prelude::*;
use master_of_coin_backend::{
    models::bulk_sync::{BulkSyncJobResponse, StartSyncJobResponse},
    schema::background_jobs,
    types::{JobStatus, JobType},
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

/// Helper to update a job's status and result directly in the DB.
/// Used for retry tests where we need a COMPLETED job with a BulkSyncReport.
fn update_job_to_completed_with_result(
    pool: &master_of_coin_backend::DbPool,
    job_id: Uuid,
    result_json: serde_json::Value,
) {
    let mut conn = pool.get().expect("Failed to get DB connection");
    diesel::update(background_jobs::table.find(job_id))
        .set((
            background_jobs::status.eq(JobStatus::Completed),
            background_jobs::result.eq(result_json),
            background_jobs::completed_at.eq(diesel::dsl::now),
        ))
        .execute(&mut conn)
        .expect("Failed to update job to COMPLETED with result");
}

// ============================================================================
// POST /api/v1/sync — Start Job Tests
// ============================================================================

/// Test that POST /sync with valid items returns 202 with job_id and status=PENDING.
/// Then GET /sync/:job_id returns the job in PENDING state.
#[tokio::test]
async fn test_start_and_poll_bulk_sync_job() {
    let server = create_test_server().await;
    let ts = Utc::now().timestamp_nanos_opt().unwrap();
    let auth = register_test_user(
        &server,
        &format!("bs_start_{}", ts),
        &format!("bs_start_{}@example.com", ts),
        "SecurePass123!",
        "BS Start",
    )
    .await;

    let body = json!({
        "items": [
            {
                "action": "push",
                "transaction_id": Uuid::new_v4()
            },
            {
                "action": "pull",
                "external_expense_id": "ext_12345"
            }
        ]
    });

    // POST should return 202
    let resp = post_authenticated(&server, "/api/v1/sync", &auth.token, &body).await;
    assert_status(&resp, 202);

    let result: StartSyncJobResponse = extract_json(resp);
    assert_eq!(result.status, JobStatus::Pending);
    assert_eq!(result.message, "Bulk sync job started");
    assert_eq!(result.total_items, 2);
    assert!(!result.job_id.is_nil(), "job_id should not be nil");

    // GET should return PENDING (worker not running in tests)
    let get_resp = get_authenticated(
        &server,
        &format!("/api/v1/sync/{}", result.job_id),
        &auth.token,
    )
    .await;
    assert_status(&get_resp, 200);

    let job_resp: BulkSyncJobResponse = extract_json(get_resp);
    assert_eq!(job_resp.job_id, result.job_id);
    assert_eq!(job_resp.status, JobStatus::Pending);
    assert!(
        job_resp.result.is_none(),
        "PENDING job should have no result"
    );
    assert!(job_resp.error.is_none(), "PENDING job should have no error");
}

// ============================================================================
// GET /api/v1/sync/:job_id — Get Job Tests
// ============================================================================

/// Test that GET with a random UUID returns 404.
#[tokio::test]
async fn test_get_bulk_sync_job_not_found() {
    let server = create_test_server().await;
    let ts = Utc::now().timestamp_nanos_opt().unwrap();
    let auth = register_test_user(
        &server,
        &format!("bs_notfound_{}", ts),
        &format!("bs_notfound_{}@example.com", ts),
        "SecurePass123!",
        "BS NotFound",
    )
    .await;

    let random_id = Uuid::new_v4();
    let resp =
        get_authenticated(&server, &format!("/api/v1/sync/{}", random_id), &auth.token).await;
    assert_status(&resp, 404);
}

/// Test that User B cannot GET User A's job — returns 404 (security: don't reveal existence).
#[tokio::test]
async fn test_get_bulk_sync_job_ownership() {
    let server = create_test_server().await;
    let ts = Utc::now().timestamp_nanos_opt().unwrap();

    let auth_a = register_test_user(
        &server,
        &format!("bs_usera_{}", ts),
        &format!("bs_usera_{}@example.com", ts),
        "SecurePass123!",
        "BS User A",
    )
    .await;

    let auth_b = register_test_user(
        &server,
        &format!("bs_userb_{}", ts),
        &format!("bs_userb_{}@example.com", ts),
        "SecurePass123!",
        "BS User B",
    )
    .await;

    // User A creates a job
    let body = json!({
        "items": [
            {
                "action": "push",
                "transaction_id": Uuid::new_v4()
            }
        ]
    });
    let post_resp = post_authenticated(&server, "/api/v1/sync", &auth_a.token, &body).await;
    assert_status(&post_resp, 202);
    let start_result: StartSyncJobResponse = extract_json(post_resp);

    // User B tries to GET User A's job — should get 404
    let get_resp = get_authenticated(
        &server,
        &format!("/api/v1/sync/{}", start_result.job_id),
        &auth_b.token,
    )
    .await;
    assert_status(&get_resp, 404);
}

// ============================================================================
// POST /api/v1/sync — Validation Tests
// ============================================================================

/// Test that POST with empty items array returns 400.
#[tokio::test]
async fn test_start_bulk_sync_empty_items() {
    let server = create_test_server().await;
    let ts = Utc::now().timestamp_nanos_opt().unwrap();
    let auth = register_test_user(
        &server,
        &format!("bs_empty_{}", ts),
        &format!("bs_empty_{}@example.com", ts),
        "SecurePass123!",
        "BS Empty",
    )
    .await;

    let body = json!({
        "items": []
    });

    let resp = post_authenticated(&server, "/api/v1/sync", &auth.token, &body).await;
    assert_status(&resp, 400);
}

/// Test that POST with push action but no transaction_id returns 400.
#[tokio::test]
async fn test_start_bulk_sync_push_without_transaction_id() {
    let server = create_test_server().await;
    let ts = Utc::now().timestamp_nanos_opt().unwrap();
    let auth = register_test_user(
        &server,
        &format!("bs_pushtx_{}", ts),
        &format!("bs_pushtx_{}@example.com", ts),
        "SecurePass123!",
        "BS PushTx",
    )
    .await;

    let body = json!({
        "items": [
            {
                "action": "push"
            }
        ]
    });

    let resp = post_authenticated(&server, "/api/v1/sync", &auth.token, &body).await;
    assert_status(&resp, 400);
}

/// Test that POST with pull action but no external_expense_id returns 400.
#[tokio::test]
async fn test_start_bulk_sync_pull_without_external_expense_id() {
    let server = create_test_server().await;
    let ts = Utc::now().timestamp_nanos_opt().unwrap();
    let auth = register_test_user(
        &server,
        &format!("bs_pullext_{}", ts),
        &format!("bs_pullext_{}@example.com", ts),
        "SecurePass123!",
        "BS PullExt",
    )
    .await;

    let body = json!({
        "items": [
            {
                "action": "pull"
            }
        ]
    });

    let resp = post_authenticated(&server, "/api/v1/sync", &auth.token, &body).await;
    assert_status(&resp, 400);
}

// ============================================================================
// POST /api/v1/sync/:job_id/retry — Retry Tests
// ============================================================================

/// Test that retrying a COMPLETED job with mixed results creates a new job
/// containing only the failed items, with previous_job_id set.
#[tokio::test]
async fn test_retry_creates_new_job_with_failed_items_only() {
    let server = create_test_server().await;
    let pool = get_test_db_pool();
    let ts = Utc::now().timestamp_nanos_opt().unwrap();
    let auth = register_test_user(
        &server,
        &format!("bs_retry_{}", ts),
        &format!("bs_retry_{}@example.com", ts),
        "SecurePass123!",
        "BS Retry",
    )
    .await;

    let failed_tx_id = Uuid::new_v4();

    // Create a job via POST
    let body = json!({
        "items": [
            {
                "action": "push",
                "transaction_id": Uuid::new_v4()
            },
            {
                "action": "push",
                "transaction_id": failed_tx_id
            },
            {
                "action": "pull",
                "external_expense_id": "ext_99999"
            }
        ]
    });
    let post_resp = post_authenticated(&server, "/api/v1/sync", &auth.token, &body).await;
    assert_status(&post_resp, 202);
    let start_result: StartSyncJobResponse = extract_json(post_resp);

    // Manually update the job to COMPLETED with a BulkSyncReport containing
    // mixed results (2 succeeded, 1 failed)
    let report = json!({
        "summary": {
            "total": 3,
            "succeeded": 2,
            "failed": 1
        },
        "items": [
            {
                "action": "push",
                "transaction_id": Uuid::new_v4(),
                "status": "success",
                "detail": { "sync_status": "created" }
            },
            {
                "action": "push",
                "transaction_id": failed_tx_id,
                "status": "failed",
                "error": "Transaction has no splits to sync"
            },
            {
                "action": "pull",
                "external_expense_id": "ext_99999",
                "status": "success",
                "detail": { "sync_status": "imported" }
            }
        ]
    });
    update_job_to_completed_with_result(&pool, start_result.job_id, report);

    // Retry the job — should create a new job with only the failed item
    let retry_resp = post_authenticated(
        &server,
        &format!("/api/v1/sync/{}/retry", start_result.job_id),
        &auth.token,
        &json!({}),
    )
    .await;
    assert_status(&retry_resp, 202);

    let retry_result: StartSyncJobResponse = extract_json(retry_resp);
    assert_eq!(retry_result.status, JobStatus::Pending);
    assert_eq!(retry_result.message, "Bulk sync retry job started");
    assert_eq!(
        retry_result.total_items, 1,
        "Only the 1 failed item should be retried"
    );
    assert_ne!(
        retry_result.job_id, start_result.job_id,
        "Retry should create a NEW job"
    );

    // Verify the new job has previous_job_id set by fetching it from DB
    let new_job =
        master_of_coin_backend::repositories::background_job::BackgroundJobRepository::find_by_id(
            &pool,
            retry_result.job_id,
        )
        .expect("DB query should succeed")
        .expect("New job should exist");
    assert_eq!(
        new_job.previous_job_id,
        Some(start_result.job_id),
        "New job should reference original job via previous_job_id"
    );
    assert_eq!(new_job.job_type, JobType::BulkSync);

    // Verify the new job's input contains only the failed item
    let input: serde_json::Value = new_job.input.expect("New job should have input");
    let items = input["items"]
        .as_array()
        .expect("Input should have items array");
    assert_eq!(items.len(), 1, "Retry job should have exactly 1 item");
    assert_eq!(items[0]["action"], "push");
    assert_eq!(
        items[0]["transaction_id"],
        failed_tx_id.to_string(),
        "Retry item should be the failed transaction"
    );
}

/// Test that retrying a COMPLETED job with no failed items returns 400.
#[tokio::test]
async fn test_retry_no_failed_items_returns_400() {
    let server = create_test_server().await;
    let pool = get_test_db_pool();
    let ts = Utc::now().timestamp_nanos_opt().unwrap();
    let auth = register_test_user(
        &server,
        &format!("bs_retrynf_{}", ts),
        &format!("bs_retrynf_{}@example.com", ts),
        "SecurePass123!",
        "BS RetryNF",
    )
    .await;

    // Create a job via POST
    let body = json!({
        "items": [
            {
                "action": "push",
                "transaction_id": Uuid::new_v4()
            }
        ]
    });
    let post_resp = post_authenticated(&server, "/api/v1/sync", &auth.token, &body).await;
    assert_status(&post_resp, 202);
    let start_result: StartSyncJobResponse = extract_json(post_resp);

    // Manually update the job to COMPLETED with all items succeeded
    let report = json!({
        "summary": {
            "total": 1,
            "succeeded": 1,
            "failed": 0
        },
        "items": [
            {
                "action": "push",
                "transaction_id": Uuid::new_v4(),
                "status": "success",
                "detail": { "sync_status": "created" }
            }
        ]
    });
    update_job_to_completed_with_result(&pool, start_result.job_id, report);

    // Retry should fail with 400 — no failed items
    let retry_resp = post_authenticated(
        &server,
        &format!("/api/v1/sync/{}/retry", start_result.job_id),
        &auth.token,
        &json!({}),
    )
    .await;
    assert_status(&retry_resp, 400);
}

/// Test that retrying a non-COMPLETED (PENDING) job returns 400.
#[tokio::test]
async fn test_retry_non_completed_job_returns_400() {
    let server = create_test_server().await;
    let ts = Utc::now().timestamp_nanos_opt().unwrap();
    let auth = register_test_user(
        &server,
        &format!("bs_retrypend_{}", ts),
        &format!("bs_retrypend_{}@example.com", ts),
        "SecurePass123!",
        "BS RetryPend",
    )
    .await;

    // Create a PENDING job via POST
    let body = json!({
        "items": [
            {
                "action": "push",
                "transaction_id": Uuid::new_v4()
            }
        ]
    });
    let post_resp = post_authenticated(&server, "/api/v1/sync", &auth.token, &body).await;
    assert_status(&post_resp, 202);
    let start_result: StartSyncJobResponse = extract_json(post_resp);

    // Try to retry a PENDING job — should fail with 400
    let retry_resp = post_authenticated(
        &server,
        &format!("/api/v1/sync/{}/retry", start_result.job_id),
        &auth.token,
        &json!({}),
    )
    .await;
    assert_status(&retry_resp, 400);
}
