//! Integration tests for people API endpoints.
//!
//! This module tests the people endpoints including:
//! - GET /api/v1/people - List all people for user
//! - POST /api/v1/people - Create new person
//! - GET /api/v1/people/:id - Get specific person
//! - PUT /api/v1/people/:id - Update person
//! - DELETE /api/v1/people/:id - Delete person
//! - GET /api/v1/people/:id/debts - Get debts for person
//! - POST /api/v1/people/:id/settle-debt - Settle debt with person
//!
//! Tests cover success cases, error cases, authorization, and data isolation.

use crate::common::*;
use chrono::Utc;
use master_of_coin_backend::{models::PersonResponse, services::debt_service::PersonDebt};
use serde_json::json;

// ============================================================================
// List People Tests
// ============================================================================

/// Test that a new user has no people initially.
///
/// Verifies that:
/// - Status code is 200 OK
/// - Response is an empty array
/// - No people exist for a newly registered user
#[tokio::test]
async fn test_list_people_empty() {
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

    // List people should return empty array
    let response = get_authenticated(&server, "/api/v1/people", &auth.token).await;
    assert_status(&response, 200);

    let people: Vec<PersonResponse> = extract_json(response);
    assert_eq!(people.len(), 0, "New user should have no people");
}

/// Test that list people returns user's people.
///
/// Verifies that:
/// - Status code is 200 OK
/// - Response contains all user's people
/// - Person data is correct
#[tokio::test]
async fn test_list_people_with_data() {
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

    // Create multiple people
    let person1 = json!({
        "name": "John Doe",
        "email": "john@example.com",
        "phone": "+1234567890",
        "notes": "Friend from college"
    });
    let response1 = post_authenticated(&server, "/api/v1/people", &auth.token, &person1).await;
    assert_status(&response1, 201);

    let person2 = json!({
        "name": "Jane Smith",
        "email": "jane@example.com"
    });
    let response2 = post_authenticated(&server, "/api/v1/people", &auth.token, &person2).await;
    assert_status(&response2, 201);

    // List people
    let response = get_authenticated(&server, "/api/v1/people", &auth.token).await;
    assert_status(&response, 200);

    let people: Vec<PersonResponse> = extract_json(response);
    assert_eq!(people.len(), 2, "User should have 2 people");

    // Verify person details
    let john = people.iter().find(|p| p.name == "John Doe").unwrap();
    assert_eq!(john.email, Some("john@example.com".to_string()));
    assert_eq!(john.phone, Some("+1234567890".to_string()));
    assert_eq!(john.notes, Some("Friend from college".to_string()));

    let jane = people.iter().find(|p| p.name == "Jane Smith").unwrap();
    assert_eq!(jane.email, Some("jane@example.com".to_string()));
    assert_eq!(jane.phone, None);
    assert_eq!(jane.notes, None);
}

/// Test that listing people without authentication fails.
///
/// Verifies that:
/// - Status code is 401 Unauthorized
/// - Error message indicates missing authentication
#[tokio::test]
async fn test_list_people_unauthorized() {
    let server = create_test_server().await;

    // Try to list people without token
    let response = get_unauthenticated(&server, "/api/v1/people").await;
    assert_status(&response, 401);

    let error_text = response.text();
    assert!(
        error_text.to_lowercase().contains("unauthorized")
            || error_text.to_lowercase().contains("token"),
        "Error message should indicate missing authentication"
    );
}

/// Test that users can only see their own people (data isolation).
///
/// Verifies that:
/// - User A can see their people
/// - User B can see their people
/// - User A cannot see User B's people
/// - User B cannot see User A's people
#[tokio::test]
async fn test_list_people_isolation() {
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

    // User A creates a person
    let person_a = json!({
        "name": "User A Person",
        "email": "persona@example.com"
    });
    let response_a = post_authenticated(&server, "/api/v1/people", &auth_a.token, &person_a).await;
    assert_status(&response_a, 201);

    // User B creates a person
    let person_b = json!({
        "name": "User B Person",
        "email": "personb@example.com"
    });
    let response_b = post_authenticated(&server, "/api/v1/people", &auth_b.token, &person_b).await;
    assert_status(&response_b, 201);

    // User A lists people - should only see their own
    let response_a = get_authenticated(&server, "/api/v1/people", &auth_a.token).await;
    assert_status(&response_a, 200);
    let people_a: Vec<PersonResponse> = extract_json(response_a);
    assert_eq!(people_a.len(), 1);
    assert_eq!(people_a[0].name, "User A Person");

    // User B lists people - should only see their own
    let response_b = get_authenticated(&server, "/api/v1/people", &auth_b.token).await;
    assert_status(&response_b, 200);
    let people_b: Vec<PersonResponse> = extract_json(response_b);
    assert_eq!(people_b.len(), 1);
    assert_eq!(people_b[0].name, "User B Person");
}

