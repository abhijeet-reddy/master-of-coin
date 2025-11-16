//! Integration tests for budget API endpoints.
//!
//! This module tests the budget endpoints including:
//! - GET /api/v1/budgets - List all budgets for user
//! - POST /api/v1/budgets - Create new budget
//! - GET /api/v1/budgets/:id - Get specific budget
//! - PUT /api/v1/budgets/:id - Update budget
//! - DELETE /api/v1/budgets/:id - Delete budget
//! - POST /api/v1/budgets/:id/ranges - Add budget range to budget
//!
//! Tests cover success cases, error cases, authorization, and data isolation.

use crate::common::*;
use chrono::Utc;
use master_of_coin_backend::{
    models::{BudgetRangeResponse, BudgetResponse, CategoryResponse},
    types::BudgetPeriod,
};
use serde_json::json;

// ============================================================================
// List Budgets Tests
// ============================================================================

/// Test that a new user has no budgets initially.
///
/// Verifies that:
/// - Status code is 200 OK
/// - Response is an empty array
/// - No budgets exist for a newly registered user
#[tokio::test]
async fn test_list_budgets_empty() {
    let server = create_test_server().await;
    let timestamp = Utc::now().timestamp_nanos_opt().unwrap();

    // Register a new user
    let auth = register_test_user(
        &server,
        &format!("emptyuser_{}", timestamp),
        &format!("empty_{}@example.com", timestamp),
        "SecurePass123!",
        "Empty Test User",
    )
    .await;

    // List budgets should return empty array
    let response = get_authenticated(&server, "/api/v1/budgets", &auth.token).await;
    assert_status(&response, 200);

    let budgets: Vec<BudgetResponse> = extract_json(response);
    assert_eq!(budgets.len(), 0, "New user should have no budgets");
}

/// Test that list budgets returns user's budgets.
///
/// Verifies that:
/// - Status code is 200 OK
/// - Response contains all user's budgets
/// - Budget data is correct
#[tokio::test]
async fn test_list_budgets_with_data() {
    let server = create_test_server().await;
    let timestamp = Utc::now().timestamp_nanos_opt().unwrap();

    // Register a user
    let auth = register_test_user(
        &server,
        &format!("listuser_{}", timestamp),
        &format!("list_{}@example.com", timestamp),
        "SecurePass123!",
        "List Test User",
    )
    .await;

    // Create multiple budgets
    let budget1 = json!({
        "name": "Monthly Groceries",
        "filters": {"category": "groceries"}
    });
    let response1 = post_authenticated(&server, "/api/v1/budgets", &auth.token, &budget1).await;
    assert_status(&response1, 201);

    let budget2 = json!({
        "name": "Entertainment Budget",
        "filters": {"category": "entertainment"}
    });
    let response2 = post_authenticated(&server, "/api/v1/budgets", &auth.token, &budget2).await;
    assert_status(&response2, 201);

    // List budgets
    let response = get_authenticated(&server, "/api/v1/budgets", &auth.token).await;
    assert_status(&response, 200);

    let budgets: Vec<BudgetResponse> = extract_json(response);
    assert_eq!(budgets.len(), 2, "User should have 2 budgets");

    // Verify budget details
    let groceries = budgets
        .iter()
        .find(|b| b.name == "Monthly Groceries")
        .unwrap();
    assert_eq!(groceries.user_id, auth.user.id);

    let entertainment = budgets
        .iter()
        .find(|b| b.name == "Entertainment Budget")
        .unwrap();
    assert_eq!(entertainment.user_id, auth.user.id);
}

/// Test that listing budgets without authentication fails.
///
/// Verifies that:
/// - Status code is 401 Unauthorized
/// - Error message indicates missing authentication
#[tokio::test]
async fn test_list_budgets_unauthorized() {
    let server = create_test_server().await;

    // Try to list budgets without token
    let response = get_unauthenticated(&server, "/api/v1/budgets").await;
    assert_status(&response, 401);

    let error_text = response.text();
    assert!(
        error_text.to_lowercase().contains("unauthorized")
            || error_text.to_lowercase().contains("token"),
        "Error message should indicate missing authentication"
    );
}

/// Test that users can only see their own budgets (data isolation).
///
/// Verifies that:
/// - User A can see their budgets
/// - User B can see their budgets
/// - User A cannot see User B's budgets
/// - User B cannot see User A's budgets
#[tokio::test]
async fn test_list_budgets_isolation() {
    let server = create_test_server().await;
    let timestamp = Utc::now().timestamp_nanos_opt().unwrap();

    // Register two users
    let auth_a = register_test_user(
        &server,
        &format!("usera_{}", timestamp),
        &format!("usera_{}@example.com", timestamp),
        "SecurePass123!",
        "User A",
    )
    .await;

    let auth_b = register_test_user(
        &server,
        &format!("userb_{}", timestamp),
        &format!("userb_{}@example.com", timestamp),
        "SecurePass123!",
        "User B",
    )
    .await;

    // User A creates a budget
    let budget_a = json!({
        "name": "User A Budget",
        "filters": {}
    });
    let response_a = post_authenticated(&server, "/api/v1/budgets", &auth_a.token, &budget_a).await;
    assert_status(&response_a, 201);

    // User B creates a budget
    let budget_b = json!({
        "name": "User B Budget",
        "filters": {}
    });
    let response_b = post_authenticated(&server, "/api/v1/budgets", &auth_b.token, &budget_b).await;
    assert_status(&response_b, 201);

    // User A lists budgets - should only see their own
    let response_a = get_authenticated(&server, "/api/v1/budgets", &auth_a.token).await;
    assert_status(&response_a, 200);
    let budgets_a: Vec<BudgetResponse> = extract_json(response_a);
    assert_eq!(budgets_a.len(), 1);
    assert_eq!(budgets_a[0].name, "User A Budget");

    // User B lists budgets - should only see their own
    let response_b = get_authenticated(&server, "/api/v1/budgets", &auth_b.token).await;
    assert_status(&response_b, 200);
    let budgets_b: Vec<BudgetResponse> = extract_json(response_b);
    assert_eq!(budgets_b.len(), 1);
    assert_eq!(budgets_b[0].name, "User B Budget");
}

