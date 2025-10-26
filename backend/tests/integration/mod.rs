//! Integration tests for the Master of Coin backend
//!
//! These tests validate the Diesel ORM migration from SQLx, ensuring:
//! - Database connection pool works correctly
//! - Migrations can be run successfully
//! - Custom enum types (AccountType, CurrencyCode, BudgetPeriod) serialize/deserialize properly
//! - CRUD operations work for all models
//! - Relationships between models are maintained
//! - Async/sync bridge pattern works with tokio::spawn_blocking
//! - Transactions work correctly (commit and rollback)

mod common;
mod test_async_bridge;
mod test_connection;
mod test_custom_types;
mod test_relationships;
mod test_transactions;
mod test_user_crud;
