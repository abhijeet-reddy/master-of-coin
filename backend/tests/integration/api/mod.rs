//! API integration tests
//!
//! This module contains integration tests for all API endpoints including:
//! - Authentication endpoints (test_auth)
//! - API key management endpoints (test_api_keys)
//! - Account management endpoints
//! - Transaction endpoints
//! - Budget endpoints
//! - Category endpoints
//! - People endpoints
//! - Dashboard endpoints

#[path = "../common/mod.rs"]
mod common;

mod test_accounts;
mod test_api_keys;
mod test_auth;
mod test_budgets;
mod test_categories;
mod test_csv_import;
mod test_currency_conversion;
mod test_dashboard;
mod test_duplicate_detection;
mod test_exchange_rates;
mod test_import_service;
mod test_people;
mod test_scope_enforcement;
mod test_transactions;
