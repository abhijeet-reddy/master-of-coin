use uuid::Uuid;

use crate::{
    DbPool,
    errors::ApiError,
    models::user_preferences::{
        DATE_FORMATS, DEFAULT_CURRENCY, NUMBER_LOCALES, NewUserPreferences,
        UpdateUserPreferencesRequest, UserPreferencesResponse, WEEK_STARTS,
    },
    repositories,
    types::CurrencyCode,
};

/// GET /preferences: the stored row or the defaults.
pub async fn get_preferences(
    pool: &DbPool,
    user_id: Uuid,
) -> Result<UserPreferencesResponse, ApiError> {
    repositories::user_preferences::get_or_default(pool, user_id).await
}

/// PUT /preferences: validate, merge onto current values, upsert.
pub async fn update_preferences(
    pool: &DbPool,
    user_id: Uuid,
    request: UpdateUserPreferencesRequest,
) -> Result<UserPreferencesResponse, ApiError> {
    if let Some(f) = &request.date_format
        && !DATE_FORMATS.contains(&f.as_str())
    {
        return Err(ApiError::Validation(format!(
            "date_format must be one of {}",
            DATE_FORMATS.join(", ")
        )));
    }
    if let Some(l) = &request.number_locale
        && !NUMBER_LOCALES.contains(&l.as_str())
    {
        return Err(ApiError::Validation(format!(
            "number_locale must be one of {}",
            NUMBER_LOCALES.join(", ")
        )));
    }
    if let Some(w) = request.week_start
        && !WEEK_STARTS.contains(&w)
    {
        return Err(ApiError::Validation(
            "week_start must be 1 (Monday) or 7 (Sunday)".to_string(),
        ));
    }

    let current = repositories::user_preferences::get_or_default(pool, user_id).await?;
    let saved = repositories::user_preferences::upsert(
        pool,
        NewUserPreferences {
            user_id,
            default_currency: request.default_currency.unwrap_or(current.default_currency),
            date_format: request.date_format.unwrap_or(current.date_format),
            number_locale: request.number_locale.unwrap_or(current.number_locale),
            week_start: request.week_start.unwrap_or(current.week_start),
        },
    )
    .await?;

    tracing::info!("Saved preferences for user {}", user_id);
    Ok(saved.into())
}

/// The currency server-side totals convert into: the user's default currency,
/// falling back to EUR when preferences are missing or cannot be read.
pub async fn user_primary_currency(pool: &DbPool, user_id: Uuid) -> CurrencyCode {
    match repositories::user_preferences::find(pool, user_id).await {
        Ok(Some(p)) => p.default_currency,
        Ok(None) => DEFAULT_CURRENCY,
        Err(e) => {
            tracing::warn!(
                "Falling back to EUR: could not read preferences for user {}: {:?}",
                user_id,
                e
            );
            DEFAULT_CURRENCY
        }
    }
}

/// The user's week start as a chrono weekday (Monday unless they chose Sunday).
pub async fn user_week_start(pool: &DbPool, user_id: Uuid) -> chrono::Weekday {
    match repositories::user_preferences::find(pool, user_id).await {
        Ok(Some(p)) if p.week_start == 7 => chrono::Weekday::Sun,
        _ => chrono::Weekday::Mon,
    }
}

/// Currency and week start in one read, for services that need both.
pub async fn user_settings(pool: &DbPool, user_id: Uuid) -> (CurrencyCode, chrono::Weekday) {
    match repositories::user_preferences::find(pool, user_id).await {
        Ok(Some(p)) => (
            p.default_currency,
            if p.week_start == 7 {
                chrono::Weekday::Sun
            } else {
                chrono::Weekday::Mon
            },
        ),
        Ok(None) => (DEFAULT_CURRENCY, chrono::Weekday::Mon),
        Err(e) => {
            tracing::warn!("Using default settings for user {}: {:?}", user_id, e);
            (DEFAULT_CURRENCY, chrono::Weekday::Mon)
        }
    }
}
