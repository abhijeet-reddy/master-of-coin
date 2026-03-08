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
//! - Split provider integration endpoints (test_split_providers)
//! - Split sync status endpoints (test_split_sync)

#[path = "../common/mod.rs"]
mod common;

mod test_accounts;
mod test_api_keys;
mod test_auth;
mod test_budget_spending;
mod test_budgets;
mod test_bulk_sync;
mod test_categories;
mod test_csv_import;
mod test_currency_conversion;
mod test_dashboard;
mod test_debt_accounts;
mod test_debt_transactions;
mod test_drift_detection;
mod test_duplicate_detection;
mod test_exchange_rates;
mod test_import_api;
mod test_import_service;
mod test_jobs;
mod test_people;
mod test_schedules;
mod test_scope_enforcement;
mod test_split_providers;
mod test_split_sync;
mod test_splitwise_debt_sync;
mod test_transactions;
mod test_transfers;
