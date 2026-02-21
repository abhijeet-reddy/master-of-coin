//! Drift Detection Service
//!
//! Core service that performs drift detection between local split transactions
//! and external split provider expenses. Called by the worker binary to execute
//! drift detection jobs.
//!
//! This module uses free functions (not a struct) — the worker calls these directly
//! with `pool` and `providers` parameters.

use std::collections::{HashMap, HashSet};
use std::sync::Arc;

use bigdecimal::BigDecimal;
use chrono::{DateTime, Utc};
use diesel::prelude::*;
use uuid::Uuid;

use crate::DbPool;
use crate::errors::{ApiError, ApiResult};
use crate::models::drift_detection::{
    DriftReport, DriftSummary, DriftedItem, ExternalSplitInfo, LocalSplitInfo, LocalSplitRow,
    LocalTransactionGroup, MissingOnExternal, MissingOnLocal, UnmappedUser,
};
use crate::models::split_provider::SplitProvider as SplitProviderModel;
use crate::schema::{
    people, person_split_configs, split_providers, split_sync_records, transaction_splits,
    transactions,
};
use crate::services::split_provider::{ExternalExpenseDetail, SplitProvider, SplitProviderError};
use crate::utils::encryption;

/// Maximum number of retry attempts for provider API calls
const MAX_RETRIES: u32 = 3;

/// Main entry point for drift detection.
///
/// Orchestrates the full drift detection flow:
/// 1. Fetch local split transactions in date range
/// 2. Fetch all external expenses from each active provider
/// 3. Build external user mapping
/// 4. Classify everything into synced/drifted/missing
///
/// # Arguments
///
/// * `pool` - Database connection pool
/// * `providers` - Map of provider_type -> provider implementation
/// * `user_id` - The user to run drift detection for
/// * `start_date` - Start of date range (inclusive)
/// * `end_date` - End of date range (inclusive)
///
/// # Returns
///
/// A `DriftReport` with summary counts and detailed items
pub async fn detect_drift(
    pool: &DbPool,
    providers: &HashMap<String, Arc<dyn SplitProvider>>,
    user_id: Uuid,
    start_date: DateTime<Utc>,
    end_date: DateTime<Utc>,
) -> ApiResult<DriftReport> {
    tracing::info!(
        "Starting drift detection for user {} from {} to {}",
        user_id,
        start_date,
        end_date
    );

    // Step 1: Fetch local split transactions in date range
    let local_txns = fetch_local_split_transactions(pool, user_id, start_date, end_date)?;
    tracing::info!("Found {} local transactions with splits", local_txns.len());

    // Step 2: Fetch all external expenses from each active provider
    let (external_expenses, current_user_external_id) =
        fetch_all_external_expenses(pool, providers, user_id, start_date, end_date).await?;
    tracing::info!(
        "Found {} external expenses (current user external ID: {})",
        external_expenses.len(),
        current_user_external_id.as_deref().unwrap_or("none")
    );

    // Step 3: Build external user mapping (external_user_id -> person_name)
    let user_mapping = build_external_user_mapping(pool, user_id)?;
    tracing::info!(
        "Built external user mapping with {} entries",
        user_mapping.len()
    );

    // Step 4: Classify everything
    let report = classify(
        &local_txns,
        &external_expenses,
        &user_mapping,
        current_user_external_id.as_deref(),
    );

    tracing::info!(
        "Drift detection complete: {} synced, {} drifted, {} missing on external, {} missing on local",
        report.summary.synced,
        report.summary.drifted,
        report.summary.missing_on_external,
        report.summary.missing_on_local
    );

    Ok(report)
}

