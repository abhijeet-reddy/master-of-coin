use chrono::{DateTime, Utc};
use diesel::{Identifiable, Insertable, Queryable, Selectable};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::schema::people;

#[derive(Debug, Clone, Serialize, Deserialize, Queryable, Selectable, Identifiable)]
#[diesel(table_name = people)]
#[diesel(check_for_backend(diesel::pg::Pg))]
pub struct Person {
    pub id: Uuid,
    pub user_id: Uuid,
    pub name: String,
    pub email: Option<String>,
    pub phone: Option<String>,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Insertable)]
#[diesel(table_name = people)]
pub struct NewPerson {
    pub user_id: Uuid,
    pub name: String,
    pub email: Option<String>,
    pub phone: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreatePerson {
    pub name: String,
    pub email: Option<String>,
    pub phone: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdatePerson {
    pub name: Option<String>,
    pub email: Option<String>,
    pub phone: Option<String>,
    pub notes: Option<String>,
}

// Request DTOs
#[derive(Debug, Deserialize, validator::Validate)]
pub struct CreatePersonRequest {
    #[validate(length(min = 1, max = 100))]
    pub name: String,
    #[validate(email)]
    pub email: Option<String>,
    #[validate(length(max = 20))]
    pub phone: Option<String>,
    #[validate(length(max = 500))]
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize, validator::Validate)]
pub struct UpdatePersonRequest {
    #[validate(length(min = 1, max = 100))]
    pub name: Option<String>,
    #[validate(email)]
    pub email: Option<String>,
    #[validate(length(max = 20))]
    pub phone: Option<String>,
    #[validate(length(max = 500))]
    pub notes: Option<String>,
}

// Response DTOs

/// Split config info included in PersonResponse
#[derive(Debug, Serialize, Deserialize)]
pub struct PersonSplitConfigInfo {
    pub split_provider_id: Uuid,
    pub provider_type: String,
    pub external_user_id: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PersonResponse {
    pub id: Uuid,
    pub user_id: Uuid,
    pub name: String,
    pub email: Option<String>,
    pub phone: Option<String>,
    pub notes: Option<String>,
    /// Optional split provider configuration
    #[serde(skip_serializing_if = "Option::is_none")]
    pub split_config: Option<PersonSplitConfigInfo>,
}

impl From<Person> for PersonResponse {
    fn from(person: Person) -> Self {
        Self {
            id: person.id,
            user_id: person.user_id,
            name: person.name,
            email: person.email,
            phone: person.phone,
            notes: person.notes,
            split_config: None, // Populated separately when needed
        }
    }
}
