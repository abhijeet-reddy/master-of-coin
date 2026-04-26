// Re-export all helper modules for use in tests
pub mod auth_helpers;
pub mod factories;
pub mod request_helpers;
pub mod test_server;

// Re-export commonly used items
pub use auth_helpers::*;
pub use factories::*;
pub use request_helpers::*;
pub use test_server::*;

use diesel::PgConnection;
use diesel::prelude::*;
use diesel::r2d2::{self, ConnectionManager};
use master_of_coin_backend::DbPool;
use master_of_coin_backend::models::{NewUser, User};
use master_of_coin_backend::schema::{accounts, users};
use uuid::Uuid;

/// Helper function to get a test database URL
pub fn get_test_database_url() -> String {
    // Load .env file from current directory
    dotenvy::from_filename(".env").ok();
    std::env::var("DATABASE_URL").expect("DATABASE_URL must be set for integration tests")
}

/// Build a standalone DB pool for tests that need direct DB access outside the
/// TestServer (e.g. to clean up created rows). Matches test_server's pool config.
pub fn get_test_db_pool() -> DbPool {
    let database_url = get_test_database_url();
    let manager = ConnectionManager::<PgConnection>::new(database_url);
    r2d2::Pool::builder()
        .max_size(5)
        .build(manager)
        .expect("Failed to create test database pool")
}

/// Hard-delete a test user by id. Cascades to schedules, background_jobs,
/// accounts, transactions, etc. via `ON DELETE CASCADE` foreign keys.
///
/// Use via [`UserCleanup`] so cleanup runs even if the test panics partway.
pub fn cleanup_test_user(pool: &DbPool, user_id: Uuid) {
    let mut conn = match pool.get() {
        Ok(c) => c,
        Err(_) => return,
    };
    let _ = diesel::delete(users::table.find(user_id)).execute(&mut conn);
}

/// RAII guard that hard-deletes a test user on drop. Keeps the per-test call
/// site to one line and ensures cleanup survives assertion panics, preventing
/// leaked rows from blocking the worker queue (issue #56).
pub struct UserCleanup {
    pub pool: DbPool,
    pub user_id: Uuid,
}

impl Drop for UserCleanup {
    fn drop(&mut self) {
        cleanup_test_user(&self.pool, self.user_id);
    }
}

/// Helper function to create a test user with unique suffix
/// The suffix is combined with a UUID to ensure global uniqueness across parallel test runs
pub fn create_test_user(
    conn: &mut PgConnection,
    suffix: &str,
) -> Result<User, diesel::result::Error> {
    let unique_id = Uuid::new_v4().to_string();
    let short_uuid = &unique_id[..8];

    let new_user = NewUser {
        username: format!("testuser_{}_{}", suffix, short_uuid),
        email: format!("test_{}_{}@example.com", suffix, short_uuid),
        password_hash: "hashed_password".to_string(),
        name: format!("Test User {}", suffix),
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