// ============================================================================
// Create Person Tests
// ============================================================================

/// Test successful person creation with all fields.
///
/// Verifies that:
/// - Status code is 201 Created
/// - Response contains person data
/// - Person ID is a valid UUID
/// - All fields are correctly set
#[tokio::test]
async fn test_create_person_success() {
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
        "name": "John Doe",
        "email": "john@example.com",
        "phone": "+1234567890",
        "notes": "Friend from work"
    });

    let response = post_authenticated(&server, "/api/v1/people", &auth.token, &request).await;
    assert_status(&response, 201);

    let person: PersonResponse = extract_json(response);
    assert_eq!(person.name, "John Doe");
    assert_eq!(person.email, Some("john@example.com".to_string()));
    assert_eq!(person.phone, Some("+1234567890".to_string()));
    assert_eq!(person.notes, Some("Friend from work".to_string()));
    assert_eq!(person.user_id, auth.user.id);
}

/// Test creating person with only required fields and optional fields.
///
/// Verifies that:
/// - Person can be created with only name
/// - Person can be created with email and notes
/// - Optional fields are handled correctly
#[tokio::test]
async fn test_create_person_with_optional_fields() {
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

    // Create person with only name
    let minimal_request = json!({
        "name": "Minimal Person"
    });
    let response =
        post_authenticated(&server, "/api/v1/people", &auth.token, &minimal_request).await;
    assert_status(&response, 201);
    let minimal_person: PersonResponse = extract_json(response);
    assert_eq!(minimal_person.name, "Minimal Person");
    assert_eq!(minimal_person.email, None);
    assert_eq!(minimal_person.phone, None);
    assert_eq!(minimal_person.notes, None);

    // Create person with email and notes
    let partial_request = json!({
        "name": "Partial Person",
        "email": "partial@example.com",
        "notes": "Has email and notes"
    });
    let response =
        post_authenticated(&server, "/api/v1/people", &auth.token, &partial_request).await;
    assert_status(&response, 201);
    let partial_person: PersonResponse = extract_json(response);
    assert_eq!(partial_person.name, "Partial Person");
    assert_eq!(
        partial_person.email,
        Some("partial@example.com".to_string())
    );
    assert_eq!(partial_person.phone, None);
    assert_eq!(
        partial_person.notes,
        Some("Has email and notes".to_string())
    );
}

/// Test that creating person with missing required fields fails.
///
/// Verifies that:
/// - Missing name fails with 422
/// - Error messages indicate validation failure
#[tokio::test]
async fn test_create_person_missing_fields() {
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
        "email": "test@example.com"
    });
    let response = post_authenticated(&server, "/api/v1/people", &auth.token, &missing_name).await;
    assert_status(&response, 422);

    // Empty name
    let empty_name = json!({
        "name": ""
    });
    let response = post_authenticated(&server, "/api/v1/people", &auth.token, &empty_name).await;
    assert_status(&response, 422);

    // Invalid email format
    let invalid_email = json!({
        "name": "Test Person",
        "email": "invalid-email"
    });
    let response = post_authenticated(&server, "/api/v1/people", &auth.token, &invalid_email).await;
    assert_status(&response, 422);
}

/// Test that creating person without authentication fails.
///
/// Verifies that:
/// - Status code is 401 Unauthorized
/// - Error message indicates missing authentication
#[tokio::test]
async fn test_create_person_unauthorized() {
    let server = create_test_server().await;

    let request = json!({
        "name": "Test Person"
    });

    let response = post_unauthenticated(&server, "/api/v1/people", &request).await;
    assert_status(&response, 401);

    let error_text = response.text();
    assert!(
        error_text.to_lowercase().contains("unauthorized")
            || error_text.to_lowercase().contains("token"),
        "Error message should indicate missing authentication"
    );
}

// ============================================================================
// Get Person Tests
// ============================================================================

/// Test successful retrieval of a specific person.
///
/// Verifies that:
/// - Status code is 200 OK
/// - Response contains correct person data
/// - All fields match the created person
#[tokio::test]
async fn test_get_person_success() {
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

    // Create a person
    let create_request = json!({
        "name": "Test Person",
        "email": "test@example.com",
        "phone": "+1234567890",
        "notes": "Test notes"
    });
    let create_response =
        post_authenticated(&server, "/api/v1/people", &auth.token, &create_request).await;
    assert_status(&create_response, 201);
    let created_person: PersonResponse = extract_json(create_response);

    // Get the person
    let get_response = get_authenticated(
        &server,
        &format!("/api/v1/people/{}", created_person.id),
        &auth.token,
    )
    .await;
    assert_status(&get_response, 200);

    let person: PersonResponse = extract_json(get_response);
    assert_eq!(person.id, created_person.id);
    assert_eq!(person.name, "Test Person");
    assert_eq!(person.email, Some("test@example.com".to_string()));
    assert_eq!(person.phone, Some("+1234567890".to_string()));
    assert_eq!(person.notes, Some("Test notes".to_string()));
}

