use bigdecimal::BigDecimal;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use validator::Validate;

use crate::types::JobStatus;

/// Request body for POST /api/v1/drift-detection
#[derive(Debug, Clone, Serialize, Deserialize, Validate)]
pub struct DriftDetectionRequest {
    pub start_date: DateTime<Utc>,
    pub end_date: DateTime<Utc>,
}

/// Response for POST /api/v1/drift-detection (202 Accepted)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StartJobResponse {
    pub job_id: Uuid,
    pub status: JobStatus,
    pub message: String,
}

/// Response for GET /api/v1/drift-detection/:job_id
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DriftDetectionJobResponse {
    pub job_id: Uuid,
    pub status: JobStatus,
    pub created_at: DateTime<Utc>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub started_at: Option<DateTime<Utc>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub completed_at: Option<DateTime<Utc>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub result: Option<DriftReport>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

/// The full drift report stored as JSONB in background_jobs.result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DriftReport {
    pub summary: DriftSummary,
    pub drifted: Vec<DriftedItem>,
    pub missing_on_external: Vec<MissingOnExternal>,
    pub missing_on_local: Vec<MissingOnLocal>,
}

/// Summary counts for the drift report
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DriftSummary {
    pub total_local: i64,
    pub total_external: i64,
    pub synced: i64,
    pub drifted: i64,
    pub missing_on_external: i64,
    pub missing_on_local: i64,
}

/// A linked pair where local and external splits differ
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DriftedItem {
    pub transaction_id: Uuid,
    pub transaction_title: String,
    pub transaction_date: DateTime<Utc>,
    pub local_amount: String,
    pub external_expense_id: String,
    pub external_description: String,
    pub external_cost: String,
    pub external_date: String,
    pub local_splits: Vec<LocalSplitInfo>,
    pub external_splits: Vec<ExternalSplitInfo>,
}

/// A local transaction with splits that has no linked external expense
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MissingOnExternal {
    pub transaction_id: Uuid,
    pub transaction_title: String,
    pub transaction_date: DateTime<Utc>,
    pub amount: String,
    pub splits: Vec<LocalSplitInfo>,
}

/// An external expense with no linked local transaction
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MissingOnLocal {
    pub external_expense_id: String,
    pub description: String,
    pub cost: String,
    pub currency_code: String,
    pub date: String,
    pub users: Vec<ExternalSplitInfo>,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    #[serde(default)]
    pub unmapped_users: Vec<UnmappedUser>,
}

/// Split info from the local side (person_name + owed_share)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LocalSplitInfo {
    pub person_name: String,
    pub external_user_id: String,
    pub owed_share: String,
}

/// Split info from the external side (Splitwise user details)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExternalSplitInfo {
    pub external_user_id: String,
    pub first_name: String,
    pub last_name: String,
    pub owed_share: String,
    pub paid_share: String,
}

/// An external user who has no local person_split_config mapping
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UnmappedUser {
    pub external_user_id: String,
    pub first_name: String,
    pub last_name: String,
}

/// Result of fetching local split transactions, grouped by transaction_id.
///
/// Used by the drift detection service's `classify()` function.
/// Made `pub` for integration testing.
#[derive(Debug, Clone)]
pub struct LocalTransactionGroup {
    pub transaction_id: Uuid,
    pub transaction_title: String,
    pub transaction_amount: BigDecimal,
    pub transaction_date: DateTime<Utc>,
    pub splits: Vec<LocalSplitRow>,
}

/// A single row from the local split transaction query.
///
/// Used by the drift detection service's `classify()` function.
/// Made `pub` for integration testing.
#[derive(Debug, Clone)]
pub struct LocalSplitRow {
    pub _split_id: Uuid,
    pub person_name: String,
    pub split_amount: BigDecimal,
    pub external_user_id: String,
    pub _provider_id: Uuid,
    pub external_expense_id: Option<String>,
    pub _sync_status: Option<String>,
}
