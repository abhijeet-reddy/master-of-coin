use diesel::prelude::*;
use master_of_coin_backend::db::{create_pool, run_migrations};
use master_of_coin_backend::models::{NewUser, User};
use master_of_coin_backend::schema::users;
use serial_test::serial;

use super::common;

#[test]
#[serial]
fn test_user_create() {
    let database_url = common::get_test_database_url();
    let pool = create_pool(&database_url, 5).expect("Failed to create pool");
    let mut conn = pool.get().expect("Failed to get connection");

    run_migrations(&mut conn).expect("Failed to run migrations");
    common::cleanup_test_data(&mut conn);

    let new_user = NewUser {
        username: "create_test_user",
        email: "create@test.com",
        password_hash: "test_hash_123",
        name: "Create Test User",
    };

    let created_user: User = diesel::insert_into(users::table)
        .values(&new_user)
        .get_result(&mut conn)
        .expect("Failed to create user");

    assert_eq!(created_user.username, "create_test_user");
    assert_eq!(created_user.email, "create@test.com");
    assert_eq!(created_user.name, "Create Test User");
    assert!(!created_user.id.is_nil(), "User ID should not be nil");

    common::cleanup_test_data(&mut conn);
}

#[test]
#[serial]
fn test_user_read() {
    let database_url = common::get_test_database_url();
    let pool = create_pool(&database_url, 5).expect("Failed to create pool");
    let mut conn = pool.get().expect("Failed to get connection");

    run_migrations(&mut conn).expect("Failed to run migrations");
    common::cleanup_test_data(&mut conn);

    let created_user = common::create_test_user(&mut conn, "read").expect("Failed to create user");

    // Query by ID
    let found_user: User = users::table
        .filter(users::id.eq(created_user.id))
        .first(&mut conn)
        .expect("Failed to find user by ID");

    assert_eq!(found_user.id, created_user.id);
    assert_eq!(found_user.username, created_user.username);

    // Query by email
    let found_by_email: User = users::table
        .filter(users::email.eq(&created_user.email))
        .first(&mut conn)
        .expect("Failed to find user by email");

    assert_eq!(found_by_email.id, created_user.id);

    common::cleanup_test_data(&mut conn);
}

#[test]
#[serial]
fn test_user_update() {
    let database_url = common::get_test_database_url();
    let pool = create_pool(&database_url, 5).expect("Failed to create pool");
    let mut conn = pool.get().expect("Failed to get connection");

    run_migrations(&mut conn).expect("Failed to run migrations");
    common::cleanup_test_data(&mut conn);

    let created_user =
        common::create_test_user(&mut conn, "update").expect("Failed to create user");

    let updated_user: User = diesel::update(users::table.filter(users::id.eq(created_user.id)))
        .set(users::name.eq("Updated Test User"))
        .get_result(&mut conn)
        .expect("Failed to update user");

    assert_eq!(updated_user.name, "Updated Test User");
    assert_eq!(updated_user.id, created_user.id);

    common::cleanup_test_data(&mut conn);
}

#[test]
#[serial]
fn test_user_delete() {
    let database_url = common::get_test_database_url();
    let pool = create_pool(&database_url, 5).expect("Failed to create pool");
    let mut conn = pool.get().expect("Failed to get connection");

    run_migrations(&mut conn).expect("Failed to run migrations");
    common::cleanup_test_data(&mut conn);

    let created_user =
        common::create_test_user(&mut conn, "delete").expect("Failed to create user");

    let deleted_count = diesel::delete(users::table.filter(users::id.eq(created_user.id)))
        .execute(&mut conn)
        .expect("Failed to delete user");

    assert_eq!(deleted_count, 1, "Should have deleted exactly one user");

    // Verify deletion
    let find_result: Result<User, _> = users::table
        .filter(users::id.eq(created_user.id))
        .first(&mut conn);

    assert!(find_result.is_err(), "User should not exist after deletion");

    common::cleanup_test_data(&mut conn);
}

#[test]
#[serial]
fn test_user_list() {
    let database_url = common::get_test_database_url();
    let pool = create_pool(&database_url, 5).expect("Failed to create pool");
    let mut conn = pool.get().expect("Failed to get connection");

    run_migrations(&mut conn).expect("Failed to run migrations");
    common::cleanup_test_data(&mut conn);

    // Create multiple users
    let _user1 = common::create_test_user(&mut conn, "list1").expect("Failed to create user1");
    let _user2 = common::create_test_user(&mut conn, "list2").expect("Failed to create user2");
    let _user3 = common::create_test_user(&mut conn, "list3").expect("Failed to create user3");

    // Query all users
    let all_users: Vec<User> = users::table.load(&mut conn).expect("Failed to load users");

    assert!(all_users.len() >= 3, "Should have at least 3 users");

    common::cleanup_test_data(&mut conn);
}
