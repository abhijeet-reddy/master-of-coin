//! Integration tests for category API endpoints.
//!
//! This module tests the category endpoints including:
//! - GET /api/v1/categories - List all categories for user
//! - POST /api/v1/categories - Create new category
//! - PUT /api/v1/categories/:id - Update category
//! - DELETE /api/v1/categories/:id - Delete category
//!
//! Note: There is NO single GET endpoint for categories (no GET /api/v1/categories/:id)
//!
//! Tests cover success cases, error cases, authorization, and data isolation.

use crate::common::*;
use chrono::Utc;
use master_of_coin_backend::models::CategoryResponse;
use serde_json::json;

// ============================================================================
// List Categories Tests
// ============================================================================

/// Test that a new user has no categories initially.
///
/// Verifies that:
/// - Status code is 200 OK
/// - Response is an empty array
/// - No categories exist for a newly registered user
#[tokio::test]
async fn test_list_categories_empty() {
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

    // List categories should return empty array
    let response = get_authenticated(&server, "/api/v1/categories", &auth.token).await;
    assert_status(&response, 200);

    let categories: Vec<CategoryResponse> = extract_json(response);
    assert_eq!(categories.len(), 0, "New user should have no categories");
}

/// Test that list categories returns user's categories.
///
/// Verifies that:
/// - Status code is 200 OK
/// - Response contains all user's categories
/// - Category data is correct
#[tokio::test]
async fn test_list_categories_with_data() {
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

    // Create multiple categories
    let category1 = json!({
        "name": "Groceries",
        "icon": "🛒",
        "color": "#FF5733"
    });
    let response1 =
        post_authenticated(&server, "/api/v1/categories", &auth.token, &category1).await;
    assert_status(&response1, 201);

    let category2 = json!({
        "name": "Entertainment",
        "icon": "🎬",
        "color": "#3498DB"
    });
    let response2 =
        post_authenticated(&server, "/api/v1/categories", &auth.token, &category2).await;
    assert_status(&response2, 201);

    // List categories
    let response = get_authenticated(&server, "/api/v1/categories", &auth.token).await;
    assert_status(&response, 200);

    let categories: Vec<CategoryResponse> = extract_json(response);
    assert_eq!(categories.len(), 2, "User should have 2 categories");

    // Verify category details
    let groceries = categories.iter().find(|c| c.name == "Groceries").unwrap();
    assert_eq!(groceries.icon, Some("🛒".to_string()));
    assert_eq!(groceries.color, Some("#FF5733".to_string()));

    let entertainment = categories
        .iter()
        .find(|c| c.name == "Entertainment")
        .unwrap();
    assert_eq!(entertainment.icon, Some("🎬".to_string()));
    assert_eq!(entertainment.color, Some("#3498DB".to_string()));
}

/// Test that listing categories without authentication fails.
///
/// Verifies that:
/// - Status code is 401 Unauthorized
/// - Error message indicates missing authentication
#[tokio::test]
async fn test_list_categories_unauthorized() {
    let server = create_test_server().await;

    // Try to list categories without token
    let response = get_unauthenticated(&server, "/api/v1/categories").await;
    assert_status(&response, 401);

    let error_text = response.text();
    assert!(
        error_text.to_lowercase().contains("unauthorized")
            || error_text.to_lowercase().contains("token"),
        "Error message should indicate missing authentication"
    );
}

/// Test that users can only see their own categories (data isolation).
///
/// Verifies that:
/// - User A can see their categories
/// - User B can see their categories
/// - User A cannot see User B's categories
/// - User B cannot see User A's categories
#[tokio::test]
async fn test_list_categories_isolation() {
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

    // User A creates a category
    let category_a = json!({
        "name": "User A Category"
    });
    let response_a =
        post_authenticated(&server, "/api/v1/categories", &auth_a.token, &category_a).await;
    assert_status(&response_a, 201);

    // User B creates a category
    let category_b = json!({
        "name": "User B Category"
    });
    let response_b =
        post_authenticated(&server, "/api/v1/categories", &auth_b.token, &category_b).await;
    assert_status(&response_b, 201);

    // User A lists categories - should only see their own
    let response_a = get_authenticated(&server, "/api/v1/categories", &auth_a.token).await;
    assert_status(&response_a, 200);
    let categories_a: Vec<CategoryResponse> = extract_json(response_a);
    assert_eq!(categories_a.len(), 1);
    assert_eq!(categories_a[0].name, "User A Category");

    // User B lists categories - should only see their own
    let response_b = get_authenticated(&server, "/api/v1/categories", &auth_b.token).await;
    assert_status(&response_b, 200);
    let categories_b: Vec<CategoryResponse> = extract_json(response_b);
    assert_eq!(categories_b.len(), 1);
    assert_eq!(categories_b[0].name, "User B Category");
}

