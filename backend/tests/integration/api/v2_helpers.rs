//! Shared helpers for the UI v2 endpoint tests.

use crate::common::*;
use axum_test::{TestResponse, TestServer};
use master_of_coin_backend::models::{
    ApiKeyScopes, AuthResponse, CreateApiKeyRequest, CreateApiKeyResponse, ScopePermission,
};
use serde_json::{Value, json};
use uuid::Uuid;

/// A registered user whose rows are hard-deleted when this is dropped.
pub struct TestUser {
    pub auth: AuthResponse,
    _cleanup: UserCleanup,
}

impl TestUser {
    pub fn token(&self) -> &str {
        &self.auth.token
    }

    pub fn id(&self) -> Uuid {
        self.auth.user.id
    }
}

pub async fn new_user(server: &TestServer, label: &str) -> TestUser {
    let unique = Uuid::new_v4().simple().to_string();
    let short = &unique[..12];
    let auth = register_test_user(
        server,
        &format!("v2_{}_{}", label, short),
        &format!("v2_{}_{}@example.com", label, short),
        "SecurePass123!",
        &format!("V2 {}", label),
    )
    .await;
    let cleanup = UserCleanup {
        pool: get_test_db_pool(),
        user_id: auth.user.id,
    };
    TestUser {
        auth,
        _cleanup: cleanup,
    }
}

/// Scope builder: `scopes(&[("transactions", "rw"), ("accounts", "r")])`.
pub fn scopes(spec: &[(&str, &str)]) -> ApiKeyScopes {
    let perms = |s: &str| {
        let mut v = Vec::new();
        if s.contains('r') {
            v.push(ScopePermission::Read);
        }
        if s.contains('w') {
            v.push(ScopePermission::Write);
        }
        v
    };
    let mut out = ApiKeyScopes {
        transactions: vec![],
        accounts: vec![],
        budgets: vec![],
        categories: vec![],
        people: vec![],
    };
    for (resource, p) in spec {
        let v = perms(p);
        match *resource {
            "transactions" => out.transactions = v,
            "accounts" => out.accounts = v,
            "budgets" => out.budgets = v,
            "categories" => out.categories = v,
            "people" => out.people = v,
            other => panic!("unknown resource {other}"),
        }
    }
    out
}

pub async fn api_key(server: &TestServer, token: &str, scopes: ApiKeyScopes) -> String {
    let request = CreateApiKeyRequest {
        name: format!("v2 test key {}", Uuid::new_v4().simple()),
        scopes,
        expires_in_days: Some(1),
    };
    let response = post_authenticated(server, "/api/v1/api-keys", token, &request).await;
    assert_status(&response, 201);
    let created: CreateApiKeyResponse = extract_json(response);
    created.key
}

pub async fn patch_authenticated(
    server: &TestServer,
    path: &str,
    token: &str,
    body: &Value,
) -> TestResponse {
    server
        .patch(path)
        .add_header("Authorization", format!("Bearer {}", token))
        .json(body)
        .await
}

pub async fn create_account(
    server: &TestServer,
    token: &str,
    name: &str,
    account_type: &str,
    currency: &str,
) -> Value {
    let response = post_authenticated(
        server,
        "/api/v1/accounts",
        token,
        &json!({"name": name, "account_type": account_type, "currency": currency}),
    )
    .await;
    assert_status(&response, 201);
    extract_json(response)
}

pub async fn create_category(server: &TestServer, token: &str, name: &str) -> Value {
    let response =
        post_authenticated(server, "/api/v1/categories", token, &json!({"name": name})).await;
    assert_status(&response, 201);
    extract_json(response)
}

/// Create a transaction; `date` is RFC 3339.
pub async fn create_tx(
    server: &TestServer,
    token: &str,
    account_id: &str,
    amount: f64,
    date: &str,
    category_id: Option<&str>,
) -> Value {
    let response = post_authenticated(
        server,
        "/api/v1/transactions",
        token,
        &json!({
            "account_id": account_id,
            "category_id": category_id,
            "title": format!("tx {}", amount),
            "amount": amount,
            "date": date,
        }),
    )
    .await;
    assert_status(&response, 201);
    extract_json(response)
}

pub async fn create_budget(server: &TestServer, token: &str, name: &str, filters: Value) -> Value {
    let response = post_authenticated(
        server,
        "/api/v1/budgets",
        token,
        &json!({"name": name, "filters": filters}),
    )
    .await;
    assert_status(&response, 201);
    extract_json(response)
}

pub async fn add_range(
    server: &TestServer,
    token: &str,
    budget_id: &str,
    limit: f64,
    period: &str,
    start: &str,
    end: Option<&str>,
) -> TestResponse {
    post_authenticated(
        server,
        &format!("/api/v1/budgets/{}/ranges", budget_id),
        token,
        &json!({
            "limit_amount": limit,
            "period": period,
            "start_date": start,
            "end_date": end,
        }),
    )
    .await
}

pub fn str_of<'a>(v: &'a Value, key: &str) -> &'a str {
    v[key]
        .as_str()
        .unwrap_or_else(|| panic!("{key} missing or not a string in {v}"))
}

pub fn dec(v: &Value, key: &str) -> bigdecimal::BigDecimal {
    use std::str::FromStr;
    bigdecimal::BigDecimal::from_str(str_of(v, key)).unwrap()
}

pub fn dec_str(s: &str) -> bigdecimal::BigDecimal {
    use std::str::FromStr;
    bigdecimal::BigDecimal::from_str(s).unwrap()
}
