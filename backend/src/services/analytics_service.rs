use bigdecimal::BigDecimal;
use chrono::{DateTime, Datelike, Days, Months, NaiveDate, NaiveTime, Utc};
use std::collections::{BTreeMap, HashMap};
use std::str::FromStr;
use uuid::Uuid;

use crate::{
    DbPool,
    errors::ApiError,
    models::{TransactionFilter, TransactionResponse},
    repositories,
    services::exchange_rate_service::ExchangeRateProvider,
    types::{AccountType, CurrencyCode},
    utils::decimal,
};

use super::preferences_service;

/// Upper bound on generated points for history and trend series.
pub const MAX_SERIES_POINTS: usize = 1000;
/// Upper bound on `months` for the monthly series.
pub const MAX_MONTHS: u32 = 120;

/// Net worth calculation result
#[derive(Debug, serde::Serialize)]
pub struct NetWorth {
    pub total: String,
    pub accounts: Vec<AccountBalance>,
}

#[derive(Debug, serde::Serialize)]
pub struct AccountBalance {
    pub account_id: Uuid,
    pub account_name: String,
    pub balance: String,
}

/// Spending trend data point
#[derive(Debug, serde::Serialize)]
pub struct SpendingTrendPoint {
    pub date: String,
    pub amount: String,
}

/// Category breakdown item
#[derive(Debug, Clone, serde::Serialize)]
pub struct CategoryBreakdown {
    pub category_id: Option<Uuid>,
    pub category_name: Option<String>,
    pub total: String,
    pub percentage: f64,
}

/// Aggregate debt overview for the dashboard
#[derive(Debug, serde::Serialize)]
pub struct DebtOverview {
    pub total_owed_to_me: String,
    pub total_i_owe: String,
}

/// Dashboard summary with all key metrics
#[derive(Debug, serde::Serialize)]
pub struct DashboardSummary {
    pub net_worth: String,
    /// Currency every total in this summary is expressed in (user preference).
    pub currency: CurrencyCode,
    pub recent_transactions: Vec<TransactionResponse>,
    pub budget_statuses: Vec<super::budget_service::BudgetStatus>,
    pub category_breakdown: Vec<CategoryBreakdown>,
    pub top_spending_categories: Vec<CategoryBreakdown>,
    pub debt_overview: DebtOverview,
}

/// One point of `GET /analytics/net-worth-history`.
#[derive(Debug, serde::Serialize)]
pub struct NetWorthPoint {
    pub date: NaiveDate,
    pub total: String,
    /// Totals per account type (SCREAMING_SNAKE keys, e.g. `CHECKING`).
    pub by_type: BTreeMap<String, String>,
}

/// One month of `GET /analytics/monthly`.
#[derive(Debug, serde::Serialize)]
pub struct MonthlyPoint {
    /// `YYYY-MM`
    pub month: String,
    pub income: String,
    pub spend: String,
    pub net: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, serde::Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum HistoryInterval {
    #[default]
    Month,
    Week,
}

/// Per-currency rate cache into one target currency, so a series with many
/// rows asks the provider once per currency.
struct Fx<'a> {
    provider: &'a dyn ExchangeRateProvider,
    target: CurrencyCode,
    rates: HashMap<CurrencyCode, BigDecimal>,
}

impl<'a> Fx<'a> {
    fn new(provider: &'a dyn ExchangeRateProvider, target: CurrencyCode) -> Self {
        Self {
            provider,
            target,
            rates: HashMap::new(),
        }
    }

    async fn convert(
        &mut self,
        amount: &BigDecimal,
        from: CurrencyCode,
    ) -> Result<BigDecimal, ApiError> {
        if from == self.target {
            return Ok(amount.clone());
        }
        if !self.rates.contains_key(&from) {
            let rate = self
                .provider
                .convert_currency(&BigDecimal::from(1), from, self.target)
                .await?;
            self.rates.insert(from, rate);
        }
        Ok(amount * &self.rates[&from])
    }
}

fn start_of_day(date: NaiveDate) -> DateTime<Utc> {
    date.and_time(NaiveTime::MIN).and_utc()
}

fn end_of_day(date: NaiveDate) -> DateTime<Utc> {
    start_of_day(date) + chrono::Duration::days(1) - chrono::Duration::microseconds(1)
}

fn type_key(account_type: AccountType) -> String {
    serde_json::to_value(account_type)
        .ok()
        .and_then(|v| v.as_str().map(str::to_owned))
        .unwrap_or_else(|| format!("{:?}", account_type))
}

