//! Portfolio Sync Service
//!
//! Core service that performs portfolio value synchronization between investment
//! accounts and external brokerage providers. Called by the worker binary to
//! execute PORTFOLIO_SYNC jobs.
//!
//! This module uses free functions (not a struct) — the worker calls these directly
//! with `pool` and `providers` parameters.

use std::collections::HashMap;
use std::sync::Arc;

use chrono::Utc;
use uuid::Uuid;

use crate::DbPool;
use crate::models::portfolio_sync::{AccountSyncResult, PortfolioSyncReport, PortfolioSyncRequest};
use crate::models::transaction::NewTransaction;
use crate::repositories;
use crate::services::investment_provider::{InvestmentProvider, InvestmentProviderError};
use crate::types::InvestmentProviderType;
use crate::utils::encryption;

/// Maximum number of retry attempts for provider API calls
const MAX_RETRIES: u32 = 3;

/// Minimum delta (in account currency) to create an adjustment transaction.
/// Avoids creating transactions for negligible floating-point differences.
const ADJUSTMENT_THRESHOLD: f64 = 0.01;

/// Main entry point for portfolio sync.
///
/// Orchestrates the full sync flow:
/// 1. Parse input to get optional account_id filter
/// 2. Query active investment providers for the user
/// 3. For each provider: fetch portfolio value, compare with balance, create adjustment
/// 4. Return a PortfolioSyncReport
///
/// # Arguments
///
/// * `pool` - Database connection pool
/// * `providers` - Map of provider_type -> provider implementation
/// * `user_id` - The user to run portfolio sync for
/// * `input` - Optional JSON input with `account_id` filter
///
/// # Returns
///
/// Serialized `PortfolioSyncReport` as JSON, or an error message string
pub async fn execute_portfolio_sync(
    pool: &DbPool,
    providers: &HashMap<InvestmentProviderType, Arc<dyn InvestmentProvider>>,
    user_id: Uuid,
    input: Option<serde_json::Value>,
) -> Result<serde_json::Value, String> {
    // Parse input to get optional account_id filter
    let request: Option<PortfolioSyncRequest> = input
        .as_ref()
        .map(|v| serde_json::from_value(v.clone()))
        .transpose()
        .map_err(|e| format!("Failed to parse portfolio sync input: {}", e))?;

    let account_id_filter = request.and_then(|r| r.account_id);

    tracing::info!(
        "Starting portfolio sync for user {} (account filter: {:?})",
        user_id,
        account_id_filter
    );

    // Query active investment providers for the user
    let investment_providers = if let Some(account_id) = account_id_filter {
        // Sync a specific account
        match repositories::investment_provider::find_by_account_id(pool, account_id)
            .await
            .map_err(|e| format!("Failed to query investment provider: {}", e))?
        {
            Some(provider) if provider.is_active && provider.user_id == user_id => vec![provider],
            Some(_) => {
                return Err(
                    "Investment provider not found or not active for this account".to_string(),
                );
            }
            None => {
                return Err(format!(
                    "No investment provider configured for account {}",
                    account_id
                ));
            }
        }
    } else {
        // Sync all active providers for the user
        repositories::investment_provider::list_active_by_user(pool, user_id)
            .await
            .map_err(|e| format!("Failed to query investment providers: {}", e))?
    };

    if investment_providers.is_empty() {
        tracing::info!("No active investment providers for user {}", user_id);
        let report = PortfolioSyncReport {
            synced_accounts: Vec::new(),
            total_synced: 0,
            total_failed: 0,
        };
        return serde_json::to_value(&report)
            .map_err(|e| format!("Failed to serialize report: {}", e));
    }

    tracing::info!(
        "Found {} active investment provider(s) to sync",
        investment_providers.len()
    );

    let mut results: Vec<AccountSyncResult> = Vec::new();
    let mut total_synced: i64 = 0;
    let mut total_failed: i64 = 0;

    for inv_provider in &investment_providers {
        let result = sync_single_account(pool, providers, user_id, inv_provider).await;

        match result {
            Ok(sync_result) => {
                if sync_result.status == "failed" {
                    total_failed += 1;
                } else {
                    total_synced += 1;
                }
                results.push(sync_result);
            }
            Err(error_msg) => {
                tracing::error!(
                    "Failed to sync account {}: {}",
                    inv_provider.account_id,
                    error_msg
                );
                total_failed += 1;
                results.push(AccountSyncResult {
                    account_id: inv_provider.account_id,
                    account_name: "Unknown".to_string(),
                    provider_type: inv_provider.provider_type,
                    previous_balance: "0.00".to_string(),
                    new_value: "0.00".to_string(),
                    adjustment_amount: "0.00".to_string(),
                    adjustment_transaction_id: None,
                    status: "failed".to_string(),
                    error: Some(error_msg),
                });
            }
        }
    }

    let report = PortfolioSyncReport {
        synced_accounts: results,
        total_synced,
        total_failed,
    };

    tracing::info!(
        "Portfolio sync complete: {} synced, {} failed",
        total_synced,
        total_failed
    );

    serde_json::to_value(&report).map_err(|e| format!("Failed to serialize report: {}", e))
}