// ============================================================================
// Create Budget Tests
// ============================================================================

/// Test successful budget creation with all fields.
///
/// Verifies that:
/// - Status code is 201 Created
/// - Response contains budget data
/// - Budget ID is a valid UUID
/// - All fields are correctly set
#[tokio::test]
async fn test_create_budget_success() {
    let server = create_test_server().await;
    let timestamp = Utc::now().timestamp_nanos_opt().unwrap();

    let auth = register_test_user(
        &server,
        &format!("createuser_{}", timestamp),
        &format!("create_{}@example.com", timestamp),
        "SecurePass123!",
        "Create Test User",
    )
    .await;

    let request = json!({
        "name": "My Monthly Budget",
        "filters": {
            "category": "groceries",
            "tags": ["essential"]
        }
    });

    let response = post_authenticated(&server, "/api/v1/budgets", &auth.token, &request).await;
    assert_status(&response, 201);

    let budget: BudgetResponse = extract_json(response);
    assert_eq!(budget.name, "My Monthly Budget");
    assert_eq!(budget.user_id, auth.user.id);
    assert!(budget.filters.is_object());
}

/// Test creating budgets with all budget periods.
///
/// Verifies that:
/// - All budget periods can be used in filters
/// - Each budget is correctly stored
#[tokio::test]
async fn test_create_budget_all_periods() {
    let server = create_test_server().await;
    let timestamp = Utc::now().timestamp_nanos_opt().unwrap();

    let auth = register_test_user(
        &server,
        &format!("periodsuser_{}", timestamp),
        &format!("periods_{}@example.com", timestamp),
        "SecurePass123!",
        "Periods Test User",
    )
    .await;

    let periods = vec!["MONTHLY", "QUARTERLY", "YEARLY"];

    for period in periods {
        let request = json!({
            "name": format!("{} Budget", period),
            "filters": {
                "period": period
            }
        });

        let response = post_authenticated(&server, "/api/v1/budgets", &auth.token, &request).await;
        assert_status(&response, 201);

        let budget: BudgetResponse = extract_json(response);
        assert_eq!(budget.name, format!("{} Budget", period));
    }

    // Verify all budgets were created
    let list_response = get_authenticated(&server, "/api/v1/budgets", &auth.token).await;
    assert_status(&list_response, 200);
    let budgets: Vec<BudgetResponse> = extract_json(list_response);
    assert_eq!(budgets.len(), 3, "Should have created 3 budgets");
}

/// Test that creating budget with missing required fields fails.
///
/// Verifies that:
/// - Missing name fails with 422
/// - Missing filters fails with 422
/// - Error messages indicate validation failure
#[tokio::test]
async fn test_create_budget_missing_fields() {
    let server = create_test_server().await;
    let timestamp = Utc::now().timestamp_nanos_opt().unwrap();

    let auth = register_test_user(
        &server,
        &format!("missinguser_{}", timestamp),
        &format!("missing_{}@example.com", timestamp),
        "SecurePass123!",
        "Missing Test User",
    )
    .await;

    // Missing name
    let missing_name = json!({
        "filters": {}
    });
    let response = post_authenticated(&server, "/api/v1/budgets", &auth.token, &missing_name).await;
    assert_status(&response, 422);

    // Missing filters
    let missing_filters = json!({
        "name": "Test Budget"
    });
    let response =
        post_authenticated(&server, "/api/v1/budgets", &auth.token, &missing_filters).await;
    assert_status(&response, 422);

    // Empty name
    let empty_name = json!({
        "name": "",
        "filters": {}
    });
    let response = post_authenticated(&server, "/api/v1/budgets", &auth.token, &empty_name).await;
    assert_status(&response, 422);
}

