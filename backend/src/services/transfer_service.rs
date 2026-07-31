use bigdecimal::BigDecimal;
use std::str::FromStr;
use uuid::Uuid;
use validator::Validate;

use crate::{
    DbPool,
    errors::ApiError,
    models::{
        NewTransaction, TransactionResponse,
        transfer::{ConvertToTransferRequest, CreateTransferRequest, TransferResponse},
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

/// Convert an existing normal transaction into a transfer.
///
/// The original transaction is kept as-is and becomes one leg; a new opposite
/// leg is created on the chosen counterpart account, and both are linked via a
/// `transfers` row — producing a transfer indistinguishable from a native one.
///
/// Direction is inferred from the original amount's sign:
/// - original **negative** (money left the original account) → original is the
///   source/from leg, the counterpart is the destination (new leg positive).
/// - original **positive** (money arrived) → original is the destination/to
///   leg, the counterpart is the source (new leg negative).
///
/// The original transaction's category is preserved on the new leg (never
/// overwritten). Refuses when the transaction has splits, is already part of a
/// transfer, has a zero amount, or the counterpart account equals the
/// original's account. All inserts happen in one DB transaction.
pub async fn convert_transaction_to_transfer(
    pool: &DbPool,
    user_id: Uuid,
    transaction_id: Uuid,
    request: ConvertToTransferRequest,
) -> Result<TransferResponse, ApiError> {
    // 1. Load the original transaction and verify ownership.
    let original = repositories::transaction::find_by_id(pool, transaction_id)
        .await?
        .transaction;
    if original.user_id != user_id {
        tracing::warn!(
            "User {} attempted to convert transaction {} owned by {}",
            user_id,
            transaction_id,
            original.user_id
        );
        return Err(ApiError::Unauthorized(
            "Transaction does not belong to user".to_string(),
        ));
    }

    // 2. Refuse if the transaction is soft-deleted.
    if original.is_deleted {
        return Err(ApiError::Validation(
            "Cannot convert a deleted transaction into a transfer".to_string(),
        ));
    }

    // 3. Refuse if the transaction already belongs to a transfer.
    if repositories::transfer::find_transfer_by_transaction_id(pool, transaction_id)
        .await?
        .is_some()
    {
        return Err(ApiError::Validation(
            "Transaction is already part of a transfer".to_string(),
        ));
    }

    // 4. Refuse if the transaction has splits (a split cannot become a transfer).
    let splits = repositories::transaction::list_splits_for_transaction(pool, transaction_id).await?;
    if !splits.is_empty() {
        return Err(ApiError::Validation(
            "Cannot convert a transaction with splits into a transfer. Remove the splits first."
                .to_string(),
        ));
    }

    // 5. Refuse zero-amount (no meaningful direction).
    let zero = BigDecimal::from(0);
    if original.amount == zero {
        return Err(ApiError::Validation(
            "Cannot convert a zero-amount transaction into a transfer".to_string(),
        ));
    }

    // 6. Counterpart account must be different from the original's account and owned by the user.
    if request.account_id == original.account_id {
        return Err(ApiError::Validation(
            "Counterpart account must be different from the transaction's account".to_string(),
        ));
    }
    let original_account = repositories::account::find_by_id(pool, original.account_id).await?;
    let counterpart_account = repositories::account::find_by_id(pool, request.account_id).await?;
    if counterpart_account.user_id != user_id {
        tracing::warn!(
            "User {} attempted to convert using counterpart account {} owned by {}",
            user_id,
            request.account_id,
            counterpart_account.user_id
        );
        return Err(ApiError::Unauthorized(
            "Account does not belong to user".to_string(),
        ));
    }

    // 7. Direction from sign. `original_is_source` == original amount is negative.
    let original_is_source = original.amount < zero;

    // 8. Resolve the counterpart leg's amount (and the transfer's exchange rate).
    // The original leg keeps its own signed amount; the new leg gets the opposite sign.
    let original_abs = original.amount.abs();
    let original_abs_f64 = f64::from_str(&original_abs.to_string()).map_err(|e| {
        tracing::error!("Failed to parse original amount: {}", e);
        ApiError::Internal
    })?;

    let same_currency = original_account.currency == counterpart_account.currency;
    let (counterpart_abs, exchange_rate) = if same_currency {
        (original_abs.clone(), 1.0_f64)
    } else if let Some(amt) = request.counterpart_amount {
        if amt <= 0.0 {
            return Err(ApiError::Validation(
                "counterpart_amount must be positive".to_string(),
            ));
        }
        let rate = amt / original_abs_f64;
        let amt_bd = BigDecimal::from_str(&format!("{}", amt))
            .map_err(|_| ApiError::Validation("Invalid counterpart_amount".to_string()))?;
        (amt_bd, rate)
    } else if let Some(rate) = request.exchange_rate {
        if rate <= 0.0 {
            return Err(ApiError::Validation(
                "exchange_rate must be positive".to_string(),
            ));
        }
        let amt_bd = BigDecimal::from_str(&format!("{}", original_abs_f64 * rate))
            .map_err(|_| ApiError::Validation("Invalid exchange_rate".to_string()))?;
        (amt_bd, rate)
    } else {
        return Err(ApiError::Validation(
            "Cross-currency conversion requires either counterpart_amount or exchange_rate"
                .to_string(),
        ));
    };

    let exchange_rate_bd = BigDecimal::from_str(&format!("{}", exchange_rate))
        .map_err(|_| ApiError::Validation("Invalid exchange_rate".to_string()))?;

    // 9. Build the new opposite leg. Sign is opposite the original: if the
    // original is the source (negative), the new counterpart leg is positive
    // (inflow), and vice versa. Category is preserved from the original.
    let new_leg_amount = if original_is_source {
        counterpart_abs // positive inflow on destination
    } else {
        -counterpart_abs // negative outflow on source
    };

    let new_leg_title = if original_is_source {
        format!("Transfer from {}", original_account.name)
    } else {
        format!("Transfer to {}", original_account.name)
    };

    let new_leg = NewTransaction {
        user_id,
        account_id: counterpart_account.id,
        category_id: original.category_id,
        title: new_leg_title,
        amount: new_leg_amount,
        date: original.date,
        notes: original.notes.clone(),
    };

    // 10. Atomically insert the new leg + the transfers row.
    let (transfer, new_transaction) =
        repositories::transfer::join_transaction_into_transfer_atomic(
            pool,
            original.id,
            original_is_source,
            new_leg,
            exchange_rate_bd,
        )
        .await?;

    tracing::info!(
        "Converted transaction {} into transfer {} for user {} (counterpart account {})",
        original.id,
        transfer.id,
        user_id,
        counterpart_account.id
    );

    // 11. Build the response with the legs in from/to order.
    let original_response = TransactionResponse::from(original);
    let new_response = TransactionResponse::from(new_transaction);
    let (from_response, to_response) = if original_is_source {
        (original_response, new_response)
    } else {
        (new_response, original_response)
    };

    Ok(TransferResponse {
        id: transfer.id,
        from_transaction: from_response,
        to_transaction: to_response,
        exchange_rate: format!("{}", transfer.exchange_rate),
        created_at: transfer.created_at,
    })
}
