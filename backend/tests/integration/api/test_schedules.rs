//! Integration tests for the schedules API endpoints.
//!
//! Tests cover:
//! - POST /api/v1/schedules — Create schedule (201 with next_run_at and cron_description)
//! - GET /api/v1/schedules — List user's schedules
//! - GET /api/v1/schedules/:id — Get schedule detail with upcoming_runs
//! - PUT /api/v1/schedules/:id — Update name, cron, parameters, is_active
//! - DELETE /api/v1/schedules/:id — Delete returns 204, schedule no longer in list
//! - Schedule ownership — User A can't see User B's schedules
//! - Invalid cron — POST with invalid cron returns 400
//! - Sub-hourly frequency — POST with `*/5 * * * *` returns 400
//! - Active/inactive toggle — PUT with `is_active: false` works

use crate::common::*;
use chrono::Utc;
use serde_json::json;

// ============================================================================
// Helpers
// ============================================================================

/// Register a unique test user and return the auth response.
async fn setup_user(
    server: &axum_test::TestServer,
    label: &str,
) -> master_of_coin_backend::models::AuthResponse {
    let ts = Utc::now().timestamp_nanos_opt().unwrap();
    register_test_user(
        server,
        &format!("sched_{}_{}", label, ts),
        &format!("sched_{}_{}@example.com", label, ts),
        "SecurePass123!",
        &format!("Schedule Test {}", label),
    )
    .await
}

/// Create a schedule via POST and return the response JSON.
async fn create_schedule_via_api(
    server: &axum_test::TestServer,
    token: &str,
    body: &serde_json::Value,
) -> axum_test::TestResponse {
    post_authenticated(server, "/api/v1/schedules", token, body).await
}

// ============================================================================
// 1. Create schedule — POST /api/v1/schedules
// ============================================================================

/// POST /api/v1/schedules returns 201 with schedule data including next_run_at and cron_description.
#[tokio::test]
async fn test_create_schedule_success() {
    let server = create_test_server().await;
    let auth = setup_user(&server, "create").await;
    let _cleanup = UserCleanup { pool: get_test_db_pool(), user_id: auth.user.id };

    let body = json!({
        "name": "Daily drift check",
        "job_type": "DRIFT_DETECTION",
        "cron_expr": "0 0 * * *",
        "parameters": { "lookback_days": 7 }
    });

    let resp = create_schedule_via_api(&server, &auth.token, &body).await;
    assert_status(&resp, 201);

    let schedule: serde_json::Value = extract_json(resp);

    // Verify required fields
    assert!(schedule["id"].is_string(), "Should have an id");
    assert_eq!(schedule["name"], "Daily drift check");
    assert_eq!(schedule["job_type"], "DRIFT_DETECTION");
    assert_eq!(schedule["cron_expr"], "0 0 * * *");
    assert_eq!(schedule["cron_description"], "Daily at 00:00");
    assert_eq!(schedule["is_active"], true);
    assert!(
        schedule["next_run_at"].is_string(),
        "Should have next_run_at computed"
    );
    assert_eq!(schedule["parameters"]["lookback_days"], 7);
    assert!(schedule["created_at"].is_string(), "Should have created_at");
    assert!(schedule["updated_at"].is_string(), "Should have updated_at");
}

// ============================================================================
// 2. List schedules — GET /api/v1/schedules
// ============================================================================