/// Calculate net worth: every non-DEBT account (archived included) converted
/// into the user's default currency. Balances come from one grouped query.
pub async fn calculate_net_worth(
    pool: &DbPool,
    user_id: Uuid,
    exchange_provider: &dyn ExchangeRateProvider,
) -> Result<NetWorth, ApiError> {
    let currency = preferences_service::user_primary_currency(pool, user_id).await;
    calculate_net_worth_in(pool, user_id, currency, exchange_provider).await
}

async fn calculate_net_worth_in(
    pool: &DbPool,
    user_id: Uuid,
    currency: CurrencyCode,
    exchange_provider: &dyn ExchangeRateProvider,
) -> Result<NetWorth, ApiError> {
    let accounts = repositories::account::list_by_user_excluding_debt(pool, user_id).await?;
    let balances = repositories::account::balances_by_account(pool, user_id).await?;
    let mut fx = Fx::new(exchange_provider, currency);

    let zero = BigDecimal::from(0);
    let mut account_balances = Vec::with_capacity(accounts.len());
    let mut total = BigDecimal::from(0);

    for account in accounts {
        let balance = balances.get(&account.id).unwrap_or(&zero);
        let converted = fx.convert(balance, account.currency).await?;
        total += &converted;
        account_balances.push(AccountBalance {
            account_id: account.id,
            account_name: account.name,
            balance: converted.to_string(),
        });
    }

    Ok(NetWorth {
        total: total.to_string(),
        accounts: account_balances,
    })
}

/// Net worth at each interval point between `from` and `to` (inclusive; the
/// last point is always `to`). A point's value is today's balance minus every
/// transaction dated after that day, converted at current FX rates.
pub async fn get_net_worth_history(
    pool: &DbPool,
    user_id: Uuid,
    from: NaiveDate,
    to: NaiveDate,
    interval: HistoryInterval,
    exchange_provider: &dyn ExchangeRateProvider,
) -> Result<Vec<NetWorthPoint>, ApiError> {
    if from > to {
        return Err(ApiError::Validation("from must be on or before to".into()));
    }
    let points = series_points(from, to, interval)?;

    let currency = preferences_service::user_primary_currency(pool, user_id).await;
    let accounts = repositories::account::list_by_user_excluding_debt(pool, user_id).await?;
    let balances = repositories::account::balances_by_account(pool, user_id).await?;
    let first_excluded_day = from.succ_opt().unwrap_or(from);
    let daily = repositories::analytics::account_daily_sums_since(
        pool,
        user_id,
        start_of_day(first_excluded_day),
    )
    .await?;

    net_worth_series(
        &accounts,
        &balances,
        &daily,
        &points,
        currency,
        exchange_provider,
    )
    .await
}

/// Pure arithmetic behind [`get_net_worth_history`], exposed for testing.
pub async fn net_worth_series(
    accounts: &[crate::models::Account],
    balances: &HashMap<Uuid, BigDecimal>,
    daily: &[repositories::analytics::AccountDailyTotal],
    points: &[NaiveDate],
    currency: CurrencyCode,
    exchange_provider: &dyn ExchangeRateProvider,
) -> Result<Vec<NetWorthPoint>, ApiError> {
    let mut fx = Fx::new(exchange_provider, currency);
    let zero = BigDecimal::from(0);

    // Per-account daily sums, grouped for the per-point subtraction.
    let mut by_account: HashMap<Uuid, Vec<(NaiveDate, &BigDecimal)>> = HashMap::new();
    for row in daily {
        by_account
            .entry(row.account_id)
            .or_default()
            .push((row.day, &row.total));
    }

    let mut series = Vec::with_capacity(points.len());
    for &point in points {
        let mut total = BigDecimal::from(0);
        let mut by_type: BTreeMap<String, BigDecimal> = BTreeMap::new();

        for account in accounts {
            let mut value = balances.get(&account.id).unwrap_or(&zero).clone();
            if let Some(rows) = by_account.get(&account.id) {
                for (day, amount) in rows {
                    if *day > point {
                        value -= *amount;
                    }
                }
            }
            let converted = fx.convert(&value, account.currency).await?;
            total += &converted;
            *by_type
                .entry(type_key(account.account_type))
                .or_insert_with(|| BigDecimal::from(0)) += converted;
        }

        series.push(NetWorthPoint {
            date: point,
            total: decimal::money_string(&total),
            by_type: by_type
                .into_iter()
                .map(|(k, v)| (k, decimal::money_string(&v)))
                .collect(),
        });
    }
    Ok(series)
}

