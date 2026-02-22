//! Integration tests for the jobs listing API endpoint.
//!
//! Tests cover:
//! - GET /api/v1/jobs — List all jobs for the current user
//!   - Empty list for new user
//!   - Returns drift detection and bulk sync jobs
//!   - Filter by job_type works
//!   - Pagination (limit/offset) works
//!   - Job ownership (User A can't see User B's jobs)

use crate::common::*;
use chrono::Utc;
use diesel::prelude::*;
use master_of_coin_backend::{
    models::job_summary::BackgroundJobSummary,
    schema::background_jobs,
    types::{JobStatus, JobType},
};
use serde_json::json;

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

/// Helper to update a job's status and optionally set a result JSONB directly in the DB.
fn update_job_in_db(
    pool: &master_of_coin_backend::DbPool,
    job_id: uuid::Uuid,
    status: JobStatus,
    result_json: Option<serde_json::Value>,
) {
    let mut conn = pool.get().expect("Failed to get DB connection");
    if let Some(result) = result_json {
        diesel::update(background_jobs::table.find(job_id))
            .set((
                background_jobs::status.eq(status),
                background_jobs::result.eq(result),
                background_jobs::completed_at.eq(diesel::dsl::now),
            ))
            .execute(&mut conn)
            .expect("Failed to update job");
    } else {
        diesel::update(background_jobs::table.find(job_id))
            .set(background_jobs::status.eq(status))
            .execute(&mut conn)
            .expect("Failed to update job status");
    }
}

// ============================================================================
// GET /api/v1/jobs — List Jobs Tests
// ============================================================================

/// Test that GET /jobs returns an empty array for a new user with no jobs.
#[tokio::test]
async fn test_list_jobs_empty_for_new_user() {
    let server = create_test_server().await;
    let ts = Utc::now().timestamp_nanos_opt().unwrap();
    let auth = register_test_user(
        &server,
        &format!("jobs_empty_{}", ts),
        &format!("jobs_empty_{}@example.com", ts),
        "SecurePass123!",
        "Jobs Empty",
    )
    .await;

    let resp = get_authenticated(&server, "/api/v1/jobs", &auth.token).await;
    assert_status(&resp, 200);

    let jobs: Vec<BackgroundJobSummary> = extract_json(resp);
    assert!(jobs.is_empty(), "New user should have no jobs");
}

/// Test that GET /jobs returns both drift detection and bulk sync jobs.
#[tokio::test]
async fn test_list_jobs_returns_drift_and_sync_jobs() {
    let server = create_test_server().await;
    let pool = get_test_db_pool();
    let ts = Utc::now().timestamp_nanos_opt().unwrap();
    let auth = register_test_user(
        &server,
        &format!("jobs_both_{}", ts),
        &format!("jobs_both_{}@example.com", ts),
        "SecurePass123!",
        "Jobs Both",
    )
    .await;

    // Create a drift detection job
    let dd_body = json!({
        "start_date": "2026-01-01T00:00:00Z",
        "end_date": "2026-02-21T23:59:59Z"
    });
    let dd_resp =
        post_authenticated(&server, "/api/v1/drift-detection", &auth.token, &dd_body).await;
    assert_status(&dd_resp, 202);
    let dd_result: serde_json::Value = extract_json(dd_resp);
    let dd_job_id = dd_result["job_id"].as_str().unwrap();

    // Mark the drift detection job as completed with a result containing summary
    let dd_uuid: uuid::Uuid = dd_job_id.parse().unwrap();
    let drift_result = json!({
        "summary": {
            "total_local": 15,
            "total_external": 12,
            "synced": 10,
            "drifted": 2,
            "missing_on_external": 3,
            "missing_on_local": 5
        },
        "drifted": [],
        "missing_on_external": [],
        "missing_on_local": []
    });
    update_job_in_db(&pool, dd_uuid, JobStatus::Completed, Some(drift_result));

    // Create a bulk sync job
    let sync_body = json!({
        "items": [
            {
                "action": "push",
                "transaction_id": "00000000-0000-0000-0000-000000000001"
            }
        ]
    });
    let sync_resp = post_authenticated(&server, "/api/v1/sync", &auth.token, &sync_body).await;
    assert_status(&sync_resp, 202);

    // List all jobs
    let resp = get_authenticated(&server, "/api/v1/jobs", &auth.token).await;
    assert_status(&resp, 200);

    let jobs: Vec<BackgroundJobSummary> = extract_json(resp);
    assert_eq!(jobs.len(), 2, "Should have 2 jobs (drift + sync)");

    // Jobs should be ordered by created_at DESC, so sync job (created second) is first
    assert_eq!(jobs[0].job_type, JobType::BulkSync);
    assert_eq!(jobs[1].job_type, JobType::DriftDetection);

    // The completed drift detection job should have a summary
    assert_eq!(jobs[1].status, JobStatus::Completed);
    assert!(
        jobs[1].summary.is_some(),
        "Completed drift job should have a summary"
    );
    let summary = jobs[1].summary.as_ref().unwrap();
    assert_eq!(summary["total_local"], 15);
    assert_eq!(summary["drifted"], 2);

    // The pending sync job should have no summary
    assert_eq!(jobs[0].status, JobStatus::Pending);
    assert!(
        jobs[0].summary.is_none(),
        "Pending sync job should have no summary"
    );
}

