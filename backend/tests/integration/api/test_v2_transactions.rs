//! UI v2 transaction endpoints: list filters (comma-separated ids,
//! `category_id=uncategorised`, `paid_by_others`), bulk delete, and the
//! CORS exposure of `X-Total-Count`.

use super::v2_helpers::*;
use crate::common::*;
use serde_json::{Value, json};
use std::collections::HashSet;

fn ids(list: &[Value]) -> HashSet<String> {
    list.iter()
        .map(|t| t["id"].as_str().unwrap().to_string())
        .collect()
}

async fn list(server: &axum_test::TestServer, token: &str, query: &str) -> (Vec<Value>, i64) {
    let response =
        get_authenticated(server, &format!("/api/v1/transactions?{}", query), token).await;
    assert_status(&response, 200);
    let total: i64 = response
        .headers()
        .get("x-total-count")
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.parse().ok())
        .expect("X-Total-Count header");
    (extract_json(response), total)
}

// ============================================================================
// Filters
// ============================================================================

#[tokio::test]
async fn test_filter_by_comma_separated_account_and_category_ids() {
    let server = create_test_server().await;
    let user = new_user(&server, "txfilter").await;
    let now = chrono::Utc::now().to_rfc3339();
    let a = create_account(&server, user.token(), "A", "CHECKING", "EUR").await;
    let b = create_account(&server, user.token(), "B", "SAVINGS", "EUR").await;
    let c = create_account(&server, user.token(), "C", "CASH", "EUR").await;
    let food = create_category(&server, user.token(), "Food").await;
    let fun = create_category(&server, user.token(), "Fun").await;

    let t_a = create_tx(
        &server,
        user.token(),
        str_of(&a, "id"),
        -10.0,
        &now,
        Some(str_of(&food, "id")),
    )
    .await;
    let t_b = create_tx(
        &server,
        user.token(),
        str_of(&b, "id"),
        -20.0,
        &now,
        Some(str_of(&fun, "id")),
    )
    .await;
    let t_c = create_tx(&server, user.token(), str_of(&c, "id"), -30.0, &now, None).await;

    let (rows, total) = list(
        &server,
        user.token(),
        &format!("account_id={},{}", str_of(&a, "id"), str_of(&b, "id")),
    )
    .await;
    assert_eq!(total, 2);
    assert_eq!(
        ids(&rows),
        HashSet::from([
            str_of(&t_a, "id").to_string(),
            str_of(&t_b, "id").to_string()
        ])
    );

    let (rows, total) = list(&server, user.token(), "category_id=uncategorised").await;
    assert_eq!(total, 1);
    assert_eq!(ids(&rows), HashSet::from([str_of(&t_c, "id").to_string()]));

    // Uncategorised combined with a real category id.
    let (rows, total) = list(
        &server,
        user.token(),
        &format!("category_id={},uncategorised", str_of(&food, "id")),
    )
    .await;
    assert_eq!(total, 2);
    assert_eq!(
        ids(&rows),
        HashSet::from([
            str_of(&t_a, "id").to_string(),
            str_of(&t_c, "id").to_string()
        ])
    );
}

#[tokio::test]
async fn test_filter_with_foreign_ids_is_404_and_bad_ids_rejected() {
    let server = create_test_server().await;
    let user = new_user(&server, "txforeign").await;
    let other = new_user(&server, "txforeign2").await;
    let mine = create_account(&server, user.token(), "Mine", "CHECKING", "EUR").await;
    let theirs = create_account(&server, other.token(), "Theirs", "CHECKING", "EUR").await;
    let their_cat = create_category(&server, other.token(), "Theirs").await;

    let path = format!(
        "/api/v1/transactions?account_id={},{}",
        str_of(&mine, "id"),
        str_of(&theirs, "id")
    );
    assert_status(&get_authenticated(&server, &path, user.token()).await, 404);

    let path = format!(
        "/api/v1/transactions?category_id={}",
        str_of(&their_cat, "id")
    );
    assert_status(&get_authenticated(&server, &path, user.token()).await, 404);

    let response = get_authenticated(
        &server,
        "/api/v1/transactions?account_id=not-a-uuid",
        user.token(),
    )
    .await;
    assert!(response.status_code().is_client_error());
}