/// GET /api/v1/schedules returns user's schedules.
#[tokio::test]
async fn test_list_schedules() {
    let server = create_test_server().await;
    let auth = setup_user(&server, "list").await;
    let _cleanup = UserCleanup { pool: get_test_db_pool(), user_id: auth.user.id };

    // Create two schedules
    let body1 = json!({
        "name": "Daily drift",
        "job_type": "DRIFT_DETECTION",
        "cron_expr": "0 0 * * *"
    });
    let resp1 = create_schedule_via_api(&server, &auth.token, &body1).await;
    assert_status(&resp1, 201);

    let body2 = json!({
        "name": "Hourly drift",
        "job_type": "DRIFT_DETECTION",
        "cron_expr": "0 * * * *"
    });
    let resp2 = create_schedule_via_api(&server, &auth.token, &body2).await;
    assert_status(&resp2, 201);

    // List schedules
    let resp = get_authenticated(&server, "/api/v1/schedules", &auth.token).await;
    assert_status(&resp, 200);

    let schedules: Vec<serde_json::Value> = extract_json(resp);
    assert_eq!(schedules.len(), 2, "Should have 2 schedules");

    // Verify both schedules are present (ordered by created_at DESC)
    let names: Vec<&str> = schedules
        .iter()
        .map(|s| s["name"].as_str().unwrap())
        .collect();
    assert!(
        names.contains(&"Daily drift"),
        "Should contain 'Daily drift'"
    );
    assert!(
        names.contains(&"Hourly drift"),
        "Should contain 'Hourly drift'"
    );
}

// ============================================================================
// 3. Get schedule detail — GET /api/v1/schedules/:id
// ============================================================================

/// GET /api/v1/schedules/:id returns schedule with upcoming_runs.
#[tokio::test]
async fn test_get_schedule_detail() {
    let server = create_test_server().await;
    let auth = setup_user(&server, "detail").await;
    let _cleanup = UserCleanup { pool: get_test_db_pool(), user_id: auth.user.id };

    // Create a schedule
    let body = json!({
        "name": "Hourly drift",
        "job_type": "DRIFT_DETECTION",
        "cron_expr": "0 * * * *",
        "parameters": { "lookback_days": 1 }
    });
    let resp = create_schedule_via_api(&server, &auth.token, &body).await;
    assert_status(&resp, 201);
    let created: serde_json::Value = extract_json(resp);
    let schedule_id = created["id"].as_str().unwrap();

    // Get schedule detail
    let detail_resp = get_authenticated(
        &server,
        &format!("/api/v1/schedules/{}", schedule_id),
        &auth.token,
    )
    .await;
    assert_status(&detail_resp, 200);

    let detail: serde_json::Value = extract_json(detail_resp);

    // Verify structure
    assert!(
        detail["schedule"].is_object(),
        "Should have schedule object"
    );
    assert_eq!(detail["schedule"]["id"], schedule_id);
    assert_eq!(detail["schedule"]["name"], "Hourly drift");
    assert_eq!(detail["schedule"]["cron_description"], "Every hour");

    // Verify upcoming_runs
    assert!(
        detail["upcoming_runs"].is_array(),
        "Should have upcoming_runs array"
    );
    let upcoming = detail["upcoming_runs"].as_array().unwrap();
    assert!(
        !upcoming.is_empty(),
        "Should have at least one upcoming run"
    );

    // Verify recent_jobs (should be empty for a new schedule)
    assert!(
        detail["recent_jobs"].is_array(),
        "Should have recent_jobs array"
    );
    let recent_jobs = detail["recent_jobs"].as_array().unwrap();
    assert!(
        recent_jobs.is_empty(),
        "New schedule should have no recent jobs"
    );
}

// ============================================================================
// 4. Update schedule — PUT /api/v1/schedules/:id
// ============================================================================