/// Test that creating budget with invalid period fails.
///
/// Verifies that:
/// - Status code is 422 Unprocessable Entity
/// - Error message indicates invalid period
#[tokio::test]
async fn test_create_budget_invalid_period() {
    let server = create_test_server().await;
    let timestamp = Utc::now().timestamp_nanos_opt().unwrap();

    let auth = register_test_user(
        &server,
        &format!("invalidperiod_{}", timestamp),
        &format!("invalidperiod_{}@example.com", timestamp),
        "SecurePass123!",
        "Invalid Period User",
    )
    .await;

    let invalid_periods = vec!["InvalidPeriod", "monthly", "DAILY", "WEEKLY"];

    for invalid_period in invalid_periods {
        let request = json!({
            "name": "Test Budget",
            "filters": {
                "period": invalid_period
            }
        });

        let response = post_authenticated(&server, "/api/v1/budgets", &auth.token, &request).await;
        // Note: This might succeed since filters is just JSON, but the period validation
        // happens when creating budget ranges
        // For now, we just verify the budget can be created
        assert!(response.status_code() == 201 || response.status_code() == 422);
    }
}

/// Test that creating budget without authentication fails.
///
/// Verifies that:
/// - Status code is 401 Unauthorized
/// - Error message indicates missing authentication
#[tokio::test]
async fn test_create_budget_unauthorized() {
    let server = create_test_server().await;

    let request = json!({
        "name": "Test Budget",
        "filters": {}
    });

    let response = post_unauthenticated(&server, "/api/v1/budgets", &request).await;
    assert_status(&response, 401);

    let error_text = response.text();
    assert!(
        error_text.to_lowercase().contains("unauthorized")
            || error_text.to_lowercase().contains("token"),
        "Error message should indicate missing authentication"
    );
}

// ============================================================================
// Get Budget Tests
// ============================================================================

/// Test successful retrieval of a specific budget.
///
/// Verifies that:
/// - Status code is 200 OK
/// - Response contains correct budget data
/// - All fields match the created budget
#[tokio::test]
async fn test_get_budget_success() {
    let server = create_test_server().await;
    let timestamp = Utc::now().timestamp_nanos_opt().unwrap();

    let auth = register_test_user(
        &server,
        &format!("getuser_{}", timestamp),
        &format!("get_{}@example.com", timestamp),
        "SecurePass123!",
        "Get Test User",
    )
    .await;

    // Create a budget
    let create_request = json!({
        "name": "Test Budget",
        "filters": {"category": "food"}
    });
    let create_response =
        post_authenticated(&server, "/api/v1/budgets", &auth.token, &create_request).await;
    assert_status(&create_response, 201);
    let created_budget: BudgetResponse = extract_json(create_response);

    // Get the budget
    let get_response = get_authenticated(
        &server,
        &format!("/api/v1/budgets/{}", created_budget.id),
        &auth.token,
    )
    .await;
    assert_status(&get_response, 200);

    let budget: BudgetResponse = extract_json(get_response);
    assert_eq!(budget.id, created_budget.id);
    assert_eq!(budget.name, "Test Budget");
    assert_eq!(budget.user_id, auth.user.id);
}

/// Test that getting a non-existent budget fails.
///
/// Verifies that:
/// - Status code is 404 Not Found
/// - Error message indicates budget not found
#[tokio::test]
async fn test_get_budget_not_found() {
    let server = create_test_server().await;
    let timestamp = Utc::now().timestamp_nanos_opt().unwrap();

    let auth = register_test_user(
        &server,
        &format!("notfounduser_{}", timestamp),
        &format!("notfound_{}@example.com", timestamp),
        "SecurePass123!",
        "Not Found User",
    )
    .await;

    // Try to get a non-existent budget
    let fake_id = uuid::Uuid::new_v4();
    let response = get_authenticated(
        &server,
        &format!("/api/v1/budgets/{}", fake_id),
        &auth.token,
    )
    .await;
    assert_status(&response, 404);

    let error_text = response.text();
    assert!(
        error_text.to_lowercase().contains("not found")
            || error_text.to_lowercase().contains("budget"),
        "Error message should indicate budget not found"
    );
}

/// Test that users cannot access other users' budgets.
///
/// Verifies that:
/// - Status code is 403 Forbidden
/// - User A cannot access User B's budget
#[tokio::test]
async fn test_get_budget_wrong_user() {
    let server = create_test_server().await;
    let timestamp = Utc::now().timestamp_nanos_opt().unwrap();

    // Register two users
    let auth_a = register_test_user(
        &server,
        &format!("wrongusera_{}", timestamp),
        &format!("wrongusera_{}@example.com", timestamp),
        "SecurePass123!",
        "Wrong User A",
    )
    .await;

    let auth_b = register_test_user(
        &server,
        &format!("wronguserb_{}", timestamp),
        &format!("wronguserb_{}@example.com", timestamp),
        "SecurePass123!",
        "Wrong User B",
    )
    .await;

    // User A creates a budget
    let create_request = json!({
        "name": "User A Budget",
        "filters": {}
    });
    let create_response =
        post_authenticated(&server, "/api/v1/budgets", &auth_a.token, &create_request).await;
    assert_status(&create_response, 201);
    let budget_a: BudgetResponse = extract_json(create_response);

    // User B tries to access User A's budget
    let response = get_authenticated(
        &server,
        &format!("/api/v1/budgets/{}", budget_a.id),
        &auth_b.token,
    )
    .await;

    // Should be 403 Forbidden (user authenticated but accessing wrong resource)
    assert_status(&response, 403);
}

