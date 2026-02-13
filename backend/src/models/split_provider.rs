use chrono::{DateTime, Utc};
use diesel::{Identifiable, Insertable, Queryable, Selectable};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use validator::Validate;

use crate::schema::split_providers;

#[derive(Debug, Clone, Serialize, Deserialize, Queryable, Selectable, Identifiable)]
#[diesel(table_name = split_providers)]
#[diesel(check_for_backend(diesel::pg::Pg))]
pub struct SplitProvider {
    pub id: Uuid,
    pub user_id: Uuid,
    pub provider_type: String,
    pub credentials: serde_json::Value,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Insertable)]
#[diesel(table_name = split_providers)]
pub struct NewSplitProvider {
    pub user_id: Uuid,
    pub provider_type: String,
    pub credentials: serde_json::Value,
    pub is_active: bool,
}

#[derive(Debug, Deserialize)]
pub struct UpdateSplitProvider {
    pub credentials: Option<serde_json::Value>,
    pub is_active: Option<bool>,
}

// Request DTOs
#[derive(Debug, Deserialize, Validate)]
pub struct CreateSplitProviderRequest {
    #[validate(length(min = 1, max = 50))]
    pub provider_type: String,
    pub credentials: serde_json::Value,
}

// Response DTOs
#[derive(Debug, Serialize, Deserialize)]
pub struct SplitProviderResponse {
    pub id: Uuid,
    pub user_id: Uuid,
    pub provider_type: String,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    // Note: credentials are never exposed in responses for security
}

impl From<SplitProvider> for SplitProviderResponse {
    fn from(provider: SplitProvider) -> Self {
        Self {
            id: provider.id,
            user_id: provider.user_id,
            provider_type: provider.provider_type,
            is_active: provider.is_active,
            created_at: provider.created_at,
            updated_at: provider.updated_at,
        }
    }
}

// Splitwise-specific credential structure
#[derive(Debug, Serialize, Deserialize)]
pub struct SplitwiseCredentials {
    pub access_token: String,
    pub refresh_token: String,
    pub token_expires_at: DateTime<Utc>,
    pub splitwise_user_id: i64,
}
