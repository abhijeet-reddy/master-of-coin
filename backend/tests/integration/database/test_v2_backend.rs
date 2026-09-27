//! UI v2 repository and service logic tested directly: the archive filter,
//! preferences upsert and defaults, active-range picking, and the
//! net-worth-history arithmetic.

use super::common;
use bigdecimal::BigDecimal;
use chrono::{Duration, NaiveDate, Utc};
use master_of_coin_backend::{
    models::{
        Account, BudgetRange, NewAccount,
        user_preferences::{NewUserPreferences, UpdateUserPreferencesRequest},
    },
    repositories::{self, analytics::AccountDailyTotal},
    services::{
        analytics_service::{self, HistoryInterval},
        mock_exchange_rate::MockExchangeRateProvider,
        preferences_service,
    },
    types::{AccountType, BudgetPeriod, CurrencyCode},
};
use std::{collections::HashMap, str::FromStr};
use uuid::Uuid;

fn d(s: &str) -> NaiveDate {
    NaiveDate::parse_from_str(s, "%Y-%m-%d").unwrap()
}

fn dec(s: &str) -> BigDecimal {
    BigDecimal::from_str(s).unwrap()
}

fn user(pool: &master_of_coin_backend::DbPool, label: &str) -> common::UserCleanup {
    let mut conn = pool.get().unwrap();
    let user = common::create_test_user(&mut conn, label).unwrap();
    common::UserCleanup {
        pool: pool.clone(),
        user_id: user.id,
    }
}

// ============================================================================
// Archive filter
// ============================================================================

#[tokio::test]
async fn test_list_visible_by_user_hides_archived_and_debt() {
    let pool = common::get_test_db_pool();
    let guard = user(&pool, "v2arch");
    let uid = guard.user_id;

    let mut ids = Vec::new();
    for (name, account_type) in [
        ("Live", AccountType::Checking),
        ("Closed", AccountType::Savings),
        ("Debt", AccountType::Debt),
    ] {
        let account = repositories::account::create_account(
            &pool,
            uid,
            NewAccount {
                user_id: uid,
                name: name.to_string(),
                account_type,
                currency: CurrencyCode::Eur,
                notes: None,
            },
        )
        .await
        .unwrap();
        ids.push(account.id);
    }
    let archived = repositories::account::set_archived_at(&pool, ids[1], Some(Utc::now()))
        .await
        .unwrap();
    assert!(!archived.is_active());

    let visible: Vec<Uuid> = repositories::account::list_visible_by_user(&pool, uid, false)
        .await
        .unwrap()
        .iter()
        .map(|a| a.id)
        .collect();
    assert_eq!(visible, vec![ids[0]]);

    let mut all: Vec<Uuid> = repositories::account::list_visible_by_user(&pool, uid, true)
        .await
        .unwrap()
        .iter()
        .map(|a| a.id)
        .collect();
    all.sort();
    let mut expected = vec![ids[0], ids[1]];
    expected.sort();
    assert_eq!(all, expected);

    let restored = repositories::account::set_archived_at(&pool, ids[1], None)
        .await
        .unwrap();
    assert!(restored.is_active());
}

// ============================================================================
// Preferences
// ============================================================================

#[tokio::test]
async fn test_preferences_defaults_upsert_and_merge() {
    let pool = common::get_test_db_pool();
    let guard = user(&pool, "v2prefs");
    let uid = guard.user_id;

    assert!(
        repositories::user_preferences::find(&pool, uid)
            .await
            .unwrap()
            .is_none()
    );
    let defaults = repositories::user_preferences::get_or_default(&pool, uid)
        .await
        .unwrap();
    assert_eq!(defaults.default_currency, CurrencyCode::Eur);
    assert!(defaults.updated_at.is_none());
    assert_eq!(
        preferences_service::user_primary_currency(&pool, uid).await,
        CurrencyCode::Eur
    );

    let row = repositories::user_preferences::upsert(
        &pool,
        NewUserPreferences {
            user_id: uid,
            default_currency: CurrencyCode::Gbp,
            date_format: "YYYY-MM-DD".to_string(),
            number_locale: "de-DE".to_string(),
            week_start: 7,
        },
    )
    .await
    .unwrap();
    assert_eq!(row.default_currency, CurrencyCode::Gbp);

    // A second upsert replaces rather than duplicating.
    let row = repositories::user_preferences::upsert(
        &pool,
        NewUserPreferences {
            user_id: uid,
            default_currency: CurrencyCode::Usd,
            date_format: "YYYY-MM-DD".to_string(),
            number_locale: "de-DE".to_string(),
            week_start: 7,
        },
    )
    .await
    .unwrap();
    assert_eq!(row.default_currency, CurrencyCode::Usd);
    assert_eq!(
        preferences_service::user_primary_currency(&pool, uid).await,
        CurrencyCode::Usd
    );
    assert_eq!(
        preferences_service::user_week_start(&pool, uid).await,
        chrono::Weekday::Sun
    );

    // Partial update through the service keeps the other fields.
    let merged = preferences_service::update_preferences(
        &pool,
        uid,
        UpdateUserPreferencesRequest {
            default_currency: None,
            date_format: None,
            number_locale: None,
            week_start: Some(1),
        },
    )
    .await
    .unwrap();
    assert_eq!(merged.default_currency, CurrencyCode::Usd);
    assert_eq!(merged.number_locale, "de-DE");
    assert_eq!(merged.week_start, 1);
}

