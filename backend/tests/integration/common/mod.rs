use diesel::prelude::*;
use master_of_coin_backend::db::DbPool;
use master_of_coin_backend::models::{NewUser, User};
use master_of_coin_backend::schema::{accounts, users};

/// Helper function to get a test database URL
pub fn get_test_database_url() -> String {
    // Load .env file from parent directory
    dotenvy::from_filename("../.env").ok();
    std::env::var("DATABASE_URL").expect("DATABASE_URL must be set for integration tests")
}

/// Helper function to create a test user with unique suffix
pub fn create_test_user(
    conn: &mut PgConnection,
    suffix: &str,
) -> Result<User, diesel::result::Error> {
    let new_user = NewUser {
        username: &format!("testuser_{}", suffix),
        email: &format!("test_{}@example.com", suffix),
        password_hash: "hashed_password",
        name: &format!("Test User {}", suffix),
    };

    diesel::insert_into(users::table)
        .values(&new_user)
        .get_result(conn)
}

/// Helper function to clean up test data
pub fn cleanup_test_data(conn: &mut PgConnection) {
    // Delete in reverse order of dependencies
    let _ = diesel::delete(accounts::table).execute(conn);
    let _ = diesel::delete(users::table).execute(conn);
}

/// Helper to get a connection from the pool
pub fn get_test_connection(
    pool: &DbPool,
) -> diesel::r2d2::PooledConnection<diesel::r2d2::ConnectionManager<PgConnection>> {
    pool.get().expect("Failed to get connection from pool")
}
