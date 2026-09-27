//! UI v2 job endpoints: POST /schedules/:id/run, GET /jobs/:id, and the
//! `schedule_id` / BANK_SYNC additions to GET /jobs.

use super::v2_helpers::*;
use crate::common::*;
use master_of_coin_backend::{
    models::NewBackgroundJob,
    repositories::background_job::BackgroundJobRepository,
    types::{JobStatus, JobType},
};
use serde_json::{Value, json};

async fn create_schedule(server: &axum_test::TestServer, token: &str, active: bool) -> Value {
    let response = post_authenticated(
        server,
        "/api/v1/schedules",
        token,
        &json!({
            "name": "Nightly drift",
            "job_type": "DRIFT_DETECTION",
            "cron_expr": "0 3 * * *",
            "parameters": {"lookback_days": 3},
        }),
    )
    .await;
    assert_status(&response, 201);
    let schedule: Value = extract_json(response);
    if !active {
        let response = put_authenticated(
            server,
            &format!("/api/v1/schedules/{}", str_of(&schedule, "id")),
            token,
            &json!({"is_active": false}),
        )
        .await;
        assert_status(&response, 200);
    }
    schedule
}

async fn run(server: &axum_test::TestServer, token: &str, id: &str) -> axum_test::TestResponse {
    post_authenticated(
        server,
        &format!("/api/v1/schedules/{}/run", id),
        token,
        &json!({}),
    )
    .await
}

#[tokio::test]
async fn test_run_schedule_queues_linked_job_without_moving_next_run() {
    let server = create_test_server().await;
    let user = new_user(&server, "runsched").await;
    let schedule = create_schedule(&server, user.token(), true).await;
    let id = str_of(&schedule, "id");

    let response = run(&server, user.token(), id).await;
    assert_status(&response, 202);
    let body: Value = extract_json(response);
    let job_id = str_of(&body, "job_id").to_string();

    let response =
        get_authenticated(&server, &format!("/api/v1/jobs/{}", job_id), user.token()).await;
    assert_status(&response, 200);
    let job: Value = extract_json(response);
    assert_eq!(job["id"], json!(job_id));
    assert_eq!(job["job_type"], json!("DRIFT_DETECTION"));
    assert_eq!(job["status"], json!("PENDING"));
    assert_eq!(job["schedule_id"], json!(id));
    assert_eq!(job["input"]["schedule_id"], json!(id));
    assert!(job["input"]["start_date"].is_string());
    assert!(job["previous_job_id"].is_null());
    assert!(job["result"].is_null());

    let response =
        get_authenticated(&server, &format!("/api/v1/schedules/{}", id), user.token()).await;
    let after: Value = extract_json(response);
    assert!(schedule["next_run_at"].is_string());
    assert_eq!(after["schedule"]["next_run_at"], schedule["next_run_at"]);

    // The job list carries schedule_id too.
    let response = get_authenticated(&server, "/api/v1/jobs", user.token()).await;
    let jobs: Vec<Value> = extract_json(response);
    let listed = jobs.iter().find(|j| j["id"] == json!(job_id)).unwrap();
    assert_eq!(listed["schedule_id"], json!(id));
}

#[tokio::test]
async fn test_run_paused_schedule_is_allowed() {
    let server = create_test_server().await;
    let user = new_user(&server, "runpaused").await;
    let schedule = create_schedule(&server, user.token(), false).await;
    assert_status(
        &run(&server, user.token(), str_of(&schedule, "id")).await,
        202,
    );
}

#[tokio::test]
async fn test_run_schedule_ownership_and_scope() {
    let server = create_test_server().await;
    let owner = new_user(&server, "runown").await;
    let other = new_user(&server, "runoth").await;
    let schedule = create_schedule(&server, owner.token(), true).await;
    let id = str_of(&schedule, "id");

    assert_status(&run(&server, other.token(), id).await, 404);
    assert_status(
        &run(&server, owner.token(), &uuid::Uuid::new_v4().to_string()).await,
        404,
    );

    let reader = api_key(&server, owner.token(), scopes(&[("transactions", "r")])).await;
    assert_status(&run(&server, &reader, id).await, 403);
    let writer = api_key(&server, owner.token(), scopes(&[("transactions", "rw")])).await;
    assert_status(&run(&server, &writer, id).await, 202);
}

#[tokio::test]
async fn test_get_job_detail_ownership_and_result() {
    let server = create_test_server().await;
    let owner = new_user(&server, "jobown").await;
    let other = new_user(&server, "joboth").await;
    let pool = get_test_db_pool();

    let job = BackgroundJobRepository::create_job(
        &pool,
        NewBackgroundJob {
            user_id: owner.id(),
            job_type: JobType::BankSync,
            status: JobStatus::Pending,
            previous_job_id: None,
            input: Some(json!({"connection_id": "abc"})),
        },
    )
    .unwrap();
    BackgroundJobRepository::update_completed(
        &pool,
        job.id,
        json!({"summary": {"imported": 4}, "details": [1, 2]}),
    )
    .unwrap();

    let path = format!("/api/v1/jobs/{}", job.id);
    let response = get_authenticated(&server, &path, owner.token()).await;
    assert_status(&response, 200);
    let detail: Value = extract_json(response);
    assert_eq!(detail["job_type"], json!("BANK_SYNC"));
    assert_eq!(detail["status"], json!("COMPLETED"));
    assert_eq!(detail["summary"], json!({"imported": 4}));
    assert_eq!(detail["result"]["details"], json!([1, 2]));
    assert_eq!(detail["input"], json!({"connection_id": "abc"}));
    assert!(detail["schedule_id"].is_null());

    assert_status(&get_authenticated(&server, &path, other.token()).await, 404);
    assert_status(
        &get_authenticated(
            &server,
            &format!("/api/v1/jobs/{}", uuid::Uuid::new_v4()),
            owner.token(),
        )
        .await,
        404,
    );

    // BANK_SYNC is a valid list filter; unknown types are rejected.
    let response =
        get_authenticated(&server, "/api/v1/jobs?job_type=BANK_SYNC", owner.token()).await;
    assert_status(&response, 200);
    let jobs: Vec<Value> = extract_json(response);
    assert_eq!(jobs.len(), 1);
    assert_eq!(jobs[0]["id"], json!(job.id));
    assert_status(
        &get_authenticated(&server, "/api/v1/jobs?job_type=NOPE", owner.token()).await,
        400,
    );
}