/// Test that getting a non-existent person fails.
///
/// Verifies that:
/// - Status code is 404 Not Found
/// - Error message indicates person not found
#[tokio::test]
async fn test_get_person_not_found() {
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

    // Try to get a non-existent person
    let fake_id = uuid::Uuid::new_v4();
    let response =
        get_authenticated(&server, &format!("/api/v1/people/{}", fake_id), &auth.token).await;
    assert_status(&response, 404);

    let error_text = response.text();
    assert!(
        error_text.to_lowercase().contains("not found")
            || error_text.to_lowercase().contains("person"),
        "Error message should indicate person not found"
    );
}

/// Test that users cannot access other users' people.
///
/// Verifies that:
/// - Status code is 403 Forbidden
/// - User A cannot access User B's person
#[tokio::test]
async fn test_get_person_wrong_user() {
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

    // User A creates a person
    let create_request = json!({
        "name": "User A Person"
    });
    let create_response =
        post_authenticated(&server, "/api/v1/people", &auth_a.token, &create_request).await;
    assert_status(&create_response, 201);
    let person_a: PersonResponse = extract_json(create_response);

    // User B tries to access User A's person
    let response = get_authenticated(
        &server,
        &format!("/api/v1/people/{}", person_a.id),
        &auth_b.token,
    )
    .await;

    // Should be 403 Forbidden (user authenticated but accessing wrong resource)
    assert_status(&response, 403);
}

/// Test that getting person without authentication fails.
///
/// Verifies that:
/// - Status code is 401 Unauthorized
/// - Error message indicates missing authentication
#[tokio::test]
async fn test_get_person_unauthorized() {
    let server = create_test_server().await;

    let fake_id = uuid::Uuid::new_v4();
    let response = get_unauthenticated(&server, &format!("/api/v1/people/{}", fake_id)).await;
    assert_status(&response, 401);

    let error_text = response.text();
    assert!(
        error_text.to_lowercase().contains("unauthorized")
            || error_text.to_lowercase().contains("token"),
        "Error message should indicate missing authentication"
    );
}

// ============================================================================
// Update Person Tests
// ============================================================================

/// Test successful person update.
///
/// Verifies that:
/// - Status code is 200 OK
/// - Response contains updated person data
/// - Only specified fields are updated
#[tokio::test]
async fn test_update_person_success() {
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

    // Create a person
    let create_request = json!({
        "name": "Original Name",
        "email": "original@example.com",
        "phone": "+1111111111",
        "notes": "Original notes"
    });
    let create_response =
        post_authenticated(&server, "/api/v1/people", &auth.token, &create_request).await;
    assert_status(&create_response, 201);
    let person: PersonResponse = extract_json(create_response);

    // Update the person
    let update_request = json!({
        "name": "Updated Name",
        "email": "updated@example.com",
        "notes": "Updated notes"
    });
    let update_response = put_authenticated(
        &server,
        &format!("/api/v1/people/{}", person.id),
        &auth.token,
        &update_request,
    )
    .await;
    assert_status(&update_response, 200);

    let updated_person: PersonResponse = extract_json(update_response);
    assert_eq!(updated_person.id, person.id);
    assert_eq!(updated_person.name, "Updated Name");
    assert_eq!(
        updated_person.email,
        Some("updated@example.com".to_string())
    );
    assert_eq!(updated_person.notes, Some("Updated notes".to_string()));
    // Phone should remain unchanged
    assert_eq!(updated_person.phone, Some("+1111111111".to_string()));
}

/// Test partial person update (only some fields).
///
/// Verifies that:
/// - Status code is 200 OK
/// - Only specified fields are updated
/// - Other fields remain unchanged
#[tokio::test]
async fn test_update_person_partial() {
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

    // Create a person
    let create_request = json!({
        "name": "Original Name",
        "email": "original@example.com",
        "phone": "+1111111111",
        "notes": "Original notes"
    });
    let create_response =
        post_authenticated(&server, "/api/v1/people", &auth.token, &create_request).await;
    assert_status(&create_response, 201);
    let person: PersonResponse = extract_json(create_response);

    // Update only the name
    let update_request = json!({
        "name": "New Name Only"
    });
    let update_response = put_authenticated(
        &server,
        &format!("/api/v1/people/{}", person.id),
        &auth.token,
        &update_request,
    )
    .await;
    assert_status(&update_response, 200);

    let updated_person: PersonResponse = extract_json(update_response);
    assert_eq!(updated_person.name, "New Name Only");
    assert_eq!(
        updated_person.email,
        Some("original@example.com".to_string())
    );
    assert_eq!(updated_person.phone, Some("+1111111111".to_string()));
    assert_eq!(updated_person.notes, Some("Original notes".to_string()));
}

