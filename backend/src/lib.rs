//! # Master of Coin Backend
//!
//! A comprehensive personal finance management API built with Axum and Diesel.
//!
//! ## Features
//!
//! - **User Authentication**: JWT-based authentication with Argon2 password hashing
//! - **Multi-Account Management**: Support for multiple accounts with different types and currencies
//! - **Transaction Tracking**: Income, expenses, and transfers with optional splits for shared expenses
//! - **Budget Management**: Flexible budgets with date ranges and category/account filters
//! - **Debt Tracking**: Track shared expenses and settle debts between people
//! - **Analytics Dashboard**: Net worth calculation, spending trends, and category breakdowns
//!
//! ## Architecture
//!
//! The application follows a layered architecture:
//!
//! - **Handlers** ([`handlers`]): HTTP request/response handling with Axum
//! - **Services** ([`services`]): Business logic and validation
//! - **Repositories** ([`repositories`]): Data access layer with Diesel ORM
//! - **Models** ([`models`]): Data structures and DTOs with validation
//! - **Middleware** ([`middleware`]): Authentication, CORS, and logging
//!
//! ## Database
//!
//! Uses PostgreSQL with Diesel ORM for type-safe queries and compile-time guarantees.
//! All database operations use connection pooling via r2d2 and are executed in
//! blocking tasks to work with Axum's async runtime.

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
    /// Split sync service for syncing transaction splits to external providers
    pub split_sync: Option<services::split_sync_service::SplitSyncService>,
}

impl AppState {
    /// Create a new AppState instance
    pub fn new(db: DbPool, config: Config) -> Self {
        // Initialize split sync service
        let split_sync = Some(services::split_sync_service::SplitSyncService::new(
            db.clone(),
        ));

        Self {
            db,
            config,
            split_sync,
        }
    }
}
