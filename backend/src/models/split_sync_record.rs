use chrono::{DateTime, Utc};
use diesel::{Identifiable, Insertable, Queryable, Selectable};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::schema::split_sync_records;

/// Sync status enum
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum SyncStatus {
    Pending,
    Synced,
    Failed,
    Deleted,
}

impl SyncStatus {
    pub fn as_str(&self) -> &str {
        match self {
            SyncStatus::Pending => "pending",
            SyncStatus::Synced => "synced",
            SyncStatus::Failed => "failed",
            SyncStatus::Deleted => "deleted",
        }
    }

    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "pending" => Some(SyncStatus::Pending),
            "synced" => Some(SyncStatus::Synced),
            "failed" => Some(SyncStatus::Failed),
            "deleted" => Some(SyncStatus::Deleted),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Queryable, Selectable, Identifiable)]
#[diesel(table_name = split_sync_records)]
#[diesel(check_for_backend(diesel::pg::Pg))]
pub struct SplitSyncRecord {
    pub id: Uuid,
    pub transaction_split_id: Uuid,
    pub split_provider_id: Uuid,
    pub external_expense_id: Option<String>,
    pub sync_status: String,
    pub last_sync_at: Option<DateTime<Utc>>,
    pub last_error: Option<String>,
    pub retry_count: i32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Insertable)]
#[diesel(table_name = split_sync_records)]
pub struct NewSplitSyncRecord {
    pub transaction_split_id: Uuid,
    pub split_provider_id: Uuid,
    pub external_expense_id: Option<String>,
    pub sync_status: String,
    pub last_sync_at: Option<DateTime<Utc>>,
    pub last_error: Option<String>,
    pub retry_count: i32,
}

#[derive(Debug, Deserialize)]
pub struct UpdateSplitSyncRecord {
    pub external_expense_id: Option<String>,
    pub sync_status: Option<String>,
    pub last_sync_at: Option<DateTime<Utc>>,
    pub last_error: Option<String>,
    pub retry_count: Option<i32>,
}

// Response DTOs
#[derive(Debug, Serialize, Deserialize)]
pub struct SplitSyncStatusResponse {
    pub id: Uuid,
    pub transaction_split_id: Uuid,
    pub split_provider_id: Uuid,
    pub provider_type: crate::types::SplitProviderType, // Included for convenience
    pub external_expense_id: Option<String>,
    pub sync_status: SyncStatus,
    pub last_sync_at: Option<DateTime<Utc>>,
    pub last_error: Option<String>,
    pub retry_count: i32,
    pub external_url: Option<String>, // Constructed based on provider
}

impl SplitSyncRecord {
    pub fn status(&self) -> SyncStatus {
        SyncStatus::from_str(&self.sync_status).unwrap_or(SyncStatus::Pending)
    }
}

/// Request body for resolving a split mismatch
#[derive(Debug, serde::Deserialize)]
pub struct ResolveMismatchRequest {
    pub external_expense_id: String,
    /// "push" to overwrite provider with local data, "pull" to update local transaction from provider
    pub action: String,
}

/// Request body for importing an external expense as a "paid by others" transaction
#[derive(Debug, serde::Deserialize)]
pub struct SyncExternalExpenseRequest {
    /// The external expense ID on the split provider (e.g., Splitwise expense ID)
    pub external_expense_id: String,
}
