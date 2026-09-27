//! UI v2 budget endpoints: range overlap (409), range GET/PUT/DELETE,
//! last-range protection, and spend/status on GET /budgets.

use super::v2_helpers::*;
use crate::common::*;
use chrono::{Datelike, Utc};
use serde_json::{Value, json};

fn month_start() -> chrono::NaiveDate {
    Utc::now().date_naive().with_day(1).unwrap()
}

async fn category_budget(
    server: &axum_test::TestServer,
    token: &str,
    limit: f64,
) -> (Value, Value, Value) {
    let category = create_category(server, token, "Groceries").await;
    let account = create_account(server, token, "Main", "CHECKING", "EUR").await;
    let budget = create_budget(
        server,
        token,
        "Food",
        json!({"category_id": str_of(&category, "id")}),
    )
    .await;
    let response = add_range(
        server,
        token,
        str_of(&budget, "id"),
        limit,
        "MONTHLY",
        &month_start().to_string(),
        None,
    )
    .await;
    assert_status(&response, 201);
    (budget, category, account)
}

async fn list_budgets(server: &axum_test::TestServer, token: &str) -> Vec<Value> {
    let response = get_authenticated(server, "/api/v1/budgets", token).await;
    assert_status(&response, 200);
    extract_json(response)
}

// ============================================================================
// Range overlap and CRUD
// ============================================================================

#[tokio::test]
async fn test_add_range_rejects_overlap_but_allows_adjacent() {
    let server = create_test_server().await;
    let user = new_user(&server, "overlap").await;
    let budget = create_budget(&server, user.token(), "Overall", json!({})).await;
    let id = str_of(&budget, "id");

    let r = add_range(
        &server,
        user.token(),
        id,
        100.0,
        "MONTHLY",
        "2025-01-01",
        Some("2025-03-31"),
    )
    .await;
    assert_status(&r, 201);

    let r = add_range(
        &server,
        user.token(),
        id,
        100.0,
        "MONTHLY",
        "2025-03-31",
        Some("2025-06-30"),
    )
    .await;
    assert_status(&r, 409);

    let r = add_range(
        &server,
        user.token(),
        id,
        100.0,
        "MONTHLY",
        "2025-04-01",
        None,
    )
    .await;
    assert_status(&r, 201);

    // Anything after an open-ended range overlaps it.
    let r = add_range(
        &server,
        user.token(),
        id,
        100.0,
        "MONTHLY",
        "2030-01-01",
        Some("2030-12-31"),
    )
    .await;
    assert_status(&r, 409);

    let r = add_range(
        &server,
        user.token(),
        id,
        100.0,
        "MONTHLY",
        "2025-02-01",
        Some("2025-01-01"),
    )
    .await;
    assert_status(&r, 422);
}

#[tokio::test]
async fn test_range_list_update_delete() {
    let server = create_test_server().await;
    let user = new_user(&server, "ranges").await;
    let budget = create_budget(&server, user.token(), "Overall", json!({})).await;
    let id = str_of(&budget, "id");

    let first: Value = extract_json(
        add_range(
            &server,
            user.token(),
            id,
            100.0,
            "MONTHLY",
            "2025-01-01",
            Some("2025-06-30"),
        )
        .await,
    );
    let second: Value = extract_json(
        add_range(
            &server,
            user.token(),
            id,
            200.0,
            "WEEKLY",
            "2025-07-01",
            None,
        )
        .await,
    );

    let response = get_authenticated(
        &server,
        &format!("/api/v1/budgets/{}/ranges", id),
        user.token(),
    )
    .await;
    assert_status(&response, 200);
    let ranges: Vec<Value> = extract_json(response);
    assert_eq!(ranges.len(), 2);
    // Newest start first.
    assert_eq!(ranges[0]["id"], second["id"]);
    assert_eq!(ranges[1]["id"], first["id"]);

    // Full replacement update.
    let path = format!("/api/v1/budgets/{}/ranges/{}", id, str_of(&first, "id"));
    let response = put_authenticated(
        &server,
        &path,
        user.token(),
        &json!({"limit_amount": 150.0, "period": "QUARTERLY", "start_date": "2025-01-01", "end_date": "2025-05-31"}),
    )
    .await;
    assert_status(&response, 200);
    let updated: Value = extract_json(response);
    assert_eq!(dec(&updated, "limit_amount"), dec_str("150"));
    assert_eq!(updated["period"], json!("QUARTERLY"));
    assert_eq!(updated["end_date"], json!("2025-05-31"));

    // Updating into the other range conflicts; updating onto itself does not.
    let response = put_authenticated(
        &server,
        &path,
        user.token(),
        &json!({"limit_amount": 150.0, "period": "MONTHLY", "start_date": "2025-01-01", "end_date": "2025-07-15"}),
    )
    .await;
    assert_status(&response, 409);

    let response = put_authenticated(
        &server,
        &path,
        user.token(),
        &json!({"limit_amount": 0, "period": "MONTHLY", "start_date": "2025-01-01", "end_date": null}),
    )
    .await;
    assert_status(&response, 422);

    // Delete one, then the last one is protected.
    assert_status(
        &delete_authenticated(&server, &path, user.token()).await,
        204,
    );
    let last = format!("/api/v1/budgets/{}/ranges/{}", id, str_of(&second, "id"));
    assert_status(
        &delete_authenticated(&server, &last, user.token()).await,
        422,
    );
    assert_status(
        &delete_authenticated(&server, &path, user.token()).await,
        404,
    );
}

