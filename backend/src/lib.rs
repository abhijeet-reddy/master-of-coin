// Core modules
pub mod config;
pub mod db;
pub mod models;
pub mod schema;
pub mod types;

// API and routing
pub mod api;

// Authentication and authorization
pub mod auth;

// Error handling
pub mod errors;

// Business logic
pub mod repositories;
pub mod services;

// Utilities and middleware
pub mod handlers;
pub mod middleware;
pub mod utils;

// Re-exports for convenience
pub use config::Config;
pub use errors::{ApiError, ApiResult};

// Database connection pool type
use diesel::PgConnection;
use diesel::r2d2::{self, ConnectionManager};

/// Database connection pool type alias
pub type DbPool = r2d2::Pool<ConnectionManager<PgConnection>>;

/// Application state shared across handlers
#[derive(Clone)]
pub struct AppState {
    /// Database connection pool
    pub db: DbPool,
    /// Application configuration
    pub config: Config,
}

impl AppState {
    /// Create a new AppState instance
    pub fn new(db: DbPool, config: Config) -> Self {
        Self { db, config }
    }
}