/// Points from `from` stepping by `interval`, always ending on `to`.
pub fn series_points(
    from: NaiveDate,
    to: NaiveDate,
    interval: HistoryInterval,
) -> Result<Vec<NaiveDate>, ApiError> {
    let mut points = Vec::new();
    let mut step: u32 = 0;
    loop {
        let point = match interval {
            HistoryInterval::Month => from.checked_add_months(Months::new(step)),
            HistoryInterval::Week => from.checked_add_days(Days::new(7 * step as u64)),
        };
        let Some(point) = point.filter(|p| *p <= to) else {
            break;
        };
        points.push(point);
        if points.len() > MAX_SERIES_POINTS {
            return Err(ApiError::Validation(format!(
                "Range produces more than {} points; narrow it or use a wider interval",
                MAX_SERIES_POINTS
            )));
        }
        step += 1;
    }
    if points.last() != Some(&to) {
        points.push(to);
    }
    Ok(points)
}

/// Income and spend per calendar month for the last `months` months
/// (current month included, oldest first, zero-filled). Transfers and
/// categories excluded from analysis are left out.
pub async fn get_monthly(
    pool: &DbPool,
    user_id: Uuid,
    months: u32,
    today: NaiveDate,
    exchange_provider: &dyn ExchangeRateProvider,
) -> Result<Vec<MonthlyPoint>, ApiError> {
    if months == 0 || months > MAX_MONTHS {
        return Err(ApiError::Validation(format!(
            "months must be between 1 and {}",
            MAX_MONTHS
        )));
    }
    let this_month = today.with_day(1).ok_or(ApiError::Internal)?;
    let first_month = this_month
        .checked_sub_months(Months::new(months - 1))
        .ok_or_else(|| ApiError::Validation("months is out of range".into()))?;

    let currency = preferences_service::user_primary_currency(pool, user_id).await;
    let excluded = super::budget_service::excluded_category_ids(pool, user_id).await?;
    let rows =
        repositories::analytics::monthly_totals(pool, user_id, start_of_day(first_month), excluded)
            .await?;

    let mut fx = Fx::new(exchange_provider, currency);
    let mut totals: BTreeMap<NaiveDate, (BigDecimal, BigDecimal)> = BTreeMap::new();
    for m in 0..months {
        if let Some(month) = first_month.checked_add_months(Months::new(m)) {
            totals.insert(month, (BigDecimal::from(0), BigDecimal::from(0)));
        }
    }
    for row in rows {
        // Future-dated rows beyond the current month are ignored.
        if let Some(entry) = totals.get_mut(&row.month) {
            entry.0 += fx.convert(&row.income, row.currency).await?;
            entry.1 += fx.convert(&row.spend, row.currency).await?;
        }
    }

    Ok(totals
        .into_iter()
        .map(|(month, (income, spend))| {
            let net = &income - &spend;
            MonthlyPoint {
                month: month.format("%Y-%m").to_string(),
                income: decimal::money_string(&income),
                spend: decimal::money_string(&spend),
                net: decimal::money_string(&net),
            }
        })
        .collect())
}

/// Daily spend between `from` and `to` inclusive, one zero-filled point per
/// day. Transfers and categories excluded from analysis are left out.
pub async fn get_spending_trend(
    pool: &DbPool,
    user_id: Uuid,
    from: NaiveDate,
    to: NaiveDate,
    exchange_provider: &dyn ExchangeRateProvider,
) -> Result<Vec<SpendingTrendPoint>, ApiError> {
    if from > to {
        return Err(ApiError::Validation("from must be on or before to".into()));
    }
    let days = (to - from).num_days() as usize + 1;
    if days > MAX_SERIES_POINTS {
        return Err(ApiError::Validation(format!(
            "Range is longer than {} days",
            MAX_SERIES_POINTS
        )));
    }

    let currency = preferences_service::user_primary_currency(pool, user_id).await;
    let excluded = super::budget_service::excluded_category_ids(pool, user_id).await?;
    let rows = repositories::analytics::spend_by_day(
        pool,
        user_id,
        start_of_day(from),
        end_of_day(to),
        excluded,
    )
    .await?;

    let mut fx = Fx::new(exchange_provider, currency);
    let mut daily: BTreeMap<NaiveDate, BigDecimal> = from
        .iter_days()
        .take(days)
        .map(|d| (d, BigDecimal::from(0)))
        .collect();
    for row in rows {
        if let Some(total) = daily.get_mut(&row.day) {
            *total += fx.convert(&row.total, row.currency).await?;
        }
    }

    Ok(daily
        .into_iter()
        .map(|(date, amount)| SpendingTrendPoint {
            date: date.format("%Y-%m-%d").to_string(),
            amount: decimal::money_string(&amount),
        })
        .collect())
}

