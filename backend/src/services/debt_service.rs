use bigdecimal::BigDecimal;
use std::str::FromStr;
use uuid::Uuid;

use crate::{
    DbPool,
    errors::ApiError,
    models::{NewTransaction, NewTransactionSplit},
    repositories,
};

/// Debt information for a person
#[derive(Debug, serde::Serialize, serde::Deserialize)]
pub struct PersonDebt {
    pub person_id: Uuid,
    pub person_name: String,
    pub debt_amount: String, // Positive means they owe you, negative means you owe them
}

/// Calculate debt for a specific person
/// Returns positive if they owe you, negative if you owe them
pub async fn calculate_debt_for_person(
    pool: &DbPool,
    person_id: Uuid,
    user_id: Uuid,
) -> Result<String, ApiError> {
    // Verify person ownership
    let person = repositories::person::find_by_id(pool, person_id).await?;
    if person.user_id != user_id {
        tracing::warn!(
            "User {} attempted to calculate debt for person {} owned by {}",
            user_id,
            person_id,
            person.user_id
        );
        return Err(ApiError::Forbidden(
            "Person does not belong to user".to_string(),
        ));
    }

    // Get all splits for this person
    let splits = repositories::person::list_splits_for_person(pool, person_id).await?;

    // Sum all split amounts
    // Positive amounts mean they owe you (you paid for them)
    // Negative amounts mean you owe them (they paid for you)
    let total_debt: BigDecimal = splits.iter().map(|split| split.amount.clone()).sum();

    Ok(total_debt.to_string())
}

/// Get all debts for a user (all people they've shared expenses with)
pub async fn get_all_debts_for_user(
    pool: &DbPool,
    user_id: Uuid,
) -> Result<Vec<PersonDebt>, ApiError> {
    // Get all user's people
    let people = repositories::person::list_by_user(pool, user_id).await?;

    let mut debts = Vec::new();

    for person in people {
        // Get splits for this person
        let splits = repositories::person::list_splits_for_person(pool, person.id).await?;

        // Calculate total debt
        let total_debt: BigDecimal = splits.iter().map(|split| split.amount.clone()).sum();

        // Only include if there's an actual debt (non-zero)
        if total_debt != BigDecimal::from(0) {
            debts.push(PersonDebt {
                person_id: person.id,
                person_name: person.name,
                debt_amount: total_debt.to_string(),
            });
        }
    }

    Ok(debts)
}

/// Settle debt with a person
/// Creates a settlement transaction to record the payment
pub async fn settle_debt(
    pool: &DbPool,
    person_id: Uuid,
    user_id: Uuid,
    amount: f64,
    account_id: Uuid,
) -> Result<(), ApiError> {
    // Verify person ownership
    let person = repositories::person::find_by_id(pool, person_id).await?;
    if person.user_id != user_id {
        tracing::warn!(
            "User {} attempted to settle debt with person {} owned by {}",
            user_id,
            person_id,
            person.user_id
        );
        return Err(ApiError::Forbidden(
            "Person does not belong to user".to_string(),
        ));
    }

    // Verify account ownership
    let account = repositories::account::find_by_id(pool, account_id).await?;
    if account.user_id != user_id {
        return Err(ApiError::Forbidden(
            "Account does not belong to user".to_string(),
        ));
    }

    // Validate amount
    if amount == 0.0 {
        return Err(ApiError::Validation(
            "Settlement amount cannot be zero".to_string(),
        ));
    }

    // Convert amount to BigDecimal
    let settlement_amount = BigDecimal::from_str(&amount.to_string()).map_err(|e| {
        tracing::error!("Failed to convert settlement amount: {}", e);
        ApiError::Validation("Invalid settlement amount".to_string())
    })?;

    // Create settlement transaction
    // Positive amount means you received payment from them
    // Negative amount means you paid them
    let settlement_transaction = NewTransaction {
        user_id,
        account_id,
        category_id: None,
        title: format!("Debt settlement with {}", person.name),
        amount: settlement_amount.clone(),
        date: chrono::Utc::now(),
        notes: Some(format!("Settlement of debt with {}", person.name)),
    };

    let transaction =
        repositories::transaction::create_transaction(pool, user_id, settlement_transaction)
            .await?;

    // Create a split with negative amount to offset the debt
    // If they paid you (positive amount), create negative split to reduce their debt
    // If you paid them (negative amount), create positive split to reduce your debt to them
    let split_amount = -settlement_amount;

    let new_split = NewTransactionSplit {
        transaction_id: transaction.id,
        person_id,
        amount: split_amount,
    };

    repositories::transaction::create_split(pool, transaction.id, new_split).await?;

    tracing::info!(
        "Settled debt of {} with person {} for user {}",
        amount,
        person_id,
        user_id
    );

    Ok(())
}