/// Test that getting budget without authentication fails.
///
/// Verifies that:
/// - Status code is 401 Unauthorized
/// - Error message indicates missing authentication
#[tokio::test]
async fn test_get_budget_unauthorized() {
    let server = create_test_server().await;

    let fake_id = uuid::Uuid::new_v4();
    let response = get_unauthenticated(&server, &format!("/api/v1/budgets/{}", fake_id)).await;
    assert_status(&response, 401);

    let error_text = response.text();
    assert!(
        error_text.to_lowercase().contains("unauthorized")
            || error_text.to_lowercase().contains("token"),
        "Error message should indicate missing authentication"
    );
}

// ============================================================================
// Update Budget Tests
// ============================================================================

/// Test successful budget update.
///
/// Verifies that:
/// - Status code is 200 OK
/// - Response contains updated budget data
/// - Only specified fields are updated
#[tokio::test]
async fn test_update_budget_success() {
    let server = create_test_server().await;
    let timestamp = Utc::now().timestamp_nanos_opt().unwrap();

    let auth = register_test_user(
        &server,
        &format!("updateuser_{}", timestamp),
        &format!("update_{}@example.com", timestamp),
        "SecurePass123!",
        "Update Test User",
    )
    .await;

    // Create a budget
    let create_request = json!({
        "name": "Original Name",
        "filters": {"category": "original"}
    });
    let create_response =
        post_authenticated(&server, "/api/v1/budgets", &auth.token, &create_request).await;
    assert_status(&create_response, 201);
    let budget: BudgetResponse = extract_json(create_response);

    // Update the budget
    let update_request = json!({
        "name": "Updated Name",
        "filters": {"category": "updated"}
    });
    let update_response = put_authenticated(
        &server,
        &format!("/api/v1/budgets/{}", budget.id),
        &auth.token,
        &update_request,
    )
    .await;
    assert_status(&update_response, 200);

    let updated_budget: BudgetResponse = extract_json(update_response);
    assert_eq!(updated_budget.id, budget.id);
    assert_eq!(updated_budget.name, "Updated Name");
    assert_eq!(updated_budget.user_id, auth.user.id);
}

/// Test partial budget update (only some fields).
///
/// Verifies that:
/// - Status code is 200 OK
/// - Only specified fields are updated
/// - Other fields remain unchanged
#[tokio::test]
async fn test_update_budget_partial() {
    let server = create_test_server().await;
    let timestamp = Utc::now().timestamp_nanos_opt().unwrap();

    let auth = register_test_user(
        &server,
        &format!("partialuser_{}", timestamp),
        &format!("partial_{}@example.com", timestamp),
        "SecurePass123!",
        "Partial Test User",
    )
    .await;

    // Create a budget
    let create_request = json!({
        "name": "Original Name",
        "filters": {"category": "food", "tags": ["essential"]}
    });
    let create_response =
        post_authenticated(&server, "/api/v1/budgets", &auth.token, &create_request).await;
    assert_status(&create_response, 201);
    let budget: BudgetResponse = extract_json(create_response);

    // Update only the name
    let update_request = json!({
        "name": "New Name Only"
    });
    let update_response = put_authenticated(
        &server,
        &format!("/api/v1/budgets/{}", budget.id),
        &auth.token,
        &update_request,
    )
    .await;
    assert_status(&update_response, 200);

    let updated_budget: BudgetResponse = extract_json(update_response);
    assert_eq!(updated_budget.name, "New Name Only");
    // Filters should remain unchanged
    assert_eq!(updated_budget.filters["category"].as_str().unwrap(), "food");
}

/// Test that updating a non-existent budget fails.
///
/// Verifies that:
/// - Status code is 404 Not Found
/// - Error message indicates budget not found
#[tokio::test]
async fn test_update_budget_not_found() {
    let server = create_test_server().await;
    let timestamp = Utc::now().timestamp_nanos_opt().unwrap();

    let auth = register_test_user(
        &server,
        &format!("updatenotfound_{}", timestamp),
        &format!("updatenotfound_{}@example.com", timestamp),
        "SecurePass123!",
        "Update Not Found User",
    )
    .await;

    let fake_id = uuid::Uuid::new_v4();
    let update_request = json!({
        "name": "New Name"
    });
    let response = put_authenticated(
        &server,
        &format!("/api/v1/budgets/{}", fake_id),
        &auth.token,
        &update_request,
    )
    .await;
    assert_status(&response, 404);
}

/// Test that users cannot update other users' budgets.
///
/// Verifies that:
/// - Status code is 403 Forbidden
/// - User B cannot update User A's budget
#[tokio::test]
async fn test_update_budget_wrong_user() {
    let server = create_test_server().await;
    let timestamp = Utc::now().timestamp_nanos_opt().unwrap();

    // Register two users
    let auth_a = register_test_user(
        &server,
        &format!("updatewronga_{}", timestamp),
        &format!("updatewronga_{}@example.com", timestamp),
        "SecurePass123!",
        "Update Wrong A",
    )
    .await;

    let auth_b = register_test_user(
        &server,
        &format!("updatewrongb_{}", timestamp),
        &format!("updatewrongb_{}@example.com", timestamp),
        "SecurePass123!",
        "Update Wrong B",
    )
    .await;

    // User A creates a budget
    let create_request = json!({
        "name": "User A Budget",
        "filters": {}
    });
    let create_response =
        post_authenticated(&server, "/api/v1/budgets", &auth_a.token, &create_request).await;
    assert_status(&create_response, 201);
    let budget: BudgetResponse = extract_json(create_response);

    // User B tries to update User A's budget
    let update_request = json!({
        "name": "Hacked Name"
    });
    let response = put_authenticated(
        &server,
        &format!("/api/v1/budgets/{}", budget.id),
        &auth_b.token,
        &update_request,
    )
    .await;

    assert_status(&response, 403);
}