// ============================================================================
// Create Category Tests
// ============================================================================

/// Test successful category creation with required fields only.
///
/// Verifies that:
/// - Status code is 201 Created
/// - Response contains category data
/// - Category ID is a valid UUID
/// - All fields are correctly set
#[tokio::test]
async fn test_create_category_success() {
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
        "name": "Transportation"
    });

    let response = post_authenticated(&server, "/api/v1/categories", &auth.token, &request).await;
    assert_status(&response, 201);

    let category: CategoryResponse = extract_json(response);
    assert_eq!(category.name, "Transportation");
    assert!(category.icon.is_none());
    assert!(category.color.is_none());
    assert!(category.parent_id.is_none());
}

/// Test creating category with all optional fields.
///
/// Verifies that:
/// - Status code is 201 Created
/// - Icon and color are correctly stored
/// - Optional fields are present in response
#[tokio::test]
async fn test_create_category_with_optional_fields() {
    let server = create_test_server().await;
    let timestamp = Utc::now().timestamp_nanos_opt().unwrap();

    let auth = register_test_user(
        &server,
        &format!("optionaluser_{}", timestamp),
        &format!("optional_{}@example.com", timestamp),
        "SecurePass123!",
        "Optional Test User",
    )
    .await;

    let request = json!({
        "name": "Food & Dining",
        "icon": "🍔",
        "color": "#E74C3C"
    });

    let response = post_authenticated(&server, "/api/v1/categories", &auth.token, &request).await;
    assert_status(&response, 201);

    let category: CategoryResponse = extract_json(response);
    assert_eq!(category.name, "Food & Dining");
    assert_eq!(category.icon, Some("🍔".to_string()));
    assert_eq!(category.color, Some("#E74C3C".to_string()));
}

/// Test that creating category with missing required fields fails.
///
/// Verifies that:
/// - Missing name fails with 422
/// - Error message indicates validation failure
#[tokio::test]
async fn test_create_category_missing_fields() {
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

    // Missing name (completely empty object)
    let missing_name = json!({});
    let response =
        post_authenticated(&server, "/api/v1/categories", &auth.token, &missing_name).await;
    assert_status(&response, 422);

    // Empty name
    let empty_name = json!({
        "name": ""
    });
    let response =
        post_authenticated(&server, "/api/v1/categories", &auth.token, &empty_name).await;
    assert_status(&response, 422);
}

/// Test that creating category without authentication fails.
///
/// Verifies that:
/// - Status code is 401 Unauthorized
/// - Error message indicates missing authentication
#[tokio::test]
async fn test_create_category_unauthorized() {
    let server = create_test_server().await;

    let request = json!({
        "name": "Test Category"
    });

    let response = post_unauthenticated(&server, "/api/v1/categories", &request).await;
    assert_status(&response, 401);

    let error_text = response.text();
    assert!(
        error_text.to_lowercase().contains("unauthorized")
            || error_text.to_lowercase().contains("token"),
        "Error message should indicate missing authentication"
    );
}

// ============================================================================
// Update Category Tests
// ============================================================================

/// Test successful category update.
///
/// Verifies that:
/// - Status code is 200 OK
/// - Response contains updated category data
/// - Only specified fields are updated
#[tokio::test]
async fn test_update_category_success() {
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

    // Create a category
    let create_request = json!({
        "name": "Original Name",
        "icon": "📝",
        "color": "#95A5A6"
    });
    let create_response =
        post_authenticated(&server, "/api/v1/categories", &auth.token, &create_request).await;
    assert_status(&create_response, 201);
    let category: CategoryResponse = extract_json(create_response);

    // Update the category
    let update_request = json!({
        "name": "Updated Name",
        "icon": "✅",
        "color": "#2ECC71"
    });
    let update_response = put_authenticated(
        &server,
        &format!("/api/v1/categories/{}", category.id),
        &auth.token,
        &update_request,
    )
    .await;
    assert_status(&update_response, 200);

    let updated_category: CategoryResponse = extract_json(update_response);
    assert_eq!(updated_category.id, category.id);
    assert_eq!(updated_category.name, "Updated Name");
    assert_eq!(updated_category.icon, Some("✅".to_string()));
    assert_eq!(updated_category.color, Some("#2ECC71".to_string()));
}