/// Sync a single investment account with its provider.
///
/// 1. Decrypt credentials
/// 2. Get provider implementation
/// 3. Fetch portfolio value with retry
/// 4. Compare with current balance
/// 5. Create adjustment transaction if needed
async fn sync_single_account(
    pool: &DbPool,
    providers: &HashMap<InvestmentProviderType, Arc<dyn InvestmentProvider>>,
    user_id: Uuid,
    inv_provider: &crate::models::investment_provider::InvestmentProviderRecord,
) -> Result<AccountSyncResult, String> {
    // Get account info
    let account = repositories::account::find_by_id(pool, inv_provider.account_id)
        .await
        .map_err(|e| format!("Failed to find account: {}", e))?;

    let account_name = account.name.clone();

    // Decrypt credentials
    let encrypted = inv_provider
        .credentials
        .get("encrypted")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "Invalid credentials format".to_string())?;

    let credentials = encryption::decrypt_credentials(encrypted)
        .map_err(|e| format!("Failed to decrypt credentials: {}", e))?;

    // Get provider implementation
    let provider = providers.get(&inv_provider.provider_type).ok_or_else(|| {
        format!(
            "No provider implementation for type: {}",
            inv_provider.provider_type
        )
    })?;

    // Fetch portfolio value with retry logic
    let snapshot = fetch_with_retry(provider.as_ref(), &credentials).await?;

    // Calculate current account balance
    let current_balance = repositories::account::calculate_balance(pool, inv_provider.account_id)
        .await
        .map_err(|e| format!("Failed to calculate account balance: {}", e))?;

    // Compute delta
    let delta = &snapshot.stock_value - &current_balance;
    let delta_f64: f64 = delta.to_string().parse().unwrap_or(0.0);

    tracing::info!(
        "Account {} ({}): provider_value={}, current_balance={}, delta={}",
        inv_provider.account_id,
        account_name,
        snapshot.stock_value,
        current_balance,
        delta
    );

    // Create adjustment transaction if delta exceeds threshold
    let adjustment_transaction_id = if delta_f64.abs() > ADJUSTMENT_THRESHOLD {
        let new_transaction = NewTransaction {
            user_id,
            account_id: inv_provider.account_id,
            category_id: None,
            title: "Portfolio Value Adjustment".to_string(),
            amount: delta.clone(),
            date: Utc::now(),
            notes: Some(format!(
                "Automated portfolio sync: stock value {} (invested {})",
                snapshot.stock_value, snapshot.invested_amount
            )),
        };

        let transaction =
            repositories::transaction::create_transaction(pool, user_id, new_transaction)
                .await
                .map_err(|e| format!("Failed to create adjustment transaction: {}", e))?;

        tracing::info!(
            "Created adjustment transaction {} for account {} (delta: {})",
            transaction.id,
            inv_provider.account_id,
            delta
        );

        Some(transaction.id)
    } else {
        tracing::info!(
            "No adjustment needed for account {} (delta {} below threshold)",
            inv_provider.account_id,
            delta
        );
        None
    };

    let status = if adjustment_transaction_id.is_some() {
        "synced"
    } else {
        "no_change"
    };

    Ok(AccountSyncResult {
        account_id: inv_provider.account_id,
        account_name,
        provider_type: inv_provider.provider_type,
        previous_balance: format!("{:.2}", current_balance),
        new_value: format!("{:.2}", snapshot.stock_value),
        adjustment_amount: format!("{:.2}", delta),
        adjustment_transaction_id,
        status: status.to_string(),
        error: None,
    })
}

/// Wraps a single `get_portfolio_value()` call with exponential backoff retry.
///
/// - Max retries: 3
/// - Backoff: 1s, 2s, 4s (exponential)
/// - Only retries on `InvestmentProviderError::is_retryable()` errors
/// - Non-retryable errors fail immediately
async fn fetch_with_retry(
    provider: &dyn InvestmentProvider,
    credentials: &serde_json::Value,
) -> Result<crate::services::investment_provider::PortfolioSnapshot, String> {
    let mut last_error: Option<InvestmentProviderError> = None;

    for attempt in 0..=MAX_RETRIES {
        if attempt > 0 {
            let backoff_secs = 1u64 << (attempt - 1);
            tracing::info!(
                "Retrying provider API call (attempt {}/{}) after {}s backoff",
                attempt,
                MAX_RETRIES,
                backoff_secs
            );
            tokio::time::sleep(std::time::Duration::from_secs(backoff_secs)).await;
        }

        match provider.get_portfolio_value(credentials).await {
            Ok(snapshot) => return Ok(snapshot),
            Err(e) => {
                if !e.is_retryable() {
                    tracing::error!("Non-retryable provider error on attempt {}: {}", attempt, e);
                    return Err(format!("Provider error: {}", e));
                }
                tracing::warn!(
                    "Retryable provider error on attempt {}/{}: {}",
                    attempt,
                    MAX_RETRIES,
                    e
                );
                last_error = Some(e);
            }
        }
    }

    Err(format!(
        "All retry attempts exhausted: {}",
        last_error
            .map(|e| e.to_string())
            .unwrap_or_else(|| "Unknown error".to_string())
    ))
}
