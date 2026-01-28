use bigdecimal::BigDecimal;
use std::str::FromStr;
use uuid::Uuid;
use validator::Validate;

use crate::{
    DbPool,
    errors::ApiError,
    models::{
        CreateTransactionRequest, NewTransaction, NewTransactionSplit, TransactionFilter,
        TransactionResponse, UpdateTransactionRequest,
    },
    repositories,
};

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

/// Get a transaction by ID with splits
pub async fn get_transaction(
    pool: &DbPool,
    transaction_id: Uuid,
    user_id: Uuid,
) -> Result<TransactionResponse, ApiError> {
    // Fetch transaction
    let transaction = repositories::transaction::find_by_id(pool, transaction_id).await?;

    // Verify ownership
    if transaction.user_id != user_id {
        tracing::warn!(
            "User {} attempted to access transaction {} owned by {}",
            user_id,
            transaction_id,
            transaction.user_id
        );
        return Err(ApiError::Forbidden("Access denied".to_string()));
    }

    // Fetch splits
    let splits = repositories::transaction::list_splits_for_transaction(pool, transaction_id)
        .await?
        .into_iter()
        .map(|split| split.into())
        .collect::<Vec<_>>();

    let mut response = TransactionResponse::from(transaction);
    response.splits = if splits.is_empty() {
        None
    } else {
        Some(splits)
    };

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

    // List transactions
    let transactions = repositories::transaction::list_transactions(pool, user_id, filters).await?;

    // Convert to responses with splits
    let mut responses = Vec::new();
    for transaction in transactions {
        let transaction_id = transaction.id;
        let mut response = TransactionResponse::from(transaction);

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
    let transaction = repositories::transaction::find_by_id(pool, transaction_id).await?;
    if transaction.user_id != user_id {
        tracing::warn!(
            "User {} attempted to update transaction {} owned by {}",
            user_id,
            transaction_id,
            transaction.user_id
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

    Ok(TransactionResponse::from(updated))
}

/// Delete a transaction
pub async fn delete_transaction(
    pool: &DbPool,
    transaction_id: Uuid,
    user_id: Uuid,
) -> Result<(), ApiError> {
    // Fetch and verify ownership
    let transaction = repositories::transaction::find_by_id(pool, transaction_id).await?;
    if transaction.user_id != user_id {
        tracing::warn!(
            "User {} attempted to delete transaction {} owned by {}",
            user_id,
            transaction_id,
            transaction.user_id
        );
        return Err(ApiError::Forbidden("Access denied".to_string()));
    }

    // Delete splits first
    repositories::transaction::delete_splits_for_transaction(pool, transaction_id).await?;

    // Delete transaction
    repositories::transaction::delete_transaction(pool, transaction_id).await?;

    tracing::info!(
        "Deleted transaction {} for user {}",
        transaction_id,
        user_id
    );

    Ok(())
}
