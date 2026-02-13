use chrono::{DateTime, Utc};
use diesel::{Identifiable, Insertable, Queryable, Selectable};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use validator::Validate;

use crate::schema::person_split_configs;

#[derive(Debug, Clone, Serialize, Deserialize, Queryable, Selectable, Identifiable)]
#[diesel(table_name = person_split_configs)]
#[diesel(check_for_backend(diesel::pg::Pg))]
pub struct PersonSplitConfig {
    pub id: Uuid,
    pub person_id: Uuid,
    pub split_provider_id: Uuid,
    pub external_user_id: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Insertable)]
#[diesel(table_name = person_split_configs)]
pub struct NewPersonSplitConfig {
    pub person_id: Uuid,
    pub split_provider_id: Uuid,
    pub external_user_id: String,
}

#[derive(Debug, Deserialize)]
pub struct UpdatePersonSplitConfig {
    pub split_provider_id: Option<Uuid>,
    pub external_user_id: Option<String>,
}

// Request DTOs
#[derive(Debug, Deserialize, Validate)]
pub struct SetPersonSplitConfigRequest {
    pub split_provider_id: Uuid,
    #[validate(length(min = 1, max = 255))]
    pub external_user_id: String,
}

// Response DTOs
#[derive(Debug, Serialize, Deserialize)]
pub struct PersonSplitConfigResponse {
    pub id: Uuid,
    pub person_id: Uuid,
    pub split_provider_id: Uuid,
    pub provider_type: String, // Included for convenience
    pub external_user_id: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl From<PersonSplitConfig> for PersonSplitConfigResponse {
    fn from(config: PersonSplitConfig) -> Self {
        Self {
            id: config.id,
            person_id: config.person_id,
            split_provider_id: config.split_provider_id,
            provider_type: String::new(), // Will be populated by join query
            external_user_id: config.external_user_id,
            created_at: config.created_at,
            updated_at: config.updated_at,
        }
    }
}
