//! Integration tests for the BackgroundJobRepository.
//!
//! Tests cover CRUD operations, status transitions, stale job detection,
//! pending job retrieval, and cleanup of old jobs.

use super::common;

use chrono::{Duration, Utc};
use diesel::prelude::*;
use master_of_coin_backend::{
    db::{create_pool, run_migrations},
    models::background_job::NewBackgroundJob,
    repositories::background_job::BackgroundJobRepository,
    schema::background_jobs,
    types::{JobStatus, JobType},
};
use serde_json::json;
use serial_test::serial;

// ============================================================================
// Helpers
// ============================================================================

fn setup_pool() -> master_of_coin_backend::DbPool {
    let database_url = common::get_test_database_url();
    let pool = create_pool(&database_url, 5).expect("Failed to create pool");
    let mut conn = pool.get().expect("Failed to get connection");
    run_migrations(&mut conn).expect("Failed to run migrations");
    pool
}

fn create_test_job(
    pool: &master_of_coin_backend::DbPool,
    user_id: uuid::Uuid,
    status: JobStatus,
    input: Option<serde_json::Value>,
) -> master_of_coin_backend::models::background_job::BackgroundJob {
    let new_job = NewBackgroundJob {
        user_id,
        job_type: JobType::DriftDetection,
        status,
        previous_job_id: None,
        input,
    };
    BackgroundJobRepository::create_job(pool, new_job).expect("Failed to create test job")
}

// ============================================================================
// CRUD Tests
// ============================================================================

/// Test creating a job and finding it by ID — verify all fields.
#[test]
#[serial]
fn test_create_and_find_job() {
    let pool = setup_pool();
    let mut conn = pool.get().expect("Failed to get connection");
    let user = common::create_test_user(&mut conn, "bg_create").expect("Failed to create user");

    let input = json!({
        "start_date": "2026-01-01T00:00:00Z",
        "end_date": "2026-02-21T23:59:59Z"
    });

    let new_job = NewBackgroundJob {
        user_id: user.id,
        job_type: JobType::DriftDetection,
        status: JobStatus::Pending,
        previous_job_id: None,
        input: Some(input.clone()),
    };

    let created = BackgroundJobRepository::create_job(&pool, new_job).expect("create_job failed");
    assert_eq!(created.user_id, user.id);
    assert_eq!(created.job_type, JobType::DriftDetection);
    assert_eq!(created.status, JobStatus::Pending);
    assert!(created.previous_job_id.is_none());
    assert!(created.input.is_some());
    assert!(created.result.is_none());
    assert!(created.error.is_none());
    assert!(created.started_at.is_none());
    assert!(created.completed_at.is_none());

    // Find by ID
    let found = BackgroundJobRepository::find_by_id(&pool, created.id)
        .expect("find_by_id failed")
        .expect("Job should exist");
    assert_eq!(found.id, created.id);
    assert_eq!(found.user_id, user.id);
    assert_eq!(found.job_type, JobType::DriftDetection);
    assert_eq!(found.status, JobStatus::Pending);
    assert_eq!(found.input, Some(input));
}

/// Test update_running sets status=RUNNING and started_at.
#[test]
#[serial]
fn test_update_running() {
    let pool = setup_pool();
    let mut conn = pool.get().expect("Failed to get connection");
    let user = common::create_test_user(&mut conn, "bg_running").expect("Failed to create user");

    let job = create_test_job(&pool, user.id, JobStatus::Pending, None);
    assert!(job.started_at.is_none());

    let updated =
        BackgroundJobRepository::update_running(&pool, job.id).expect("update_running failed");
    assert_eq!(updated.status, JobStatus::Running);
    assert!(
        updated.started_at.is_some(),
        "started_at should be set after update_running"
    );
}

