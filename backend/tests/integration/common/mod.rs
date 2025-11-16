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

use diesel::prelude::*;
use master_of_coin_backend::models::{NewUser, User};
use master_of_coin_backend::schema::{accounts, users};
use uuid::Uuid;

/// Helper function to get a test database URL
pub fn get_test_database_url() -> String {
    // Load .env file from parent directory
    dotenvy::from_filename("../.env").ok();
    std::env::var("DATABASE_URL").expect("DATABASE_URL must be set for integration tests")
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
