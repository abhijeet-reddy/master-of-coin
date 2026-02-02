use chrono::{DateTime, Utc};
use diesel::{Identifiable, Insertable, Queryable, Selectable};
use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;
use uuid::Uuid;

use crate::schema::api_keys;
use crate::types::ApiKeyStatus;

/// Database model for API keys
#[derive(Debug, Clone, Serialize, Deserialize, Queryable, Selectable, Identifiable)]
#[diesel(table_name = api_keys)]
#[diesel(check_for_backend(diesel::pg::Pg))]
pub struct ApiKey {
    pub id: Uuid,
    pub user_id: Uuid,
    pub name: String,
    #[serde(skip_serializing)]
    pub key_hash: String,
    pub key_prefix: String,
    pub scopes: JsonValue,
    pub status: ApiKeyStatus,
    pub expires_at: Option<DateTime<Utc>>,
    pub last_used_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Model for inserting new API keys
#[derive(Debug, Insertable)]
#[diesel(table_name = api_keys)]
pub struct NewApiKey {
    pub user_id: Uuid,
    pub name: String,
    pub key_hash: String,
    pub key_prefix: String,
    pub scopes: JsonValue,
    pub status: ApiKeyStatus,
    pub expires_at: Option<DateTime<Utc>>,
}

/// Scope permissions for API keys
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum ScopePermission {
    Read,
    Write,
}

/// Scopes structure defining permissions for each resource type
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ApiKeyScopes {
    #[serde(default)]
    pub transactions: Vec<ScopePermission>,
    #[serde(default)]
    pub accounts: Vec<ScopePermission>,
    #[serde(default)]
    pub budgets: Vec<ScopePermission>,
    #[serde(default)]
    pub categories: Vec<ScopePermission>,
    #[serde(default)]
    pub people: Vec<ScopePermission>,
}

impl ApiKeyScopes {
    /// Check if the scopes include a specific permission for a resource
    pub fn has_permission(&self, resource: ResourceType, operation: OperationType) -> bool {
        let permissions = match resource {
            ResourceType::Transactions => &self.transactions,
            ResourceType::Accounts => &self.accounts,
            ResourceType::Budgets => &self.budgets,
            ResourceType::Categories => &self.categories,
            ResourceType::People => &self.people,
        };

        match operation {
            OperationType::Read => permissions.contains(&ScopePermission::Read),
            OperationType::Write => permissions.contains(&ScopePermission::Write),
        }
    }

    /// Convert to JSON value for database storage
    pub fn to_json(&self) -> Result<JsonValue, serde_json::Error> {
        serde_json::to_value(self)
    }

    /// Parse from JSON value from database
    pub fn from_json(value: &JsonValue) -> Result<Self, serde_json::Error> {
        serde_json::from_value(value.clone())
    }
}

/// Resource types for scope checking
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ResourceType {
    Transactions,
    Accounts,
    Budgets,
    Categories,
    People,
}

/// Operation types for scope checking
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum OperationType {
    Read,  // GET operations
    Write, // POST, PUT, DELETE operations
}

// Request DTOs

/// Request to create a new API key
#[derive(Debug, Serialize, Deserialize, validator::Validate)]
pub struct CreateApiKeyRequest {
    #[validate(length(min = 1, max = 255))]
    pub name: String,
    pub scopes: ApiKeyScopes,
    pub expires_in_days: Option<i64>, // null means never expires
}

/// Request to update an existing API key
#[derive(Debug, Serialize, Deserialize, validator::Validate)]
pub struct UpdateApiKeyRequest {
    #[validate(length(min = 1, max = 255))]
    pub name: Option<String>,
    pub expires_in_days: Option<i64>,
    pub scopes: Option<ApiKeyScopes>,
}

// Response DTOs

/// Response when creating an API key (includes the plain key - shown only once)
#[derive(Debug, Serialize, Deserialize)]
pub struct CreateApiKeyResponse {
    pub id: Uuid,
    pub name: String,
    pub key: String, // Plain API key - only shown once!
    pub key_prefix: String,
    pub scopes: ApiKeyScopes,
    pub status: ApiKeyStatus,
    pub expires_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
}

/// Response for API key details (without the plain key)
#[derive(Debug, Serialize, Deserialize)]
pub struct ApiKeyResponse {
    pub id: Uuid,
    pub name: String,
    pub key_prefix: String,
    pub scopes: ApiKeyScopes,
    pub status: ApiKeyStatus,
    pub expires_at: Option<DateTime<Utc>>,
    pub last_used_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl ApiKeyResponse {
    /// Convert from ApiKey model
    pub fn from_api_key(api_key: ApiKey) -> Result<Self, serde_json::Error> {
        let scopes = ApiKeyScopes::from_json(&api_key.scopes)?;

        Ok(ApiKeyResponse {
            id: api_key.id,
            name: api_key.name,
            key_prefix: api_key.key_prefix,
            scopes,
            status: api_key.status,
            expires_at: api_key.expires_at,
            last_used_at: api_key.last_used_at,
            created_at: api_key.created_at,
            updated_at: api_key.updated_at,
        })
    }
}

/// Response for listing API keys
#[derive(Debug, Serialize, Deserialize)]
pub struct ListApiKeysResponse {
    pub api_keys: Vec<ApiKeyResponse>,
}
