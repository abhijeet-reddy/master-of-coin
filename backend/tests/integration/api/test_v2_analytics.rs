//! UI v2 analytics series: net-worth-history, monthly, spending-trend.

use super::v2_helpers::*;
use crate::common::*;
use chrono::{Datelike, Duration, Months, NaiveDate, Utc};
use serde_json::{Value, json};

fn noon(day: NaiveDate) -> String {
    day.and_hms_opt(12, 0, 0).unwrap().and_utc().to_rfc3339()
}

fn today() -> NaiveDate {
    Utc::now().date_naive()
}

async fn excluded_category(server: &axum_test::TestServer, token: &str) -> Value {
    let category = create_category(server, token, "Internal").await;
    let response = put_authenticated(
        server,
        &format!("/api/v1/categories/{}", str_of(&category, "id")),
        token,
        &json!({"is_excluded_from_analysis": true}),
    )
    .await;
    assert_status(&response, 200);
    category
}

async fn transfer(server: &axum_test::TestServer, token: &str, from: &str, to: &str, amount: f64) {
    let response = post_authenticated(
        server,
        "/api/v1/transfers",
        token,
        &json!({
            "from_account_id": from,
            "to_account_id": to,
            "from_amount": amount,
            "date": Utc::now().to_rfc3339(),
        }),
    )
    .await;
    assert_status(&response, 201);
}

async fn get_series(server: &axum_test::TestServer, token: &str, path: &str) -> Vec<Value> {
    let response = get_authenticated(server, path, token).await;
    assert_status(&response, 200);
    extract_json(response)
}

// ============================================================================
// Net worth history
// ============================================================================

#[tokio::test]
async fn test_net_worth_history_reconstructs_past_balances() {
    let server = create_test_server().await;
    let user = new_user(&server, "nwhist").await;
    let checking = create_account(&server, user.token(), "Current", "CHECKING", "EUR").await;
    let savings = create_account(&server, user.token(), "Pot", "SAVINGS", "EUR").await;
    let t = today();

    // (days ago, account, amount)
    let txs: Vec<(i64, &Value, f64)> = vec![
        (60, &checking, 1000.0),
        (20, &savings, 500.0),
        (10, &checking, -200.0),
    ];
    for (ago, account, amount) in &txs {
        create_tx(
            &server,
            user.token(),
            str_of(account, "id"),
            *amount,
            &noon(t - Duration::days(*ago)),
            None,
        )
        .await;
    }

    let from = t - Duration::days(90);
    let path = format!(
        "/api/v1/analytics/net-worth-history?from={}&to={}&interval=week",
        from, t
    );
    let series = get_series(&server, user.token(), &path).await;

    // Weekly points from `from`, always ending on `to`.
    assert_eq!(series[0]["date"], json!(from.to_string()));
    assert_eq!(series.last().unwrap()["date"], json!(t.to_string()));
    assert_eq!(series.len(), 90 / 7 + 1 + usize::from(90 % 7 != 0));

    for point in &series {
        let date = NaiveDate::parse_from_str(str_of(point, "date"), "%Y-%m-%d").unwrap();
        let mut expected_checking = 0.0;
        let mut expected_savings = 0.0;
        for (ago, account, amount) in &txs {
            if t - Duration::days(*ago) <= date {
                if account["id"] == checking["id"] {
                    expected_checking += amount;
                } else {
                    expected_savings += amount;
                }
            }
        }
        let by_type = &point["by_type"];
        assert_eq!(
            dec(by_type, "CHECKING"),
            dec_str(&expected_checking.to_string()),
            "{point}"
        );
        assert_eq!(
            dec(by_type, "SAVINGS"),
            dec_str(&expected_savings.to_string()),
            "{point}"
        );
        assert_eq!(
            dec(point, "total"),
            dec_str(&(expected_checking + expected_savings).to_string()),
            "{point}"
        );
    }

    // Money values are 2dp strings.
    assert_eq!(series.last().unwrap()["total"], json!("1300.00"));
}

#[tokio::test]
async fn test_net_worth_history_defaults_to_monthly_last_year() {
    let server = create_test_server().await;
    let user = new_user(&server, "nwdef").await;
    create_account(&server, user.token(), "Current", "CHECKING", "EUR").await;

    let series = get_series(&server, user.token(), "/api/v1/analytics/net-worth-history").await;
    assert_eq!(series.len(), 13);
    let t = today();
    assert_eq!(series.last().unwrap()["date"], json!(t.to_string()));
    assert_eq!(
        series[0]["date"],
        json!(t.checked_sub_months(Months::new(12)).unwrap().to_string())
    );
}

// ============================================================================
// Monthly
// ============================================================================