/// Fetch local split transactions in the given date range.
///
/// Performs a Diesel query joining:
/// `transactions` INNER JOIN `transaction_splits` INNER JOIN `people`
/// INNER JOIN `person_split_configs` LEFT JOIN `split_sync_records`
///
/// Results are grouped by transaction_id for the classification step.
#[allow(clippy::type_complexity)]
fn fetch_local_split_transactions(
    pool: &DbPool,
    user_id: Uuid,
    start_date: DateTime<Utc>,
    end_date: DateTime<Utc>,
) -> ApiResult<Vec<LocalTransactionGroup>> {
    let mut conn = pool.get().map_err(|e| {
        tracing::error!("Failed to get DB connection: {}", e);
        ApiError::Internal
    })?;

    // Query: transactions + transaction_splits + people + person_split_configs + split_sync_records
    let rows: Vec<(
        Uuid,           // t.id
        String,         // t.title
        BigDecimal,     // t.amount
        DateTime<Utc>,  // t.date
        Uuid,           // ts.id (split_id)
        BigDecimal,     // ts.amount (split_amount)
        String,         // p.name
        String,         // psc.external_user_id
        Uuid,           // psc.split_provider_id
        Option<String>, // ssr.external_expense_id
        Option<String>, // ssr.sync_status
    )> = transactions::table
        .inner_join(
            transaction_splits::table.on(transaction_splits::transaction_id.eq(transactions::id)),
        )
        .inner_join(people::table.on(people::id.eq(transaction_splits::person_id)))
        .inner_join(
            person_split_configs::table
                .on(person_split_configs::person_id.eq(transaction_splits::person_id)),
        )
        .left_join(
            split_sync_records::table
                .on(split_sync_records::transaction_split_id.eq(transaction_splits::id)),
        )
        .filter(transactions::user_id.eq(user_id))
        .filter(transactions::date.ge(start_date))
        .filter(transactions::date.le(end_date))
        .select((
            transactions::id,
            transactions::title,
            transactions::amount,
            transactions::date,
            transaction_splits::id,
            transaction_splits::amount,
            people::name,
            person_split_configs::external_user_id,
            person_split_configs::split_provider_id,
            split_sync_records::external_expense_id.nullable(),
            split_sync_records::sync_status.nullable(),
        ))
        .order(transactions::date.desc())
        .load(&mut conn)?;

    // Group by transaction_id
    let mut groups: HashMap<Uuid, LocalTransactionGroup> = HashMap::new();
    // Track which split_ids we've already added (to avoid duplicates from LEFT JOIN)
    let mut seen_splits: HashSet<(Uuid, Uuid)> = HashSet::new();

    for row in rows {
        let (
            txn_id,
            txn_title,
            txn_amount,
            txn_date,
            split_id,
            split_amount,
            person_name,
            external_user_id,
            provider_id,
            external_expense_id,
            sync_status,
        ) = row;

        // Deduplicate: a split may appear multiple times if it has multiple sync records
        // or if person_split_configs has multiple entries. We take the first match.
        let key = (txn_id, split_id);
        if seen_splits.contains(&key) {
            continue;
        }
        seen_splits.insert(key);

        let group = groups
            .entry(txn_id)
            .or_insert_with(|| LocalTransactionGroup {
                transaction_id: txn_id,
                transaction_title: txn_title,
                transaction_amount: txn_amount,
                transaction_date: txn_date,
                splits: Vec::new(),
            });

        group.splits.push(LocalSplitRow {
            _split_id: split_id,
            person_name,
            split_amount,
            external_user_id,
            _provider_id: provider_id,
            external_expense_id,
            _sync_status: sync_status,
        });
    }

    Ok(groups.into_values().collect())
}

