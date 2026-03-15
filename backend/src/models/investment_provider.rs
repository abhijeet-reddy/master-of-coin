use chrono::{DateTime, Utc};
use diesel::{Identifiable, Insertable, Queryable, Selectable};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use validator::Validate;

use crate::schema::investment_providers;
use crate::types::InvestmentProviderType;

// --- Database models ---

#[derive(Debug, Clone, Serialize, Deserialize, Queryable, Selectable, Identifiable)]
#[diesel(table_name = investment_providers)]
#[diesel(check_for_backend(diesel::pg::Pg))]
pub struct InvestmentProviderRecord {
    pub id: Uuid,
    pub user_id: Uuid,
    pub account_id: Uuid,
    pub provider_type: InvestmentProviderType,
    pub credentials: serde_json::Value,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Insertable)]
#[diesel(table_name = investment_providers)]
pub struct NewInvestmentProvider {
    pub user_id: Uuid,
    pub account_id: Uuid,
    pub provider_type: InvestmentProviderType,
    pub credentials: serde_json::Value,
    pub is_active: bool,
}

// --- Request DTOs ---

/// Request body for POST /api/v1/investment-providers
#[derive(Debug, Deserialize, Validate)]
pub struct ConnectInvestmentProviderRequest {
    pub account_id: Uuid,
    pub provider_type: InvestmentProviderType,
    #[validate(length(min = 1, max = 500))]
    pub api_key: String,
    #[validate(length(min = 1, max = 500))]
    pub api_secret: String,
    /// Optional: "live" or "demo". Defaults to "live".
    pub environment: Option<String>,
}

// --- Response DTOs ---

/// Response for GET /api/v1/investment-providers (list) and POST (connect)
#[derive(Debug, Serialize, Deserialize)]
pub struct InvestmentProviderResponse {
    pub id: Uuid,
    pub user_id: Uuid,
    pub account_id: Uuid,
    pub provider_type: InvestmentProviderType,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    // Note: credentials are never exposed in responses for security
}

impl From<InvestmentProviderRecord> for InvestmentProviderResponse {
    fn from(record: InvestmentProviderRecord) -> Self {
        Self {
            id: record.id,
            user_id: record.user_id,
            account_id: record.account_id,
            provider_type: record.provider_type,
            is_active: record.is_active,
            created_at: record.created_at,
            updated_at: record.updated_at,
        }
    }
}
