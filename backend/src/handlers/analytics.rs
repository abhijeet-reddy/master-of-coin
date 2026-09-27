//! Analytics series for charts: net worth history, monthly income and spend,
//! and daily spend. All totals are in the user's default currency.

use axum::{
    Json,
    extract::{Extension, Query, State},
};
use chrono::{Months, NaiveDate, Utc};
use serde::Deserialize;

use crate::{
    AppState,
    auth::context::AuthContext,
    errors::ApiError,
    services::analytics_service::{
        self, HistoryInterval, MonthlyPoint, NetWorthPoint, SpendingTrendPoint,
    },
};

#[derive(Debug, Deserialize)]
pub struct NetWorthHistoryQuery {
    /// Default: 12 months before `to`.
    pub from: Option<NaiveDate>,
    /// Default: today (UTC).
    pub to: Option<NaiveDate>,
    #[serde(default)]
    pub interval: HistoryInterval,
}

#[derive(Debug, Deserialize)]
pub struct MonthlyQuery {
    /// Default 12, max 120.
    pub months: Option<u32>,
}

#[derive(Debug, Deserialize)]
pub struct SpendingTrendQuery {
    /// Default: 29 days before `to` (a 30-day window).
    pub from: Option<NaiveDate>,
    /// Default: today (UTC).
    pub to: Option<NaiveDate>,
}

/// GET /analytics/net-worth-history?from&to&interval=month|week
pub async fn net_worth_history(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthContext>,
    Query(query): Query<NetWorthHistoryQuery>,
) -> Result<Json<Vec<NetWorthPoint>>, ApiError> {
    let to = query.to.unwrap_or_else(|| Utc::now().date_naive());
    let from = match query.from {
        Some(from) => from,
        None => to
            .checked_sub_months(Months::new(12))
            .ok_or_else(|| ApiError::Validation("to is out of range".into()))?,
    };
    let series = analytics_service::get_net_worth_history(
        &state.db,
        auth.user_id(),
        from,
        to,
        query.interval,
        &*state.exchange_rate_provider,
    )
    .await?;
    Ok(Json(series))
}

/// GET /analytics/monthly?months=12
pub async fn monthly(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthContext>,
    Query(query): Query<MonthlyQuery>,
) -> Result<Json<Vec<MonthlyPoint>>, ApiError> {
    let series = analytics_service::get_monthly(
        &state.db,
        auth.user_id(),
        query.months.unwrap_or(12),
        Utc::now().date_naive(),
        &*state.exchange_rate_provider,
    )
    .await?;
    Ok(Json(series))
}

/// GET /analytics/spending-trend?from&to
pub async fn spending_trend(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthContext>,
    Query(query): Query<SpendingTrendQuery>,
) -> Result<Json<Vec<SpendingTrendPoint>>, ApiError> {
    let to = query.to.unwrap_or_else(|| Utc::now().date_naive());
    let from = match query.from {
        Some(from) => from,
        None => to
            .checked_sub_days(chrono::Days::new(29))
            .ok_or_else(|| ApiError::Validation("to is out of range".into()))?,
    };
    let series = analytics_service::get_spending_trend(
        &state.db,
        auth.user_id(),
        from,
        to,
        &*state.exchange_rate_provider,
    )
    .await?;
    Ok(Json(series))
}