/// Fetch all external expenses from each active provider for the user.
///
/// For each active `split_provider`:
/// 1. Decrypt credentials
/// 2. Get provider implementation
/// 3. Call `get_expenses(None, ...)` with retry logic
/// 4. Collect and deduplicate by external_expense_id
///
/// If ANY provider fails after retries, returns an error (job should be marked FAILED).
///
/// Also extracts the current user's external ID from provider credentials.
///
/// # Returns
///
/// Tuple of (deduplicated expenses, current user's external_user_id)
async fn fetch_all_external_expenses(
    pool: &DbPool,
    providers: &HashMap<String, Arc<dyn SplitProvider>>,
    user_id: Uuid,
    start_date: DateTime<Utc>,
    end_date: DateTime<Utc>,
) -> ApiResult<(Vec<ExternalExpenseDetail>, Option<String>)> {
    // Query active split_providers for this user
    let active_providers = {
        let mut conn = pool.get().map_err(|e| {
            tracing::error!("Failed to get DB connection: {}", e);
            ApiError::Internal
        })?;

        split_providers::table
            .filter(split_providers::user_id.eq(user_id))
            .filter(split_providers::is_active.eq(true))
            .load::<SplitProviderModel>(&mut conn)?
    };

    if active_providers.is_empty() {
        tracing::info!("No active split providers for user {}", user_id);
        return Ok((Vec::new(), None));
    }

    let mut all_expenses: Vec<ExternalExpenseDetail> = Vec::new();
    let mut seen_expense_ids: HashSet<String> = HashSet::new();
    let mut current_user_external_id: Option<String> = None;

    let dated_after = start_date.format("%Y-%m-%dT%H:%M:%SZ").to_string();
    let dated_before = end_date.format("%Y-%m-%dT%H:%M:%SZ").to_string();

    for provider_model in &active_providers {
        // Get provider implementation
        let provider = providers
            .get(&provider_model.provider_type)
            .ok_or_else(|| {
                ApiError::InternalWithMessage(format!(
                    "Unknown provider type: {}",
                    provider_model.provider_type
                ))
            })?;

        // Decrypt credentials
        let encrypted = provider_model
            .credentials
            .get("encrypted")
            .and_then(|v| v.as_str())
            .ok_or_else(|| {
                ApiError::InternalWithMessage("Invalid credentials format".to_string())
            })?;

        let credentials = encryption::decrypt_credentials(encrypted).map_err(|e| {
            ApiError::InternalWithMessage(format!("Failed to decrypt credentials: {}", e))
        })?;

        // Extract current user's external ID from credentials
        if current_user_external_id.is_none() {
            current_user_external_id = credentials.get("splitwise_user_id").and_then(|v| {
                v.as_i64()
                    .map(|id| id.to_string())
                    .or_else(|| v.as_str().map(|s| s.to_string()))
            });
        }

        let current_ext_id = current_user_external_id.clone().unwrap_or_default();

        // Fetch expenses with retry and pagination
        let mut offset = 0u32;
        let limit = 200u32;

        loop {
            let expenses = fetch_with_retry(
                provider.as_ref(),
                &credentials,
                &dated_after,
                &dated_before,
                limit,
                offset,
            )
            .await
            .map_err(|e| {
                ApiError::External(format!(
                    "Provider '{}' failed after retries: {}",
                    provider_model.provider_type, e
                ))
            })?;

            let batch_size = expenses.len();

            for expense in expenses {
                // Filter out expenses where current user has zero owed_share AND zero paid_share
                let user_relevant = expense.users.iter().any(|u| {
                    u.external_user_id == current_ext_id
                        && (u.owed_share.parse::<f64>().unwrap_or(0.0) != 0.0
                            || u.paid_share.parse::<f64>().unwrap_or(0.0) != 0.0)
                });

                if !user_relevant {
                    continue;
                }

                // Deduplicate by external_expense_id
                if seen_expense_ids.insert(expense.external_expense_id.clone()) {
                    all_expenses.push(expense);
                }
            }

            // If we got fewer results than the limit, we've fetched everything
            if (batch_size as u32) < limit {
                break;
            }

            offset += limit;
        }
    }

    Ok((all_expenses, current_user_external_id))
}