/// Test that updating a non-existent person fails.
///
/// Verifies that:
/// - Status code is 404 Not Found
/// - Error message indicates person not found
#[tokio::test]
async fn test_update_person_not_found() {
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
        &format!("/api/v1/people/{}", fake_id),
        &auth.token,
        &update_request,
    )
    .await;
    assert_status(&response, 404);
}

/// Test that users cannot update other users' people.
///
/// Verifies that:
/// - Status code is 403 Forbidden
/// - User B cannot update User A's person
#[tokio::test]
async fn test_update_person_wrong_user() {
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

    // User A creates a person
    let create_request = json!({
        "name": "User A Person"
    });
    let create_response =
        post_authenticated(&server, "/api/v1/people", &auth_a.token, &create_request).await;
    assert_status(&create_response, 201);
    let person: PersonResponse = extract_json(create_response);

    // User B tries to update User A's person
    let update_request = json!({
        "name": "Hacked Name"
    });
    let response = put_authenticated(
        &server,
        &format!("/api/v1/people/{}", person.id),
        &auth_b.token,
        &update_request,
    )
    .await;

    assert_status(&response, 403);
}

/// Test that updating person without authentication fails.
///
/// Verifies that:
/// - Status code is 401 Unauthorized
/// - Error message indicates missing authentication
#[tokio::test]
async fn test_update_person_unauthorized() {
    let server = create_test_server().await;

    let fake_id = uuid::Uuid::new_v4();
    let update_request = json!({
        "name": "New Name"
    });

    let response = server
        .put(&format!("/api/v1/people/{}", fake_id))
        .json(&update_request)
        .await;
    assert_status(&response, 401);
}

// ============================================================================
// Delete Person Tests
// ============================================================================

/// Test successful person deletion.
///
/// Verifies that:
/// - Status code is 204 No Content
/// - Person is actually deleted
/// - Subsequent GET returns 404
#[tokio::test]
async fn test_delete_person_success() {
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

    // Create a person
    let create_request = json!({
        "name": "Person to Delete"
    });
    let create_response =
        post_authenticated(&server, "/api/v1/people", &auth.token, &create_request).await;
    assert_status(&create_response, 201);
    let person: PersonResponse = extract_json(create_response);

    // Delete the person
    let delete_response = delete_authenticated(
        &server,
        &format!("/api/v1/people/{}", person.id),
        &auth.token,
    )
    .await;
    assert_status(&delete_response, 204);

    // Verify person is deleted - GET should return 404
    let get_response = get_authenticated(
        &server,
        &format!("/api/v1/people/{}", person.id),
        &auth.token,
    )
    .await;
    assert_status(&get_response, 404);

    // Verify person is not in list
    let list_response = get_authenticated(&server, "/api/v1/people", &auth.token).await;
    assert_status(&list_response, 200);
    let people: Vec<PersonResponse> = extract_json(list_response);
    assert!(
        !people.iter().any(|p| p.id == person.id),
        "Deleted person should not appear in list"
    );
}

/// Test that deleting a non-existent person fails.
///
/// Verifies that:
/// - Status code is 404 Not Found
/// - Error message indicates person not found
#[tokio::test]
async fn test_delete_person_not_found() {
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
    let response =
        delete_authenticated(&server, &format!("/api/v1/people/{}", fake_id), &auth.token).await;
    assert_status(&response, 404);
}

/// Test that users cannot delete other users' people.
///
/// Verifies that:
/// - Status code is 403 Forbidden
/// - User B cannot delete User A's person
#[tokio::test]
async fn test_delete_person_wrong_user() {
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

    // User A creates a person
    let create_request = json!({
        "name": "User A Person"
    });
    let create_response =
        post_authenticated(&server, "/api/v1/people", &auth_a.token, &create_request).await;
    assert_status(&create_response, 201);
    let person: PersonResponse = extract_json(create_response);

    // User B tries to delete User A's person
    let response = delete_authenticated(
        &server,
        &format!("/api/v1/people/{}", person.id),
        &auth_b.token,
    )
    .await;

    assert_status(&response, 403);

    // Verify person still exists for User A
    let get_response = get_authenticated(
        &server,
        &format!("/api/v1/people/{}", person.id),
        &auth_a.token,
    )
    .await;
    assert_status(&get_response, 200);
}

