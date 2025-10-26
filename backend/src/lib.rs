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
pub use errors::ApiError;
