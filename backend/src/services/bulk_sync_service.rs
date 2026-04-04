//! Bulk Sync Service
//!
//! Orchestrates bulk push/pull sync operations by delegating to the existing
//! `SplitSyncService`. Each item is processed sequentially with error isolation —
//! one item's failure does not prevent others from being processed.
//!
//! This module uses free functions (not a struct). The worker calls
//! `execute_bulk_sync()` directly with the required dependencies.

use diesel::prelude::*;
use uuid::Uuid;

use crate::DbPool;
use crate::models::bulk_sync::{
    BulkSyncReport, BulkSyncSummary, SyncAction, SyncItem, SyncItemResult,
};
use crate::repositories::split_sync_record::SplitSyncRecordRepository;
use crate::schema::transaction_splits;
use crate::services::split_sync_service::SplitSyncService;
use crate::types::SplitProviderType;

/// Execute a bulk sync job.
///
/// Iterates through each item, dispatches to the appropriate
/// `SplitSyncService` method, and collects per-item results.
///
/// Individual item failures are captured but do not stop processing.
///
/// # Arguments
///
/// * `sync_service` - The split sync service for push/pull operations
/// * `pool` - Database connection pool for direct repository lookups
/// * `user_id` - The authenticated user's ID
/// * `items` - The list of sync items to process
///
/// # Returns
///
/// A `BulkSyncReport` with summary counts and per-item results
pub async fn execute_bulk_sync(
    sync_service: &SplitSyncService,
    pool: &DbPool,
    user_id: Uuid,
    items: Vec<SyncItem>,
) -> BulkSyncReport {
    let total = items.len();
    let mut results: Vec<SyncItemResult> = Vec::with_capacity(total);
    let mut succeeded = 0usize;
    let mut failed = 0usize;

    for item in items {
        let result = match item.action {
            SyncAction::Push => {
                let transaction_id = match item.transaction_id {
                    Some(id) => id,
                    None => {
                        results.push(SyncItemResult {
                            action: SyncAction::Push,
                            transaction_id: None,
                            external_expense_id: None,
                            provider_type: None,
                            status: "failed".to_string(),
                            detail: None,
                            error: Some("push action requires transaction_id".to_string()),
                        });
                        failed += 1;
                        continue;
                    }
                };

                execute_push(sync_service, transaction_id).await
            }
            SyncAction::Pull => {
                let ext_id = match item.external_expense_id.as_deref() {
                    Some(id) if !id.is_empty() => id.to_string(),
                    _ => {
                        results.push(SyncItemResult {
                            action: SyncAction::Pull,
                            transaction_id: None,
                            external_expense_id: item.external_expense_id.clone(),
                            provider_type: item.provider_type.clone(),
                            status: "failed".to_string(),
                            detail: None,
                            error: Some("pull action requires external_expense_id".to_string()),
                        });
                        failed += 1;
                        continue;
                    }
                };

                execute_pull(sync_service, pool, user_id, &ext_id, item.provider_type).await
            }
        };

        match result {
            Ok(item_result) => {
                succeeded += 1;
                results.push(item_result);
            }
            Err(error_msg) => {
                failed += 1;
                let (action, transaction_id, external_expense_id) = match item.action {
                    SyncAction::Push => (SyncAction::Push, item.transaction_id, None),
                    SyncAction::Pull => (SyncAction::Pull, None, item.external_expense_id.clone()),
                };
                results.push(SyncItemResult {
                    action,
                    transaction_id,
                    external_expense_id,
                    provider_type: item.provider_type.clone(),
                    status: "failed".to_string(),
                    detail: None,
                    error: Some(error_msg),
                });
            }
        }
    }

    BulkSyncReport {
        summary: BulkSyncSummary {
            total,
            succeeded,
            failed,
        },
        items: results,
    }
}

/// Execute a push operation for a single transaction.
///
/// 1. Calls `sync_service.sync_transaction(transaction_id)`
/// 2. If the result status is `"mismatch"`, extracts `external_expense_id` from
///    the JSON response and calls `sync_service.resolve_mismatch()` with action `"push"`
/// 3. Returns a success result with sync details from the JSON response
async fn execute_push(
    sync_service: &SplitSyncService,
    transaction_id: Uuid,
) -> Result<SyncItemResult, String> {
    let sync_result = sync_service
        .sync_transaction(transaction_id)
        .await
        .map_err(|e| format!("sync_transaction failed: {}", e))?;

    let status = sync_result
        .get("status")
        .and_then(|v| v.as_str())
        .unwrap_or("unknown");

    if status == "mismatch" {
        // Extract external_expense_id from the mismatch response and force-push
        let ext_id = sync_result
            .get("external_expense_id")
            .and_then(|v| v.as_str())
            .ok_or_else(|| "mismatch response missing external_expense_id".to_string())?;

        let resolve_result = sync_service
            .resolve_mismatch(transaction_id, ext_id, "push")
            .await
            .map_err(|e| format!("resolve_mismatch (push) failed: {}", e))?;

        let resolve_status = resolve_result
            .get("status")
            .and_then(|v| v.as_str())
            .unwrap_or("unknown");

        return Ok(SyncItemResult {
            action: SyncAction::Push,
            transaction_id: Some(transaction_id),
            external_expense_id: Some(ext_id.to_string()),
            provider_type: None,
            status: "success".to_string(),
            detail: Some(serde_json::json!({
                "sync_status": resolve_status,
                "external_expense_id": ext_id,
            })),
            error: None,
        });
    }

    // For "synced", "linked", or "created" — all are success
    let ext_id = sync_result
        .get("external_expense_id")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    Ok(SyncItemResult {
        action: SyncAction::Push,
        transaction_id: Some(transaction_id),
        external_expense_id: ext_id.clone(),
        provider_type: None,
        status: "success".to_string(),
        detail: Some(serde_json::json!({
            "sync_status": status,
            "external_expense_id": ext_id,
        })),
        error: None,
    })
}