/// Get category breakdown for spending, in the given currency, sorted by
/// total descending. Transfers and excluded categories are left out.
async fn get_category_breakdown(
    pool: &DbPool,
    user_id: Uuid,
    start_date: DateTime<Utc>,
    end_date: DateTime<Utc>,
    currency: CurrencyCode,
    exchange_provider: &dyn ExchangeRateProvider,
) -> Result<Vec<CategoryBreakdown>, ApiError> {
    let categories = repositories::category::list_by_user(pool, user_id).await?;
    let category_names: HashMap<Uuid, String> =
        categories.iter().map(|c| (c.id, c.name.clone())).collect();
    let excluded: Vec<Uuid> = categories
        .iter()
        .filter(|c| c.is_excluded_from_analysis)
        .map(|c| c.id)
        .collect();

    let rows =
        repositories::analytics::spend_by_category(pool, user_id, start_date, end_date, excluded)
            .await?;

    let mut fx = Fx::new(exchange_provider, currency);
    let mut category_totals: HashMap<Option<Uuid>, BigDecimal> = HashMap::new();
    let mut total_spending = BigDecimal::from(0);
    for row in rows {
        let converted = fx.convert(&row.total, row.currency).await?;
        total_spending += &converted;
        *category_totals
            .entry(row.category_id)
            .or_insert_with(|| BigDecimal::from(0)) += converted;
    }

    let mut totals: Vec<(Option<Uuid>, BigDecimal)> = category_totals.into_iter().collect();
    totals.sort_by(|a, b| b.1.cmp(&a.1));

    let zero = BigDecimal::from(0);
    totals
        .into_iter()
        .map(|(category_id, total)| {
            let percentage = if total_spending > zero {
                decimal::to_f64(&(&total / &total_spending))? * 100.0
            } else {
                0.0
            };
            Ok(CategoryBreakdown {
                category_id,
                category_name: category_id.and_then(|id| category_names.get(&id).cloned()),
                total: total.to_string(),
                percentage,
            })
        })
        .collect()
}

/// Get dashboard summary with all key metrics, in the user's default currency.
pub async fn get_dashboard_summary(
    pool: &DbPool,
    user_id: Uuid,
    exchange_provider: &dyn ExchangeRateProvider,
) -> Result<DashboardSummary, ApiError> {
    let end_date = Utc::now();
    let start_date = end_date - chrono::Duration::days(30);
    let currency = preferences_service::user_primary_currency(pool, user_id).await;

    let (net_worth, recent_transactions, budget_statuses, category_breakdown, debt_overview) = tokio::join!(
        calculate_net_worth_in(pool, user_id, currency, exchange_provider),
        get_recent_transactions(pool, user_id),
        super::budget_service::list_budget_statuses(pool, user_id, exchange_provider),
        get_category_breakdown(
            pool,
            user_id,
            start_date,
            end_date,
            currency,
            exchange_provider
        ),
        get_debt_overview(pool, user_id)
    );

    let category_breakdown = category_breakdown?;
    let top_spending_categories = category_breakdown.iter().take(5).cloned().collect();

    Ok(DashboardSummary {
        net_worth: net_worth?.total,
        currency,
        recent_transactions: recent_transactions?,
        budget_statuses: budget_statuses?,
        category_breakdown,
        top_spending_categories,
        debt_overview: debt_overview?,
    })
}

/// Helper: Get recent transactions (last 10)
async fn get_recent_transactions(
    pool: &DbPool,
    user_id: Uuid,
) -> Result<Vec<TransactionResponse>, ApiError> {
    let filter = TransactionFilter {
        limit: Some(10),
        ..Default::default()
    };

    let transactions = repositories::transaction::list_transactions(pool, user_id, filter).await?;

    Ok(transactions
        .into_iter()
        .map(TransactionResponse::from)
        .collect())
}

/// Helper: Get aggregate debt overview (total owed to me and total I owe)
async fn get_debt_overview(pool: &DbPool, user_id: Uuid) -> Result<DebtOverview, ApiError> {
    let debts = super::debt_service::get_all_debts_for_user(pool, user_id).await?;

    let mut total_owed_to_me = BigDecimal::from(0);
    let mut total_i_owe = BigDecimal::from(0);

    for debt in &debts {
        let amount = BigDecimal::from_str(&debt.debt_amount).map_err(|e| {
            tracing::error!("Unparseable debt amount {:?}: {}", debt.debt_amount, e);
            ApiError::Internal
        })?;
        if amount > BigDecimal::from(0) {
            total_owed_to_me += amount;
        } else if amount < BigDecimal::from(0) {
            total_i_owe += amount.abs();
        }
    }

    Ok(DebtOverview {
        total_owed_to_me: total_owed_to_me.to_string(),
        total_i_owe: total_i_owe.to_string(),
    })
}