// ============================================================================
// Active range
// ============================================================================

fn range(start: &str, end: Option<&str>) -> BudgetRange {
    BudgetRange {
        id: Uuid::new_v4(),
        budget_id: Uuid::nil(),
        limit_amount: dec("100"),
        period: BudgetPeriod::Monthly,
        start_date: d(start),
        end_date: end.map(d),
        created_at: Utc::now(),
        updated_at: Utc::now(),
    }
}

#[test]
fn test_pick_active_range() {
    // Ordered start_date DESC like the repository returns them.
    let ranges = vec![
        range("2025-07-01", None),
        range("2025-01-01", Some("2025-06-30")),
        range("2024-01-01", Some("2024-06-30")),
    ];
    let pick = |date: &str| {
        repositories::budget::pick_active_range(&ranges, d(date)).map(|r| r.start_date)
    };
    assert_eq!(pick("2026-03-01"), Some(d("2025-07-01")));
    assert_eq!(pick("2025-07-01"), Some(d("2025-07-01")));
    assert_eq!(pick("2025-06-30"), Some(d("2025-01-01")));
    assert_eq!(pick("2024-03-15"), Some(d("2024-01-01")));
    assert_eq!(pick("2024-09-01"), None);
    assert_eq!(pick("2023-12-31"), None);
}

// ============================================================================
// Net worth history arithmetic
// ============================================================================

#[test]
fn test_series_points() {
    let points =
        analytics_service::series_points(d("2025-01-31"), d("2025-04-15"), HistoryInterval::Month)
            .unwrap();
    assert_eq!(
        points,
        vec![
            d("2025-01-31"),
            d("2025-02-28"),
            d("2025-03-31"),
            d("2025-04-15")
        ]
    );

    let points =
        analytics_service::series_points(d("2025-01-01"), d("2025-01-15"), HistoryInterval::Week)
            .unwrap();
    assert_eq!(
        points,
        vec![d("2025-01-01"), d("2025-01-08"), d("2025-01-15")]
    );

    let single =
        analytics_service::series_points(d("2025-01-01"), d("2025-01-01"), HistoryInterval::Month)
            .unwrap();
    assert_eq!(single, vec![d("2025-01-01")]);

    assert!(
        analytics_service::series_points(d("2000-01-01"), d("2030-01-01"), HistoryInterval::Week)
            .is_err()
    );
}

fn account(account_type: AccountType) -> Account {
    Account {
        id: Uuid::new_v4(),
        user_id: Uuid::nil(),
        name: "a".to_string(),
        account_type,
        currency: CurrencyCode::Eur,
        notes: None,
        created_at: Utc::now(),
        updated_at: Utc::now(),
        archived_at: None,
    }
}

#[tokio::test]
async fn test_net_worth_series_subtracts_later_activity() {
    let checking = account(AccountType::Checking);
    let card = account(AccountType::CreditCard);
    let balances = HashMap::from([(checking.id, dec("1000")), (card.id, dec("-150.555"))]);
    let today = d("2025-03-31");
    let daily = vec![
        AccountDailyTotal {
            account_id: checking.id,
            day: today - Duration::days(5),
            total: dec("300"),
        },
        AccountDailyTotal {
            account_id: checking.id,
            day: d("2025-02-15"),
            total: dec("-100"),
        },
        AccountDailyTotal {
            account_id: card.id,
            day: d("2025-03-01"),
            total: dec("-50"),
        },
    ];
    let points = vec![d("2025-01-31"), d("2025-02-28"), d("2025-03-26"), today];

    let series = analytics_service::net_worth_series(
        &[checking, card],
        &balances,
        &daily,
        &points,
        CurrencyCode::Eur,
        &MockExchangeRateProvider::new(),
    )
    .await
    .unwrap();

    let totals: Vec<&str> = series.iter().map(|p| p.total.as_str()).collect();
    // Jan 31: 1000 - 300 + 100 = 800 checking; -150.555 + 50 = -100.555 card.
    assert_eq!(totals, vec!["699.45", "599.45", "849.45", "849.45"]);
    assert_eq!(series[0].by_type["CHECKING"], "800.00");
    assert_eq!(series[0].by_type["CREDIT_CARD"], "-100.56");
    assert_eq!(series[1].by_type["CHECKING"], "700.00");
    assert_eq!(series[3].by_type["CHECKING"], "1000.00");
    assert_eq!(series[3].by_type["CREDIT_CARD"], "-150.56");
    assert_eq!(series[3].date, today);
}
