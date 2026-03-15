use bigdecimal::BigDecimal;
use chrono::{DateTime, Duration, Utc};
use std::collections::{HashMap, HashSet};
use std::str::FromStr;
use uuid::Uuid;
use validator::Validate;

use crate::{
    DbPool,
    config::Config,
    errors::ApiError,
    models::{
        CreateTransactionRequest, NewTransaction, NewTransactionSplit, TransactionFilter,
        TransactionResponse, UpdateTransactionRequest,
    },
    repositories,
};

/// Compute the date when a soft-deleted transaction will be permanently purged.
///
/// Returns `deleted_at + retention_days` using the configured retention period.
fn compute_permanent_delete_at(deleted_at: DateTime<Utc>, retention_days: i64) -> DateTime<Utc> {
    deleted_at + Duration::days(retention_days)
}

/// Read the soft-delete retention days from the application configuration.
///
/// Falls back to 30 days if the config cannot be loaded.
fn get_retention_days() -> i64 {
    Config::from_env()
        .map(|c| c.soft_delete_retention_days)
        .unwrap_or(30)
}

/// Create a new transaction with optional splits
pub async fn create_transaction(
    pool: &DbPool,
    user_id: Uuid,
    request: CreateTransactionRequest,
) -> Result<TransactionResponse, ApiError> {
    // Validate request
    request.validate().map_err(|e| {
        tracing::warn!("Transaction validation failed: {}", e);
        ApiError::Validation(e.to_string())
    })?;

    // Convert amount to BigDecimal
    let amount = BigDecimal::from_str(&request.amount.to_string()).map_err(|e| {
        tracing::error!("Failed to convert amount: {}", e);
        ApiError::Validation("Invalid amount".to_string())
    })?;

    // Verify account ownership
    let account = repositories::account::find_by_id(pool, request.account_id).await?;
    if account.user_id != user_id {
        tracing::warn!(
            "User {} attempted to create transaction for account {} owned by {}",
            user_id,
            request.account_id,
            account.user_id
        );
        return Err(ApiError::Unauthorized(
            "Account does not belong to user".to_string(),
        ));
    }

    // If category provided, verify it belongs to user
    if let Some(category_id) = request.category_id {
        let category = repositories::category::find_by_id(pool, category_id).await?;
        if category.user_id != user_id {
            tracing::warn!(
                "User {} attempted to use category {} owned by {}",
                user_id,
                category_id,
                category.user_id
            );
            return Err(ApiError::Unauthorized(
                "Category does not belong to user".to_string(),
            ));
        }
    }

    // Create transaction
    let new_transaction = NewTransaction {
        user_id,
        account_id: request.account_id,
        category_id: request.category_id,
        title: request.title.clone(),
        amount,
        date: request.date,
        notes: request.notes.clone(),
    };

    let transaction =
        repositories::transaction::create_transaction(pool, user_id, new_transaction).await?;

    tracing::info!(
        "Created transaction {} for user {}",
        transaction.id,
        user_id
    );

    // Handle splits if provided
    let splits = if let Some(split_inputs) = request.splits {
        let mut created_splits = Vec::new();
        for split_input in split_inputs {
            // Verify person ownership
            let person = repositories::person::find_by_id(pool, split_input.person_id).await?;
            if person.user_id != user_id {
                tracing::warn!(
                    "User {} attempted to split with person {} owned by {}",
                    user_id,
                    split_input.person_id,
                    person.user_id
                );
                return Err(ApiError::Unauthorized(
                    "Person does not belong to user".to_string(),
                ));
            }

            let split_amount =
                BigDecimal::from_str(&split_input.amount.to_string()).map_err(|e| {
                    tracing::error!("Failed to convert split amount: {}", e);
                    ApiError::Validation("Invalid split amount".to_string())
                })?;

            let new_split = NewTransactionSplit {
                transaction_id: transaction.id,
                person_id: split_input.person_id,
                amount: split_amount,
            };

            let split =
                repositories::transaction::create_split(pool, transaction.id, new_split).await?;
            created_splits.push(split);
        }
        Some(created_splits)
    } else {
        None
    };

    // Build response
    let mut response = TransactionResponse::from(transaction);
    response.splits = splits.map(|s| s.into_iter().map(|split| split.into()).collect());

    Ok(response)
}