/// Test partial category update (only some fields).
///
/// Verifies that:
/// - Status code is 200 OK
/// - Only specified fields are updated
/// - Other fields remain unchanged
#[tokio::test]
async fn test_update_category_partial() {
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

    // Create a category
    let create_request = json!({
        "name": "Original Name",
        "icon": "🎨",
        "color": "#9B59B6"
    });
    let create_response =
        post_authenticated(&server, "/api/v1/categories", &auth.token, &create_request).await;
    assert_status(&create_response, 201);
    let category: CategoryResponse = extract_json(create_response);

    // Update only the name
    let update_request = json!({
        "name": "New Name Only"
    });
    let update_response = put_authenticated(
        &server,
        &format!("/api/v1/categories/{}", category.id),
        &auth.token,
        &update_request,
    )
    .await;
    assert_status(&update_response, 200);

    let updated_category: CategoryResponse = extract_json(update_response);
    assert_eq!(updated_category.name, "New Name Only");
    assert_eq!(updated_category.icon, Some("🎨".to_string()));
    assert_eq!(updated_category.color, Some("#9B59B6".to_string()));
}

/// Test that updating a non-existent category fails.
///
/// Verifies that:
/// - Status code is 404 Not Found
/// - Error message indicates category not found
#[tokio::test]
async fn test_update_category_not_found() {
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
        &format!("/api/v1/categories/{}", fake_id),
        &auth.token,
        &update_request,
    )
    .await;
    assert_status(&response, 404);
}

/// Test that users cannot update other users' categories.
///
/// Verifies that:
/// - Status code is 403 Forbidden
/// - User B cannot update User A's category
#[tokio::test]
async fn test_update_category_wrong_user() {
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

    // User A creates a category
    let create_request = json!({
        "name": "User A Category"
    });
    let create_response = post_authenticated(
        &server,
        "/api/v1/categories",
        &auth_a.token,
        &create_request,
    )
    .await;
    assert_status(&create_response, 201);
    let category: CategoryResponse = extract_json(create_response);

    // User B tries to update User A's category
    let update_request = json!({
        "name": "Hacked Name"
    });
    let response = put_authenticated(
        &server,
        &format!("/api/v1/categories/{}", category.id),
        &auth_b.token,
        &update_request,
    )
    .await;

    assert_status(&response, 403);
}

/// Test that updating category without authentication fails.
///
/// Verifies that:
/// - Status code is 401 Unauthorized
/// - Error message indicates missing authentication
#[tokio::test]
async fn test_update_category_unauthorized() {
    let server = create_test_server().await;

    let fake_id = uuid::Uuid::new_v4();
    let update_request = json!({
        "name": "New Name"
    });

    let response = server
        .put(&format!("/api/v1/categories/{}", fake_id))
        .json(&update_request)
        .await;
    assert_status(&response, 401);
}

// ============================================================================
// Delete Category Tests
// ============================================================================

/// Test successful category deletion.
///
/// Verifies that:
/// - Status code is 204 No Content
/// - Category is actually deleted
/// - Category no longer appears in list
#[tokio::test]
async fn test_delete_category_success() {
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

    // Create a category
    let create_request = json!({
        "name": "Category to Delete"
    });
    let create_response =
        post_authenticated(&server, "/api/v1/categories", &auth.token, &create_request).await;
    assert_status(&create_response, 201);
    let category: CategoryResponse = extract_json(create_response);

    // Delete the category
    let delete_response = delete_authenticated(
        &server,
        &format!("/api/v1/categories/{}", category.id),
        &auth.token,
    )
    .await;
    assert_status(&delete_response, 204);

    // Verify category is not in list
    let list_response = get_authenticated(&server, "/api/v1/categories", &auth.token).await;
    assert_status(&list_response, 200);
    let categories: Vec<CategoryResponse> = extract_json(list_response);
    assert!(
        !categories.iter().any(|c| c.id == category.id),
        "Deleted category should not appear in list"
    );
}

/// Test that deleting a non-existent category fails.
///
/// Verifies that:
/// - Status code is 404 Not Found
/// - Error message indicates category not found
#[tokio::test]
async fn test_delete_category_not_found() {
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
        &format!("/api/v1/categories/{}", fake_id),
        &auth.token,
    )
    .await;
    assert_status(&response, 404);
}

