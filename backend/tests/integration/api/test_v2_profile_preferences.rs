//! UI v2 profile and preferences endpoints: PATCH /auth/me,
//! POST /auth/change-password, GET/PUT /preferences.

use super::v2_helpers::*;
use crate::common::*;
use serde_json::{Value, json};

// ============================================================================
// Preferences
// ============================================================================

#[tokio::test]
async fn test_preferences_defaults_then_partial_updates_merge() {
    let server = create_test_server().await;
    let user = new_user(&server, "prefs").await;

    let response = get_authenticated(&server, "/api/v1/preferences", user.token()).await;
    assert_status(&response, 200);
    let prefs: Value = extract_json(response);
    assert_eq!(prefs["default_currency"], json!("EUR"));
    assert_eq!(prefs["date_format"], json!("DD/MM/YYYY"));
    assert_eq!(prefs["number_locale"], json!("en-US"));
    assert_eq!(prefs["week_start"], json!(1));
    assert!(prefs["updated_at"].is_null());

    let response = put_authenticated(
        &server,
        "/api/v1/preferences",
        user.token(),
        &json!({"default_currency": "USD", "week_start": 7}),
    )
    .await;
    assert_status(&response, 200);
    let prefs: Value = extract_json(response);
    assert_eq!(prefs["default_currency"], json!("USD"));
    assert_eq!(prefs["week_start"], json!(7));
    assert_eq!(prefs["date_format"], json!("DD/MM/YYYY"));
    assert!(prefs["updated_at"].is_string());

    // A second partial update keeps the earlier values.
    let response = put_authenticated(
        &server,
        "/api/v1/preferences",
        user.token(),
        &json!({"date_format": "YYYY-MM-DD"}),
    )
    .await;
    assert_status(&response, 200);
    let response = get_authenticated(&server, "/api/v1/preferences", user.token()).await;
    let prefs: Value = extract_json(response);
    assert_eq!(prefs["default_currency"], json!("USD"));
    assert_eq!(prefs["week_start"], json!(7));
    assert_eq!(prefs["date_format"], json!("YYYY-MM-DD"));
}

#[tokio::test]
async fn test_preferences_validation() {
    let server = create_test_server().await;
    let user = new_user(&server, "prefval").await;

    for body in [
        json!({"date_format": "YY/MM"}),
        json!({"number_locale": "xx-XX"}),
        json!({"week_start": 3}),
        json!({"default_currency": "ZZZ"}),
    ] {
        let response = put_authenticated(&server, "/api/v1/preferences", user.token(), &body).await;
        assert_status(&response, 422);
    }
}

#[tokio::test]
async fn test_preferences_are_per_user() {
    let server = create_test_server().await;
    let a = new_user(&server, "prefa").await;
    let b = new_user(&server, "prefb").await;

    let response = put_authenticated(
        &server,
        "/api/v1/preferences",
        a.token(),
        &json!({"default_currency": "GBP"}),
    )
    .await;
    assert_status(&response, 200);

    let prefs: Value =
        extract_json(get_authenticated(&server, "/api/v1/preferences", b.token()).await);
    assert_eq!(prefs["default_currency"], json!("EUR"));
}

#[tokio::test]
async fn test_preferences_write_rejects_api_keys() {
    let server = create_test_server().await;
    let user = new_user(&server, "prefkey").await;
    let key = api_key(
        &server,
        user.token(),
        scopes(&[
            ("transactions", "rw"),
            ("accounts", "rw"),
            ("budgets", "rw"),
            ("categories", "rw"),
            ("people", "rw"),
        ]),
    )
    .await;

    let response = get_authenticated(&server, "/api/v1/preferences", &key).await;
    assert_status(&response, 200);
    let response = put_authenticated(
        &server,
        "/api/v1/preferences",
        &key,
        &json!({"week_start": 7}),
    )
    .await;
    assert_status(&response, 403);
}

