use super::common;

use diesel::prelude::*;
use master_of_coin_backend::db::{create_pool, run_migrations};
use master_of_coin_backend::models::User;
use master_of_coin_backend::schema::users;
use serial_test::serial;

#[tokio::test]
#[serial]
async fn test_spawn_blocking_basic() {
    let database_url = common::get_test_database_url();
    let pool = create_pool(&database_url, 5).expect("Failed to create pool");

    let pool_clone = pool.clone();

    let result = tokio::task::spawn_blocking(move || {
        let mut conn = pool_clone.get().expect("Failed to get connection");
        run_migrations(&mut conn).expect("Failed to run migrations");
        common::cleanup_test_data(&mut conn);

        common::create_test_user(&mut conn, "async_basic").expect("Failed to create user")
    })
    .await;

    assert!(result.is_ok(), "Async spawn_blocking failed");
    let user = result.unwrap();
    assert!(user.username.starts_with("testuser_async_basic_"));

    // Cleanup
    let pool_clone = pool.clone();
    tokio::task::spawn_blocking(move || {
        let mut conn = pool_clone.get().expect("Failed to get connection");
        common::cleanup_test_data(&mut conn);
    })
    .await
    .expect("Failed to cleanup");
}

#[tokio::test]
#[serial]
async fn test_spawn_blocking_multiple_operations() {
    let database_url = common::get_test_database_url();
    let pool = create_pool(&database_url, 5).expect("Failed to create pool");

    let pool_clone = pool.clone();

    // Create user in blocking task
    let user = tokio::task::spawn_blocking(move || {
        let mut conn = pool_clone.get().expect("Failed to get connection");
        run_migrations(&mut conn).expect("Failed to run migrations");
        common::cleanup_test_data(&mut conn);

        common::create_test_user(&mut conn, "async_multi").expect("Failed to create user")
    })
    .await
    .expect("Failed to create user");

    // Query user in another blocking task
    let pool_clone = pool.clone();
    let user_id = user.id;
    let found_user = tokio::task::spawn_blocking(move || {
        let mut conn = pool_clone.get().expect("Failed to get connection");

        users::table
            .filter(users::id.eq(user_id))
            .first::<User>(&mut conn)
            .expect("Failed to find user")
    })
    .await
    .expect("Failed to query user");

    assert_eq!(found_user.id, user.id);
    assert_eq!(found_user.username, user.username);

    // Cleanup
    let pool_clone = pool.clone();
    tokio::task::spawn_blocking(move || {
        let mut conn = pool_clone.get().expect("Failed to get connection");
        common::cleanup_test_data(&mut conn);
    })
    .await
    .expect("Failed to cleanup");
}
