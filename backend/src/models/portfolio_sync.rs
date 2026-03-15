use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::types::{InvestmentProviderType, JobStatus};

// --- Request DTOs ---

/// Request body for POST /api/v1/portfolio-sync
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PortfolioSyncRequest {
    /// Optional: sync only this account. If omitted, syncs all accounts with active providers.
    pub account_id: Option<Uuid>,
}

// --- Response DTOs ---

/// Response for POST /api/v1/portfolio-sync (202 Accepted)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StartPortfolioSyncResponse {
    pub job_id: Uuid,
    pub status: JobStatus,
    pub message: String,
}

/// Response for GET /api/v1/portfolio-sync/:job_id
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PortfolioSyncJobResponse {
    pub job_id: Uuid,
    pub status: JobStatus,
    pub created_at: DateTime<Utc>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub started_at: Option<DateTime<Utc>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub completed_at: Option<DateTime<Utc>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub result: Option<PortfolioSyncReport>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

// --- Job result DTOs (stored in background_jobs.result as JSONB) ---

/// The full sync report stored as JSONB in background_jobs.result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PortfolioSyncReport {
    pub synced_accounts: Vec<AccountSyncResult>,
    pub total_synced: i64,
    pub total_failed: i64,
}

/// Result for a single account sync within a portfolio sync job
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AccountSyncResult {
    pub account_id: Uuid,
    pub account_name: String,
    pub provider_type: InvestmentProviderType,
    pub previous_balance: String,
    pub new_value: String,
    pub adjustment_amount: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub adjustment_transaction_id: Option<Uuid>,
    /// "synced", "no_change", "failed"
    pub status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}
