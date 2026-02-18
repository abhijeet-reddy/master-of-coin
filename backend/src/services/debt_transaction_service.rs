//! Service for creating "paid by others" (debt) transactions.
//!
//! This module handles the creation of transactions where another person paid
//! for an expense on the user's behalf. These transactions are recorded on
//! DEBT pseudo-accounts and linked to the payer via `debt_transaction_metadata`.

use bigdecimal::BigDecimal;
use std::str::FromStr;
use uuid::Uuid;
use validator::Validate;

use crate::{
    DbPool,
    errors::ApiError,
    models::{
        CreateDebtTransactionRequest, NewDebtTransactionMetadata, NewTransaction,
        NewTransactionSplit, TransactionResponse, debt_transaction_metadata::DebtMetadataResponse,
    },
    repositories,
    types::CurrencyCode,
};

/// Creates a "paid by others" transaction.
///
/// Orchestrates the full flow:
/// 1. Validates payer person and category ownership
/// 2. Gets or creates a DEBT account for the specified currency
/// 3. Creates the transaction on the DEBT account
/// 4. Creates `debt_transaction_metadata` linking to the payer
/// 5. Creates a split for debt tracking
///
/// # Arguments
///
/// * `pool` - Database connection pool
/// * `user_id` - The authenticated user's ID
/// * `request` - The debt transaction creation request
///
/// # Returns
///
/// A [`TransactionResponse`] with `debt_metadata` populated.
///
/// # Errors
///
/// Returns [`ApiError::Validation`] if the request is invalid or amount is zero.
/// Returns [`ApiError::Unauthorized`] if the person or category doesn't belong to the user.
pub async fn create_debt_transaction(
    pool: &DbPool,
    user_id: Uuid,
    request: CreateDebtTransactionRequest,
) -> Result<TransactionResponse, ApiError> {
    request.validate().map_err(|e| {
        tracing::warn!("Debt transaction validation failed: {}", e);
        ApiError::Validation(e.to_string())
    })?;

    if request.amount == 0.0 {
        return Err(ApiError::Validation(
            "Transaction amount cannot be zero".to_string(),
        ));
    }

    // Verify payer person ownership
    let payer = repositories::person::find_by_id(pool, request.payer_person_id).await?;
    if payer.user_id != user_id {
        tracing::warn!(
            "User {} attempted to use person {} owned by {}",
            user_id,
            request.payer_person_id,
            payer.user_id
        );
        return Err(ApiError::Unauthorized(
            "Person does not belong to user".to_string(),
        ));
    }

    // Verify category ownership if provided
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

    let amount = BigDecimal::from_str(&request.amount.to_string()).map_err(|e| {
        tracing::error!("Failed to convert amount: {}", e);
        ApiError::Validation("Invalid amount".to_string())
    })?;

    // Get or create DEBT account for the currency
    let currency = request.currency.unwrap_or(CurrencyCode::Eur);
    let debt_account =
        repositories::account::get_or_create_debt_account(pool, user_id, currency).await?;

    // Create transaction on the DEBT account
    let new_transaction = NewTransaction {
        user_id,
        account_id: debt_account.id,
        category_id: request.category_id,
        title: request.title.clone(),
        amount: amount.clone(),
        date: request.date,
        notes: request.notes.clone(),
    };

    let transaction =
        repositories::transaction::create_transaction(pool, user_id, new_transaction).await?;

    tracing::info!(
        "Created debt transaction {} for user {} (payer: {})",
        transaction.id,
        user_id,
        payer.name
    );

    // Create debt_transaction_metadata
    let new_metadata = NewDebtTransactionMetadata {
        transaction_id: transaction.id,
        payer_person_id: request.payer_person_id,
    };
    repositories::debt_transaction_metadata::create_metadata(pool, new_metadata).await?;

    // Create split for debt tracking.
    // The split amount matches the transaction amount:
    // - Negative amount (expense) → negative split → I owe them
    // - Positive amount (collected on my behalf) → positive split → they owe me
    let new_split = NewTransactionSplit {
        transaction_id: transaction.id,
        person_id: request.payer_person_id,
        amount,
    };
    let split = repositories::transaction::create_split(pool, transaction.id, new_split).await?;

    // Build response with debt_metadata
    let mut response = TransactionResponse::from(transaction);
    response.splits = Some(vec![split.into()]);
    response.debt_metadata = Some(DebtMetadataResponse {
        payer_person_id: request.payer_person_id,
        payer_person_name: payer.name,
    });

    Ok(response)
}