#[tokio::test]
async fn test_default_currency_drives_dashboard_totals() {
    let server = create_test_server().await;
    let user = new_user(&server, "prefdash").await;
    let account = create_account(&server, user.token(), "Main", "CHECKING", "EUR").await;
    let now = chrono::Utc::now().to_rfc3339();
    create_tx(
        &server,
        user.token(),
        str_of(&account, "id"),
        100.0,
        &now,
        None,
    )
    .await;

    let dashboard: Value =
        extract_json(get_authenticated(&server, "/api/v1/dashboard", user.token()).await);
    assert_eq!(dashboard["currency"], json!("EUR"));
    assert_eq!(dec(&dashboard, "net_worth"), dec_str("100"));

    let response = put_authenticated(
        &server,
        "/api/v1/preferences",
        user.token(),
        &json!({"default_currency": "USD"}),
    )
    .await;
    assert_status(&response, 200);

    let dashboard: Value =
        extract_json(get_authenticated(&server, "/api/v1/dashboard", user.token()).await);
    assert_eq!(dashboard["currency"], json!("USD"));
    assert_ne!(dec(&dashboard, "net_worth"), dec_str("100"));

    // Exchange rates default to the preferred currency as base.
    let rates: Value =
        extract_json(get_authenticated(&server, "/api/v1/exchange-rates", user.token()).await);
    assert_eq!(rates["base_code"], json!("USD"));
}

// ============================================================================
// Profile
// ============================================================================

#[tokio::test]
async fn test_patch_me_updates_name_and_email() {
    let server = create_test_server().await;
    let user = new_user(&server, "profile").await;
    let new_email = format!("renamed_{}@example.com", uuid::Uuid::new_v4().simple());

    let response = patch_authenticated(
        &server,
        "/api/v1/auth/me",
        user.token(),
        &json!({"name": "New Name", "email": new_email}),
    )
    .await;
    assert_status(&response, 200);
    let me: Value = extract_json(response);
    assert_eq!(me["name"], json!("New Name"));
    assert_eq!(me["email"], json!(new_email));

    let me: Value = extract_json(get_authenticated(&server, "/api/v1/auth/me", user.token()).await);
    assert_eq!(me["name"], json!("New Name"));
}

#[tokio::test]
async fn test_patch_me_validation_and_conflict() {
    let server = create_test_server().await;
    let user = new_user(&server, "profval").await;
    let other = new_user(&server, "profoth").await;

    for body in [json!({"name": "   "}), json!({"email": "not-an-email"})] {
        let response = patch_authenticated(&server, "/api/v1/auth/me", user.token(), &body).await;
        assert_status(&response, 422);
    }

    let response = patch_authenticated(
        &server,
        "/api/v1/auth/me",
        user.token(),
        &json!({"email": other.auth.user.email}),
    )
    .await;
    assert_status(&response, 409);
}

#[tokio::test]
async fn test_patch_me_rejects_api_keys() {
    let server = create_test_server().await;
    let user = new_user(&server, "profkey").await;
    let key = api_key(&server, user.token(), scopes(&[("accounts", "rw")])).await;

    let response =
        patch_authenticated(&server, "/api/v1/auth/me", &key, &json!({"name": "X"})).await;
    assert_status(&response, 403);
}

// ============================================================================
// Change password
// ============================================================================

#[tokio::test]
async fn test_change_password_flow() {
    let server = create_test_server().await;
    let user = new_user(&server, "pwd").await;
    let email = user.auth.user.email.clone();

    let response = post_authenticated(
        &server,
        "/api/v1/auth/change-password",
        user.token(),
        &json!({"current_password": "wrong-password", "new_password": "AnotherPass456!"}),
    )
    .await;
    assert_status(&response, 422);

    let response = post_authenticated(
        &server,
        "/api/v1/auth/change-password",
        user.token(),
        &json!({"current_password": "SecurePass123!", "new_password": "short"}),
    )
    .await;
    assert_status(&response, 422);

    let response = post_authenticated(
        &server,
        "/api/v1/auth/change-password",
        user.token(),
        &json!({"current_password": "SecurePass123!", "new_password": "AnotherPass456!"}),
    )
    .await;
    assert_status(&response, 204);

    let old = server
        .post("/api/v1/auth/login")
        .json(&json!({"email": email, "password": "SecurePass123!"}))
        .await;
    assert_status(&old, 401);
    let new = server
        .post("/api/v1/auth/login")
        .json(&json!({"email": email, "password": "AnotherPass456!"}))
        .await;
    assert_status(&new, 200);
}

#[tokio::test]
async fn test_change_password_rejects_api_keys() {
    let server = create_test_server().await;
    let user = new_user(&server, "pwdkey").await;
    let key = api_key(&server, user.token(), scopes(&[("accounts", "rw")])).await;

    let response = post_authenticated(
        &server,
        "/api/v1/auth/change-password",
        &key,
        &json!({"current_password": "SecurePass123!", "new_password": "AnotherPass456!"}),
    )
    .await;
    assert_status(&response, 403);
}
