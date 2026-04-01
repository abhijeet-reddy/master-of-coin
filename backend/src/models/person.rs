use chrono::{DateTime, Utc};
use diesel::{Identifiable, Insertable, Queryable, Selectable};
use serde::{Deserialize, Deserializer, Serialize};
use uuid::Uuid;

use crate::schema::people;
use crate::types::SplitProviderType;

/// Deserialize a double-Option field: absent → None, null → Some(None), value → Some(Some(v)).
/// Use with `#[serde(default, deserialize_with = "deserialize_optional_field")]`.
pub fn deserialize_optional_field<'de, D>(
    deserializer: D,
) -> Result<Option<Option<String>>, D::Error>
where
    D: Deserializer<'de>,
{
    Ok(Some(Option::deserialize(deserializer)?))
}

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
    /// None = don't change, Some(None) = set to NULL, Some(Some(v)) = set to v
    pub email: Option<Option<String>>,
    /// None = don't change, Some(None) = set to NULL, Some(Some(v)) = set to v
    pub phone: Option<Option<String>>,
    /// None = don't change, Some(None) = set to NULL, Some(Some(v)) = set to v
    pub notes: Option<Option<String>>,
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

#[derive(Debug, Deserialize)]
pub struct UpdatePersonRequest {
    pub name: Option<String>,
    /// Absent → don't change; null → clear; value → set
    #[serde(default, deserialize_with = "deserialize_optional_field")]
    pub email: Option<Option<String>>,
    /// Absent → don't change; null → clear; value → set
    #[serde(default, deserialize_with = "deserialize_optional_field")]
    pub phone: Option<Option<String>>,
    /// Absent → don't change; null → clear; value → set
    #[serde(default, deserialize_with = "deserialize_optional_field")]
    pub notes: Option<Option<String>>,
}

impl UpdatePersonRequest {
    /// Validate the request fields manually since validator crate
    /// doesn't support Option<Option<String>> (double-Option pattern).
    pub fn validate_fields(&self) -> Result<(), String> {
        if let Some(ref name) = self.name {
            if name.is_empty() || name.len() > 100 {
                return Err("Name must be between 1 and 100 characters".to_string());
            }
        }
        if let Some(Some(ref email)) = self.email {
            // Basic email validation: must contain @
            if !email.contains('@') || email.len() < 3 {
                return Err("Invalid email format".to_string());
            }
        }
        if let Some(Some(ref phone)) = self.phone {
            if phone.len() > 20 {
                return Err("Phone must be less than 20 characters".to_string());
            }
        }
        if let Some(Some(ref notes)) = self.notes {
            if notes.len() > 500 {
                return Err("Notes must be less than 500 characters".to_string());
            }
        }
        Ok(())
    }
}

// Response DTOs

/// Debt summary for a person (owes_me, i_owe, net)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DebtSummaryResponse {
    pub owes_me: String,
    pub i_owe: String,
    pub net: String,
}

/// Split config info included in PersonResponse
#[derive(Debug, Serialize, Deserialize)]
pub struct PersonSplitConfigInfo {
    pub split_provider_id: Uuid,
    pub provider_type: SplitProviderType,
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
    /// Debt summary (owes_me, i_owe, net)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub debt_summary: Option<DebtSummaryResponse>,
    /// Number of transactions involving this person
    pub transaction_count: i64,
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
            debt_summary: None,   // Populated by handler
            transaction_count: 0, // Populated by handler
            split_config: None,   // Populated separately when needed
        }
    }
}