#[tokio::test]
async fn test_filter_paid_by_others() {
    let server = create_test_server().await;
    let user = new_user(&server, "txpaid").await;
    let account = create_account(&server, user.token(), "Main", "CHECKING", "EUR").await;
    let now = chrono::Utc::now().to_rfc3339();
    let mine = create_tx(
        &server,
        user.token(),
        str_of(&account, "id"),
        -12.0,
        &now,
        None,
    )
    .await;
    let person = create_test_person(&server, user.token(), "Alex").await;

    let response = post_authenticated(
        &server,
        "/api/v1/debt-transactions",
        user.token(),
        &json!({
            "payer_person_id": person.id,
            "currency": "EUR",
            "title": "Dinner paid by Alex",
            "amount": -40.0,
            "date": now,
        }),
    )
    .await;
    assert_status(&response, 201);
    let paid: Value = extract_json(response);

    let (rows, total) = list(&server, user.token(), "paid_by_others=only").await;
    assert_eq!(total, 1);
    assert_eq!(ids(&rows), HashSet::from([str_of(&paid, "id").to_string()]));

    let (rows, _) = list(&server, user.token(), "paid_by_others=exclude").await;
    let got = ids(&rows);
    assert!(got.contains(str_of(&mine, "id")));
    assert!(!got.contains(str_of(&paid, "id")));

    let response = get_authenticated(
        &server,
        "/api/v1/transactions?paid_by_others=maybe",
        user.token(),
    )
    .await;
    assert!(response.status_code().is_client_error());
}

// ============================================================================
// Bulk delete
// ============================================================================

#[tokio::test]
async fn test_bulk_delete_success_and_partial_failures() {
    let server = create_test_server().await;
    let user = new_user(&server, "bulk").await;
    let other = new_user(&server, "bulk2").await;
    let now = chrono::Utc::now().to_rfc3339();
    let account = create_account(&server, user.token(), "Main", "CHECKING", "EUR").await;
    let foreign_account = create_account(&server, other.token(), "Other", "CHECKING", "EUR").await;
    let t1 = create_tx(
        &server,
        user.token(),
        str_of(&account, "id"),
        -1.0,
        &now,
        None,
    )
    .await;
    let t2 = create_tx(
        &server,
        user.token(),
        str_of(&account, "id"),
        -2.0,
        &now,
        None,
    )
    .await;
    let keep = create_tx(
        &server,
        user.token(),
        str_of(&account, "id"),
        -3.0,
        &now,
        None,
    )
    .await;
    let foreign = create_tx(
        &server,
        other.token(),
        str_of(&foreign_account, "id"),
        -4.0,
        &now,
        None,
    )
    .await;
    let missing = uuid::Uuid::new_v4().to_string();

    let response = post_authenticated(
        &server,
        "/api/v1/transactions/bulk-delete",
        user.token(),
        &json!({"ids": [str_of(&t1, "id"), str_of(&t2, "id"), str_of(&foreign, "id"), missing]}),
    )
    .await;
    assert_status(&response, 200);
    let body: Value = extract_json(response);
    assert_eq!(body["deleted"], json!(2));
    let deleted: HashSet<String> = body["deleted_ids"]
        .as_array()
        .unwrap()
        .iter()
        .map(|v| v.as_str().unwrap().to_string())
        .collect();
    assert_eq!(
        deleted,
        HashSet::from([str_of(&t1, "id").to_string(), str_of(&t2, "id").to_string()])
    );
    assert_eq!(body["failed"].as_array().unwrap().len(), 2);

    // Deleting again reports the rows as already deleted.
    let response = post_authenticated(
        &server,
        "/api/v1/transactions/bulk-delete",
        user.token(),
        &json!({"ids": [str_of(&t1, "id")]}),
    )
    .await;
    let body: Value = extract_json(response);
    assert_eq!(body["deleted"], json!(0));
    assert!(
        body["failed"][0]["error"]
            .as_str()
            .unwrap()
            .contains("already deleted")
    );

    let (rows, _) = list(&server, user.token(), "").await;
    assert_eq!(ids(&rows), HashSet::from([str_of(&keep, "id").to_string()]));

    // The other user's transaction is untouched.
    let (rows, _) = list(&server, other.token(), "").await;
    assert!(ids(&rows).contains(str_of(&foreign, "id")));
}

