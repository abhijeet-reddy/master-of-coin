//! Service for creating and updating "paid by others" (debt) transactions.
//!
//! This module handles the creation and update of transactions where another person paid
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
        NewTransactionSplit, TransactionResponse, UpdateTransaction,
        debt_transaction_metadata::{DebtMetadataResponse, UpdateExpenseDetailsRequest},
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

    // Compute total_cost: use provided value or default to the absolute amount
    let total_cost = request
        .total_cost
        .map(|tc| BigDecimal::from_str(&tc.to_string()).unwrap_or_else(|_| amount.abs()))
        .unwrap_or_else(|| amount.abs());

    // Convert expense_participants to JSONB if provided
    let expense_participants_json = request
        .expense_participants
        .as_ref()
        .map(|participants| serde_json::to_value(participants).unwrap_or(serde_json::Value::Null));

    // Create debt_transaction_metadata
    let new_metadata = NewDebtTransactionMetadata {
        transaction_id: transaction.id,
        payer_person_id: request.payer_person_id,
        total_cost: total_cost.clone(),
        expense_participants: expense_participants_json.clone(),
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

    // Parse expense_participants for response
    let participants_response = request.expense_participants.map(|participants| {
        participants
            .into_iter()
            .map(
                |p| crate::models::debt_transaction_metadata::ExpenseParticipantResponse {
                    name: p.name,
                    external_user_id: p.external_user_id,
                    paid_share: p.paid_share,
                    owed_share: p.owed_share,
                },
            )
            .collect()
    });

    // Build response with debt_metadata
    let mut response = TransactionResponse::from(transaction);
    response.splits = Some(vec![split.into()]);
    response.debt_metadata = Some(DebtMetadataResponse {
        payer_person_id: request.payer_person_id,
        payer_person_name: payer.name,
        total_cost: format!("{:.2}", total_cost),
        expense_participants: participants_response,
    });

    Ok(response)
}