/// PUT /api/v1/schedules/:id updates name, cron, parameters, is_active.
#[tokio::test]
async fn test_update_schedule() {
    let server = create_test_server().await;
    let auth = setup_user(&server, "update").await;
    let _cleanup = UserCleanup { pool: get_test_db_pool(), user_id: auth.user.id };

    // Create a schedule
    let body = json!({
        "name": "Original name",
        "job_type": "DRIFT_DETECTION",
        "cron_expr": "0 0 * * *",
        "parameters": { "lookback_days": 7 }
    });
    let resp = create_schedule_via_api(&server, &auth.token, &body).await;
    assert_status(&resp, 201);
    let created: serde_json::Value = extract_json(resp);
    let schedule_id = created["id"].as_str().unwrap();

    // Update the schedule — use "0 0 1 * *" (monthly on the 1st) which is
    // both valid in the cron crate and has a known describe_cron preset.
    let update_body = json!({
        "name": "Updated name",
        "cron_expr": "0 0 1 * *",
        "parameters": { "lookback_days": 14 },
        "is_active": false
    });
    let update_resp = put_authenticated(
        &server,
        &format!("/api/v1/schedules/{}", schedule_id),
        &auth.token,
        &update_body,
    )
    .await;
    assert_status(&update_resp, 200);

    let updated: serde_json::Value = extract_json(update_resp);
    assert_eq!(updated["name"], "Updated name");
    assert_eq!(updated["cron_expr"], "0 0 1 * *");
    assert_eq!(updated["cron_description"], "Monthly on the 1st at 00:00");
    assert_eq!(updated["parameters"]["lookback_days"], 14);
    assert_eq!(updated["is_active"], false);
}

// ============================================================================
// 5. Delete schedule — DELETE /api/v1/schedules/:id
// ============================================================================

/// DELETE /api/v1/schedules/:id returns 204, schedule no longer in list.
#[tokio::test]
async fn test_delete_schedule() {
    let server = create_test_server().await;
    let auth = setup_user(&server, "delete").await;
    let _cleanup = UserCleanup { pool: get_test_db_pool(), user_id: auth.user.id };

    // Create a schedule
    let body = json!({
        "name": "To be deleted",
        "job_type": "DRIFT_DETECTION",
        "cron_expr": "0 0 * * *"
    });
    let resp = create_schedule_via_api(&server, &auth.token, &body).await;
    assert_status(&resp, 201);
    let created: serde_json::Value = extract_json(resp);
    let schedule_id = created["id"].as_str().unwrap();

    // Delete the schedule
    let delete_resp = delete_authenticated(
        &server,
        &format!("/api/v1/schedules/{}", schedule_id),
        &auth.token,
    )
    .await;
    assert_status(&delete_resp, 204);

    // Verify it's gone from the list
    let list_resp = get_authenticated(&server, "/api/v1/schedules", &auth.token).await;
    assert_status(&list_resp, 200);
    let schedules: Vec<serde_json::Value> = extract_json(list_resp);
    assert!(
        schedules.is_empty(),
        "Schedule list should be empty after deletion"
    );

    // Verify GET by ID returns 404
    let get_resp = get_authenticated(
        &server,
        &format!("/api/v1/schedules/{}", schedule_id),
        &auth.token,
    )
    .await;
    assert_status(&get_resp, 404);
}

// ============================================================================
// 6. Schedule ownership — User A can't see User B's schedules
// ============================================================================

/// User A can't see User B's schedules.
#[tokio::test]
async fn test_schedule_ownership_isolation() {
    let server = create_test_server().await;
    let auth_a = setup_user(&server, "owner_a").await;
    let auth_b = setup_user(&server, "owner_b").await;
    let _cleanup_a = UserCleanup { pool: get_test_db_pool(), user_id: auth_a.user.id };
    let _cleanup_b = UserCleanup { pool: get_test_db_pool(), user_id: auth_b.user.id };

    // User A creates a schedule
    let body = json!({
        "name": "User A's schedule",
        "job_type": "DRIFT_DETECTION",
        "cron_expr": "0 0 * * *"
    });
    let resp = create_schedule_via_api(&server, &auth_a.token, &body).await;
    assert_status(&resp, 201);
    let created: serde_json::Value = extract_json(resp);
    let schedule_id = created["id"].as_str().unwrap();

    // User A can see their schedule
    let list_a = get_authenticated(&server, "/api/v1/schedules", &auth_a.token).await;
    assert_status(&list_a, 200);
    let schedules_a: Vec<serde_json::Value> = extract_json(list_a);
    assert_eq!(schedules_a.len(), 1, "User A should see 1 schedule");

    // User B can't see User A's schedules
    let list_b = get_authenticated(&server, "/api/v1/schedules", &auth_b.token).await;
    assert_status(&list_b, 200);
    let schedules_b: Vec<serde_json::Value> = extract_json(list_b);
    assert!(
        schedules_b.is_empty(),
        "User B should see 0 schedules (can't see User A's)"
    );

    // User B can't access User A's schedule by ID (returns 404)
    let get_b = get_authenticated(
        &server,
        &format!("/api/v1/schedules/{}", schedule_id),
        &auth_b.token,
    )
    .await;
    assert_status(&get_b, 404);
}