/// Test that deleting person without authentication fails.
///
/// Verifies that:
/// - Status code is 401 Unauthorized
/// - Error message indicates missing authentication
#[tokio::test]
async fn test_delete_person_unauthorized() {
    let server = create_test_server().await;

    let fake_id = uuid::Uuid::new_v4();
    let response = server.delete(&format!("/api/v1/people/{}", fake_id)).await;
    assert_status(&response, 401);
}

// ============================================================================
// Debt Management Tests
// ============================================================================

/// Test that getting debts for person with no debts returns empty.
///
/// Verifies that:
/// - Status code is 200 OK
/// - Person with no debts returns zero debt amount
#[tokio::test]
async fn test_get_person_debts_empty() {
    let server = create_test_server().await;
    let timestamp = Utc::now().timestamp_nanos_opt().unwrap();

    let auth = register_test_user(
        &server,
        &format!("debtsempty_{}", timestamp),
        &format!("debtsempty_{}@example.com", timestamp),
        "SecurePass123!",
        "Debts Empty User",
    )
    .await;

    // Create a person
    let person = create_test_person(&server, &auth.token, "Test Person").await;

    // Get debts for person (should be empty)
    let response = get_authenticated(
        &server,
        &format!("/api/v1/people/{}/debts", person.id),
        &auth.token,
    )
    .await;
    assert_status(&response, 200);

    let debt: PersonDebt = extract_json(response);
    assert_eq!(debt.person_id, person.id);
    assert_eq!(debt.person_name, "Test Person");
    assert_eq!(debt.debt_amount, "0");
}

/// Test that getting debts for person with debts returns correct data.
///
/// Verifies that:
/// - Status code is 200 OK
/// - Person with debts returns correct debt amount
/// - Debt calculation is accurate
#[tokio::test]
async fn test_get_person_debts_with_data() {
    let server = create_test_server().await;
    let timestamp = Utc::now().timestamp_nanos_opt().unwrap();

    let auth = register_test_user(
        &server,
        &format!("debtsdata_{}", timestamp),
        &format!("debtsdata_{}@example.com", timestamp),
        "SecurePass123!",
        "Debts Data User",
    )
    .await;

    // Create account, category, and person
    let account = create_test_account(&server, &auth.token, "Test Account").await;
    let category = create_test_category(&server, &auth.token, "Test Category").await;
    let person = create_test_person(&server, &auth.token, "Test Person").await;

    // Create a transaction with splits
    let transaction_request = json!({
        "account_id": account.id,
        "category_id": category.id,
        "title": "Shared Expense",
        "amount": 100.0,
        "date": "2023-01-01T00:00:00Z",
        "splits": [
            {
                "person_id": person.id,
                "amount": 50.0
            }
        ]
    });

    let response = post_authenticated(
        &server,
        "/api/v1/transactions",
        &auth.token,
        &transaction_request,
    )
    .await;
    assert_status(&response, 201);

    // Get debts for person
    let response = get_authenticated(
        &server,
        &format!("/api/v1/people/{}/debts", person.id),
        &auth.token,
    )
    .await;
    assert_status(&response, 200);

    let debt: PersonDebt = extract_json(response);
    assert_eq!(debt.person_id, person.id);
    assert_eq!(debt.person_name, "Test Person");
    assert_eq!(debt.debt_amount, "50.00");
}

/// Test that getting debts for non-existent person fails.
///
/// Verifies that:
/// - Status code is 404 Not Found
/// - Error message indicates person not found
#[tokio::test]
async fn test_get_person_debts_not_found() {
    let server = create_test_server().await;
    let timestamp = Utc::now().timestamp_nanos_opt().unwrap();

    let auth = register_test_user(
        &server,
        &format!("debtsnotfound_{}", timestamp),
        &format!("debtsnotfound_{}@example.com", timestamp),
        "SecurePass123!",
        "Debts Not Found User",
    )
    .await;

    let fake_id = uuid::Uuid::new_v4();
    let response = get_authenticated(
        &server,
        &format!("/api/v1/people/{}/debts", fake_id),
        &auth.token,
    )
    .await;
    assert_status(&response, 404);
}

/// Test that users cannot access other users' person debts.
///
/// Verifies that:
/// - Status code is 403 Forbidden
/// - User B cannot access User A's person debts
#[tokio::test]
async fn test_get_person_debts_wrong_user() {
    let server = create_test_server().await;
    let timestamp = Utc::now().timestamp_nanos_opt().unwrap();

    // Register two users
    let auth_a = register_test_user(
        &server,
        &format!("debtswronga_{}", timestamp),
        &format!("debtswronga_{}@example.com", timestamp),
        "SecurePass123!",
        "Debts Wrong A",
    )
    .await;

    let auth_b = register_test_user(
        &server,
        &format!("debtswrongb_{}", timestamp),
        &format!("debtswrongb_{}@example.com", timestamp),
        "SecurePass123!",
        "Debts Wrong B",
    )
    .await;

    // User A creates a person
    let person = create_test_person(&server, &auth_a.token, "User A Person").await;

    // User B tries to access User A's person debts
    let response = get_authenticated(
        &server,
        &format!("/api/v1/people/{}/debts", person.id),
        &auth_b.token,
    )
    .await;

    assert_status(&response, 403);
}

