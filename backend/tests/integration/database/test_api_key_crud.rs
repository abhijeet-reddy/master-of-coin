use diesel::prelude::*;
use master_of_coin_backend::auth::api_key::{extract_key_prefix, generate_api_key, hash_api_key};
use master_of_coin_backend::db::{create_pool, run_migrations};
use master_of_coin_backend::models::{ApiKey, ApiKeyScopes, NewApiKey, ScopePermission};
use master_of_coin_backend::schema::api_keys;
use master_of_coin_backend::types::ApiKeyStatus;
use serde_json::json;
use serial_test::serial;

use super::common;

#[test]
#[serial]
fn test_api_key_create() {
    let database_url = common::get_test_database_url();
    let pool = create_pool(&database_url, 5).expect("Failed to create pool");
    let mut conn = pool.get().expect("Failed to get connection");

    run_migrations(&mut conn).expect("Failed to run migrations");
    common::cleanup_test_data(&mut conn);

    // Create a test user first
    let user = common::create_test_user(&mut conn, "apikey").expect("Failed to create user");

    // Generate and hash an API key
    let plain_key = generate_api_key();
    let key_hash = hash_api_key(&plain_key).expect("Failed to hash key");
    let key_prefix = extract_key_prefix(&plain_key);

    // Create scopes
    let scopes = ApiKeyScopes {
        transactions: vec![ScopePermission::Read, ScopePermission::Write],
        accounts: vec![ScopePermission::Read],
        budgets: vec![],
        categories: vec![],
        people: vec![],
    };
    let scopes_json = serde_json::to_value(&scopes).expect("Failed to serialize scopes");

    // Insert API key
    let new_api_key = NewApiKey {
        user_id: user.id,
        name: "Test Key".to_string(),
        key_hash,
        key_prefix: key_prefix.clone(),
        scopes: scopes_json,
        status: ApiKeyStatus::Active,
        expires_at: None,
    };

    let created_key: ApiKey = diesel::insert_into(api_keys::table)
        .values(&new_api_key)
        .get_result(&mut conn)
        .expect("Failed to create API key");

    assert_eq!(created_key.name, "Test Key");
    assert_eq!(created_key.user_id, user.id);
    assert_eq!(created_key.key_prefix, key_prefix);
    assert_eq!(created_key.status, ApiKeyStatus::Active);
    assert!(!created_key.id.is_nil());

    common::cleanup_test_data(&mut conn);
}

#[test]
#[serial]
fn test_api_key_find_by_prefix() {
    let database_url = common::get_test_database_url();
    let pool = create_pool(&database_url, 5).expect("Failed to create pool");
    let mut conn = pool.get().expect("Failed to get connection");

    run_migrations(&mut conn).expect("Failed to run migrations");
    common::cleanup_test_data(&mut conn);

    let user = common::create_test_user(&mut conn, "prefix").expect("Failed to create user");

    // Create API key
    let plain_key = generate_api_key();
    let key_hash = hash_api_key(&plain_key).expect("Failed to hash key");
    let key_prefix = extract_key_prefix(&plain_key);

    let new_api_key = NewApiKey {
        user_id: user.id,
        name: "Prefix Test".to_string(),
        key_hash,
        key_prefix: key_prefix.clone(),
        scopes: json!({}),
        status: ApiKeyStatus::Active,
        expires_at: None,
    };

    diesel::insert_into(api_keys::table)
        .values(&new_api_key)
        .execute(&mut conn)
        .expect("Failed to create API key");

    // Find by prefix
    let found_keys: Vec<ApiKey> = api_keys::table
        .filter(api_keys::key_prefix.eq(&key_prefix))
        .load(&mut conn)
        .expect("Failed to find API key by prefix");

    assert_eq!(found_keys.len(), 1);
    assert_eq!(found_keys[0].key_prefix, key_prefix);

    common::cleanup_test_data(&mut conn);
}

