//! Aggregate analytics queries.
//!
//! Every query groups in SQL (by day, month, category or account) and returns
//! totals per account currency, so the service layer converts a handful of
//! rows instead of looking up the account of every transaction.
//!
//! Spend and income queries leave out soft-deleted rows, both legs of
//! transfers, and categories flagged as excluded from analysis
//! (uncategorised rows are never excluded).

use bigdecimal::BigDecimal;
use chrono::{DateTime, NaiveDate, Utc};
use diesel::prelude::*;
use diesel::sql_types::{Array, Date, Nullable, Numeric, Timestamptz, Uuid as DieselUuid};
use uuid::Uuid;

use crate::{DbPool, errors::ApiError, types::CurrencyCode};

/// Shared WHERE fragment: the user's live, non-transfer rows outside
/// excluded categories. `$1` is the user id, `$2` the excluded category ids.
const LIVE_NON_TRANSFER: &str = "t.user_id = $1 \
    AND t.is_deleted = false \
    AND (t.category_id IS NULL OR t.category_id <> ALL($2)) \
    AND NOT EXISTS (SELECT 1 FROM transfers tr \
                    WHERE tr.from_transaction_id = t.id OR tr.to_transaction_id = t.id)";

#[derive(Debug, QueryableByName)]
pub struct DailyCurrencyTotal {
    #[diesel(sql_type = Date)]
    pub day: NaiveDate,
    #[diesel(sql_type = crate::schema::sql_types::CurrencyCode)]
    pub currency: CurrencyCode,
    #[diesel(sql_type = Numeric)]
    pub total: BigDecimal,
}

#[derive(Debug, QueryableByName)]
pub struct CategoryCurrencyTotal {
    #[diesel(sql_type = Nullable<DieselUuid>)]
    pub category_id: Option<Uuid>,
    #[diesel(sql_type = crate::schema::sql_types::CurrencyCode)]
    pub currency: CurrencyCode,
    #[diesel(sql_type = Numeric)]
    pub total: BigDecimal,
}

#[derive(Debug, QueryableByName)]
pub struct MonthlyCurrencyTotal {
    #[diesel(sql_type = Date)]
    pub month: NaiveDate,
    #[diesel(sql_type = crate::schema::sql_types::CurrencyCode)]
    pub currency: CurrencyCode,
    #[diesel(sql_type = Numeric)]
    pub income: BigDecimal,
    #[diesel(sql_type = Numeric)]
    pub spend: BigDecimal,
}

#[derive(Debug, QueryableByName)]
pub struct AccountDailyTotal {
    #[diesel(sql_type = DieselUuid)]
    pub account_id: Uuid,
    #[diesel(sql_type = Date)]
    pub day: NaiveDate,
    #[diesel(sql_type = Numeric)]
    pub total: BigDecimal,
}