/// Get a transaction by ID with splits, debt metadata, and transfer info.
pub async fn get_transaction(
    pool: &DbPool,
    transaction_id: Uuid,
    user_id: Uuid,
) -> Result<TransactionResponse, ApiError> {
    // Fetch transaction with debt metadata via LEFT JOIN
    let result = repositories::transaction::find_by_id(pool, transaction_id).await?;

    // Verify ownership
    if result.transaction.user_id != user_id {
        tracing::warn!(
            "User {} attempted to access transaction {} owned by {}",
            user_id,
            transaction_id,
            result.transaction.user_id
        );
        return Err(ApiError::Forbidden("Access denied".to_string()));
    }

    // Fetch splits
    let splits = repositories::transaction::list_splits_for_transaction(pool, transaction_id)
        .await?
        .into_iter()
        .map(|split| split.into())
        .collect::<Vec<_>>();

    // Convert with debt_metadata populated from LEFT JOIN via From impl
    let mut response = TransactionResponse::from(result);
    response.splits = if splits.is_empty() {
        None
    } else {
        Some(splits)
    };

    // Compute permanent_delete_at for soft-deleted transactions
    if let Some(deleted_at) = response.deleted_at {
        let retention_days = get_retention_days();
        response.permanent_delete_at =
            Some(compute_permanent_delete_at(deleted_at, retention_days));
    }

    // Fetch transfer info if this transaction is part of a transfer
    let transfer_map =
        repositories::transfer::find_transfer_info_for_transactions(pool, &[transaction_id])
            .await?;
    if let Some(info) = transfer_map.into_values().next() {
        response.transfer_info = Some(info);
    }

    Ok(response)
}

/// List transactions with filters
pub async fn list_transactions(
    pool: &DbPool,
    user_id: Uuid,
    filters: TransactionFilter,
) -> Result<Vec<TransactionResponse>, ApiError> {
    // Validate filters
    filters.validate().map_err(|e| {
        tracing::warn!("Transaction filter validation failed: {}", e);
        ApiError::Validation(e.to_string())
    })?;

    // If account_id filter provided, verify ownership
    if let Some(account_id) = filters.account_id {
        let account = repositories::account::find_by_id(pool, account_id).await?;
        if account.user_id != user_id {
            return Err(ApiError::Unauthorized(
                "Account does not belong to user".to_string(),
            ));
        }
    }

    // If category_id filter provided, verify ownership
    if let Some(category_id) = filters.category_id {
        let category = repositories::category::find_by_id(pool, category_id).await?;
        if category.user_id != user_id {
            return Err(ApiError::Unauthorized(
                "Category does not belong to user".to_string(),
            ));
        }
    }

    // Determine if we're listing soft-deleted transactions (for permanent_delete_at computation)
    let listing_deleted = filters.is_deleted == Some(true);

    // List transactions with debt metadata via LEFT JOIN
    // The is_deleted filter is passed through to the repository layer
    let results = repositories::transaction::list_transactions(pool, user_id, filters).await?;

    // Read retention days once if listing deleted transactions
    let retention_days = if listing_deleted {
        get_retention_days()
    } else {
        0
    };

    // Convert to responses with splits
    let mut responses = Vec::new();
    for result in results {
        let transaction_id = result.transaction.id;
        let mut response = TransactionResponse::from(result);

        // Compute permanent_delete_at for soft-deleted transactions
        if listing_deleted {
            if let Some(deleted_at) = response.deleted_at {
                response.permanent_delete_at =
                    Some(compute_permanent_delete_at(deleted_at, retention_days));
            }
        }

        // Fetch splits for this transaction
        let splits = repositories::transaction::list_splits_for_transaction(pool, transaction_id)
            .await?
            .into_iter()
            .map(|split| split.into())
            .collect::<Vec<_>>();

        response.splits = if splits.is_empty() {
            None
        } else {
            Some(splits)
        };

        responses.push(response);
    }

    // Batch-fetch transfer info for all transactions in the result set
    let transaction_ids: Vec<Uuid> = responses.iter().map(|r| r.id).collect();
    let transfer_map =
        repositories::transfer::find_transfer_info_for_transactions(pool, &transaction_ids).await?;

    // Populate transfer_info on each response that has a match
    for response in &mut responses {
        if let Some(info) = transfer_map.get(&response.id) {
            response.transfer_info = Some(info.clone());
        }
    }

    Ok(responses)
}

