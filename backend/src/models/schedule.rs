use chrono::{DateTime, Utc};
use diesel::{AsChangeset, Identifiable, Insertable, Queryable, Selectable};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::models::job_summary::BackgroundJobSummary;
use crate::schema::schedules;
use crate::types::JobType;

/// Schedule database row — Queryable struct matching the `schedules` table.
#[derive(Debug, Clone, Serialize, Deserialize, Queryable, Selectable, Identifiable)]
#[diesel(table_name = schedules)]
#[diesel(check_for_backend(diesel::pg::Pg))]
pub struct Schedule {
    pub id: Uuid,
    pub user_id: Uuid,
    pub name: String,
    pub job_type: JobType,
    pub cron_expr: String,
    pub parameters: Option<serde_json::Value>,
    pub is_active: bool,
    pub next_run_at: Option<DateTime<Utc>>,
    pub last_run_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Insertable struct for creating a new schedule.
#[derive(Debug, Insertable)]
#[diesel(table_name = schedules)]
pub struct NewSchedule {
    pub user_id: Uuid,
    pub name: String,
    pub job_type: JobType,
    pub cron_expr: String,
    pub parameters: Option<serde_json::Value>,
    pub is_active: bool,
    pub next_run_at: Option<DateTime<Utc>>,
}

/// Changeset for partial updates to a schedule.
#[derive(Debug, AsChangeset)]
#[diesel(table_name = schedules)]
pub struct UpdateSchedule {
    pub name: Option<String>,
    pub cron_expr: Option<String>,
    pub parameters: Option<Option<serde_json::Value>>,
    pub is_active: Option<bool>,
    pub next_run_at: Option<Option<DateTime<Utc>>>,
    pub updated_at: Option<DateTime<Utc>>,
}

/// Request body for creating a schedule.
#[derive(Debug, Deserialize)]
pub struct CreateScheduleRequest {
    pub name: String,
    pub job_type: String,
    pub cron_expr: String,
    #[serde(default)]
    pub parameters: Option<serde_json::Value>,
}

/// Request body for updating a schedule (all fields optional).
#[derive(Debug, Deserialize)]
pub struct UpdateScheduleRequest {
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub cron_expr: Option<String>,
    #[serde(default)]
    pub parameters: Option<serde_json::Value>,
    #[serde(default)]
    pub is_active: Option<bool>,
}

/// API response for a schedule, includes computed `cron_description`.
#[derive(Debug, Serialize)]
pub struct ScheduleResponse {
    pub id: Uuid,
    pub name: String,
    pub job_type: JobType,
    pub cron_expr: String,
    pub cron_description: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub parameters: Option<serde_json::Value>,
    pub is_active: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub next_run_at: Option<DateTime<Utc>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_run_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Detailed API response for a single schedule, includes recent jobs and upcoming runs.
#[derive(Debug, Serialize)]
pub struct ScheduleDetailResponse {
    pub schedule: ScheduleResponse,
    pub recent_jobs: Vec<BackgroundJobSummary>,
    pub upcoming_runs: Vec<DateTime<Utc>>,
}

impl ScheduleResponse {
    /// Build a [`ScheduleResponse`] from a [`Schedule`] row, computing the cron description.
    pub fn from_schedule(schedule: &Schedule) -> Self {
        let cron_description = crate::utils::cron::describe_cron(&schedule.cron_expr);
        Self {
            id: schedule.id,
            name: schedule.name.clone(),
            job_type: schedule.job_type,
            cron_expr: schedule.cron_expr.clone(),
            cron_description,
            parameters: schedule.parameters.clone(),
            is_active: schedule.is_active,
            next_run_at: schedule.next_run_at,
            last_run_at: schedule.last_run_at,
            created_at: schedule.created_at,
            updated_at: schedule.updated_at,
        }
    }
}
