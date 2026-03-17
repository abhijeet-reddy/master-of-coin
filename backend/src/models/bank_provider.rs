use chrono::{DateTime, Utc};
use diesel::{Identifiable, Insertable, Queryable, Selectable};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use validator::Validate;

use crate::schema::bank_providers;
use crate::types::BankProviderType;

// --- Database models ---

#[derive(Debug, Clone, Serialize, Deserialize, Queryable, Selectable, Identifiable)]
#[diesel(table_name = bank_providers)]
#[diesel(check_for_backend(diesel::pg::Pg))]
pub struct BankProviderRecord {
    pub id: Uuid,
    pub user_id: Uuid,
    pub account_id: Uuid,
    pub provider_type: BankProviderType,
    pub credentials: serde_json::Value,
    pub external_account_id: Option<String>,
    pub is_active: bool,
    pub last_sync_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Insertable)]
#[diesel(table_name = bank_providers)]
pub struct NewBankProvider {
    pub user_id: Uuid,
    pub account_id: Uuid,
    pub provider_type: BankProviderType,
    pub credentials: serde_json::Value,
    pub external_account_id: Option<String>,
    pub is_active: bool,
}

// --- Request DTOs ---

/// Query params for GET /api/v1/bank-providers/:provider_type/auth-url
#[derive(Debug, Deserialize, Validate)]
pub struct BankAuthUrlRequest {
    pub account_id: Uuid,
}

/// Request body for POST /api/v1/bank-providers/:id/sync
#[derive(Debug, Clone, Serialize, Deserialize, Validate)]
pub struct BankSyncRequest {
    pub from_date: Option<DateTime<Utc>>,
    pub to_date: Option<DateTime<Utc>>,
}

/// Request body for POST /api/v1/bank-providers/sync/:job_id/import
#[derive(Debug, Deserialize, Validate)]
pub struct BankSyncImportRequest {
    /// External transaction IDs to import
    #[validate(length(min = 1, message = "At least one transaction must be selected"))]
    pub transaction_ids: Vec<String>,
}

/// Request body for PUT /api/v1/bank-providers/:id/link-account
#[derive(Debug, Deserialize, Validate)]
pub struct LinkExternalAccountRequest {
    #[validate(length(min = 1, max = 255))]
    pub external_account_id: String,
}

// --- Response DTOs ---

/// Response for bank provider endpoints (credentials excluded for security)
#[derive(Debug, Serialize, Deserialize)]
pub struct BankProviderResponse {
    pub id: Uuid,
    pub user_id: Uuid,
    pub account_id: Uuid,
    pub provider_type: BankProviderType,
    pub external_account_id: Option<String>,
    pub is_active: bool,
    pub last_sync_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    // Note: credentials are never exposed in responses for security
}

impl From<BankProviderRecord> for BankProviderResponse {
    fn from(record: BankProviderRecord) -> Self {
        Self {
            id: record.id,
            user_id: record.user_id,
            account_id: record.account_id,
            provider_type: record.provider_type,
            external_account_id: record.external_account_id,
            is_active: record.is_active,
            last_sync_at: record.last_sync_at,
            created_at: record.created_at,
            updated_at: record.updated_at,
        }
    }
}

/// Response for GET /api/v1/bank-providers/:provider_type/auth-url
#[derive(Debug, Serialize)]
pub struct BankAuthUrlResponse {
    pub auth_url: String,
    pub state: String,
}

/// Response for GET /api/v1/bank-providers/:id/balance
#[derive(Debug, Serialize, Deserialize)]
pub struct BankBalanceResponse {
    pub current: String,
    pub available: Option<String>,
    pub currency: String,
    pub updated_at: DateTime<Utc>,
}

/// Response for GET /api/v1/bank-providers/:id/accounts (external bank accounts)
#[derive(Debug, Serialize, Deserialize)]
pub struct ExternalBankAccountResponse {
    pub account_id: String,
    pub account_name: String,
    pub account_type: String,
    pub currency: String,
    pub account_number: Option<String>,
    pub sort_code: Option<String>,
}