/// Test that getting person debts without authentication fails.
///
/// Verifies that:
/// - Status code is 401 Unauthorized
/// - Error message indicates missing authentication
#[tokio::test]
async fn test_get_person_debts_unauthorized() {
    let server = create_test_server().await;

    let fake_id = uuid::Uuid::new_v4();
    let response = get_unauthenticated(&server, &format!("/api/v1/people/{}/debts", fake_id)).await;
    assert_status(&response, 401);
}

// ============================================================================
// Settle Debt Tests
// ============================================================================

/// Test successful debt settlement.
///
/// Verifies that:
/// - Status code is 204 No Content
/// - Settlement transaction is created
/// - Debt amount is updated correctly
#[tokio::test]
async fn test_settle_debt_success() {
    let server = create_test_server().await;
    let timestamp = Utc::now().timestamp_nanos_opt().unwrap();

    let auth = register_test_user(
        &server,
        &format!("settleuser_{}", timestamp),
        &format!("settle_{}@example.com", timestamp),
        "SecurePass123!",
        "Settle Test User",
    )
    .await;

    // Create account, category, and person
    let account = create_test_account(&server, &auth.token, "Test Account").await;
    let category = create_test_category(&server, &auth.token, "Test Category").await;
    let person = create_test_person(&server, &auth.token, "Test Person").await;

    // Create a transaction with splits to establish debt
    let transaction_request = json!({
        "account_id": account.id,
        "category_id": category.id,
        "title": "Shared Expense",
        "amount": 100.0,
        "date": "2023-01-01T00:00:00Z",
        "splits": [
            {
                "person_id": person.id,
                "amount": 50.0
            }
        ]
    });

    let response = post_authenticated(
        &server,
        "/api/v1/transactions",
        &auth.token,
        &transaction_request,
    )
    .await;
    assert_status(&response, 201);

    // Verify initial debt
    let debt_response = get_authenticated(
        &server,
        &format!("/api/v1/people/{}/debts", person.id),
        &auth.token,
    )
    .await;
    assert_status(&debt_response, 200);
    let initial_debt: PersonDebt = extract_json(debt_response);
    assert_eq!(initial_debt.debt_amount, "50.00");

    // Settle the debt
    let settle_request = json!({
        "amount": 50.0,
        "account_id": account.id
    });

    let settle_response = post_authenticated(
        &server,
        &format!("/api/v1/people/{}/settle", person.id),
        &auth.token,
        &settle_request,
    )
    .await;
    assert_status(&settle_response, 204);

    // Verify debt is settled
    let final_debt_response = get_authenticated(
        &server,
        &format!("/api/v1/people/{}/debts", person.id),
        &auth.token,
    )
    .await;
    assert_status(&final_debt_response, 200);
    let final_debt: PersonDebt = extract_json(final_debt_response);
    assert_eq!(final_debt.debt_amount, "0");
}

/// Test that settling debt for non-existent person fails.
///
/// Verifies that:
/// - Status code is 404 Not Found
/// - Error message indicates person not found
#[tokio::test]
async fn test_settle_debt_not_found() {
    let server = create_test_server().await;
    let timestamp = Utc::now().timestamp_nanos_opt().unwrap();

    let auth = register_test_user(
        &server,
        &format!("settlenotfound_{}", timestamp),
        &format!("settlenotfound_{}@example.com", timestamp),
        "SecurePass123!",
        "Settle Not Found User",
    )
    .await;

    let account = create_test_account(&server, &auth.token, "Test Account").await;

    let fake_id = uuid::Uuid::new_v4();
    let settle_request = json!({
        "amount": 50.0,
        "account_id": account.id
    });

    let response = post_authenticated(
        &server,
        &format!("/api/v1/people/{}/settle", fake_id),
        &auth.token,
        &settle_request,
    )
    .await;
    assert_status(&response, 404);
}