/// Test update_completed sets status=COMPLETED, result, and completed_at.
#[test]
#[serial]
fn test_update_completed() {
    let pool = setup_pool();
    let mut conn = pool.get().expect("Failed to get connection");
    let user = common::create_test_user(&mut conn, "bg_completed").expect("Failed to create user");

    let job = create_test_job(&pool, user.id, JobStatus::Pending, None);

    let result_json = json!({
        "summary": {
            "total_local": 5,
            "total_external": 3,
            "synced": 2,
            "drifted": 1,
            "missing_on_external": 2,
            "missing_on_local": 0
        },
        "drifted": [],
        "missing_on_external": [],
        "missing_on_local": []
    });

    let updated = BackgroundJobRepository::update_completed(&pool, job.id, result_json.clone())
        .expect("update_completed failed");
    assert_eq!(updated.status, JobStatus::Completed);
    assert_eq!(updated.result, Some(result_json));
    assert!(
        updated.completed_at.is_some(),
        "completed_at should be set after update_completed"
    );
}

/// Test update_failed sets status=FAILED, error, and completed_at.
#[test]
#[serial]
fn test_update_failed() {
    let pool = setup_pool();
    let mut conn = pool.get().expect("Failed to get connection");
    let user = common::create_test_user(&mut conn, "bg_failed").expect("Failed to create user");

    let job = create_test_job(&pool, user.id, JobStatus::Pending, None);

    let error_msg = "Provider API failed: rate limit exceeded";
    let updated = BackgroundJobRepository::update_failed(&pool, job.id, error_msg)
        .expect("update_failed failed");
    assert_eq!(updated.status, JobStatus::Failed);
    assert_eq!(updated.error.as_deref(), Some(error_msg));
    assert!(
        updated.completed_at.is_some(),
        "completed_at should be set after update_failed"
    );
}

// ============================================================================
// Stale Jobs & Pending Jobs Tests
// ============================================================================

/// Test find_stale_jobs returns only RUNNING jobs (for startup recovery).
#[test]
#[serial]
fn test_find_stale_jobs() {
    let pool = setup_pool();
    let mut conn = pool.get().expect("Failed to get connection");
    let user = common::create_test_user(&mut conn, "bg_stale").expect("Failed to create user");

    // Create a PENDING job — should NOT be returned
    let _pending_job = create_test_job(&pool, user.id, JobStatus::Pending, None);

    // Create a RUNNING job — SHOULD be returned
    let running_job = create_test_job(&pool, user.id, JobStatus::Pending, None);
    BackgroundJobRepository::update_running(&pool, running_job.id).expect("update_running failed");

    let stale = BackgroundJobRepository::find_stale_jobs(&pool).expect("find_stale_jobs failed");

    // Should contain the running job
    assert!(
        stale.iter().any(|j| j.id == running_job.id),
        "Stale jobs should include the RUNNING job"
    );

    // Should NOT contain the pending job
    assert!(
        !stale.iter().any(|j| j.id == _pending_job.id),
        "Stale jobs should NOT include PENDING jobs"
    );
}

/// Test find_next_pending returns a PENDING job (oldest first ordering).
///
/// Since the database may contain PENDING jobs from other tests, we verify
/// that the returned job is PENDING and that when we process it, the next
/// call returns a different one — proving FIFO ordering works.
#[test]
#[serial]
fn test_find_next_pending() {
    let pool = setup_pool();
    let mut conn = pool.get().expect("Failed to get connection");

    // Clean up any leftover PENDING jobs from other tests to get a clean slate
    diesel::delete(background_jobs::table.filter(background_jobs::status.eq(JobStatus::Pending)))
        .execute(&mut conn)
        .expect("Failed to clean up pending jobs");

    let user = common::create_test_user(&mut conn, "bg_next").expect("Failed to create user");

    // Create two PENDING jobs — the first one created should be returned (oldest)
    let first_job = create_test_job(
        &pool,
        user.id,
        JobStatus::Pending,
        Some(json!({"start_date": "2026-01-01T00:00:00Z", "end_date": "2026-01-31T23:59:59Z"})),
    );
    // Small delay to ensure different created_at timestamps
    std::thread::sleep(std::time::Duration::from_millis(10));
    let second_job = create_test_job(
        &pool,
        user.id,
        JobStatus::Pending,
        Some(json!({"start_date": "2026-02-01T00:00:00Z", "end_date": "2026-02-28T23:59:59Z"})),
    );

    // First call should return the oldest PENDING job
    let next = BackgroundJobRepository::find_next_pending(&pool, &[])
        .expect("find_next_pending failed")
        .expect("Should find a pending job");

    assert_eq!(
        next.id, first_job.id,
        "find_next_pending should return the oldest PENDING job"
    );

    // Mark the first job as RUNNING so it's no longer PENDING
    BackgroundJobRepository::update_running(&pool, first_job.id).expect("update_running failed");

    // Second call should return the second job
    let next2 = BackgroundJobRepository::find_next_pending(&pool, &[])
        .expect("find_next_pending failed")
        .expect("Should find another pending job");

    assert_eq!(
        next2.id, second_job.id,
        "After processing first, find_next_pending should return the second job"
    );
}

