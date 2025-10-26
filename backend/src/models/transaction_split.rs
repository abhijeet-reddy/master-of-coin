use bigdecimal::BigDecimal;
use chrono::{DateTime, Utc};
use diesel::{Identifiable, Insertable, Queryable, Selectable};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::schema::transaction_splits;

#[derive(Debug, Clone, Serialize, Deserialize, Queryable, Selectable, Identifiable)]
#[diesel(table_name = transaction_splits)]
pub struct TransactionSplit {
    pub id: Uuid,
    pub transaction_id: Uuid,
    pub person_id: Uuid,
    pub amount: BigDecimal,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Insertable)]
#[diesel(table_name = transaction_splits)]
pub struct NewTransactionSplit {
    pub transaction_id: Uuid,
    pub person_id: Uuid,
    pub amount: BigDecimal,
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