/// Wraps a single `get_expenses()` call with exponential backoff retry.
///
/// - Max retries: 3
/// - Backoff: 1s, 2s, 4s (exponential)
/// - Only retries on `SplitProviderError::is_retryable()` errors
/// - Non-retryable errors fail immediately
async fn fetch_with_retry(
    provider: &dyn SplitProvider,
    credentials: &serde_json::Value,
    dated_after: &str,
    dated_before: &str,
    limit: u32,
    _offset: u32,
) -> Result<Vec<ExternalExpenseDetail>, SplitProviderError> {
    let mut last_error: Option<SplitProviderError> = None;

    for attempt in 0..=MAX_RETRIES {
        if attempt > 0 {
            // Exponential backoff: 1s, 2s, 4s
            let backoff_secs = 1u64 << (attempt - 1);
            tracing::info!(
                "Retrying provider API call (attempt {}/{}) after {}s backoff",
                attempt,
                MAX_RETRIES,
                backoff_secs
            );
            tokio::time::sleep(std::time::Duration::from_secs(backoff_secs)).await;
        }

        match provider
            .get_expenses(
                credentials,
                None, // No friend filter — fetch all expenses
                Some(dated_after),
                Some(dated_before),
                Some(limit),
            )
            .await
        {
            Ok(expenses) => return Ok(expenses),
            Err(e) => {
                if !e.is_retryable() {
                    tracing::error!("Non-retryable provider error on attempt {}: {}", attempt, e);
                    return Err(e);
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

    Err(last_error.unwrap_or_else(|| {
        SplitProviderError::ApiError("All retry attempts exhausted".to_string())
    }))
}

/// Build a mapping of external_user_id -> person_name.
///
/// Queries `person_split_configs` JOIN `people` for the given user.
fn build_external_user_mapping(pool: &DbPool, user_id: Uuid) -> ApiResult<HashMap<String, String>> {
    let mut conn = pool.get().map_err(|e| {
        tracing::error!("Failed to get DB connection: {}", e);
        ApiError::Internal
    })?;

    let rows: Vec<(String, String)> = person_split_configs::table
        .inner_join(people::table.on(people::id.eq(person_split_configs::person_id)))
        .filter(people::user_id.eq(user_id))
        .select((person_split_configs::external_user_id, people::name))
        .load(&mut conn)?;

    Ok(rows.into_iter().collect())
}

/// Core classification logic.
///
/// For each local transaction:
/// - If it has a sync record with an external_expense_id AND that expense is in the
///   external set → compare splits → **synced** or **drifted**
/// - If it has a sync record but the expense is NOT in the external set → **missing on external**
/// - If it has NO sync record → **missing on external**
///
/// For each external expense NOT matched by any sync record → **missing on local**
///
/// For missing_on_local items: checks each user's external_user_id against the mapping
/// to populate `unmapped_users`.
///
/// Builds and returns `DriftReport` with summary counts satisfying invariants:
/// - `total_local = synced + drifted + missing_on_external`
/// - `total_external = synced + drifted + missing_on_local`
///
/// Made `pub` for integration testing.
pub fn classify(
    local_txns: &[LocalTransactionGroup],
    external_expenses: &[ExternalExpenseDetail],
    user_mapping: &HashMap<String, String>,
    current_user_external_id: Option<&str>,
) -> DriftReport {
    // Build a lookup: external_expense_id -> &ExternalExpenseDetail
    let external_map: HashMap<&str, &ExternalExpenseDetail> = external_expenses
        .iter()
        .map(|e| (e.external_expense_id.as_str(), e))
        .collect();

    // Track which external expense IDs are matched by sync records
    let mut matched_external_ids: HashSet<String> = HashSet::new();

    let mut synced_count: i64 = 0;
    let mut drifted_items: Vec<DriftedItem> = Vec::new();
    let mut missing_on_external: Vec<MissingOnExternal> = Vec::new();

    for txn in local_txns {
        // Check if any split has a sync record with an external_expense_id
        let linked_expense_id: Option<&str> = txn
            .splits
            .iter()
            .filter_map(|s| s.external_expense_id.as_deref())
            .next();

        match linked_expense_id {
            Some(ext_id) if external_map.contains_key(ext_id) => {
                // Linked and found in external set — compare splits
                let external_expense = external_map[ext_id];
                matched_external_ids.insert(ext_id.to_string());

                let splits_match = compare_splits(txn, external_expense, current_user_external_id);

                if splits_match {
                    synced_count += 1;
                } else {
                    // Drifted — build detailed comparison
                    let local_splits: Vec<LocalSplitInfo> = txn
                        .splits
                        .iter()
                        .map(|s| LocalSplitInfo {
                            person_name: s.person_name.clone(),
                            external_user_id: s.external_user_id.clone(),
                            owed_share: format!("{:.2}", s.split_amount.abs()),
                        })
                        .collect();

                    let external_splits: Vec<ExternalSplitInfo> = external_expense
                        .users
                        .iter()
                        .map(|u| ExternalSplitInfo {
                            external_user_id: u.external_user_id.clone(),
                            first_name: u.first_name.clone(),
                            last_name: u.last_name.clone(),
                            owed_share: u.owed_share.clone(),
                            paid_share: u.paid_share.clone(),
                        })
                        .collect();

                    drifted_items.push(DriftedItem {
                        transaction_id: txn.transaction_id,
                        transaction_title: txn.transaction_title.clone(),
                        transaction_date: txn.transaction_date,
                        local_amount: format!("{:.2}", txn.transaction_amount),
                        external_expense_id: ext_id.to_string(),
                        external_description: external_expense.description.clone(),
                        external_cost: external_expense.cost.clone(),
                        external_date: external_expense.date.clone(),
                        local_splits,
                        external_splits,
                    });
                }
            }
            Some(ext_id) => {
                // Has sync record but expense NOT in external set (deleted on provider)
                matched_external_ids.insert(ext_id.to_string());

                let splits: Vec<LocalSplitInfo> = txn
                    .splits
                    .iter()
                    .map(|s| LocalSplitInfo {
                        person_name: s.person_name.clone(),
                        external_user_id: s.external_user_id.clone(),
                        owed_share: format!("{:.2}", s.split_amount.abs()),
                    })
                    .collect();

                missing_on_external.push(MissingOnExternal {
                    transaction_id: txn.transaction_id,
                    transaction_title: txn.transaction_title.clone(),
                    transaction_date: txn.transaction_date,
                    amount: format!("{:.2}", txn.transaction_amount),
                    splits,
                });
            }
            None => {
                // No sync record — missing on external
                let splits: Vec<LocalSplitInfo> = txn
                    .splits
                    .iter()
                    .map(|s| LocalSplitInfo {
                        person_name: s.person_name.clone(),
                        external_user_id: s.external_user_id.clone(),
                        owed_share: format!("{:.2}", s.split_amount.abs()),
                    })
                    .collect();

                missing_on_external.push(MissingOnExternal {
                    transaction_id: txn.transaction_id,
                    transaction_title: txn.transaction_title.clone(),
                    transaction_date: txn.transaction_date,
                    amount: format!("{:.2}", txn.transaction_amount),
                    splits,
                });
            }
        }
    }

    // Find external expenses not matched by any sync record → missing on local
    let mut missing_on_local: Vec<MissingOnLocal> = Vec::new();

    for expense in external_expenses {
        if matched_external_ids.contains(&expense.external_expense_id) {
            continue;
        }

        let users: Vec<ExternalSplitInfo> = expense
            .users
            .iter()
            .map(|u| ExternalSplitInfo {
                external_user_id: u.external_user_id.clone(),
                first_name: u.first_name.clone(),
                last_name: u.last_name.clone(),
                owed_share: u.owed_share.clone(),
                paid_share: u.paid_share.clone(),
            })
            .collect();

        // Check for unmapped users (external users not in person_split_configs)
        let unmapped_users: Vec<UnmappedUser> = expense
            .users
            .iter()
            .filter(|u| {
                // Skip the current user — they don't need a mapping
                if current_user_external_id == Some(u.external_user_id.as_str()) {
                    return false;
                }
                // Check if this external user has a local mapping
                !user_mapping.contains_key(&u.external_user_id)
            })
            .map(|u| UnmappedUser {
                external_user_id: u.external_user_id.clone(),
                first_name: u.first_name.clone(),
                last_name: u.last_name.clone(),
            })
            .collect();

        missing_on_local.push(MissingOnLocal {
            external_expense_id: expense.external_expense_id.clone(),
            description: expense.description.clone(),
            cost: expense.cost.clone(),
            currency_code: expense.currency_code.clone(),
            date: expense.date.clone(),
            users,
            unmapped_users,
        });
    }

    let drifted_count = drifted_items.len() as i64;
    let missing_ext_count = missing_on_external.len() as i64;
    let missing_local_count = missing_on_local.len() as i64;

    // Invariants:
    // total_local = synced + drifted + missing_on_external
    // total_external = synced + drifted + missing_on_local
    let total_local = synced_count + drifted_count + missing_ext_count;
    let total_external = synced_count + drifted_count + missing_local_count;

    DriftReport {
        summary: DriftSummary {
            total_local,
            total_external,
            synced: synced_count,
            drifted: drifted_count,
            missing_on_external: missing_ext_count,
            missing_on_local: missing_local_count,
        },
        drifted: drifted_items,
        missing_on_external,
        missing_on_local,
    }
}

/// Compare local splits against an external expense to determine if they match.
///
/// Reuses the same approach as `SplitSyncService::compare_splits()`:
/// - Build a map of external_user_id → owed_share from the external expense
/// - Compare each local split's amount against the external owed_share
/// - Also compare the payer's share (total - sum of splits)
/// - If all match → true (synced); if any differ → false (drifted)
fn compare_splits(
    local_txn: &LocalTransactionGroup,
    external_expense: &ExternalExpenseDetail,
    current_user_external_id: Option<&str>,
) -> bool {
    // Build a map of external_user_id → owed_share from the external expense
    let external_map: HashMap<&str, BigDecimal> = external_expense
        .users
        .iter()
        .filter_map(|u| {
            u.owed_share
                .parse::<BigDecimal>()
                .ok()
                .map(|amount| (u.external_user_id.as_str(), amount))
        })
        .collect();

    // Check each local split participant matches numerically
    for split in &local_txn.splits {
        let local_owed = split.split_amount.abs();
        match external_map.get(split.external_user_id.as_str()) {
            Some(external_owed) => {
                if local_owed != *external_owed {
                    return false;
                }
            }
            None => return false,
        }
    }

    // Also validate the payer's share:
    // Local payer share = |transaction amount| - sum of |local splits|
    // External payer share = their owed_share (the user with paid_share > 0)
    let local_total = local_txn.transaction_amount.abs();
    let local_splits_total: BigDecimal =
        local_txn.splits.iter().map(|s| s.split_amount.abs()).sum();
    let local_payer_share = &local_total - &local_splits_total;

    // The payer is the current user (the one with paid_share > 0)
    // If the current user isn't in the external map, we can't compare payer share.
    // This might happen if the expense structure is different. We'll consider it a match
    // for the split participants only.
    if let Some(external_payer_owed) = current_user_external_id.and_then(|id| external_map.get(id))
        && local_payer_share != *external_payer_owed
    {
        return false;
    }

    true
}