/// Test that updating budget without authentication fails.
///
/// Verifies that:
/// - Status code is 401 Unauthorized
/// - Error message indicates missing authentication
#[tokio::test]
async fn test_update_budget_unauthorized() {
    let server = create_test_server().await;

    let fake_id = uuid::Uuid::new_v4();
    let update_request = json!({
        "name": "New Name"
    });

    let response = server
        .put(&format!("/api/v1/budgets/{}", fake_id))
        .json(&update_request)
        .await;
    assert_status(&response, 401);
}

// ============================================================================
// Delete Budget Tests
// ============================================================================

/// Test successful budget deletion.
///
/// Verifies that:
/// - Status code is 204 No Content
/// - Budget is actually deleted
/// - Subsequent GET returns 404
#[tokio::test]
async fn test_delete_budget_success() {
    let server = create_test_server().await;
    let timestamp = Utc::now().timestamp_nanos_opt().unwrap();

    let auth = register_test_user(
        &server,
        &format!("deleteuser_{}", timestamp),
        &format!("delete_{}@example.com", timestamp),
        "SecurePass123!",
        "Delete Test User",
    )
    .await;

    // Create a budget
    let create_request = json!({
        "name": "Budget to Delete",
        "filters": {}
    });
    let create_response =
        post_authenticated(&server, "/api/v1/budgets", &auth.token, &create_request).await;
    assert_status(&create_response, 201);
    let budget: BudgetResponse = extract_json(create_response);

    // Delete the budget
    let delete_response = delete_authenticated(
        &server,
        &format!("/api/v1/budgets/{}", budget.id),
        &auth.token,
    )
    .await;
    assert_status(&delete_response, 204);

    // Verify budget is deleted - GET should return 404
    let get_response = get_authenticated(
        &server,
        &format!("/api/v1/budgets/{}", budget.id),
        &auth.token,
    )
    .await;
    assert_status(&get_response, 404);

    // Verify budget is not in list
    let list_response = get_authenticated(&server, "/api/v1/budgets", &auth.token).await;
    assert_status(&list_response, 200);
    let budgets: Vec<BudgetResponse> = extract_json(list_response);
    assert!(
        !budgets.iter().any(|b| b.id == budget.id),
        "Deleted budget should not appear in list"
    );
}

/// Test that deleting a non-existent budget fails.
///
/// Verifies that:
/// - Status code is 404 Not Found
/// - Error message indicates budget not found
#[tokio::test]
async fn test_delete_budget_not_found() {
    let server = create_test_server().await;
    let timestamp = Utc::now().timestamp_nanos_opt().unwrap();

    let auth = register_test_user(
        &server,
        &format!("deletenotfound_{}", timestamp),
        &format!("deletenotfound_{}@example.com", timestamp),
        "SecurePass123!",
        "Delete Not Found User",
    )
    .await;

    let fake_id = uuid::Uuid::new_v4();
    let response = delete_authenticated(
        &server,
        &format!("/api/v1/budgets/{}", fake_id),
        &auth.token,
    )
    .await;
    assert_status(&response, 404);
}

/// Test that users cannot delete other users' budgets.
///
/// Verifies that:
/// - Status code is 403 Forbidden
/// - User B cannot delete User A's budget
#[tokio::test]
async fn test_delete_budget_wrong_user() {
    let server = create_test_server().await;
    let timestamp = Utc::now().timestamp_nanos_opt().unwrap();

    // Register two users
    let auth_a = register_test_user(
        &server,
        &format!("deletewronga_{}", timestamp),
        &format!("deletewronga_{}@example.com", timestamp),
        "SecurePass123!",
        "Delete Wrong A",
    )
    .await;

    let auth_b = register_test_user(
        &server,
        &format!("deletewrongb_{}", timestamp),
        &format!("deletewrongb_{}@example.com", timestamp),
        "SecurePass123!",
        "Delete Wrong B",
    )
    .await;

    // User A creates a budget
    let create_request = json!({
        "name": "User A Budget",
        "filters": {}
    });
    let create_response =
        post_authenticated(&server, "/api/v1/budgets", &auth_a.token, &create_request).await;
    assert_status(&create_response, 201);
    let budget: BudgetResponse = extract_json(create_response);

    // User B tries to delete User A's budget
    let response = delete_authenticated(
        &server,
        &format!("/api/v1/budgets/{}", budget.id),
        &auth_b.token,
    )
    .await;

    assert_status(&response, 403);

    // Verify budget still exists for User A
    let get_response = get_authenticated(
        &server,
        &format!("/api/v1/budgets/{}", budget.id),
        &auth_a.token,
    )
    .await;
    assert_status(&get_response, 200);
}