#[test]
#[serial]
fn test_api_key_update_status() {
    let database_url = common::get_test_database_url();
    let pool = create_pool(&database_url, 5).expect("Failed to create pool");
    let mut conn = pool.get().expect("Failed to get connection");

    run_migrations(&mut conn).expect("Failed to run migrations");
    common::cleanup_test_data(&mut conn);

    let user = common::create_test_user(&mut conn, "status").expect("Failed to create user");

    // Create API key
    let plain_key = generate_api_key();
    let key_hash = hash_api_key(&plain_key).expect("Failed to hash key");
    let key_prefix = extract_key_prefix(&plain_key);

    let new_api_key = NewApiKey {
        user_id: user.id,
        name: "Status Test".to_string(),
        key_hash,
        key_prefix,
        scopes: json!({}),
        status: ApiKeyStatus::Active,
        expires_at: None,
    };

    let created_key: ApiKey = diesel::insert_into(api_keys::table)
        .values(&new_api_key)
        .get_result(&mut conn)
        .expect("Failed to create API key");

    assert_eq!(created_key.status, ApiKeyStatus::Active);

    // Update status to revoked
    let updated_key: ApiKey =
        diesel::update(api_keys::table.filter(api_keys::id.eq(created_key.id)))
            .set(api_keys::status.eq(ApiKeyStatus::Revoked))
            .get_result(&mut conn)
            .expect("Failed to update status");

    assert_eq!(updated_key.status, ApiKeyStatus::Revoked);

    common::cleanup_test_data(&mut conn);
}

#[test]
#[serial]
fn test_api_key_list_by_user() {
    let database_url = common::get_test_database_url();
    let pool = create_pool(&database_url, 5).expect("Failed to create pool");
    let mut conn = pool.get().expect("Failed to get connection");

    run_migrations(&mut conn).expect("Failed to run migrations");
    common::cleanup_test_data(&mut conn);

    let user = common::create_test_user(&mut conn, "list").expect("Failed to create user");

    // Create multiple API keys
    for i in 1..=3 {
        let plain_key = generate_api_key();
        let key_hash = hash_api_key(&plain_key).expect("Failed to hash key");
        let key_prefix = extract_key_prefix(&plain_key);

        let new_api_key = NewApiKey {
            user_id: user.id,
            name: format!("Key {}", i),
            key_hash,
            key_prefix,
            scopes: json!({}),
            status: ApiKeyStatus::Active,
            expires_at: None,
        };

        diesel::insert_into(api_keys::table)
            .values(&new_api_key)
            .execute(&mut conn)
            .expect("Failed to create API key");
    }

    // List all keys for user
    let user_keys: Vec<ApiKey> = api_keys::table
        .filter(api_keys::user_id.eq(user.id))
        .load(&mut conn)
        .expect("Failed to load user's API keys");

    assert_eq!(user_keys.len(), 3);

    common::cleanup_test_data(&mut conn);
}

#[test]
#[serial]
fn test_api_key_cascade_delete() {
    let database_url = common::get_test_database_url();
    let pool = create_pool(&database_url, 5).expect("Failed to create pool");
    let mut conn = pool.get().expect("Failed to get connection");

    run_migrations(&mut conn).expect("Failed to run migrations");
    common::cleanup_test_data(&mut conn);

    let user = common::create_test_user(&mut conn, "cascade").expect("Failed to create user");

    // Create API key
    let plain_key = generate_api_key();
    let key_hash = hash_api_key(&plain_key).expect("Failed to hash key");
    let key_prefix = extract_key_prefix(&plain_key);

    let new_api_key = NewApiKey {
        user_id: user.id,
        name: "Cascade Test".to_string(),
        key_hash,
        key_prefix,
        scopes: json!({}),
        status: ApiKeyStatus::Active,
        expires_at: None,
    };

    let created_key: ApiKey = diesel::insert_into(api_keys::table)
        .values(&new_api_key)
        .get_result(&mut conn)
        .expect("Failed to create API key");

    // Delete user (should cascade delete API keys)
    use master_of_coin_backend::schema::users;
    diesel::delete(users::table.filter(users::id.eq(user.id)))
        .execute(&mut conn)
        .expect("Failed to delete user");

    // Verify API key was also deleted
    let find_result: Result<ApiKey, _> = api_keys::table
        .filter(api_keys::id.eq(created_key.id))
        .first(&mut conn);

    assert!(
        find_result.is_err(),
        "API key should be deleted when user is deleted"
    );

    common::cleanup_test_data(&mut conn);
}
