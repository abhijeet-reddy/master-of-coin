//! API endpoint integration tests for CSV import
//!
//! These tests verify the import endpoints work correctly with actual file uploads

use axum_test::multipart::{MultipartForm, Part};
use serde_json::json;

#[path = "../common/mod.rs"]
mod common;

use common::{auth_helpers::register_unique_test_user, test_server::create_test_server};

#[tokio::test]
async fn test_import_parse_requires_authentication() {
    let server = create_test_server().await;

    // Create CSV file
    let csv_content = b"id,time,merchant,type,amount,card
TEST123,2026-01-03 03:27:50,Amazon,Purchase,\xE2\x82\xAC-10.00,\xE2\x80\xA2\xE2\x80\xA2\xE2\x80\xA2\xE2\x80\xA2 2133";

    // Create multipart form
    let file_part = Part::bytes(csv_content.to_vec())
        .file_name("test.csv")
        .mime_type("text/csv");

    let form = MultipartForm::new()
        .add_part("account_id", Part::text(uuid::Uuid::new_v4().to_string()))
        .add_part("file", file_part);

    // Try to upload without authentication
    let response = server
        .post("/api/v1/transactions/import/parse")
        .multipart(form)
        .await;

    // Should return unauthorized
    assert_eq!(response.status_code(), 401);
}

#[tokio::test]
async fn test_import_parse_with_valid_csv() {
    let server = create_test_server().await;
    // Use short timestamp for uniqueness (avoids 50 char username limit)
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_nanos();
    let auth = register_unique_test_user(&server, &format!("imp_{}", timestamp)).await;

    // Create test account
    let account_response = server
        .post("/api/v1/accounts")
        .add_header(
            "Authorization".parse::<http::HeaderName>().unwrap(),
            format!("Bearer {}", auth.token)
                .parse::<http::HeaderValue>()
                .unwrap(),
        )
        .json(&json!({
            "name": "Test Account",
            "account_type": "CHECKING",
        }))
        .await;

    assert_eq!(account_response.status_code(), 201);
    let account: serde_json::Value = account_response.json();
    let account_id = account["id"].as_str().unwrap();

    // Create CSV file
    let csv_content = b"id,time,merchant,type,amount,card
TEST123,2026-01-03 03:27:50,Amazon.co.uk,Purchase,\xE2\x82\xAC-108.12,\xE2\x80\xA2\xE2\x80\xA2\xE2\x80\xA2\xE2\x80\xA2 2133
TEST456,2026-01-02 12:18:23,TESCO,Purchase,\xE2\x82\xAC-23.84,\xE2\x80\xA2\xE2\x80\xA2\xE2\x80\xA2\xE2\x80\xA2 2133";

    // Create multipart form
    let file_part = Part::bytes(csv_content.to_vec())
        .file_name("statement.csv")
        .mime_type("text/csv");

    let form = MultipartForm::new()
        .add_part("account_id", Part::text(account_id.to_string()))
        .add_part("file", file_part);

    // Upload CSV
    let response = server
        .post("/api/v1/transactions/import/parse")
        .add_header(
            "Authorization".parse::<http::HeaderName>().unwrap(),
            format!("Bearer {}", auth.token)
                .parse::<http::HeaderValue>()
                .unwrap(),
        )
        .multipart(form)
        .await;

    assert_eq!(response.status_code(), 200);

    let parse_response: serde_json::Value = response.json();
    assert_eq!(parse_response["success"], true);
    assert_eq!(
        parse_response["data"]["transactions"]
            .as_array()
            .unwrap()
            .len(),
        2
    );
    assert_eq!(parse_response["data"]["summary"]["total"], 2);
    assert_eq!(parse_response["data"]["summary"]["expenses"], 2);
}

#[tokio::test]
async fn test_import_parse_invalid_account() {
    let server = create_test_server().await;
    // Use short timestamp for uniqueness (avoids 50 char username limit)
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_nanos();
    let auth = register_unique_test_user(&server, &format!("inv_{}", timestamp)).await;

    // Create CSV file
    let csv_content = b"id,time,merchant,type,amount,card
TEST123,2026-01-03 03:27:50,Amazon,Purchase,\xE2\x82\xAC-10.00,\xE2\x80\xA2\xE2\x80\xA2\xE2\x80\xA2\xE2\x80\xA2 2133";

    // Create multipart form with non-existent account
    let file_part = Part::bytes(csv_content.to_vec())
        .file_name("test.csv")
        .mime_type("text/csv");

    let form = MultipartForm::new()
        .add_part("account_id", Part::text(uuid::Uuid::new_v4().to_string()))
        .add_part("file", file_part);

    // Try to upload for non-existent account
    let response = server
        .post("/api/v1/transactions/import/parse")
        .add_header(
            "Authorization".parse::<http::HeaderName>().unwrap(),
            format!("Bearer {}", auth.token)
                .parse::<http::HeaderValue>()
                .unwrap(),
        )
        .multipart(form)
        .await;

    // Should return not found
    assert_eq!(response.status_code(), 404);
}