#[tokio::test]
async fn test_range_endpoints_ownership_404() {
    let server = create_test_server().await;
    let owner = new_user(&server, "rangeown").await;
    let other = new_user(&server, "rangeoth").await;
    let budget = create_budget(&server, owner.token(), "Mine", json!({})).await;
    let id = str_of(&budget, "id");
    let range: Value = extract_json(
        add_range(
            &server,
            owner.token(),
            id,
            100.0,
            "MONTHLY",
            "2025-01-01",
            None,
        )
        .await,
    );
    let range_path = format!("/api/v1/budgets/{}/ranges/{}", id, str_of(&range, "id"));
    let body = json!({"limit_amount": 1.0, "period": "MONTHLY", "start_date": "2025-01-01", "end_date": null});

    assert_status(
        &get_authenticated(
            &server,
            &format!("/api/v1/budgets/{}/ranges", id),
            other.token(),
        )
        .await,
        404,
    );
    assert_status(
        &put_authenticated(&server, &range_path, other.token(), &body).await,
        404,
    );
    assert_status(
        &delete_authenticated(&server, &range_path, other.token()).await,
        404,
    );

    // A range id that belongs to a different budget of the same user.
    let second = create_budget(&server, owner.token(), "Second", json!({})).await;
    let wrong = format!(
        "/api/v1/budgets/{}/ranges/{}",
        str_of(&second, "id"),
        str_of(&range, "id")
    );
    assert_status(
        &put_authenticated(&server, &wrong, owner.token(), &body).await,
        404,
    );
}

#[tokio::test]
async fn test_range_endpoints_scope() {
    let server = create_test_server().await;
    let user = new_user(&server, "rangescope").await;
    let budget = create_budget(&server, user.token(), "Mine", json!({})).await;
    let id = str_of(&budget, "id");
    let range: Value = extract_json(
        add_range(
            &server,
            user.token(),
            id,
            100.0,
            "MONTHLY",
            "2025-01-01",
            None,
        )
        .await,
    );
    let range_path = format!("/api/v1/budgets/{}/ranges/{}", id, str_of(&range, "id"));
    let body = json!({"limit_amount": 5.0, "period": "MONTHLY", "start_date": "2025-01-01", "end_date": null});

    let reader = api_key(&server, user.token(), scopes(&[("budgets", "r")])).await;
    assert_status(
        &get_authenticated(&server, &format!("/api/v1/budgets/{}/ranges", id), &reader).await,
        200,
    );
    assert_status(
        &put_authenticated(&server, &range_path, &reader, &body).await,
        403,
    );
    assert_status(
        &delete_authenticated(&server, &range_path, &reader).await,
        403,
    );

    let none = api_key(&server, user.token(), scopes(&[("transactions", "r")])).await;
    assert_status(
        &get_authenticated(&server, &format!("/api/v1/budgets/{}/ranges", id), &none).await,
        403,
    );

    let writer = api_key(&server, user.token(), scopes(&[("budgets", "rw")])).await;
    assert_status(
        &put_authenticated(&server, &range_path, &writer, &body).await,
        200,
    );
}

// ============================================================================
// GET /budgets spend and status
// ============================================================================