#[tokio::test]
async fn test_monthly_totals_skip_transfers_and_excluded_categories() {
    let server = create_test_server().await;
    let user = new_user(&server, "monthly").await;
    let a = create_account(&server, user.token(), "A", "CHECKING", "EUR").await;
    let b = create_account(&server, user.token(), "B", "SAVINGS", "EUR").await;
    let excluded = excluded_category(&server, user.token()).await;
    let now = Utc::now().to_rfc3339();
    let a_id = str_of(&a, "id");

    create_tx(&server, user.token(), a_id, 1000.0, &now, None).await;
    create_tx(&server, user.token(), a_id, -200.0, &now, None).await;
    create_tx(
        &server,
        user.token(),
        a_id,
        -50.0,
        &now,
        Some(str_of(&excluded, "id")),
    )
    .await;
    transfer(&server, user.token(), a_id, str_of(&b, "id"), 300.0).await;

    let last_month = today().with_day(1).unwrap() - Duration::days(10);
    create_tx(&server, user.token(), a_id, -100.0, &noon(last_month), None).await;

    let series = get_series(&server, user.token(), "/api/v1/analytics/monthly?months=3").await;
    assert_eq!(series.len(), 3);

    let first = today()
        .with_day(1)
        .unwrap()
        .checked_sub_months(Months::new(2))
        .unwrap();
    assert_eq!(series[0]["month"], json!(first.format("%Y-%m").to_string()));
    assert_eq!(series[0]["income"], json!("0.00"));
    assert_eq!(series[0]["spend"], json!("0.00"));

    assert_eq!(
        series[1]["month"],
        json!(last_month.format("%Y-%m").to_string())
    );
    assert_eq!(dec(&series[1], "spend"), dec_str("100"));
    assert_eq!(dec(&series[1], "net"), dec_str("-100"));

    assert_eq!(
        series[2]["month"],
        json!(today().format("%Y-%m").to_string())
    );
    assert_eq!(dec(&series[2], "income"), dec_str("1000"));
    assert_eq!(dec(&series[2], "spend"), dec_str("200"));
    assert_eq!(dec(&series[2], "net"), dec_str("800"));

    // Default is 12 months.
    let series = get_series(&server, user.token(), "/api/v1/analytics/monthly").await;
    assert_eq!(series.len(), 12);
}

// ============================================================================
// Spending trend
// ============================================================================

#[tokio::test]
async fn test_spending_trend_is_zero_filled_daily_spend() {
    let server = create_test_server().await;
    let user = new_user(&server, "trend").await;
    let a = create_account(&server, user.token(), "A", "CHECKING", "EUR").await;
    let b = create_account(&server, user.token(), "B", "SAVINGS", "EUR").await;
    let excluded = excluded_category(&server, user.token()).await;
    let a_id = str_of(&a, "id");
    let t = today();

    create_tx(
        &server,
        user.token(),
        a_id,
        -30.0,
        &noon(t - Duration::days(2)),
        None,
    )
    .await;
    create_tx(
        &server,
        user.token(),
        a_id,
        -20.0,
        &Utc::now().to_rfc3339(),
        None,
    )
    .await;
    create_tx(
        &server,
        user.token(),
        a_id,
        500.0,
        &Utc::now().to_rfc3339(),
        None,
    )
    .await;
    create_tx(
        &server,
        user.token(),
        a_id,
        -99.0,
        &noon(t - Duration::days(1)),
        Some(str_of(&excluded, "id")),
    )
    .await;
    transfer(&server, user.token(), a_id, str_of(&b, "id"), 75.0).await;

    let from = t - Duration::days(4);
    let path = format!("/api/v1/analytics/spending-trend?from={}&to={}", from, t);
    let series = get_series(&server, user.token(), &path).await;
    let amounts: Vec<&str> = series.iter().map(|p| str_of(p, "amount")).collect();
    assert_eq!(amounts, vec!["0.00", "0.00", "30.00", "0.00", "20.00"]);
    let dates: Vec<String> = (0..5)
        .map(|d| (from + Duration::days(d)).to_string())
        .collect();
    let got: Vec<&str> = series.iter().map(|p| str_of(p, "date")).collect();
    assert_eq!(got, dates);

    // Default window is the last 30 days.
    let series = get_series(&server, user.token(), "/api/v1/analytics/spending-trend").await;
    assert_eq!(series.len(), 30);
    assert_eq!(series.last().unwrap()["date"], json!(t.to_string()));
}

// ============================================================================
// Validation and scope
// ============================================================================

#[tokio::test]
async fn test_analytics_validation() {
    let server = create_test_server().await;
    let user = new_user(&server, "anval").await;

    for path in [
        "/api/v1/analytics/net-worth-history?from=2025-06-01&to=2025-01-01",
        "/api/v1/analytics/net-worth-history?from=2000-01-01&to=2030-01-01&interval=week",
        "/api/v1/analytics/monthly?months=0",
        "/api/v1/analytics/monthly?months=121",
        "/api/v1/analytics/spending-trend?from=2025-06-01&to=2025-01-01",
        "/api/v1/analytics/spending-trend?from=2020-01-01&to=2025-01-01",
    ] {
        let response = get_authenticated(&server, path, user.token()).await;
        assert_eq!(response.status_code().as_u16(), 422, "{path}");
    }

    let response = get_authenticated(
        &server,
        "/api/v1/analytics/net-worth-history?interval=day",
        user.token(),
    )
    .await;
    assert!(response.status_code().is_client_error());
}

#[tokio::test]
async fn test_analytics_require_transactions_read_scope() {
    let server = create_test_server().await;
    let user = new_user(&server, "anscope").await;
    let without = api_key(&server, user.token(), scopes(&[("accounts", "r")])).await;
    let with = api_key(&server, user.token(), scopes(&[("transactions", "r")])).await;

    for path in [
        "/api/v1/analytics/net-worth-history",
        "/api/v1/analytics/monthly",
        "/api/v1/analytics/spending-trend",
    ] {
        assert_eq!(
            get_authenticated(&server, path, &without)
                .await
                .status_code()
                .as_u16(),
            403,
            "{path}"
        );
        assert_eq!(
            get_authenticated(&server, path, &with)
                .await
                .status_code()
                .as_u16(),
            200,
            "{path}"
        );
    }
}