#[tokio::test]
async fn test_bulk_delete_includes_transfer_partner_leg() {
    let server = create_test_server().await;
    let user = new_user(&server, "bulkxfer").await;
    let a = create_account(&server, user.token(), "A", "CHECKING", "EUR").await;
    let b = create_account(&server, user.token(), "B", "SAVINGS", "EUR").await;
    let response = post_authenticated(
        &server,
        "/api/v1/transfers",
        user.token(),
        &json!({
            "from_account_id": str_of(&a, "id"),
            "to_account_id": str_of(&b, "id"),
            "from_amount": 50.0,
            "date": chrono::Utc::now().to_rfc3339(),
        }),
    )
    .await;
    assert_status(&response, 201);
    let transfer: Value = extract_json(response);
    let from_id = transfer["from_transaction"]["id"]
        .as_str()
        .unwrap()
        .to_string();
    let to_id = transfer["to_transaction"]["id"]
        .as_str()
        .unwrap()
        .to_string();

    let response = post_authenticated(
        &server,
        "/api/v1/transactions/bulk-delete",
        user.token(),
        &json!({"ids": [from_id]}),
    )
    .await;
    assert_status(&response, 200);
    let body: Value = extract_json(response);
    assert_eq!(body["deleted"], json!(2));
    let deleted: HashSet<String> = body["deleted_ids"]
        .as_array()
        .unwrap()
        .iter()
        .map(|v| v.as_str().unwrap().to_string())
        .collect();
    assert_eq!(deleted, HashSet::from([from_id, to_id]));
}

#[tokio::test]
async fn test_bulk_delete_validation() {
    let server = create_test_server().await;
    let user = new_user(&server, "bulkval").await;

    let response = post_authenticated(
        &server,
        "/api/v1/transactions/bulk-delete",
        user.token(),
        &json!({"ids": []}),
    )
    .await;
    assert_status(&response, 422);

    let too_many: Vec<String> = (0..501).map(|_| uuid::Uuid::new_v4().to_string()).collect();
    let response = post_authenticated(
        &server,
        "/api/v1/transactions/bulk-delete",
        user.token(),
        &json!({"ids": too_many}),
    )
    .await;
    assert_status(&response, 422);
}

#[tokio::test]
async fn test_bulk_delete_requires_transactions_write_scope() {
    let server = create_test_server().await;
    let user = new_user(&server, "bulkscope").await;
    let account = create_account(&server, user.token(), "Main", "CHECKING", "EUR").await;
    let now = chrono::Utc::now().to_rfc3339();
    let t = create_tx(
        &server,
        user.token(),
        str_of(&account, "id"),
        -5.0,
        &now,
        None,
    )
    .await;
    let body = json!({"ids": [str_of(&t, "id")]});

    let reader = api_key(&server, user.token(), scopes(&[("transactions", "r")])).await;
    let response =
        post_authenticated(&server, "/api/v1/transactions/bulk-delete", &reader, &body).await;
    assert_status(&response, 403);

    let writer = api_key(&server, user.token(), scopes(&[("transactions", "rw")])).await;
    let response =
        post_authenticated(&server, "/api/v1/transactions/bulk-delete", &writer, &body).await;
    assert_status(&response, 200);
}

// ============================================================================
// CORS
// ============================================================================

#[tokio::test]
async fn test_cors_exposes_total_count_and_allows_patch() {
    let app = axum::Router::new()
        .route("/probe", axum::routing::get(|| async { "ok" }))
        .layer(master_of_coin_backend::middleware::cors::create_cors_layer());
    let server = axum_test::TestServer::new(app).unwrap();

    let response = server
        .get("/probe")
        .add_header("Origin", "http://localhost:3000")
        .await;
    let exposed = response
        .headers()
        .get("access-control-expose-headers")
        .and_then(|v| v.to_str().ok())
        .unwrap_or_default()
        .to_ascii_lowercase();
    assert!(exposed.contains("x-total-count"), "exposed: {exposed}");

    let preflight = server
        .method(axum::http::Method::OPTIONS, "/probe")
        .add_header("Origin", "http://localhost:3000")
        .add_header("Access-Control-Request-Method", "PATCH")
        .await;
    let methods = preflight
        .headers()
        .get("access-control-allow-methods")
        .and_then(|v| v.to_str().ok())
        .unwrap_or_default()
        .to_string();
    assert!(methods.contains("PATCH"), "methods: {methods}");
}
