use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use validator::Validate;

use crate::types::JobStatus;

/// Request body for POST /api/v1/sync
#[derive(Debug, Clone, Serialize, Deserialize, Validate)]
pub struct BulkSyncRequest {
    #[validate(length(min = 1, message = "items array must not be empty"))]
    pub items: Vec<SyncItem>,
}

/// A single sync operation in the bulk request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncItem {
    pub action: SyncAction,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub transaction_id: Option<Uuid>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub external_expense_id: Option<String>,
}

/// The action to perform for a sync item
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum SyncAction {
    Push,
    Pull,
}

/// Response for POST /api/v1/sync (202 Accepted)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StartSyncJobResponse {
    pub job_id: Uuid,
    pub status: JobStatus,
    pub message: String,
    pub total_items: usize,
}

/// Response for GET /api/v1/sync/:job_id
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BulkSyncJobResponse {
    pub job_id: Uuid,
    pub status: JobStatus,
    pub created_at: DateTime<Utc>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub started_at: Option<DateTime<Utc>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub completed_at: Option<DateTime<Utc>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub result: Option<BulkSyncReport>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

/// The full bulk sync report stored as JSONB in background_jobs.result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BulkSyncReport {
    pub summary: BulkSyncSummary,
    pub items: Vec<SyncItemResult>,
}

/// Summary counts for the bulk sync report
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BulkSyncSummary {
    pub total: usize,
    pub succeeded: usize,
    pub failed: usize,
}

/// Per-item result in the bulk sync report
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncItemResult {
    pub action: SyncAction,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub transaction_id: Option<Uuid>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub external_expense_id: Option<String>,
    pub status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub detail: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}