/// Execute a pull operation for a single external expense.
///
/// 1. Checks `split_sync_records` to see if the external expense is already linked
/// 2. If linked: gets the `transaction_id` from the sync record's related
///    `transaction_split`, then calls `resolve_mismatch` with action `"pull"`
/// 3. If not linked: finds the user's active split provider, fetches the expense
///    from the provider, and calls `sync_external_expense` to import it
async fn execute_pull(
    sync_service: &SplitSyncService,
    pool: &DbPool,
    user_id: Uuid,
    external_expense_id: &str,
    provider_type: Option<SplitProviderType>,
) -> Result<SyncItemResult, String> {
    // Check if this external expense is already linked to a local transaction
    let existing_records =
        SplitSyncRecordRepository::find_by_external_expense_id(pool, external_expense_id)
            .map_err(|e| format!("Failed to look up sync records: {}", e))?;

    if !existing_records.is_empty() {
        // Already linked — get the transaction_id via the transaction_split
        let record = &existing_records[0];
        let split_id = record.transaction_split_id;

        let transaction_id = {
            let mut conn = pool
                .get()
                .map_err(|e| format!("Failed to get DB connection: {}", e))?;
            transaction_splits::table
                .find(split_id)
                .select(transaction_splits::transaction_id)
                .first::<Uuid>(&mut conn)
                .map_err(|e| format!("Failed to find transaction_split {}: {}", split_id, e))?
        };

        // Pull: update local data from external
        let resolve_result = sync_service
            .resolve_mismatch(transaction_id, external_expense_id, "pull")
            .await
            .map_err(|e| format!("resolve_mismatch (pull) failed: {}", e))?;

        let resolve_status = resolve_result
            .get("status")
            .and_then(|v| v.as_str())
            .unwrap_or("unknown");

        return Ok(SyncItemResult {
            action: SyncAction::Pull,
            transaction_id: Some(transaction_id),
            external_expense_id: Some(external_expense_id.to_string()),
            provider_type: provider_type.clone(),
            status: "success".to_string(),
            detail: Some(serde_json::json!({
                "sync_status": resolve_status,
                "transaction_id": transaction_id,
            })),
            error: None,
        });
    }

    // Not linked — need to fetch the expense from the provider and import it
    // Step 1: Find the user's active split provider
    let providers = crate::repositories::split_provider::list_by_user(pool, user_id)
        .await
        .map_err(|e| format!("Failed to list split providers: {}", e))?;

    let provider = match provider_type {
        Some(ref pt) => providers
            .into_iter()
            .find(|p| p.is_active && p.provider_type == *pt)
            .ok_or_else(|| format!("No active {} provider configured for user", pt))?,
        None => providers
            .into_iter()
            .find(|p| p.is_active)
            .ok_or_else(|| "No active split provider configured for user".to_string())?,
    };

    let provider_id = provider.id;

    // Step 2: Fetch the expense details from the provider
    let expense = sync_service
        .fetch_linked_expense(provider_id, external_expense_id)
        .await
        .map_err(|e| format!("Failed to fetch expense from provider: {}", e))?
        .ok_or_else(|| {
            format!(
                "External expense {} not found on provider",
                external_expense_id
            )
        })?;

    // Step 3: Import the expense as a local transaction
    let import_result = sync_service
        .sync_external_expense(user_id, &expense, provider_id)
        .await
        .map_err(|e| format!("sync_external_expense failed: {}", e))?;

    let import_status = import_result
        .get("status")
        .and_then(|v| v.as_str())
        .unwrap_or("unknown");

    let transaction_id = import_result
        .get("transaction_id")
        .and_then(|v| v.as_str())
        .and_then(|s| Uuid::parse_str(s).ok());

    Ok(SyncItemResult {
        action: SyncAction::Pull,
        transaction_id,
        external_expense_id: Some(external_expense_id.to_string()),
        provider_type,
        status: "success".to_string(),
        detail: Some(serde_json::json!({
            "sync_status": import_status,
            "transaction_id": transaction_id,
            "external_expense_id": external_expense_id,
        })),
        error: None,
    })
}