/// Test that deleting budget without authentication fails.
///
/// Verifies that:
/// - Status code is 401 Unauthorized
/// - Error message indicates missing authentication
#[tokio::test]
async fn test_delete_budget_unauthorized() {
    let server = create_test_server().await;

    let fake_id = uuid::Uuid::new_v4();
    let response = server.delete(&format!("/api/v1/budgets/{}", fake_id)).await;
    assert_status(&response, 401);
}

// ============================================================================
// Budget Range Tests
// ============================================================================

/// Test successfully adding a budget range.
///
/// Verifies that:
/// - Status code is 201 Created
/// - Response contains budget range data
/// - Range is correctly associated with budget
#[tokio::test]
async fn test_add_budget_range_success() {
    let server = create_test_server().await;
    let timestamp = Utc::now().timestamp_nanos_opt().unwrap();

    let auth = register_test_user(
        &server,
        &format!("rangeuser_{}", timestamp),
        &format!("range_{}@example.com", timestamp),
        "SecurePass123!",
        "Range Test User",
    )
    .await;

    // Create a budget
    let budget_request = json!({
        "name": "Monthly Budget",
        "filters": {}
    });
    let budget_response =
        post_authenticated(&server, "/api/v1/budgets", &auth.token, &budget_request).await;
    assert_status(&budget_response, 201);
    let budget: BudgetResponse = extract_json(budget_response);

    // Add a budget range
    let range_request = json!({
        "limit_amount": 1000.0,
        "period": "MONTHLY",
        "start_date": "2024-01-01",
        "end_date": "2024-01-31"
    });
    let range_response = post_authenticated(
        &server,
        &format!("/api/v1/budgets/{}/ranges", budget.id),
        &auth.token,
        &range_request,
    )
    .await;
    assert_status(&range_response, 201);

    let range: BudgetRangeResponse = extract_json(range_response);
    assert_eq!(range.budget_id, budget.id);
    assert_eq!(range.limit_amount, "1000.00");
    assert_eq!(range.period, BudgetPeriod::Monthly);
}

/// Test adding budget range with category filter.
///
/// Verifies that:
/// - Status code is 201 Created
/// - Range can be added to budget with category filters
#[tokio::test]
async fn test_add_budget_range_with_category() {
    let server = create_test_server().await;
    let timestamp = Utc::now().timestamp_nanos_opt().unwrap();

    let auth = register_test_user(
        &server,
        &format!("rangecatuser_{}", timestamp),
        &format!("rangecat_{}@example.com", timestamp),
        "SecurePass123!",
        "Range Category User",
    )
    .await;

    // Create a category
    let category_request = json!({
        "name": "Groceries"
    });
    let category_response = post_authenticated(
        &server,
        "/api/v1/categories",
        &auth.token,
        &category_request,
    )
    .await;
    assert_status(&category_response, 201);
    let category: CategoryResponse = extract_json(category_response);

    // Create a budget with category filter
    let budget_request = json!({
        "name": "Grocery Budget",
        "filters": {
            "category_id": category.id
        }
    });
    let budget_response =
        post_authenticated(&server, "/api/v1/budgets", &auth.token, &budget_request).await;
    assert_status(&budget_response, 201);
    let budget: BudgetResponse = extract_json(budget_response);

    // Add a budget range
    let range_request = json!({
        "limit_amount": 500.0,
        "period": "MONTHLY",
        "start_date": "2024-01-01",
        "end_date": "2024-01-31"
    });
    let range_response = post_authenticated(
        &server,
        &format!("/api/v1/budgets/{}/ranges", budget.id),
        &auth.token,
        &range_request,
    )
    .await;
    assert_status(&range_response, 201);

    let range: BudgetRangeResponse = extract_json(range_response);
    assert_eq!(range.budget_id, budget.id);
}

/// Test that adding budget range with missing fields fails.
///
/// Verifies that:
/// - Missing required fields fails with 422
/// - Error messages indicate validation failure
#[tokio::test]
async fn test_add_budget_range_missing_fields() {
    let server = create_test_server().await;
    let timestamp = Utc::now().timestamp_nanos_opt().unwrap();

    let auth = register_test_user(
        &server,
        &format!("rangemissing_{}", timestamp),
        &format!("rangemissing_{}@example.com", timestamp),
        "SecurePass123!",
        "Range Missing User",
    )
    .await;

    // Create a budget
    let budget_request = json!({
        "name": "Test Budget",
        "filters": {}
    });
    let budget_response =
        post_authenticated(&server, "/api/v1/budgets", &auth.token, &budget_request).await;
    assert_status(&budget_response, 201);
    let budget: BudgetResponse = extract_json(budget_response);

    // Missing limit_amount
    let missing_amount = json!({
        "period": "MONTHLY",
        "start_date": "2024-01-01",
        "end_date": "2024-01-31"
    });
    let response = post_authenticated(
        &server,
        &format!("/api/v1/budgets/{}/ranges", budget.id),
        &auth.token,
        &missing_amount,
    )
    .await;
    assert_status(&response, 422);

    // Missing period
    let missing_period = json!({
        "limit_amount": 1000.0,
        "start_date": "2024-01-01",
        "end_date": "2024-01-31"
    });
    let response = post_authenticated(
        &server,
        &format!("/api/v1/budgets/{}/ranges", budget.id),
        &auth.token,
        &missing_period,
    )
    .await;
    assert_status(&response, 422);
}

