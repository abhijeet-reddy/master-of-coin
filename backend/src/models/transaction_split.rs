use bigdecimal::BigDecimal;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct TransactionSplit {
    pub id: Uuid,
    pub transaction_id: Uuid,
    pub person_id: Uuid,
    pub amount: BigDecimal,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateTransactionSplit {
    pub transaction_id: Uuid,
    pub person_id: Uuid,
    pub amount: BigDecimal,
}

#[derive(Debug, Deserialize)]
pub struct UpdateTransactionSplit {
    pub person_id: Option<Uuid>,
    pub amount: Option<BigDecimal>,
}