/// Test find_next_pending with exclude_types skips jobs of excluded types.
#[test]
#[serial]
fn test_find_next_pending_excludes_types() {
    let pool = setup_pool();
    let mut conn = pool.get().expect("Failed to get connection");
    let user = common::create_test_user(&mut conn, "bg_exclude").expect("Failed to create user");

    // Create a PENDING DRIFT_DETECTION job
    let _dd_job = create_test_job(&pool, user.id, JobStatus::Pending, None);

    // Exclude DRIFT_DETECTION — should return None (only type available)
    let next = BackgroundJobRepository::find_next_pending(&pool, &[JobType::DriftDetection])
        .expect("find_next_pending failed");

    assert!(
        next.is_none(),
        "Should return None when all pending jobs are of excluded types"
    );
}

// ============================================================================
// Cleanup Tests
// ============================================================================

/// Test cleanup_old_jobs deletes old COMPLETED/FAILED jobs but not PENDING/RUNNING.
#[test]
#[serial]
fn test_cleanup_old_jobs() {
    let pool = setup_pool();
    let mut conn = pool.get().expect("Failed to get connection");
    let user = common::create_test_user(&mut conn, "bg_cleanup").expect("Failed to create user");

    // Create a COMPLETED job
    let completed_job = create_test_job(&pool, user.id, JobStatus::Pending, None);
    BackgroundJobRepository::update_completed(&pool, completed_job.id, json!({}))
        .expect("update_completed failed");

    // Create a FAILED job
    let failed_job = create_test_job(&pool, user.id, JobStatus::Pending, None);
    BackgroundJobRepository::update_failed(&pool, failed_job.id, "test error")
        .expect("update_failed failed");

    // Create a PENDING job (should NOT be deleted)
    let pending_job = create_test_job(&pool, user.id, JobStatus::Pending, None);

    // Manually backdate the completed and failed jobs' created_at to > 1 year ago
    let old_date = Utc::now() - Duration::days(400);
    diesel::update(background_jobs::table.find(completed_job.id))
        .set(background_jobs::created_at.eq(old_date))
        .execute(&mut conn)
        .expect("Failed to backdate completed job");
    diesel::update(background_jobs::table.find(failed_job.id))
        .set(background_jobs::created_at.eq(old_date))
        .execute(&mut conn)
        .expect("Failed to backdate failed job");

    // Run cleanup with threshold of 1 year ago
    let threshold = Utc::now() - Duration::days(365);
    let deleted =
        BackgroundJobRepository::cleanup_old_jobs(&pool, threshold).expect("cleanup failed");

    assert!(
        deleted >= 2,
        "Should have deleted at least 2 old terminal jobs, deleted: {}",
        deleted
    );

    // Verify the pending job still exists
    let still_exists = BackgroundJobRepository::find_by_id(&pool, pending_job.id)
        .expect("find_by_id failed")
        .is_some();
    assert!(still_exists, "PENDING job should NOT be deleted by cleanup");

    // Verify the completed and failed jobs are gone
    let completed_gone = BackgroundJobRepository::find_by_id(&pool, completed_job.id)
        .expect("find_by_id failed")
        .is_none();
    assert!(completed_gone, "Old COMPLETED job should be deleted");

    let failed_gone = BackgroundJobRepository::find_by_id(&pool, failed_job.id)
        .expect("find_by_id failed")
        .is_none();
    assert!(failed_gone, "Old FAILED job should be deleted");
}