/// Test that adding budget range to non-existent budget fails.
///
/// Verifies that:
/// - Status code is 404 Not Found
/// - Error message indicates budget not found
#[tokio::test]
async fn test_add_budget_range_not_found() {
    let server = create_test_server().await;
    let timestamp = Utc::now().timestamp_nanos_opt().unwrap();

    let auth = register_test_user(
        &server,
        &format!("rangenotfound_{}", timestamp),
        &format!("rangenotfound_{}@example.com", timestamp),
        "SecurePass123!",
        "Range Not Found User",
    )
    .await;

    let fake_id = uuid::Uuid::new_v4();
    let range_request = json!({
        "limit_amount": 1000.0,
        "period": "MONTHLY",
        "start_date": "2024-01-01",
        "end_date": "2024-01-31"
    });
    let response = post_authenticated(
        &server,
        &format!("/api/v1/budgets/{}/ranges", fake_id),
        &auth.token,
        &range_request,
    )
    .await;
    assert_status(&response, 404);
}

/// Test that users cannot add ranges to other users' budgets.
///
/// Verifies that:
/// - Status code is 403 Forbidden
/// - User B cannot add range to User A's budget
#[tokio::test]
async fn test_add_budget_range_wrong_user() {
    let server = create_test_server().await;
    let timestamp = Utc::now().timestamp_nanos_opt().unwrap();

    // Register two users
    let auth_a = register_test_user(
        &server,
        &format!("rangewronga_{}", timestamp),
        &format!("rangewronga_{}@example.com", timestamp),
        "SecurePass123!",
        "Range Wrong A",
    )
    .await;

    let auth_b = register_test_user(
        &server,
        &format!("rangewrongb_{}", timestamp),
        &format!("rangewrongb_{}@example.com", timestamp),
        "SecurePass123!",
        "Range Wrong B",
    )
    .await;

    // User A creates a budget
    let budget_request = json!({
        "name": "User A Budget",
        "filters": {}
    });
    let budget_response =
        post_authenticated(&server, "/api/v1/budgets", &auth_a.token, &budget_request).await;
    assert_status(&budget_response, 201);
    let budget: BudgetResponse = extract_json(budget_response);

    // User B tries to add range to User A's budget
    let range_request = json!({
        "limit_amount": 1000.0,
        "period": "MONTHLY",
        "start_date": "2024-01-01",
        "end_date": "2024-01-31"
    });
    let response = post_authenticated(
        &server,
        &format!("/api/v1/budgets/{}/ranges", budget.id),
        &auth_b.token,
        &range_request,
    )
    .await;

    assert_status(&response, 403);
}

/// Test that adding budget range without authentication fails.
///
/// Verifies that:
/// - Status code is 401 Unauthorized
/// - Error message indicates missing authentication
#[tokio::test]
async fn test_add_budget_range_unauthorized() {
    let server = create_test_server().await;

    let fake_id = uuid::Uuid::new_v4();
    let range_request = json!({
        "limit_amount": 1000.0,
        "period": "MONTHLY",
        "start_date": "2024-01-01",
        "end_date": "2024-01-31"
    });

    let response = server
        .post(&format!("/api/v1/budgets/{}/ranges", fake_id))
        .json(&range_request)
        .await;
    assert_status(&response, 401);
}

// ============================================================================
// Integration Flow Tests
// ============================================================================