/// Update a transaction
pub async fn update_transaction(
    pool: &DbPool,
    transaction_id: Uuid,
    user_id: Uuid,
    request: UpdateTransactionRequest,
) -> Result<TransactionResponse, ApiError> {
    // Validate request
    request.validate().map_err(|e| {
        tracing::warn!("Transaction update validation failed: {}", e);
        ApiError::Validation(e.to_string())
    })?;

    // Fetch and verify ownership
    let result = repositories::transaction::find_by_id(pool, transaction_id).await?;
    if result.transaction.user_id != user_id {
        tracing::warn!(
            "User {} attempted to update transaction {} owned by {}",
            user_id,
            transaction_id,
            result.transaction.user_id
        );
        return Err(ApiError::Forbidden("Access denied".to_string()));
    }

    // If updating account, verify new account ownership
    if let Some(account_id) = request.account_id {
        let account = repositories::account::find_by_id(pool, account_id).await?;
        if account.user_id != user_id {
            return Err(ApiError::Unauthorized(
                "Account does not belong to user".to_string(),
            ));
        }
    }

    // If updating category, verify new category ownership
    if let Some(category_id) = request.category_id {
        let category = repositories::category::find_by_id(pool, category_id).await?;
        if category.user_id != user_id {
            return Err(ApiError::Unauthorized(
                "Category does not belong to user".to_string(),
            ));
        }
    }

    // Reject splits on income transactions (positive amount)
    if request.splits.is_some() {
        let effective_amount = request.amount.unwrap_or_else(|| {
            result
                .transaction
                .amount
                .to_string()
                .parse::<f64>()
                .unwrap_or(0.0)
        });
        if effective_amount > 0.0 {
            return Err(ApiError::Validation(
                "Splits are not allowed on income transactions".to_string(),
            ));
        }
    }

    // Convert amount if provided
    let amount = if let Some(amt) = request.amount {
        Some(BigDecimal::from_str(&amt.to_string()).map_err(|e| {
            tracing::error!("Failed to convert amount: {}", e);
            ApiError::Validation("Invalid amount".to_string())
        })?)
    } else {
        None
    };

    // Create update struct
    let updates = crate::models::UpdateTransaction {
        account_id: request.account_id,
        category_id: request.category_id,
        title: request.title,
        amount,
        date: request.date,
        notes: request.notes,
    };

    // Update transaction
    let updated =
        repositories::transaction::update_transaction(pool, transaction_id, updates).await?;

    tracing::info!(
        "Updated transaction {} for user {}",
        transaction_id,
        user_id
    );

    // Handle splits if provided (upsert strategy: preserves split IDs for sync records)
    let splits = if let Some(split_inputs) = request.splits {
        // Validate no duplicate person_ids in the request
        let mut seen_persons = HashSet::new();
        for input in &split_inputs {
            if !seen_persons.insert(input.person_id) {
                return Err(ApiError::Validation(
                    "Duplicate person_id in splits".to_string(),
                ));
            }
        }

        // Fetch existing splits for this transaction
        let existing_splits =
            repositories::transaction::list_splits_for_transaction(pool, transaction_id).await?;

        // Build person_id → existing split lookup
        let existing_map: HashMap<Uuid, crate::models::transaction_split::TransactionSplit> =
            existing_splits
                .into_iter()
                .map(|s| (s.person_id, s))
                .collect();

        // Track which existing person_ids are still present in the incoming request
        let incoming_person_ids: HashSet<Uuid> = split_inputs.iter().map(|s| s.person_id).collect();

        let mut result_splits = Vec::new();

        for split_input in split_inputs {
            // Verify person ownership
            let person = repositories::person::find_by_id(pool, split_input.person_id).await?;
            if person.user_id != user_id {
                tracing::warn!(
                    "User {} attempted to split with person {} owned by {}",
                    user_id,
                    split_input.person_id,
                    person.user_id
                );
                return Err(ApiError::Unauthorized(
                    "Person does not belong to user".to_string(),
                ));
            }

            let split_amount =
                BigDecimal::from_str(&split_input.amount.to_string()).map_err(|e| {
                    tracing::error!("Failed to convert split amount: {}", e);
                    ApiError::Validation("Invalid split amount".to_string())
                })?;

            if let Some(existing) = existing_map.get(&split_input.person_id) {
                // UPDATE existing split amount (preserves split ID and sync records)
                let updated =
                    repositories::transaction::update_split_amount(pool, existing.id, split_amount)
                        .await?;
                result_splits.push(updated);
            } else {
                // CREATE new split
                let new_split = NewTransactionSplit {
                    transaction_id,
                    person_id: split_input.person_id,
                    amount: split_amount,
                };
                let split =
                    repositories::transaction::create_split(pool, transaction_id, new_split)
                        .await?;
                result_splits.push(split);
            }
        }

        // DELETE splits for persons no longer in the list
        for (person_id, existing_split) in &existing_map {
            if !incoming_person_ids.contains(person_id) {
                repositories::transaction::delete_split_by_id(pool, existing_split.id).await?;
            }
        }

        if result_splits.is_empty() {
            None
        } else {
            Some(
                result_splits
                    .into_iter()
                    .map(|split| split.into())
                    .collect(),
            )
        }
    } else {
        // Splits not provided in request — fetch existing splits
        let existing_splits =
            repositories::transaction::list_splits_for_transaction(pool, transaction_id).await?;
        if existing_splits.is_empty() {
            None
        } else {
            Some(
                existing_splits
                    .into_iter()
                    .map(|split| split.into())
                    .collect(),
            )
        }
    };

    let mut response = TransactionResponse::from(updated);
    response.splits = splits;

    Ok(response)
}