/// Test that filtering by job_type works correctly.
#[tokio::test]
async fn test_list_jobs_filter_by_type() {
    let server = create_test_server().await;
    let ts = Utc::now().timestamp_nanos_opt().unwrap();
    let auth = register_test_user(
        &server,
        &format!("jobs_filter_{}", ts),
        &format!("jobs_filter_{}@example.com", ts),
        "SecurePass123!",
        "Jobs Filter",
    )
    .await;

    // Create a drift detection job
    let dd_body = json!({
        "start_date": "2026-01-01T00:00:00Z",
        "end_date": "2026-02-21T23:59:59Z"
    });
    let dd_resp =
        post_authenticated(&server, "/api/v1/drift-detection", &auth.token, &dd_body).await;
    assert_status(&dd_resp, 202);

    // Create a bulk sync job
    let sync_body = json!({
        "items": [
            {
                "action": "push",
                "transaction_id": "00000000-0000-0000-0000-000000000001"
            }
        ]
    });
    let sync_resp = post_authenticated(&server, "/api/v1/sync", &auth.token, &sync_body).await;
    assert_status(&sync_resp, 202);

    // Filter by DRIFT_DETECTION
    let resp = get_authenticated(
        &server,
        "/api/v1/jobs?job_type=DRIFT_DETECTION",
        &auth.token,
    )
    .await;
    assert_status(&resp, 200);
    let jobs: Vec<BackgroundJobSummary> = extract_json(resp);
    assert_eq!(jobs.len(), 1, "Should have 1 drift detection job");
    assert_eq!(jobs[0].job_type, JobType::DriftDetection);

    // Filter by BULK_SYNC
    let resp = get_authenticated(&server, "/api/v1/jobs?job_type=BULK_SYNC", &auth.token).await;
    assert_status(&resp, 200);
    let jobs: Vec<BackgroundJobSummary> = extract_json(resp);
    assert_eq!(jobs.len(), 1, "Should have 1 bulk sync job");
    assert_eq!(jobs[0].job_type, JobType::BulkSync);

    // Invalid job_type should return 400
    let resp = get_authenticated(&server, "/api/v1/jobs?job_type=INVALID", &auth.token).await;
    assert_status(&resp, 400);
}

