use super::common;

use diesel::prelude::*;
use master_of_coin_backend::db::{create_pool, run_migrations};
use master_of_coin_backend::models::User;
use master_of_coin_backend::schema::users;
use serial_test::serial;
use uuid::Uuid;

#[test]
#[serial]
fn test_transaction_rollback() {
    let database_url = common::get_test_database_url();
    let pool = create_pool(&database_url, 5).expect("Failed to create pool");
    let mut conn = pool.get().expect("Failed to get connection");

    run_migrations(&mut conn).expect("Failed to run migrations");
    common::cleanup_test_data(&mut conn);

    // Test that we can use transactions
    let unique_id = Uuid::new_v4();
    let result: Result<User, diesel::result::Error> = conn
        .transaction::<_, diesel::result::Error, _>(|conn| {
            let user = common::create_test_user(
                conn,
                &format!("transaction_{}", &unique_id.to_string()[..8]),
            )?;

            // Verify user exists within transaction
            let found: User = users::table.filter(users::id.eq(user.id)).first(conn)?;

            assert!(found.username.contains("transaction_"));

            // Rollback by returning an error
            Err(diesel::result::Error::RollbackTransaction)
        });

    assert!(result.is_err(), "Transaction should have been rolled back");

    // Verify user doesn't exist after rollback
    let find_result: Result<User, _> = users::table
        .filter(users::username.like(format!("%transaction_{}%", &unique_id.to_string()[..8])))
        .first(&mut conn);

    assert!(find_result.is_err(), "User should not exist after rollback");

    common::cleanup_test_data(&mut conn);
}

#[test]
#[serial]
fn test_transaction_commit() {
    let database_url = common::get_test_database_url();
    let pool = create_pool(&database_url, 5).expect("Failed to create pool");
    let mut conn = pool.get().expect("Failed to get connection");

    run_migrations(&mut conn).expect("Failed to run migrations");
    common::cleanup_test_data(&mut conn);

    // Test successful transaction
    let user_id = conn
        .transaction::<_, diesel::result::Error, _>(|conn| {
            let user = common::create_test_user(conn, "commit")?;
            Ok(user.id)
        })
        .expect("Transaction should succeed");

    // Verify user exists after commit
    let found_user: User = users::table
        .filter(users::id.eq(user_id))
        .first(&mut conn)
        .expect("User should exist after commit");

    assert!(found_user.username.starts_with("testuser_commit_"));

    common::cleanup_test_data(&mut conn);
}