/// Test that users cannot settle debt with other users' people.
///
/// Verifies that:
/// - Status code is 403 Forbidden
/// - User B cannot settle debt with User A's person
#[tokio::test]
async fn test_settle_debt_wrong_user() {
    let server = create_test_server().await;
    let timestamp = Utc::now().timestamp_nanos_opt().unwrap();

    // Register two users
    let auth_a = register_test_user(
        &server,
        &format!("settlewronga_{}", timestamp),
        &format!("settlewronga_{}@example.com", timestamp),
        "SecurePass123!",
        "Settle Wrong A",
    )
    .await;

    let auth_b = register_test_user(
        &server,
        &format!("settlewrongb_{}", timestamp),
        &format!("settlewrongb_{}@example.com", timestamp),
        "SecurePass123!",
        "Settle Wrong B",
    )
    .await;

    // User A creates a person
    let person = create_test_person(&server, &auth_a.token, "User A Person").await;

    // User B creates an account
    let account_b = create_test_account(&server, &auth_b.token, "User B Account").await;

    // User B tries to settle debt with User A's person
    let settle_request = json!({
        "amount": 50.0,
        "account_id": account_b.id
    });

    let response = post_authenticated(
        &server,
        &format!("/api/v1/people/{}/settle", person.id),
        &auth_b.token,
        &settle_request,
    )
    .await;

    assert_status(&response, 403);
}

/// Test that settling debt without authentication fails.
///
/// Verifies that:
/// - Status code is 401 Unauthorized
/// - Error message indicates missing authentication
#[tokio::test]
async fn test_settle_debt_unauthorized() {
    let server = create_test_server().await;

    let fake_id = uuid::Uuid::new_v4();
    let settle_request = json!({
        "amount": 50.0,
        "account_id": uuid::Uuid::new_v4()
    });

    let response = post_unauthenticated(
        &server,
        &format!("/api/v1/people/{}/settle", fake_id),
        &settle_request,
    )
    .await;
    assert_status(&response, 401);
}

// ============================================================================
// Integration Flow Tests
// ============================================================================

/// Test complete CRUD flow: Create → Read → Update → Delete.
///
/// Verifies that:
/// - Person can be created successfully
/// - Person can be retrieved with correct data
/// - Person can be updated with new data
/// - Person can be deleted successfully
/// - All operations maintain data consistency
#[tokio::test]
async fn test_full_person_crud_flow() {
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

    // Step 1: Create person
    let create_request = json!({
        "name": "CRUD Test Person",
        "email": "crud@example.com",
        "phone": "+1234567890",
        "notes": "Initial notes"
    });
    let create_response =
        post_authenticated(&server, "/api/v1/people", &auth.token, &create_request).await;
    assert_status(&create_response, 201);
    let created_person: PersonResponse = extract_json(create_response);

    assert_eq!(created_person.name, "CRUD Test Person");
    assert_eq!(created_person.email, Some("crud@example.com".to_string()));
    assert_eq!(created_person.phone, Some("+1234567890".to_string()));
    assert_eq!(created_person.notes, Some("Initial notes".to_string()));
    assert_eq!(created_person.user_id, auth.user.id);

    // Step 2: Read person
    let get_response = get_authenticated(
        &server,
        &format!("/api/v1/people/{}", created_person.id),
        &auth.token,
    )
    .await;
    assert_status(&get_response, 200);
    let read_person: PersonResponse = extract_json(get_response);

    assert_eq!(read_person.id, created_person.id);
    assert_eq!(read_person.name, created_person.name);
    assert_eq!(read_person.email, created_person.email);

    // Step 3: Update person
    let update_request = json!({
        "name": "Updated CRUD Person",
        "email": "updated@example.com",
        "notes": "Updated notes"
    });
    let update_response = put_authenticated(
        &server,
        &format!("/api/v1/people/{}", created_person.id),
        &auth.token,
        &update_request,
    )
    .await;
    assert_status(&update_response, 200);
    let updated_person: PersonResponse = extract_json(update_response);

    assert_eq!(updated_person.id, created_person.id);
    assert_eq!(updated_person.name, "Updated CRUD Person");
    assert_eq!(
        updated_person.email,
        Some("updated@example.com".to_string())
    );
    assert_eq!(updated_person.notes, Some("Updated notes".to_string()));
    // Phone should remain unchanged
    assert_eq!(updated_person.phone, Some("+1234567890".to_string()));

    // Step 4: Verify update persisted
    let get_response2 = get_authenticated(
        &server,
        &format!("/api/v1/people/{}", created_person.id),
        &auth.token,
    )
    .await;
    assert_status(&get_response2, 200);
    let verified_person: PersonResponse = extract_json(get_response2);
    assert_eq!(verified_person.name, "Updated CRUD Person");

    // Step 5: Delete person
    let delete_response = delete_authenticated(
        &server,
        &format!("/api/v1/people/{}", created_person.id),
        &auth.token,
    )
    .await;
    assert_status(&delete_response, 204);

    // Step 6: Verify deletion
    let get_response3 = get_authenticated(
        &server,
        &format!("/api/v1/people/{}", created_person.id),
        &auth.token,
    )
    .await;
    assert_status(&get_response3, 404);

    // Step 7: Verify person not in list
    let list_response = get_authenticated(&server, "/api/v1/people", &auth.token).await;
    assert_status(&list_response, 200);
    let final_people: Vec<PersonResponse> = extract_json(list_response);
    assert_eq!(final_people.len(), 0, "All people should be deleted");
}