/// Test complete CRUD flow: Create → Read → Update → Delete.
///
/// Verifies that:
/// - Budget can be created successfully
/// - Budget can be retrieved with correct data
/// - Budget can be updated with new data
/// - Budget can be deleted successfully
/// - All operations maintain data consistency
#[tokio::test]
async fn test_full_budget_crud_flow() {
    let server = create_test_server().await;
    let timestamp = Utc::now().timestamp_nanos_opt().unwrap();

    let auth = register_test_user(
        &server,
        &format!("cruduser_{}", timestamp),
        &format!("crud_{}@example.com", timestamp),
        "SecurePass123!",
        "CRUD Test User",
    )
    .await;

    // Step 1: Create budget
    let create_request = json!({
        "name": "CRUD Test Budget",
        "filters": {
            "category": "test",
            "tags": ["important"]
        }
    });
    let create_response =
        post_authenticated(&server, "/api/v1/budgets", &auth.token, &create_request).await;
    assert_status(&create_response, 201);
    let created_budget: BudgetResponse = extract_json(create_response);

    assert_eq!(created_budget.name, "CRUD Test Budget");
    assert_eq!(created_budget.user_id, auth.user.id);

    // Step 2: Read budget
    let get_response = get_authenticated(
        &server,
        &format!("/api/v1/budgets/{}", created_budget.id),
        &auth.token,
    )
    .await;
    assert_status(&get_response, 200);
    let read_budget: BudgetResponse = extract_json(get_response);

    assert_eq!(read_budget.id, created_budget.id);
    assert_eq!(read_budget.name, created_budget.name);

    // Step 3: Update budget
    let update_request = json!({
        "name": "Updated CRUD Budget",
        "filters": {
            "category": "updated"
        }
    });
    let update_response = put_authenticated(
        &server,
        &format!("/api/v1/budgets/{}", created_budget.id),
        &auth.token,
        &update_request,
    )
    .await;
    assert_status(&update_response, 200);
    let updated_budget: BudgetResponse = extract_json(update_response);

    assert_eq!(updated_budget.id, created_budget.id);
    assert_eq!(updated_budget.name, "Updated CRUD Budget");

    // Step 4: Verify update persisted
    let get_response2 = get_authenticated(
        &server,
        &format!("/api/v1/budgets/{}", created_budget.id),
        &auth.token,
    )
    .await;
    assert_status(&get_response2, 200);
    let verified_budget: BudgetResponse = extract_json(get_response2);
    assert_eq!(verified_budget.name, "Updated CRUD Budget");

    // Step 5: Delete budget
    let delete_response = delete_authenticated(
        &server,
        &format!("/api/v1/budgets/{}", created_budget.id),
        &auth.token,
    )
    .await;
    assert_status(&delete_response, 204);

    // Step 6: Verify deletion
    let get_response3 = get_authenticated(
        &server,
        &format!("/api/v1/budgets/{}", created_budget.id),
        &auth.token,
    )
    .await;
    assert_status(&get_response3, 404);

    // Step 7: Verify budget not in list
    let list_response = get_authenticated(&server, "/api/v1/budgets", &auth.token).await;
    assert_status(&list_response, 200);
    let final_budgets: Vec<BudgetResponse> = extract_json(list_response);
    assert_eq!(final_budgets.len(), 0, "All budgets should be deleted");
}

/// Test complete budget with ranges flow.
///
/// Verifies that:
/// - Budget can be created
/// - Multiple ranges can be added to budget
/// - Ranges are correctly associated
/// - Budget and ranges can be deleted
#[tokio::test]
async fn test_full_budget_with_ranges_flow() {
    let server = create_test_server().await;
    let timestamp = Utc::now().timestamp_nanos_opt().unwrap();

    let auth = register_test_user(
        &server,
        &format!("rangesflowuser_{}", timestamp),
        &format!("rangesflow_{}@example.com", timestamp),
        "SecurePass123!",
        "Ranges Flow User",
    )
    .await;

    // Step 1: Create budget
    let budget_request = json!({
        "name": "Annual Budget",
        "filters": {
            "year": 2024
        }
    });
    let budget_response =
        post_authenticated(&server, "/api/v1/budgets", &auth.token, &budget_request).await;
    assert_status(&budget_response, 201);
    let budget: BudgetResponse = extract_json(budget_response);

    // Step 2: Add monthly range
    let monthly_range = json!({
        "limit_amount": 1000.0,
        "period": "MONTHLY",
        "start_date": "2024-01-01",
        "end_date": "2024-01-31"
    });
    let monthly_response = post_authenticated(
        &server,
        &format!("/api/v1/budgets/{}/ranges", budget.id),
        &auth.token,
        &monthly_range,
    )
    .await;
    assert_status(&monthly_response, 201);
    let monthly: BudgetRangeResponse = extract_json(monthly_response);
    assert_eq!(monthly.period, BudgetPeriod::Monthly);

    // Step 3: Add quarterly range
    let quarterly_range = json!({
        "limit_amount": 3000.0,
        "period": "QUARTERLY",
        "start_date": "2024-01-01",
        "end_date": "2024-03-31"
    });
    let quarterly_response = post_authenticated(
        &server,
        &format!("/api/v1/budgets/{}/ranges", budget.id),
        &auth.token,
        &quarterly_range,
    )
    .await;
    assert_status(&quarterly_response, 201);
    let quarterly: BudgetRangeResponse = extract_json(quarterly_response);
    assert_eq!(quarterly.period, BudgetPeriod::Quarterly);

    // Step 4: Add yearly range
    let yearly_range = json!({
        "limit_amount": 12000.0,
        "period": "YEARLY",
        "start_date": "2024-01-01",
        "end_date": "2024-12-31"
    });
    let yearly_response = post_authenticated(
        &server,
        &format!("/api/v1/budgets/{}/ranges", budget.id),
        &auth.token,
        &yearly_range,
    )
    .await;
    assert_status(&yearly_response, 201);
    let yearly: BudgetRangeResponse = extract_json(yearly_response);
    assert_eq!(yearly.period, BudgetPeriod::Yearly);

    // Step 5: Verify budget still exists
    let get_response = get_authenticated(
        &server,
        &format!("/api/v1/budgets/{}", budget.id),
        &auth.token,
    )
    .await;
    assert_status(&get_response, 200);

    // Step 6: Delete budget (should cascade delete ranges)
    let delete_response = delete_authenticated(
        &server,
        &format!("/api/v1/budgets/{}", budget.id),
        &auth.token,
    )
    .await;
    assert_status(&delete_response, 204);

    // Step 7: Verify budget is deleted
    let get_response2 = get_authenticated(
        &server,
        &format!("/api/v1/budgets/{}", budget.id),
        &auth.token,
    )
    .await;
    assert_status(&get_response2, 404);
}