/// Soft-delete a transaction (move to trash).
///
/// If the transaction is part of a transfer, both linked transactions are
/// soft-deleted atomically. Returns the soft-deleted transaction with
/// `deleted_at` and computed `permanent_delete_at`.
pub async fn delete_transaction(
    pool: &DbPool,
    transaction_id: Uuid,
    user_id: Uuid,
) -> Result<TransactionResponse, ApiError> {
    // Fetch and verify ownership
    let result = repositories::transaction::find_by_id(pool, transaction_id).await?;
    if result.transaction.user_id != user_id {
        tracing::warn!(
            "User {} attempted to delete transaction {} owned by {}",
            user_id,
            transaction_id,
            result.transaction.user_id
        );
        return Err(ApiError::Forbidden("Access denied".to_string()));
    }

    // Check if the transaction is part of a transfer
    if let Some(transfer) =
        repositories::transfer::find_transfer_by_transaction_id(pool, transaction_id).await?
    {
        // Soft-delete both transactions in the transfer
        repositories::transfer::soft_delete_transfer_transactions(pool, &transfer).await?;

        tracing::info!(
            "Soft-deleted transfer {} and both transactions for user {}",
            transfer.id,
            user_id
        );
    } else {
        // Soft-delete the standalone transaction
        repositories::transaction::soft_delete_transaction(pool, transaction_id).await?;

        tracing::info!(
            "Soft-deleted transaction {} for user {}",
            transaction_id,
            user_id
        );
    }

    // Re-fetch the transaction to get the updated deleted_at timestamp
    let updated_result = repositories::transaction::find_by_id(pool, transaction_id).await?;
    let mut response = TransactionResponse::from(updated_result);

    // Compute permanent_delete_at
    if let Some(deleted_at) = response.deleted_at {
        let retention_days = get_retention_days();
        response.permanent_delete_at =
            Some(compute_permanent_delete_at(deleted_at, retention_days));
    }

    Ok(response)
}