/// Updates the expense details (total_cost, expense_participants) on an existing
/// debt transaction. Also updates the transaction amount and split amount to match
/// the user's owed_share from the participants list.
///
/// # Arguments
///
/// * `pool` - Database connection pool
/// * `user_id` - The authenticated user's ID
/// * `transaction_id` - The transaction to update
/// * `request` - The updated expense details
///
/// # Returns
///
/// A [`TransactionResponse`] with updated debt_metadata.
///
/// # Errors
///
/// Returns [`ApiError::NotFound`] if the transaction or metadata doesn't exist.
/// Returns [`ApiError::Unauthorized`] if the transaction doesn't belong to the user.
/// Returns [`ApiError::Validation`] if the total_cost is zero or negative.
pub async fn update_expense_details(
    pool: &DbPool,
    user_id: Uuid,
    transaction_id: Uuid,
    request: UpdateExpenseDetailsRequest,
) -> Result<TransactionResponse, ApiError> {
    if request.total_cost <= 0.0 {
        return Err(ApiError::Validation(
            "Total cost must be positive".to_string(),
        ));
    }

    // Verify transaction exists and belongs to user
    let transaction = repositories::transaction::find_by_id(pool, transaction_id).await?;
    if transaction.transaction.user_id != user_id {
        return Err(ApiError::Unauthorized(
            "Transaction does not belong to user".to_string(),
        ));
    }

    // Verify debt metadata exists
    let metadata =
        repositories::debt_transaction_metadata::find_by_transaction_id(pool, transaction_id)
            .await?
            .ok_or_else(|| {
                ApiError::NotFound(format!(
                    "No debt metadata found for transaction {}",
                    transaction_id
                ))
            })?;

    // Convert total_cost
    let total_cost = BigDecimal::from_str(&request.total_cost.to_string()).map_err(|e| {
        tracing::error!("Failed to convert total_cost: {}", e);
        ApiError::Validation("Invalid total_cost".to_string())
    })?;

    // Auto-fix payer's paid_share to match total_cost
    // Splitwise requires sum(paid_shares) == cost
    let mut participants = request.expense_participants.clone();
    let total_cost_str = format!("{:.2}", request.total_cost);
    for p in &mut participants {
        if p.paid_share.parse::<f64>().unwrap_or(0.0) > 0.0 {
            p.paid_share = total_cost_str.clone();
        }
    }

    // Serialize participants to JSONB
    let participants_json = serde_json::to_value(&participants).map_err(|e| {
        tracing::error!("Failed to serialize expense_participants: {}", e);
        ApiError::Validation("Invalid expense_participants".to_string())
    })?;

    // Find the user's owed_share from participants.
    // The user is the participant whose external_user_id is None (the "self" participant),
    // or we look for the participant that is NOT the payer.
    // For Splitwise imports, the user is the one without an external_user_id,
    // or we can use the payer_person to identify the payer and find the user's share.
    //
    // Strategy: look for participant with no external_user_id first.
    // If not found, use the first non-payer participant.
    let payer_person = repositories::person::find_by_id(pool, metadata.payer_person_id).await?;

    let user_owed_share = find_user_owed_share(&request.expense_participants, &payer_person.name);

    let user_amount = BigDecimal::from_str(&user_owed_share).map_err(|e| {
        tracing::error!("Failed to convert user owed_share: {}", e);
        ApiError::Validation("Invalid owed_share for user".to_string())
    })?;

    // The transaction amount is negative (expense) — negate the owed_share
    let signed_amount = -user_amount.abs();

    // 1. Update debt_transaction_metadata (total_cost + expense_participants)
    repositories::debt_transaction_metadata::update_expense_details(
        pool,
        transaction_id,
        total_cost.clone(),
        Some(participants_json),
    )
    .await?;

    // 2. Update transaction amount
    let update = UpdateTransaction {
        account_id: None,
        category_id: None,
        title: None,
        amount: Some(signed_amount.clone()),
        date: None,
        notes: None,
    };
    repositories::transaction::update_transaction(pool, transaction_id, update).await?;

    // 3. Update split amount (the single split for the payer)
    let existing_splits =
        repositories::transaction::list_splits_for_transaction(pool, transaction_id).await?;
    if let Some(split) = existing_splits.first() {
        repositories::transaction::update_split_amount(pool, split.id, signed_amount).await?;
    }

    tracing::info!(
        "Updated expense details for debt transaction {} (user {})",
        transaction_id,
        user_id
    );

    // Build response — re-fetch the full transaction with debt metadata via LEFT JOIN
    // The From<TransactionWithDebtInfo> impl populates debt_metadata automatically
    let updated = repositories::transaction::find_by_id(pool, transaction_id).await?;
    let mut response = TransactionResponse::from(updated);

    // Fetch updated splits for response
    let updated_splits =
        repositories::transaction::list_splits_for_transaction(pool, transaction_id)
            .await?
            .into_iter()
            .map(|s| s.into())
            .collect::<Vec<_>>();
    response.splits = if updated_splits.is_empty() {
        None
    } else {
        Some(updated_splits)
    };

    Ok(response)
}

/// Find the user's owed_share from the participants list.
/// The user is identified as the participant without an external_user_id.
/// If all participants have external_user_ids, fall back to finding by name exclusion.
fn find_user_owed_share(
    participants: &[crate::models::debt_transaction_metadata::ExpenseParticipantInput],
    payer_name: &str,
) -> String {
    // First: look for participant with no external_user_id (the local user)
    if let Some(user_participant) = participants.iter().find(|p| p.external_user_id.is_none()) {
        return user_participant.owed_share.clone();
    }

    // Fallback: look for participant whose name doesn't match the payer
    if let Some(non_payer) = participants
        .iter()
        .find(|p| p.name.to_lowercase() != payer_name.to_lowercase())
    {
        return non_payer.owed_share.clone();
    }

    // Last resort: use the first participant's owed_share
    participants
        .first()
        .map(|p| p.owed_share.clone())
        .unwrap_or_else(|| "0".to_string())
}
