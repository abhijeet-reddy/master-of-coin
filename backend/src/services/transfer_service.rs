use bigdecimal::BigDecimal;
use std::str::FromStr;
use uuid::Uuid;
use validator::Validate;

use crate::{
    DbPool,
    errors::ApiError,
    models::{
        NewTransaction, TransactionResponse,
        transfer::{CreateTransferRequest, TransferResponse},
    },
    repositories,
};

/// Create a transfer between two accounts owned by the same user.
///
/// This creates two linked transactions (a debit on the source account and a
/// credit on the destination account) atomically via the repository layer.
pub async fn create_transfer(
    pool: &DbPool,
    user_id: Uuid,
    request: CreateTransferRequest,
) -> Result<TransferResponse, ApiError> {
    // 1. Validate request
    request.validate().map_err(|e| {
        tracing::warn!("Transfer validation failed: {}", e);
        ApiError::Validation(e.to_string())
    })?;

    // 2. Verify from_account_id != to_account_id
    if request.from_account_id == request.to_account_id {
        return Err(ApiError::Validation(
            "Source and destination accounts must be different".to_string(),
        ));
    }

    // 3. Verify both accounts belong to user
    let from_account = repositories::account::find_by_id(pool, request.from_account_id).await?;
    if from_account.user_id != user_id {
        tracing::warn!(
            "User {} attempted to transfer from account {} owned by {}",
            user_id,
            request.from_account_id,
            from_account.user_id
        );
        return Err(ApiError::Unauthorized(
            "Account does not belong to user".to_string(),
        ));
    }

    let to_account = repositories::account::find_by_id(pool, request.to_account_id).await?;
    if to_account.user_id != user_id {
        tracing::warn!(
            "User {} attempted to transfer to account {} owned by {}",
            user_id,
            request.to_account_id,
            to_account.user_id
        );
        return Err(ApiError::Unauthorized(
            "Account does not belong to user".to_string(),
        ));
    }

    // 4. If category provided, verify it belongs to user
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

    // 5. Resolve amounts and exchange rate
    let same_currency = from_account.currency == to_account.currency;
    let from_amount = request.from_amount;

    let (to_amount, exchange_rate) = if same_currency {
        (from_amount, 1.0_f64)
    } else if let Some(to_amt) = request.to_amount {
        let rate = to_amt / from_amount;
        (to_amt, rate)
    } else if let Some(rate) = request.exchange_rate {
        let to_amt = from_amount * rate;
        (to_amt, rate)
    } else {
        return Err(ApiError::Validation(
            "Cross-currency transfers require either to_amount or exchange_rate".to_string(),
        ));
    };

    // 6. Validate exchange_rate > 0 and to_amount > 0
    if exchange_rate <= 0.0 {
        return Err(ApiError::Validation(
            "Exchange rate must be positive".to_string(),
        ));
    }
    if to_amount <= 0.0 {
        return Err(ApiError::Validation(
            "Transfer amount must be positive".to_string(),
        ));
    }

    // 7. Build titles
    let from_title = request
        .title
        .clone()
        .unwrap_or_else(|| format!("Transfer to {}", to_account.name));
    let to_title = request
        .title
        .clone()
        .unwrap_or_else(|| format!("Transfer from {}", from_account.name));

    // 8-10. Convert amounts to BigDecimal and build NewTransaction structs
    let from_amount_bd = BigDecimal::from_str(&format!("{}", from_amount)).map_err(|e| {
        tracing::error!("Failed to convert from_amount to BigDecimal: {}", e);
        ApiError::Validation("Invalid from_amount".to_string())
    })?;

    let to_amount_bd = BigDecimal::from_str(&format!("{}", to_amount)).map_err(|e| {
        tracing::error!("Failed to convert to_amount to BigDecimal: {}", e);
        ApiError::Validation("Invalid to_amount".to_string())
    })?;

    let exchange_rate_bd = BigDecimal::from_str(&format!("{}", exchange_rate)).map_err(|e| {
        tracing::error!("Failed to convert exchange_rate to BigDecimal: {}", e);
        ApiError::Validation("Invalid exchange_rate".to_string())
    })?;

    // From-side transaction: negative amount (outflow)
    let from_txn = NewTransaction {
        user_id,
        account_id: request.from_account_id,
        category_id: request.category_id,
        title: from_title,
        amount: -from_amount_bd,
        date: request.date,
        notes: request.notes.clone(),
    };

    // To-side transaction: positive amount (inflow)
    let to_txn = NewTransaction {
        user_id,
        account_id: request.to_account_id,
        category_id: request.category_id,
        title: to_title,
        amount: to_amount_bd,
        date: request.date,
        notes: request.notes.clone(),
    };

    // 11. Call repository to create transfer atomically
    let (transfer, from_transaction, to_transaction) =
        repositories::transfer::create_transfer_atomic(pool, from_txn, to_txn, exchange_rate_bd)
            .await?;

    tracing::info!(
        "Created transfer {} for user {} (from={}, to={})",
        transfer.id,
        user_id,
        request.from_account_id,
        request.to_account_id
    );

    // 12. Build TransferResponse
    let from_response = TransactionResponse::from(from_transaction);
    let to_response = TransactionResponse::from(to_transaction);

    Ok(TransferResponse {
        id: transfer.id,
        from_transaction: from_response,
        to_transaction: to_response,
        exchange_rate: format!("{}", transfer.exchange_rate),
        created_at: transfer.created_at,
    })
}