/// Test that users cannot delete other users' categories.
///
/// Verifies that:
/// - Status code is 403 Forbidden
/// - User B cannot delete User A's category
#[tokio::test]
async fn test_delete_category_wrong_user() {
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

    // User A creates a category
    let create_request = json!({
        "name": "User A Category"
    });
    let create_response = post_authenticated(
        &server,
        "/api/v1/categories",
        &auth_a.token,
        &create_request,
    )
    .await;
    assert_status(&create_response, 201);
    let category: CategoryResponse = extract_json(create_response);

    // User B tries to delete User A's category
    let response = delete_authenticated(
        &server,
        &format!("/api/v1/categories/{}", category.id),
        &auth_b.token,
    )
    .await;

    assert_status(&response, 403);

    // Verify category still exists for User A
    let list_response = get_authenticated(&server, "/api/v1/categories", &auth_a.token).await;
    assert_status(&list_response, 200);
    let categories: Vec<CategoryResponse> = extract_json(list_response);
    assert!(
        categories.iter().any(|c| c.id == category.id),
        "Category should still exist for User A"
    );
}

/// Test that deleting category without authentication fails.
///
/// Verifies that:
/// - Status code is 401 Unauthorized
/// - Error message indicates missing authentication
#[tokio::test]
async fn test_delete_category_unauthorized() {
    let server = create_test_server().await;

    let fake_id = uuid::Uuid::new_v4();
    let response = server
        .delete(&format!("/api/v1/categories/{}", fake_id))
        .await;
    assert_status(&response, 401);
}

// ============================================================================
// Integration Flow Test
// ============================================================================

/// Test complete CRUD flow: Create → Update → Delete.
///
/// Note: There is no single GET endpoint for categories, so we verify
/// through the list endpoint instead.
///
/// Verifies that:
/// - Category can be created successfully
/// - Category appears in list with correct data
/// - Category can be updated with new data
/// - Category can be deleted successfully
/// - All operations maintain data consistency
#[tokio::test]
async fn test_full_category_crud_flow() {
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

    // Step 1: Create category
    let create_request = json!({
        "name": "CRUD Test Category",
        "icon": "🧪",
        "color": "#1ABC9C"
    });
    let create_response =
        post_authenticated(&server, "/api/v1/categories", &auth.token, &create_request).await;
    assert_status(&create_response, 201);
    let created_category: CategoryResponse = extract_json(create_response);

    assert_eq!(created_category.name, "CRUD Test Category");
    assert_eq!(created_category.icon, Some("🧪".to_string()));
    assert_eq!(created_category.color, Some("#1ABC9C".to_string()));

    // Step 2: Verify category appears in list
    let list_response = get_authenticated(&server, "/api/v1/categories", &auth.token).await;
    assert_status(&list_response, 200);
    let categories: Vec<CategoryResponse> = extract_json(list_response);

    let found_category = categories
        .iter()
        .find(|c| c.id == created_category.id)
        .expect("Created category should appear in list");

    assert_eq!(found_category.name, created_category.name);
    assert_eq!(found_category.icon, created_category.icon);
    assert_eq!(found_category.color, created_category.color);

    // Step 3: Update category
    let update_request = json!({
        "name": "Updated CRUD Category",
        "icon": "✨",
        "color": "#E67E22"
    });
    let update_response = put_authenticated(
        &server,
        &format!("/api/v1/categories/{}", created_category.id),
        &auth.token,
        &update_request,
    )
    .await;
    assert_status(&update_response, 200);
    let updated_category: CategoryResponse = extract_json(update_response);

    assert_eq!(updated_category.id, created_category.id);
    assert_eq!(updated_category.name, "Updated CRUD Category");
    assert_eq!(updated_category.icon, Some("✨".to_string()));
    assert_eq!(updated_category.color, Some("#E67E22".to_string()));

    // Step 4: Verify update persisted in list
    let list_response2 = get_authenticated(&server, "/api/v1/categories", &auth.token).await;
    assert_status(&list_response2, 200);
    let categories2: Vec<CategoryResponse> = extract_json(list_response2);

    let verified_category = categories2
        .iter()
        .find(|c| c.id == created_category.id)
        .expect("Updated category should appear in list");

    assert_eq!(verified_category.name, "Updated CRUD Category");
    assert_eq!(verified_category.icon, Some("✨".to_string()));

    // Step 5: Delete category
    let delete_response = delete_authenticated(
        &server,
        &format!("/api/v1/categories/{}", created_category.id),
        &auth.token,
    )
    .await;
    assert_status(&delete_response, 204);

    // Step 6: Verify deletion
    let list_response3 = get_authenticated(&server, "/api/v1/categories", &auth.token).await;
    assert_status(&list_response3, 200);
    let final_categories: Vec<CategoryResponse> = extract_json(list_response3);
    assert_eq!(
        final_categories.len(),
        0,
        "All categories should be deleted"
    );
}