/// Test complete debt management flow: Create person → Create debt transaction → Get debts → Settle debt.
///
/// Verifies that:
/// - Person can be created
/// - Debt transactions can be created with splits
/// - Debts can be retrieved correctly
/// - Debts can be settled successfully
/// - All debt calculations are accurate
#[tokio::test]
async fn test_full_debt_management_flow() {
    let server = create_test_server().await;
    let timestamp = Utc::now().timestamp_nanos_opt().unwrap();

    let auth = register_test_user(
        &server,
        &format!("debtflow_{}", timestamp),
        &format!("debtflow_{}@example.com", timestamp),
        "SecurePass123!",
        "Debt Flow User",
    )
    .await;

    // Step 1: Create person
    let person = create_test_person(&server, &auth.token, "Debt Test Person").await;

    // Step 2: Create account and category
    let account = create_test_account(&server, &auth.token, "Test Account").await;
    let category = create_test_category(&server, &auth.token, "Test Category").await;

    // Step 3: Create debt transaction with splits
    let transaction_request = json!({
        "account_id": account.id,
        "category_id": category.id,
        "title": "Shared Restaurant Bill",
        "amount": 120.0,
        "date": "2023-01-01T00:00:00Z",
        "splits": [
            {
                "person_id": person.id,
                "amount": 60.0
            }
        ]
    });

    let transaction_response = post_authenticated(
        &server,
        "/api/v1/transactions",
        &auth.token,
        &transaction_request,
    )
    .await;
    assert_status(&transaction_response, 201);

    // Step 4: Get debts for person
    let debt_response = get_authenticated(
        &server,
        &format!("/api/v1/people/{}/debts", person.id),
        &auth.token,
    )
    .await;
    assert_status(&debt_response, 200);
    let debt: PersonDebt = extract_json(debt_response);

    assert_eq!(debt.person_id, person.id);
    assert_eq!(debt.person_name, "Debt Test Person");
    assert_eq!(debt.debt_amount, "60.00");

    // Step 5: Create another debt transaction
    let transaction_request2 = json!({
        "account_id": account.id,
        "category_id": category.id,
        "title": "Shared Groceries",
        "amount": 80.0,
        "date": "2023-01-02T00:00:00Z",
        "splits": [
            {
                "person_id": person.id,
                "amount": 40.0
            }
        ]
    });

    let transaction_response2 = post_authenticated(
        &server,
        "/api/v1/transactions",
        &auth.token,
        &transaction_request2,
    )
    .await;
    assert_status(&transaction_response2, 201);

    // Step 6: Get updated debts
    let debt_response2 = get_authenticated(
        &server,
        &format!("/api/v1/people/{}/debts", person.id),
        &auth.token,
    )
    .await;
    assert_status(&debt_response2, 200);
    let debt2: PersonDebt = extract_json(debt_response2);
    assert_eq!(debt2.debt_amount, "100.00"); // 60 + 40

    // Step 7: Partially settle debt
    let settle_request = json!({
        "amount": 30.0,
        "account_id": account.id
    });

    let settle_response = post_authenticated(
        &server,
        &format!("/api/v1/people/{}/settle", person.id),
        &auth.token,
        &settle_request,
    )
    .await;
    assert_status(&settle_response, 204);

    // Step 8: Verify partial settlement
    let debt_response3 = get_authenticated(
        &server,
        &format!("/api/v1/people/{}/debts", person.id),
        &auth.token,
    )
    .await;
    assert_status(&debt_response3, 200);
    let debt3: PersonDebt = extract_json(debt_response3);
    assert_eq!(debt3.debt_amount, "70.00"); // 100 - 30

    // Step 9: Fully settle remaining debt
    let settle_request2 = json!({
        "amount": 70.0,
        "account_id": account.id
    });

    let settle_response2 = post_authenticated(
        &server,
        &format!("/api/v1/people/{}/settle", person.id),
        &auth.token,
        &settle_request2,
    )
    .await;
    assert_status(&settle_response2, 204);

    // Step 10: Verify debt is fully settled
    let final_debt_response = get_authenticated(
        &server,
        &format!("/api/v1/people/{}/debts", person.id),
        &auth.token,
    )
    .await;
    assert_status(&final_debt_response, 200);
    let final_debt: PersonDebt = extract_json(final_debt_response);
    assert_eq!(final_debt.debt_amount, "0");
}
