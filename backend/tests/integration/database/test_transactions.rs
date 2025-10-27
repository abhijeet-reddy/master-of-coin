use super::common;

use diesel::prelude::*;
use master_of_coin_backend::db::{create_pool, run_migrations};
use master_of_coin_backend::models::{NewUser, User};
use master_of_coin_backend::schema::users;
use serial_test::serial;

#[test]
#[serial]
fn test_transaction_rollback() {
    let database_url = common::get_test_database_url();
    let pool = create_pool(&database_url, 5).expect("Failed to create pool");
    let mut conn = pool.get().expect("Failed to get connection");

    run_migrations(&mut conn).expect("Failed to run migrations");
    common::cleanup_test_data(&mut conn);

    // Test that we can use transactions
    let result: Result<(), diesel::result::Error> = conn
        .transaction::<_, diesel::result::Error, _>(|conn| {
            let new_user = NewUser {
                username: "transaction_test",
                email: "transaction@test.com",
                password_hash: "hash",
                name: "Transaction Test",
            };

            let user: User = diesel::insert_into(users::table)
                .values(&new_user)
                .get_result(conn)?;

            // Verify user exists within transaction
            let found: User = users::table.filter(users::id.eq(user.id)).first(conn)?;

            assert_eq!(found.username, "transaction_test");

            // Rollback by returning an error
            Err(diesel::result::Error::RollbackTransaction)
        });

    assert!(result.is_err(), "Transaction should have been rolled back");

    // Verify user doesn't exist after rollback
    let find_result: Result<User, _> = users::table
        .filter(users::username.eq("transaction_test"))
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
            let new_user = NewUser {
                username: "commit_test",
                email: "commit@test.com",
                password_hash: "hash",
                name: "Commit Test",
            };

            let user: User = diesel::insert_into(users::table)
                .values(&new_user)
                .get_result(conn)?;

            Ok(user.id)
        })
        .expect("Transaction should succeed");

    // Verify user exists after commit
    let found_user: User = users::table
        .filter(users::id.eq(user_id))
        .first(&mut conn)
        .expect("User should exist after commit");

    assert_eq!(found_user.username, "commit_test");

    common::cleanup_test_data(&mut conn);
}
