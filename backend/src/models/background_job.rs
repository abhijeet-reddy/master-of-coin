use chrono::{DateTime, Utc};
use diesel::{Identifiable, Insertable, Queryable, Selectable};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::schema::background_jobs;
use crate::types::{JobStatus, JobType};

#[derive(Debug, Clone, Serialize, Deserialize, Queryable, Selectable, Identifiable)]
#[diesel(table_name = background_jobs)]
#[diesel(check_for_backend(diesel::pg::Pg))]
pub struct BackgroundJob {
    pub id: Uuid,
    pub user_id: Uuid,
    pub job_type: JobType,
    pub status: JobStatus,
    pub previous_job_id: Option<Uuid>,
    pub input: Option<serde_json::Value>,
    pub result: Option<serde_json::Value>,
    pub error: Option<String>,
    pub created_at: DateTime<Utc>,
    pub started_at: Option<DateTime<Utc>>,
    pub completed_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Insertable)]
#[diesel(table_name = background_jobs)]
pub struct NewBackgroundJob {
    pub user_id: Uuid,
    pub job_type: JobType,
    pub status: JobStatus,
    pub previous_job_id: Option<Uuid>,
    pub input: Option<serde_json::Value>,
}