async fn run<T, F>(pool: &DbPool, what: &'static str, f: F) -> Result<T, ApiError>
where
    T: Send + 'static,
    F: FnOnce(&mut PgConnection) -> QueryResult<T> + Send + 'static,
{
    let mut conn = pool.get().map_err(|e| {
        tracing::error!("Failed to get DB connection: {}", e);
        ApiError::Internal
    })?;

    tokio::task::spawn_blocking(move || {
        f(&mut conn).map_err(|e| {
            tracing::error!("Analytics query '{}' failed: {}", what, e);
            ApiError::from(e)
        })
    })
    .await
    .map_err(|e| {
        tracing::error!("Task join error: {}", e);
        ApiError::Internal
    })?
}

/// Daily spend (absolute value of negative amounts) per account currency,
/// UTC days, for `from <= date <= to`.
pub async fn spend_by_day(
    pool: &DbPool,
    user_id: Uuid,
    from: DateTime<Utc>,
    to: DateTime<Utc>,
    excluded_category_ids: Vec<Uuid>,
) -> Result<Vec<DailyCurrencyTotal>, ApiError> {
    let sql = format!(
        "SELECT (t.date AT TIME ZONE 'UTC')::date AS day, a.currency, \
                SUM(-t.amount) AS total \
         FROM transactions t JOIN accounts a ON a.id = t.account_id \
         WHERE {LIVE_NON_TRANSFER} AND t.amount < 0 AND t.date >= $3 AND t.date <= $4 \
         GROUP BY 1, 2 ORDER BY 1"
    );
    run(pool, "spend_by_day", move |conn| {
        diesel::sql_query(sql)
            .bind::<DieselUuid, _>(user_id)
            .bind::<Array<DieselUuid>, _>(excluded_category_ids)
            .bind::<Timestamptz, _>(from)
            .bind::<Timestamptz, _>(to)
            .load(conn)
    })
    .await
}

/// Spend per category and account currency for `from <= date <= to`.
pub async fn spend_by_category(
    pool: &DbPool,
    user_id: Uuid,
    from: DateTime<Utc>,
    to: DateTime<Utc>,
    excluded_category_ids: Vec<Uuid>,
) -> Result<Vec<CategoryCurrencyTotal>, ApiError> {
    let sql = format!(
        "SELECT t.category_id, a.currency, SUM(-t.amount) AS total \
         FROM transactions t JOIN accounts a ON a.id = t.account_id \
         WHERE {LIVE_NON_TRANSFER} AND t.amount < 0 AND t.date >= $3 AND t.date <= $4 \
         GROUP BY 1, 2"
    );
    run(pool, "spend_by_category", move |conn| {
        diesel::sql_query(sql)
            .bind::<DieselUuid, _>(user_id)
            .bind::<Array<DieselUuid>, _>(excluded_category_ids)
            .bind::<Timestamptz, _>(from)
            .bind::<Timestamptz, _>(to)
            .load(conn)
    })
    .await
}

/// Income and spend per UTC calendar month and account currency, from
/// `from` onwards.
pub async fn monthly_totals(
    pool: &DbPool,
    user_id: Uuid,
    from: DateTime<Utc>,
    excluded_category_ids: Vec<Uuid>,
) -> Result<Vec<MonthlyCurrencyTotal>, ApiError> {
    let sql = format!(
        "SELECT date_trunc('month', t.date AT TIME ZONE 'UTC')::date AS month, a.currency, \
                COALESCE(SUM(t.amount) FILTER (WHERE t.amount > 0), 0) AS income, \
                COALESCE(SUM(-t.amount) FILTER (WHERE t.amount < 0), 0) AS spend \
         FROM transactions t JOIN accounts a ON a.id = t.account_id \
         WHERE {LIVE_NON_TRANSFER} AND t.date >= $3 \
         GROUP BY 1, 2 ORDER BY 1"
    );
    run(pool, "monthly_totals", move |conn| {
        diesel::sql_query(sql)
            .bind::<DieselUuid, _>(user_id)
            .bind::<Array<DieselUuid>, _>(excluded_category_ids)
            .bind::<Timestamptz, _>(from)
            .load(conn)
    })
    .await
}

/// Per-account daily sums of every live transaction dated on or after
/// `since` (all categories, transfers included: this feeds balances).
pub async fn account_daily_sums_since(
    pool: &DbPool,
    user_id: Uuid,
    since: DateTime<Utc>,
) -> Result<Vec<AccountDailyTotal>, ApiError> {
    run(pool, "account_daily_sums_since", move |conn| {
        diesel::sql_query(
            "SELECT t.account_id, (t.date AT TIME ZONE 'UTC')::date AS day, \
                    SUM(t.amount) AS total \
             FROM transactions t JOIN accounts a ON a.id = t.account_id \
             WHERE a.user_id = $1 AND t.is_deleted = false AND t.date >= $2 \
             GROUP BY 1, 2",
        )
        .bind::<DieselUuid, _>(user_id)
        .bind::<Timestamptz, _>(since)
        .load(conn)
    })
    .await
}
