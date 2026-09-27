//! UI v2 account endpoints: archive / unarchive, the `include_archived`
//! filter, account type validation, archived accounts in net worth, and the
//! sync refusal for archived accounts.

use super::v2_helpers::*;
use crate::common::*;
use serde_json::{Value, json};

async fn archive(server: &axum_test::TestServer, token: &str, id: &str) -> axum_test::TestResponse {
    post_authenticated(
        server,
        &format!("/api/v1/accounts/{}/archive", id),
        token,
        &json!({}),
    )
    .await
}

async fn list_ids(server: &axum_test::TestServer, token: &str, path: &str) -> Vec<String> {
    let response = get_authenticated(server, path, token).await;
    assert_status(&response, 200);
    let accounts: Vec<Value> = extract_json(response);
    accounts
        .iter()
        .map(|a| a["id"].as_str().unwrap().to_string())
        .collect()
}

#[tokio::test]
async fn test_archive_and_unarchive_account() {
    let server = create_test_server().await;
    let user = new_user(&server, "arch").await;
    let account = create_account(&server, user.token(), "Old card", "CREDIT_CARD", "EUR").await;
    let id = str_of(&account, "id").to_string();
    assert_eq!(account["is_active"], json!(true));
    assert!(account["archived_at"].is_null());

    let response = archive(&server, user.token(), &id).await;
    assert_status(&response, 200);
    let archived: Value = extract_json(response);
    assert_eq!(archived["is_active"], json!(false));
    assert!(archived["archived_at"].is_string());

    // Idempotent: archiving again keeps it archived.
    let again = archive(&server, user.token(), &id).await;
    assert_status(&again, 200);
    let again: Value = extract_json(again);
    assert_eq!(again["archived_at"], archived["archived_at"]);

    // Hidden by default, visible with include_archived=true.
    assert!(
        !list_ids(&server, user.token(), "/api/v1/accounts")
            .await
            .contains(&id)
    );
    assert!(
        list_ids(
            &server,
            user.token(),
            "/api/v1/accounts?include_archived=true"
        )
        .await
        .contains(&id)
    );

    let response = post_authenticated(
        &server,
        &format!("/api/v1/accounts/{}/unarchive", id),
        user.token(),
        &json!({}),
    )
    .await;
    assert_status(&response, 200);
    let restored: Value = extract_json(response);
    assert_eq!(restored["is_active"], json!(true));
    assert!(restored["archived_at"].is_null());
    assert!(
        list_ids(&server, user.token(), "/api/v1/accounts")
            .await
            .contains(&id)
    );
}

#[tokio::test]
async fn test_update_is_active_archives_account() {
    let server = create_test_server().await;
    let user = new_user(&server, "isact").await;
    let account = create_account(&server, user.token(), "Savings", "SAVINGS", "EUR").await;
    let id = str_of(&account, "id");

    let response = put_authenticated(
        &server,
        &format!("/api/v1/accounts/{}", id),
        user.token(),
        &json!({"is_active": false}),
    )
    .await;
    assert_status(&response, 200);
    let updated: Value = extract_json(response);
    assert_eq!(updated["is_active"], json!(false));
    assert!(updated["archived_at"].is_string());

    let response = put_authenticated(
        &server,
        &format!("/api/v1/accounts/{}", id),
        user.token(),
        &json!({"is_active": true}),
    )
    .await;
    assert_status(&response, 200);
    let updated: Value = extract_json(response);
    assert_eq!(updated["is_active"], json!(true));
}

#[tokio::test]
async fn test_archive_other_users_account_is_404() {
    let server = create_test_server().await;
    let owner = new_user(&server, "archown").await;
    let other = new_user(&server, "archoth").await;
    let account = create_account(&server, owner.token(), "Mine", "CHECKING", "EUR").await;
    let id = str_of(&account, "id");

    assert_status(&archive(&server, other.token(), id).await, 404);
    let response = post_authenticated(
        &server,
        &format!("/api/v1/accounts/{}/unarchive", id),
        other.token(),
        &json!({}),
    )
    .await;
    assert_status(&response, 404);
    assert_status(
        &archive(&server, owner.token(), &uuid::Uuid::new_v4().to_string()).await,
        404,
    );
}

#[tokio::test]
async fn test_archive_requires_accounts_write_scope() {
    let server = create_test_server().await;
    let user = new_user(&server, "archscope").await;
    let account = create_account(&server, user.token(), "Cash", "CASH", "EUR").await;
    let id = str_of(&account, "id");

    let read_only = api_key(&server, user.token(), scopes(&[("accounts", "r")])).await;
    assert_status(&archive(&server, &read_only, id).await, 403);

    let writer = api_key(&server, user.token(), scopes(&[("accounts", "rw")])).await;
    assert_status(&archive(&server, &writer, id).await, 200);
}

#[tokio::test]
async fn test_account_type_validation() {
    let server = create_test_server().await;
    let user = new_user(&server, "types").await;

    let response = post_authenticated(
        &server,
        "/api/v1/accounts",
        user.token(),
        &json!({"name": "Mortgage", "account_type": "LOAN", "currency": "EUR"}),
    )
    .await;
    assert_status(&response, 422);

    let gift = create_account(&server, user.token(), "Voucher", "GIFT_CARD", "EUR").await;
    assert_eq!(gift["account_type"], json!("GIFT_CARD"));
}

#[tokio::test]
async fn test_archived_account_counts_toward_net_worth() {
    let server = create_test_server().await;
    let user = new_user(&server, "archnw").await;
    let a = create_account(&server, user.token(), "Live", "CHECKING", "EUR").await;
    let b = create_account(&server, user.token(), "Closed", "SAVINGS", "EUR").await;
    let now = chrono::Utc::now().to_rfc3339();
    create_tx(&server, user.token(), str_of(&a, "id"), 100.0, &now, None).await;
    create_tx(&server, user.token(), str_of(&b, "id"), 250.0, &now, None).await;
    assert_status(&archive(&server, user.token(), str_of(&b, "id")).await, 200);

    let response = get_authenticated(&server, "/api/v1/dashboard", user.token()).await;
    assert_status(&response, 200);
    let dashboard: Value = extract_json(response);
    assert_eq!(dec(&dashboard, "net_worth"), dec_str("350"));
    assert_eq!(dashboard["currency"], json!("EUR"));
}

#[tokio::test]
async fn test_portfolio_sync_refuses_archived_account() {
    let server = create_test_server().await;
    let user = new_user(&server, "archsync").await;
    let other = new_user(&server, "archsync2").await;
    let account = create_account(&server, user.token(), "Broker", "INVESTMENT", "EUR").await;
    let id = str_of(&account, "id");
    assert_status(&archive(&server, user.token(), id).await, 200);

    let response = post_authenticated(
        &server,
        "/api/v1/portfolio-sync",
        user.token(),
        &json!({"account_id": id}),
    )
    .await;
    assert_status(&response, 422);
    assert!(response.text().contains("archived"));

    let response = post_authenticated(
        &server,
        "/api/v1/portfolio-sync",
        other.token(),
        &json!({"account_id": id}),
    )
    .await;
    assert_status(&response, 404);
}