/// Test that pagination (limit/offset) works correctly.
#[tokio::test]
async fn test_list_jobs_pagination() {
    let server = create_test_server().await;
    let ts = Utc::now().timestamp_nanos_opt().unwrap();
    let auth = register_test_user(
        &server,
        &format!("jobs_page_{}", ts),
        &format!("jobs_page_{}@example.com", ts),
        "SecurePass123!",
        "Jobs Page",
    )
    .await;

    // Create 3 drift detection jobs
    for _ in 0..3 {
        let body = json!({
            "start_date": "2026-01-01T00:00:00Z",
            "end_date": "2026-02-21T23:59:59Z"
        });
        let resp = post_authenticated(&server, "/api/v1/drift-detection", &auth.token, &body).await;
        assert_status(&resp, 202);
    }

    // Get all jobs (should be 3)
    let resp = get_authenticated(&server, "/api/v1/jobs", &auth.token).await;
    assert_status(&resp, 200);
    let all_jobs: Vec<BackgroundJobSummary> = extract_json(resp);
    assert_eq!(all_jobs.len(), 3, "Should have 3 jobs total");

    // Get first 2 jobs (limit=2)
    let resp = get_authenticated(&server, "/api/v1/jobs?limit=2", &auth.token).await;
    assert_status(&resp, 200);
    let page1: Vec<BackgroundJobSummary> = extract_json(resp);
    assert_eq!(page1.len(), 2, "Page 1 should have 2 jobs");

    // Get remaining jobs (limit=2, offset=2)
    let resp = get_authenticated(&server, "/api/v1/jobs?limit=2&offset=2", &auth.token).await;
    assert_status(&resp, 200);
    let page2: Vec<BackgroundJobSummary> = extract_json(resp);
    assert_eq!(page2.len(), 1, "Page 2 should have 1 job");

    // Verify no overlap between pages
    assert_ne!(page1[0].id, page2[0].id, "Pages should not overlap");
    assert_ne!(page1[1].id, page2[0].id, "Pages should not overlap");
}

/// Test that User A cannot see User B's jobs (job ownership isolation).
#[tokio::test]
async fn test_list_jobs_ownership_isolation() {
    let server = create_test_server().await;
    let ts = Utc::now().timestamp_nanos_opt().unwrap();

    let auth_a = register_test_user(
        &server,
        &format!("jobs_usera_{}", ts),
        &format!("jobs_usera_{}@example.com", ts),
        "SecurePass123!",
        "Jobs User A",
    )
    .await;

    let auth_b = register_test_user(
        &server,
        &format!("jobs_userb_{}", ts),
        &format!("jobs_userb_{}@example.com", ts),
        "SecurePass123!",
        "Jobs User B",
    )
    .await;

    // User A creates a drift detection job
    let body = json!({
        "start_date": "2026-01-01T00:00:00Z",
        "end_date": "2026-02-21T23:59:59Z"
    });
    let resp = post_authenticated(&server, "/api/v1/drift-detection", &auth_a.token, &body).await;
    assert_status(&resp, 202);

    // User A creates a bulk sync job
    let sync_body = json!({
        "items": [
            {
                "action": "push",
                "transaction_id": "00000000-0000-0000-0000-000000000001"
            }
        ]
    });
    let resp = post_authenticated(&server, "/api/v1/sync", &auth_a.token, &sync_body).await;
    assert_status(&resp, 202);

    // User A should see 2 jobs
    let resp = get_authenticated(&server, "/api/v1/jobs", &auth_a.token).await;
    assert_status(&resp, 200);
    let jobs_a: Vec<BackgroundJobSummary> = extract_json(resp);
    assert_eq!(jobs_a.len(), 2, "User A should see 2 jobs");

    // User B should see 0 jobs
    let resp = get_authenticated(&server, "/api/v1/jobs", &auth_b.token).await;
    assert_status(&resp, 200);
    let jobs_b: Vec<BackgroundJobSummary> = extract_json(resp);
    assert!(
        jobs_b.is_empty(),
        "User B should see 0 jobs (can't see User A's jobs)"
    );
}
