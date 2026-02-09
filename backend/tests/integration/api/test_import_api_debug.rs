//! Debug test to check registration response

use axum_test::TestServer;

#[path = "../common/mod.rs"]
mod common;

use common::test_server::create_test_server;

#[tokio::test]
async fn debug_registration_response() {
    let server = create_test_server().await;

    let request = serde_json::json!({
        "username": "debuguser",
        "email": "debug@example.com",
        "password": "password123",
        "name": "Debug User"
    });

    let response = server.post("/api/v1/auth/register").json(&request).await;

    println!("Status: {}", response.status_code());
    println!("Response text: {}", response.text());
}
