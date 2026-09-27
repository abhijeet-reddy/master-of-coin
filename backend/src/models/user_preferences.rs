use chrono::{DateTime, Utc};
use diesel::{AsChangeset, Insertable, Queryable, Selectable};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::schema::user_preferences;
use crate::types::CurrencyCode;

pub const DATE_FORMATS: [&str; 3] = ["DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"];
pub const NUMBER_LOCALES: [&str; 4] = ["en-US", "de-DE", "fr-FR", "en-IN"];
pub const WEEK_STARTS: [i16; 2] = [1, 7];

pub const DEFAULT_CURRENCY: CurrencyCode = CurrencyCode::Eur;
pub const DEFAULT_DATE_FORMAT: &str = "DD/MM/YYYY";
pub const DEFAULT_NUMBER_LOCALE: &str = "en-US";
pub const DEFAULT_WEEK_START: i16 = 1;

#[derive(Debug, Clone, Queryable, Selectable)]
#[diesel(table_name = user_preferences)]
#[diesel(check_for_backend(diesel::pg::Pg))]
pub struct UserPreferences {
    pub user_id: Uuid,
    pub default_currency: CurrencyCode,
    pub date_format: String,
    pub number_locale: String,
    pub week_start: i16,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Insertable, AsChangeset)]
#[diesel(table_name = user_preferences)]
pub struct NewUserPreferences {
    pub user_id: Uuid,
    pub default_currency: CurrencyCode,
    pub date_format: String,
    pub number_locale: String,
    pub week_start: i16,
}

/// PUT /preferences body. Omitted fields keep their current (or default) value.
#[derive(Debug, Default, Deserialize)]
pub struct UpdateUserPreferencesRequest {
    pub default_currency: Option<CurrencyCode>,
    pub date_format: Option<String>,
    pub number_locale: Option<String>,
    pub week_start: Option<i16>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct UserPreferencesResponse {
    pub default_currency: CurrencyCode,
    pub date_format: String,
    pub number_locale: String,
    /// 1 = Monday, 7 = Sunday.
    pub week_start: i16,
    /// None when the user has never saved preferences (defaults are returned).
    pub updated_at: Option<DateTime<Utc>>,
}

impl UserPreferencesResponse {
    pub fn defaults() -> Self {
        Self {
            default_currency: DEFAULT_CURRENCY,
            date_format: DEFAULT_DATE_FORMAT.to_string(),
            number_locale: DEFAULT_NUMBER_LOCALE.to_string(),
            week_start: DEFAULT_WEEK_START,
            updated_at: None,
        }
    }
}

impl From<UserPreferences> for UserPreferencesResponse {
    fn from(p: UserPreferences) -> Self {
        Self {
            default_currency: p.default_currency,
            date_format: p.date_format,
            number_locale: p.number_locale,
            week_start: p.week_start,
            updated_at: Some(p.updated_at),
        }
    }
}
