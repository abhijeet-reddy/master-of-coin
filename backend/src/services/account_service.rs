use bigdecimal::BigDecimal;
use std::str::FromStr;
use uuid::Uuid;
use validator::Validate;

use crate::{
    DbPool,
    errors::ApiError,
    models::{
        AccountResponse, CreateAccountRequest, NewAccount, NewTransaction, UpdateAccountRequest,
    },
    repositories,
};

/// Create a new account
pub async fn create_account(
    pool: &DbPool,
    user_id: Uuid,
    request: CreateAccountRequest,
) -> Result<AccountResponse, ApiError> {
    // Validate request
    request.validate().map_err(|e| {
        tracing::warn!("Account validation failed: {}", e);
        ApiError::Validation(e.to_string())
    })?;

    // Convert initial balance if provided
    let initial_balance = if let Some(balance) = request.initial_balance {
        Some(BigDecimal::from_str(&balance.to_string()).map_err(|e| {
            tracing::error!("Failed to convert initial balance: {}", e);
            ApiError::Validation("Invalid initial balance".to_string())
        })?)
    } else {
        None
    };

    // Create account with currency defaulting to EUR if not provided
    let new_account = NewAccount {
        user_id,
        name: request.name.clone(),
        account_type: request.account_type,
        currency: request.currency.unwrap_or(crate::types::CurrencyCode::Eur),
        notes: request.notes.clone(),
    };

    let account = repositories::account::create_account(pool, user_id, new_account).await?;

    tracing::info!("Created account {} for user {}", account.id, user_id);

    // If initial balance provided, create an initial transaction
    if let Some(balance) = initial_balance {
        if balance != BigDecimal::from(0) {
            let initial_transaction = NewTransaction {
                user_id,
                account_id: account.id,
                category_id: None,
                title: "Initial Balance".to_string(), // TODO: Consider making this configurable or translatable
                amount: balance,
                date: chrono::Utc::now(),
                notes: Some("Initial account balance".to_string()), // TODO: Consider making this configurable or translatable
            };

            repositories::transaction::create_transaction(pool, user_id, initial_transaction)
                .await?;

            tracing::info!(
                "Created initial balance transaction for account {}",
                account.id
            );
        }
    }

    // Calculate current balance
    let balance = calculate_account_balance(pool, account.id).await?;

    Ok(AccountResponse {
        id: account.id,
        user_id: account.user_id,
        name: account.name,
        account_type: account.account_type,
        currency: account.currency,
        balance: balance.to_string().parse::<f64>().unwrap_or(0.0),
        is_active: true, // TODO: Add is_active field to database schema for account archiving
        notes: account.notes,
    })
}

/// Get an account with its current balance
pub async fn get_account(
    pool: &DbPool,
    account_id: Uuid,
    user_id: Uuid,
) -> Result<AccountResponse, ApiError> {
    // Fetch account
    let account = repositories::account::find_by_id(pool, account_id).await?;

    // Verify ownership
    if account.user_id != user_id {
        tracing::warn!(
            "User {} attempted to access account {} owned by {}",
            user_id,
            account_id,
            account.user_id
        );
        return Err(ApiError::Unauthorized(
            "Account does not belong to user".to_string(),
        ));
    }

    // Calculate current balance
    let balance = calculate_account_balance(pool, account_id).await?;

    Ok(AccountResponse {
        id: account.id,
        user_id: account.user_id,
        name: account.name,
        account_type: account.account_type,
        currency: account.currency,
        balance: balance.to_string().parse::<f64>().unwrap_or(0.0),
        is_active: true, // TODO: Add is_active field to database schema
        notes: account.notes,
    })
}

/// List all accounts for a user with their balances
pub async fn list_accounts(pool: &DbPool, user_id: Uuid) -> Result<Vec<AccountResponse>, ApiError> {
    // Fetch all user accounts
    let accounts = repositories::account::list_by_user(pool, user_id).await?;

    // Calculate balance for each account
    let mut responses = Vec::new();
    for account in accounts {
        let balance = calculate_account_balance(pool, account.id).await?;

        responses.push(AccountResponse {
            id: account.id,
            user_id: account.user_id,
            name: account.name,
            account_type: account.account_type,
            currency: account.currency,
            balance: balance.to_string().parse::<f64>().unwrap_or(0.0),
            is_active: true, // TODO: Add is_active field to database schema
            notes: account.notes,
        });
    }

    Ok(responses)
}

/// Update an account
pub async fn update_account(
    pool: &DbPool,
    account_id: Uuid,
    user_id: Uuid,
    request: UpdateAccountRequest,
) -> Result<AccountResponse, ApiError> {
    // Validate request
    request.validate().map_err(|e| {
        tracing::warn!("Account update validation failed: {}", e);
        ApiError::Validation(e.to_string())
    })?;

    // Fetch and verify ownership
    let account = repositories::account::find_by_id(pool, account_id).await?;
    if account.user_id != user_id {
        tracing::warn!(
            "User {} attempted to update account {} owned by {}",
            user_id,
            account_id,
            account.user_id
        );
        return Err(ApiError::Unauthorized(
            "Account does not belong to user".to_string(),
        ));
    }

    // Create update struct
    let updates = crate::models::UpdateAccount {
        name: request.name,
        notes: request.notes,
    };

    // Update account
    let updated = repositories::account::update_account(pool, account_id, updates).await?;

    tracing::info!("Updated account {} for user {}", account_id, user_id);

    // Calculate current balance
    let balance = calculate_account_balance(pool, account_id).await?;

    Ok(AccountResponse {
        id: updated.id,
        user_id: updated.user_id,
        name: updated.name,
        account_type: updated.account_type,
        currency: updated.currency,
        balance: balance.to_string().parse::<f64>().unwrap_or(0.0),
        is_active: true, // TODO: Add is_active field to database schema if account archiving is needed
        notes: updated.notes,
    })
}

/// Delete an account (only if it has no transactions)
pub async fn delete_account(
    pool: &DbPool,
    account_id: Uuid,
    user_id: Uuid,
) -> Result<(), ApiError> {
    // Fetch and verify ownership
    let account = repositories::account::find_by_id(pool, account_id).await?;
    if account.user_id != user_id {
        tracing::warn!(
            "User {} attempted to delete account {} owned by {}",
            user_id,
            account_id,
            account.user_id
        );
        return Err(ApiError::Unauthorized(
            "Account does not belong to user".to_string(),
        ));
    }

    // Check if account has transactions
    let has_transactions = repositories::account::has_transactions(pool, account_id).await?;

    if has_transactions {
        tracing::warn!(
            "User {} attempted to delete account {} which has transactions",
            user_id,
            account_id
        );
        return Err(ApiError::Validation(
            "Cannot delete account with existing transactions".to_string(),
        ));
    }

    // Delete account
    repositories::account::delete_account(pool, account_id).await?;

    tracing::info!("Deleted account {} for user {}", account_id, user_id);

    Ok(())
}

/// Helper function to calculate account balance
async fn calculate_account_balance(
    pool: &DbPool,
    account_id: Uuid,
) -> Result<BigDecimal, ApiError> {
    repositories::account::calculate_balance(pool, account_id).await
}