/// Restore a soft-deleted transaction from trash.
///
/// If the transaction is part of a transfer, both linked transactions are
/// restored. Returns the restored `TransactionResponse`.
pub async fn restore_transaction(
    pool: &DbPool,
    transaction_id: Uuid,
    user_id: Uuid,
) -> Result<TransactionResponse, ApiError> {
    // Fetch transaction (find_by_id does NOT filter by is_deleted)
    let result = repositories::transaction::find_by_id(pool, transaction_id).await?;

    // Verify ownership
    if result.transaction.user_id != user_id {
        tracing::warn!(
            "User {} attempted to restore transaction {} owned by {}",
            user_id,
            transaction_id,
            result.transaction.user_id
        );
        return Err(ApiError::Forbidden("Access denied".to_string()));
    }

    // Verify the transaction is actually soft-deleted
    if !result.transaction.is_deleted {
        return Err(ApiError::BadRequest(
            "Transaction is not in trash".to_string(),
        ));
    }

    // Check if the transaction is part of a transfer
    if let Some(transfer) =
        repositories::transfer::find_transfer_by_transaction_id(pool, transaction_id).await?
    {
        // Restore both transactions in the transfer
        repositories::transfer::restore_transfer_transactions(pool, &transfer).await?;

        tracing::info!(
            "Restored transfer {} and both transactions for user {}",
            transfer.id,
            user_id
        );
    } else {
        // Restore the standalone transaction
        repositories::transaction::restore_transaction(pool, transaction_id).await?;

        tracing::info!(
            "Restored transaction {} for user {}",
            transaction_id,
            user_id
        );
    }

    // Re-fetch the restored transaction to build the response
    let restored_result = repositories::transaction::find_by_id(pool, transaction_id).await?;

    // Fetch splits
    let splits = repositories::transaction::list_splits_for_transaction(pool, transaction_id)
        .await?
        .into_iter()
        .map(|split| split.into())
        .collect::<Vec<_>>();

    let mut response = TransactionResponse::from(restored_result);
    response.splits = if splits.is_empty() {
        None
    } else {
        Some(splits)
    };

    // Fetch transfer info
    let transfer_map =
        repositories::transfer::find_transfer_info_for_transactions(pool, &[transaction_id])
            .await?;
    if let Some(info) = transfer_map.into_values().next() {
        response.transfer_info = Some(info);
    }

    Ok(response)
}

/// Permanently delete a soft-deleted transaction.
///
/// The transaction must already be in the trash (`is_deleted == true`).
/// If the transaction is part of a transfer, both linked transactions,
/// the transfer record, associated splits, and debt metadata are all
/// hard-deleted.
pub async fn permanent_delete_transaction(
    pool: &DbPool,
    transaction_id: Uuid,
    user_id: Uuid,
) -> Result<(), ApiError> {
    // Fetch transaction (find_by_id does NOT filter by is_deleted)
    let result = repositories::transaction::find_by_id(pool, transaction_id).await?;

    // Verify ownership
    if result.transaction.user_id != user_id {
        tracing::warn!(
            "User {} attempted to permanently delete transaction {} owned by {}",
            user_id,
            transaction_id,
            result.transaction.user_id
        );
        return Err(ApiError::Forbidden("Access denied".to_string()));
    }

    // Verify the transaction is actually soft-deleted
    if !result.transaction.is_deleted {
        return Err(ApiError::BadRequest(
            "Transaction is not in trash".to_string(),
        ));
    }

    // Check if the transaction is part of a transfer
    if let Some(transfer) =
        repositories::transfer::find_transfer_by_transaction_id(pool, transaction_id).await?
    {
        // Hard-delete both transactions and the transfer link atomically
        // (delete_transfer_and_transactions handles splits deletion and cascade)
        repositories::transfer::delete_transfer_and_transactions(pool, &transfer).await?;

        tracing::info!(
            "Permanently deleted transfer {} and both transactions for user {}",
            transfer.id,
            user_id
        );
    } else {
        // Delete splits first
        repositories::transaction::delete_splits_for_transaction(pool, transaction_id).await?;

        // Delete debt metadata if present
        repositories::debt_transaction_metadata::delete_by_transaction_id(pool, transaction_id)
            .await?;

        // Hard-delete the transaction
        repositories::transaction::hard_delete_transaction(pool, transaction_id).await?;

        tracing::info!(
            "Permanently deleted transaction {} for user {}",
            transaction_id,
            user_id
        );
    }

    Ok(())
}