// ============================================================================
// 7. Invalid cron — POST with invalid cron returns 400
// ============================================================================

/// POST with invalid cron expression returns 400.
#[tokio::test]
async fn test_create_schedule_invalid_cron() {
    let server = create_test_server().await;
    let auth = setup_user(&server, "badcron").await;
    let _cleanup = UserCleanup { pool: get_test_db_pool(), user_id: auth.user.id };

    let body = json!({
        "name": "Bad cron schedule",
        "job_type": "DRIFT_DETECTION",
        "cron_expr": "not a valid cron"
    });

    let resp = create_schedule_via_api(&server, &auth.token, &body).await;
    assert_status(&resp, 400);
}

// ============================================================================
// 8. Sub-hourly frequency — POST with `*/5 * * * *` returns 400
// ============================================================================

/// POST with sub-hourly cron expression returns 400.
#[tokio::test]
async fn test_create_schedule_sub_hourly_rejected() {
    let server = create_test_server().await;
    let auth = setup_user(&server, "subhourly").await;
    let _cleanup = UserCleanup { pool: get_test_db_pool(), user_id: auth.user.id };

    let body = json!({
        "name": "Too frequent schedule",
        "job_type": "DRIFT_DETECTION",
        "cron_expr": "*/5 * * * *"
    });

    let resp = create_schedule_via_api(&server, &auth.token, &body).await;
    assert_status(&resp, 400);
}

// ============================================================================
// 9. Active/inactive toggle — PUT with is_active: false works
// ============================================================================

/// PUT with `is_active: false` deactivates the schedule.
#[tokio::test]
async fn test_schedule_active_inactive_toggle() {
    let server = create_test_server().await;
    let auth = setup_user(&server, "toggle").await;
    let _cleanup = UserCleanup { pool: get_test_db_pool(), user_id: auth.user.id };

    // Create an active schedule
    let body = json!({
        "name": "Toggle test",
        "job_type": "DRIFT_DETECTION",
        "cron_expr": "0 0 * * *"
    });
    let resp = create_schedule_via_api(&server, &auth.token, &body).await;
    assert_status(&resp, 201);
    let created: serde_json::Value = extract_json(resp);
    let schedule_id = created["id"].as_str().unwrap();
    assert_eq!(created["is_active"], true, "Should start as active");

    // Deactivate
    let deactivate_body = json!({ "is_active": false });
    let deactivate_resp = put_authenticated(
        &server,
        &format!("/api/v1/schedules/{}", schedule_id),
        &auth.token,
        &deactivate_body,
    )
    .await;
    assert_status(&deactivate_resp, 200);
    let deactivated: serde_json::Value = extract_json(deactivate_resp);
    assert_eq!(deactivated["is_active"], false, "Should be inactive");

    // Reactivate
    let reactivate_body = json!({ "is_active": true });
    let reactivate_resp = put_authenticated(
        &server,
        &format!("/api/v1/schedules/{}", schedule_id),
        &auth.token,
        &reactivate_body,
    )
    .await;
    assert_status(&reactivate_resp, 200);
    let reactivated: serde_json::Value = extract_json(reactivate_resp);
    assert_eq!(reactivated["is_active"], true, "Should be active again");
}
