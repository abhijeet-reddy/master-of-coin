//! Integration tests for drift detection API endpoints.
//!
//! Tests cover:
//! - POST /api/v1/drift-detection - Start a drift detection job
//! - GET /api/v1/drift-detection/:job_id - Get job status
//! - POST /api/v1/drift-detection/:job_id/retry - Retry a failed job
//!
//! These tests validate the async job-based API pattern:
//! POST creates a PENDING job, GET returns the current status.
//! The worker binary (not tested here) processes jobs asynchronously.

use crate::common::*;
use chrono::Utc;
use diesel::prelude::*;
use master_of_coin_backend::{
    models::drift_detection::{DriftDetectionJobResponse, StartJobResponse},
    schema::background_jobs,
    types::JobStatus,
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

/// Helper to update a job's status directly in the DB.
fn update_job_status_in_db(
    pool: &master_of_coin_backend::DbPool,
    job_id: Uuid,
    status: JobStatus,
    error: Option<&str>,
) {
    let mut conn = pool.get().expect("Failed to get DB connection");
    if let Some(err_msg) = error {
        diesel::update(background_jobs::table.find(job_id))
            .set((
                background_jobs::status.eq(status),
                background_jobs::error.eq(err_msg),
                background_jobs::completed_at.eq(diesel::dsl::now),
            ))
            .execute(&mut conn)
            .expect("Failed to update job status");
    } else {
        diesel::update(background_jobs::table.find(job_id))
            .set(background_jobs::status.eq(status))
            .execute(&mut conn)
            .expect("Failed to update job status");
    }
}

// ============================================================================
// POST /api/v1/drift-detection — Start Job Tests
// ============================================================================

/// Test that POST /drift-detection with valid start_date returns 202 with job_id and status=PENDING.
#[tokio::test]
async fn test_start_drift_detection_returns_202() {
    let server = create_test_server().await;
    let ts = Utc::now().timestamp_nanos_opt().unwrap();
    let auth = register_test_user(
        &server,
        &format!("dd_start_{}", ts),
        &format!("dd_start_{}@example.com", ts),
        "SecurePass123!",
        "DD Start",
    )
    .await;

    let body = json!({
        "start_date": "2026-01-01T00:00:00Z",
        "end_date": "2026-02-21T23:59:59Z"
    });

    let resp = post_authenticated(&server, "/api/v1/drift-detection", &auth.token, &body).await;
    assert_status(&resp, 202);

    let result: StartJobResponse = extract_json(resp);
    assert_eq!(result.status, JobStatus::Pending);
    assert_eq!(result.message, "Drift detection job started");
    assert!(!result.job_id.is_nil(), "job_id should not be nil");
}

/// Test that POST /drift-detection without start_date returns 422 (deserialization error).
#[tokio::test]
async fn test_start_drift_detection_missing_start_date() {
    let server = create_test_server().await;
    let ts = Utc::now().timestamp_nanos_opt().unwrap();
    let auth = register_test_user(
        &server,
        &format!("dd_nodate_{}", ts),
        &format!("dd_nodate_{}@example.com", ts),
        "SecurePass123!",
        "DD NoDate",
    )
    .await;

    // Missing start_date — only end_date provided
    let body = json!({
        "end_date": "2026-02-21T23:59:59Z"
    });

    let resp = post_authenticated(&server, "/api/v1/drift-detection", &auth.token, &body).await;
    // Should fail with 422 (Unprocessable Entity) due to missing required field
    assert_status(&resp, 422);
}

// ============================================================================
// GET /api/v1/drift-detection/:job_id — Get Job Tests
// ============================================================================

/// Test that GET returns PENDING status for a newly created job.
#[tokio::test]
async fn test_get_drift_detection_pending_job() {
    let server = create_test_server().await;
    let ts = Utc::now().timestamp_nanos_opt().unwrap();
    let auth = register_test_user(
        &server,
        &format!("dd_pending_{}", ts),
        &format!("dd_pending_{}@example.com", ts),
        "SecurePass123!",
        "DD Pending",
    )
    .await;

    // Create a job via POST
    let body = json!({
        "start_date": "2026-01-01T00:00:00Z",
        "end_date": "2026-02-21T23:59:59Z"
    });
    let post_resp =
        post_authenticated(&server, "/api/v1/drift-detection", &auth.token, &body).await;
    assert_status(&post_resp, 202);
    let start_result: StartJobResponse = extract_json(post_resp);

    // GET the job — should be PENDING (worker not running in tests)
    let get_resp = get_authenticated(
        &server,
        &format!("/api/v1/drift-detection/{}", start_result.job_id),
        &auth.token,
    )
    .await;
    assert_status(&get_resp, 200);

    let job_resp: DriftDetectionJobResponse = extract_json(get_resp);
    assert_eq!(job_resp.job_id, start_result.job_id);
    assert_eq!(job_resp.status, JobStatus::Pending);
    assert!(
        job_resp.result.is_none(),
        "PENDING job should have no result"
    );
    assert!(job_resp.error.is_none(), "PENDING job should have no error");
}

/// Test that GET with a random UUID returns 404.
#[tokio::test]
async fn test_get_drift_detection_not_found() {
    let server = create_test_server().await;
    let ts = Utc::now().timestamp_nanos_opt().unwrap();
    let auth = register_test_user(
        &server,
        &format!("dd_notfound_{}", ts),
        &format!("dd_notfound_{}@example.com", ts),
        "SecurePass123!",
        "DD NotFound",
    )
    .await;

    let random_id = Uuid::new_v4();
    let resp = get_authenticated(
        &server,
        &format!("/api/v1/drift-detection/{}", random_id),
        &auth.token,
    )
    .await;
    assert_status(&resp, 404);
}

/// Test that User B cannot GET User A's job — returns 404 (security: don't reveal existence).
#[tokio::test]
async fn test_get_drift_detection_wrong_user() {
    let server = create_test_server().await;
    let ts = Utc::now().timestamp_nanos_opt().unwrap();

    let auth_a = register_test_user(
        &server,
        &format!("dd_usera_{}", ts),
        &format!("dd_usera_{}@example.com", ts),
        "SecurePass123!",
        "DD User A",
    )
    .await;

    let auth_b = register_test_user(
        &server,
        &format!("dd_userb_{}", ts),
        &format!("dd_userb_{}@example.com", ts),
        "SecurePass123!",
        "DD User B",
    )
    .await;

    // User A creates a job
    let body = json!({
        "start_date": "2026-01-01T00:00:00Z",
        "end_date": "2026-02-21T23:59:59Z"
    });
    let post_resp =
        post_authenticated(&server, "/api/v1/drift-detection", &auth_a.token, &body).await;
    assert_status(&post_resp, 202);
    let start_result: StartJobResponse = extract_json(post_resp);

    // User B tries to GET User A's job — should get 404
    let get_resp = get_authenticated(
        &server,
        &format!("/api/v1/drift-detection/{}", start_result.job_id),
        &auth_b.token,
    )
    .await;
    assert_status(&get_resp, 404);
}

// ============================================================================
// POST /api/v1/drift-detection/:job_id/retry — Retry Tests
// ============================================================================

/// Test that retrying a FAILED job returns 202 with a new job_id and previous_job_id set.
#[tokio::test]
async fn test_retry_failed_job() {
    let server = create_test_server().await;
    let pool = get_test_db_pool();
    let ts = Utc::now().timestamp_nanos_opt().unwrap();
    let auth = register_test_user(
        &server,
        &format!("dd_retry_{}", ts),
        &format!("dd_retry_{}@example.com", ts),
        "SecurePass123!",
        "DD Retry",
    )
    .await;

    // Create a job via POST
    let body = json!({
        "start_date": "2026-01-01T00:00:00Z",
        "end_date": "2026-02-21T23:59:59Z"
    });
    let post_resp =
        post_authenticated(&server, "/api/v1/drift-detection", &auth.token, &body).await;
    assert_status(&post_resp, 202);
    let start_result: StartJobResponse = extract_json(post_resp);

    // Manually update the job to FAILED in DB
    update_job_status_in_db(
        &pool,
        start_result.job_id,
        JobStatus::Failed,
        Some("Provider API failed"),
    );

    // Retry the failed job
    let retry_resp = post_authenticated(
        &server,
        &format!("/api/v1/drift-detection/{}/retry", start_result.job_id),
        &auth.token,
        &json!({}),
    )
    .await;
    assert_status(&retry_resp, 202);

    let retry_result: StartJobResponse = extract_json(retry_resp);
    assert_eq!(retry_result.status, JobStatus::Pending);
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
}

/// Test that retrying a PENDING (non-FAILED) job returns 400.
#[tokio::test]
async fn test_retry_non_failed_job() {
    let server = create_test_server().await;
    let ts = Utc::now().timestamp_nanos_opt().unwrap();
    let auth = register_test_user(
        &server,
        &format!("dd_retrynf_{}", ts),
        &format!("dd_retrynf_{}@example.com", ts),
        "SecurePass123!",
        "DD RetryNF",
    )
    .await;

    // Create a PENDING job via POST
    let body = json!({
        "start_date": "2026-01-01T00:00:00Z",
        "end_date": "2026-02-21T23:59:59Z"
    });
    let post_resp =
        post_authenticated(&server, "/api/v1/drift-detection", &auth.token, &body).await;
    assert_status(&post_resp, 202);
    let start_result: StartJobResponse = extract_json(post_resp);

    // Try to retry a PENDING job — should fail with 400
    let retry_resp = post_authenticated(
        &server,
        &format!("/api/v1/drift-detection/{}/retry", start_result.job_id),
        &auth.token,
        &json!({}),
    )
    .await;
    assert_status(&retry_resp, 400);
}

/// Test that retrying a non-existent job returns 404.
#[tokio::test]
async fn test_retry_not_found() {
    let server = create_test_server().await;
    let ts = Utc::now().timestamp_nanos_opt().unwrap();
    let auth = register_test_user(
        &server,
        &format!("dd_retrynotfound_{}", ts),
        &format!("dd_retrynotfound_{}@example.com", ts),
        "SecurePass123!",
        "DD RetryNF",
    )
    .await;

    let random_id = Uuid::new_v4();
    let retry_resp = post_authenticated(
        &server,
        &format!("/api/v1/drift-detection/{}/retry", random_id),
        &auth.token,
        &json!({}),
    )
    .await;
    assert_status(&retry_resp, 404);
}
