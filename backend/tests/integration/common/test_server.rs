//! Test server setup and lifecycle management for API integration tests.
//!
//! This module provides utilities to create and manage test instances of the Axum
//! application server for integration testing. It handles server lifecycle, database
//! setup, and provides convenient access to the test server.

use axum_test::TestServer;
use diesel::PgConnection;
use diesel::r2d2::{self, ConnectionManager};
use master_of_coin_backend::{AppState, Config, api::routes::create_router};

use super::get_test_database_url;

/// Creates a test server instance with a fresh database connection pool.
///
/// This function:
/// 1. Loads test configuration from environment variables
/// 2. Creates a new database connection pool
/// 3. Builds the Axum router with all routes
/// 4. Wraps it in a TestServer for easy HTTP testing
///
/// # Returns
///
/// A [`TestServer`] instance ready for making HTTP requests
///
/// # Panics
///
/// Panics if:
/// - Environment variables are not properly configured
/// - Database connection cannot be established
/// - Server cannot be created
///
/// # Example
///
/// ```no_run
/// use integration::common::test_server::create_test_server;
///
/// #[tokio::test]
/// async fn test_api_endpoint() {
///     let server = create_test_server().await;
///     let response = server.get("/api/v1/health").await;
///     assert_eq!(response.status_code(), 200);
/// }
/// ```
pub async fn create_test_server() -> TestServer {
    // Load test configuration
    let config = create_test_config();

    // Create database connection pool
    let db_pool = create_test_db_pool();

    // Create application state
    let state = AppState::new(db_pool, config);

    // Create router with all routes
    let app = create_router(state);

    // Wrap in TestServer for easy testing
    TestServer::new(app).expect("Failed to create test server")
}

/// Creates a test configuration with appropriate test settings.
///
/// This function loads configuration from environment variables but ensures
/// test-appropriate defaults are used. The JWT secret is loaded from the
/// environment or uses a test default.
///
/// # Returns
///
/// A [`Config`] instance configured for testing
///
/// # Panics
///
/// Panics if required environment variables are missing
fn create_test_config() -> Config {
    // Load .env file from parent directory
    dotenvy::from_filename("../.env").ok();

    let jwt_secret = std::env::var("JWT_SECRET")
        .unwrap_or_else(|_| "test_secret_key_at_least_32_characters_long_for_testing".to_string());

    Config {
        server: master_of_coin_backend::config::ServerConfig {
            host: "127.0.0.1".to_string(),
            port: 0, // Use random port for tests
        },
        database: master_of_coin_backend::config::DatabaseConfig {
            url: get_test_database_url(),
            max_connections: 5, // Fewer connections for tests
        },
        jwt: master_of_coin_backend::config::JwtConfig {
            secret: jwt_secret,
            expiration_hours: 24,
        },
        import: master_of_coin_backend::config::ImportConfig::default(),
    }
}

/// Creates a database connection pool for testing.
///
/// This function creates a connection pool with test-appropriate settings:
/// - Smaller pool size (5 connections)
/// - Uses test database URL
/// - Configured for integration test workloads
///
/// # Returns
///
/// A database connection pool
///
/// # Panics
///
/// Panics if the database connection pool cannot be created
fn create_test_db_pool() -> master_of_coin_backend::DbPool {
    let database_url = get_test_database_url();
    let manager = ConnectionManager::<PgConnection>::new(database_url);

    r2d2::Pool::builder()
        .max_size(5)
        .build(manager)
        .expect("Failed to create test database pool")
}

/// Helper to get the base URL for a test server.
///
/// This is useful when you need to construct full URLs for testing
/// external HTTP clients or for logging purposes.
///
/// # Arguments
///
/// * `server` - Reference to the test server
///
/// # Returns
///
/// The base URL as a String (e.g., "http://127.0.0.1:12345")
///
/// # Example
///
/// ```no_run
/// use integration::common::test_server::{create_test_server, get_base_url};
///
/// #[tokio::test]
/// async fn test_with_base_url() {
///     let server = create_test_server().await;
///     let base_url = get_base_url(&server);
///     println!("Test server running at: {}", base_url);
/// }
/// ```
pub fn get_base_url(server: &TestServer) -> String {
    server
        .server_address()
        .expect("Failed to get server address")
        .to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_create_test_server() {
        let server = create_test_server().await;
        let response = server.get("/api/v1/auth/me").await;
        // Should get 401 for unauthenticated request, proving server is working
        assert_eq!(response.status_code().as_u16(), 401);
    }

    #[tokio::test]
    async fn test_server_responds() {
        let server = create_test_server().await;
        // Test that server is responsive (even if route doesn't exist)
        let response = server.get("/api/v1/nonexistent").await;
        // Should get some response, even if it's 404
        assert!(response.status_code().as_u16() >= 200);
    }
}
