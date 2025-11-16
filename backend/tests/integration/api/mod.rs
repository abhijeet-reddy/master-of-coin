//! API integration tests
//!
//! This module contains integration tests for all API endpoints including:
//! - Authentication endpoints (test_auth)
//! - Account management endpoints
//! - Transaction endpoints
//! - Budget endpoints
//! - Category endpoints
//! - People endpoints
//! - Dashboard endpoints

#[path = "../common/mod.rs"]
mod common;

mod test_accounts;
mod test_auth;
mod test_budgets;
mod test_categories;
mod test_dashboard;
mod test_people;
mod test_transactions;
