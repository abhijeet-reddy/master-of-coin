use chrono::{DateTime, Utc};
use diesel::{Identifiable, Insertable, Queryable, Selectable};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::schema::bank_sync_records;
use crate::types::{BankProviderType, JobStatus};

// --- Database models ---

#[derive(Debug, Clone, Serialize, Deserialize, Queryable, Selectable, Identifiable)]
#[diesel(table_name = bank_sync_records)]
#[diesel(check_for_backend(diesel::pg::Pg))]
pub struct BankSyncRecord {
    pub id: Uuid,
    pub bank_provider_id: Uuid,
    pub external_transaction_id: String,
    pub transaction_id: Option<Uuid>,
    pub imported_at: DateTime<Utc>,
}

#[derive(Debug, Insertable)]
#[diesel(table_name = bank_sync_records)]
pub struct NewBankSyncRecord {
    pub bank_provider_id: Uuid,
    pub external_transaction_id: String,
    pub transaction_id: Option<Uuid>,
}

// --- Sync Report DTOs (stored as JSONB in background_jobs.result) ---

/// The full bank sync report stored as JSONB in background_jobs.result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BankSyncReport {
    pub provider_type: BankProviderType,
    pub account_name: String,
    pub bank_provider_id: String,
    /// The local account ID linked to this bank provider
    pub account_id: String,
    pub balance: Option<BankBalanceInfo>,
    pub transactions: Vec<FetchedBankTransaction>,
    pub summary: BankSyncSummary,
}

/// Summary counts for the sync report
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BankSyncSummary {
    pub total_fetched: i64,
    pub already_imported: i64,
    pub new_transactions: i64,
}

/// A single transaction fetched from the bank provider
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FetchedBankTransaction {
    pub external_id: String,
    pub description: String,
    pub amount: String,
    pub currency: String,
    pub date: DateTime<Utc>,
    pub transaction_type: String,
    pub merchant_name: Option<String>,
    pub category: Option<String>,
    pub already_imported: bool,
}

/// Balance information from the bank provider
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BankBalanceInfo {
    pub current: String,
    pub available: Option<String>,
    pub currency: String,
    pub updated_at: DateTime<Utc>,
}

// --- Job Response DTOs ---

/// Response for GET /api/v1/bank-providers/sync/:job_id
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BankSyncJobResponse {
    pub job_id: Uuid,
    pub status: JobStatus,
    pub created_at: DateTime<Utc>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub started_at: Option<DateTime<Utc>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub completed_at: Option<DateTime<Utc>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub result: Option<BankSyncReport>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

/// Response for POST /api/v1/bank-providers/:id/sync (202 Accepted)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StartBankSyncResponse {
    pub job_id: Uuid,
    pub status: JobStatus,
    pub message: String,
}

/// Response for POST /api/v1/bank-providers/sync/:job_id/import
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BankImportResult {
    pub imported_count: i64,
    pub skipped_count: i64,
    pub errors: Vec<String>,
}