#[tokio::test]
async fn test_list_budgets_includes_spend_and_status() {
    let server = create_test_server().await;
    let user = new_user(&server, "budspend").await;
    let (budget, category, account) = category_budget(&server, user.token(), 100.0).await;
    let now = Utc::now().to_rfc3339();

    let budgets = list_budgets(&server, user.token()).await;
    let b = budgets.iter().find(|b| b["id"] == budget["id"]).unwrap();
    assert_eq!(dec(b, "current_spending"), dec_str("0"));
    assert_eq!(b["status"], json!("on_track"));
    assert_eq!(b["currency"], json!("EUR"));
    assert!(b["days_left"].as_i64().unwrap() >= 1);
    assert!(b["active_range"].is_object());

    let cat = str_of(&category, "id");
    let acc = str_of(&account, "id");
    create_tx(&server, user.token(), acc, -50.0, &now, Some(cat)).await;
    // Other categories and income do not count.
    create_tx(&server, user.token(), acc, -999.0, &now, None).await;
    create_tx(&server, user.token(), acc, 500.0, &now, Some(cat)).await;

    let budgets = list_budgets(&server, user.token()).await;
    let b = budgets.iter().find(|b| b["id"] == budget["id"]).unwrap();
    assert_eq!(dec(b, "current_spending"), dec_str("50"));
    assert_eq!(dec(b, "remaining"), dec_str("50"));
    assert_eq!(b["percentage_used"].as_f64().unwrap().round(), 50.0);
    assert_eq!(b["status"], json!("on_track"));

    create_tx(&server, user.token(), acc, -35.0, &now, Some(cat)).await;
    let budgets = list_budgets(&server, user.token()).await;
    let b = budgets.iter().find(|b| b["id"] == budget["id"]).unwrap();
    assert_eq!(b["status"], json!("warning"));

    let over = create_tx(&server, user.token(), acc, -20.0, &now, Some(cat)).await;
    let budgets = list_budgets(&server, user.token()).await;
    let b = budgets.iter().find(|b| b["id"] == budget["id"]).unwrap();
    assert_eq!(b["status"], json!("over"));
    assert_eq!(dec(b, "remaining"), dec_str("-5"));

    // Soft-deleted transactions stop counting.
    assert_status(
        &delete_authenticated(
            &server,
            &format!("/api/v1/transactions/{}", str_of(&over, "id")),
            user.token(),
        )
        .await,
        200,
    );
    let budgets = list_budgets(&server, user.token()).await;
    let b = budgets.iter().find(|b| b["id"] == budget["id"]).unwrap();
    assert_eq!(dec(b, "current_spending"), dec_str("85"));
}

#[tokio::test]
async fn test_active_range_is_the_one_covering_today() {
    let server = create_test_server().await;
    let user = new_user(&server, "budactive").await;
    let budget = create_budget(&server, user.token(), "Overall", json!({})).await;
    let id = str_of(&budget, "id");
    let today = Utc::now().date_naive();
    let past_end = today - chrono::Duration::days(40);

    let r = add_range(
        &server,
        user.token(),
        id,
        10.0,
        "MONTHLY",
        "2020-01-01",
        Some(&past_end.to_string()),
    )
    .await;
    assert_status(&r, 201);
    let current: Value = extract_json(
        add_range(
            &server,
            user.token(),
            id,
            20.0,
            "MONTHLY",
            &(past_end + chrono::Duration::days(1)).to_string(),
            None,
        )
        .await,
    );

    let budgets = list_budgets(&server, user.token()).await;
    let b = budgets.iter().find(|b| b["id"] == budget["id"]).unwrap();
    assert_eq!(b["active_range"]["id"], current["id"]);

    let response =
        get_authenticated(&server, &format!("/api/v1/budgets/{}", id), user.token()).await;
    assert_status(&response, 200);
    let single: Value = extract_json(response);
    assert_eq!(single["active_range"]["id"], current["id"]);
}

#[tokio::test]
async fn test_dashboard_budget_statuses_use_real_periods() {
    let server = create_test_server().await;
    let user = new_user(&server, "buddash").await;
    let (budget, category, account) = category_budget(&server, user.token(), 200.0).await;
    let now = Utc::now().to_rfc3339();
    create_tx(
        &server,
        user.token(),
        str_of(&account, "id"),
        -40.0,
        &now,
        Some(str_of(&category, "id")),
    )
    .await;

    let response = get_authenticated(&server, "/api/v1/dashboard", user.token()).await;
    assert_status(&response, 200);
    let dashboard: Value = extract_json(response);
    let statuses = dashboard["budget_statuses"].as_array().unwrap();
    assert_eq!(statuses.len(), 1);
    let s = &statuses[0];
    assert_eq!(s["budget_id"], budget["id"]);
    assert_eq!(dec(s, "current_spending"), dec_str("40"));
    assert_eq!(s["period_start"], json!(month_start().to_string()));
    assert_eq!(s["status"], json!("on_track"));
}
