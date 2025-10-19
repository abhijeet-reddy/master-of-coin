# Data Models

## Core Models

### User
```rust
pub struct User {
    pub id: Uuid,
    pub username: String,
    pub email: String,
    pub password_hash: String,
    pub name: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}
```

### Account
```rust
pub enum AccountType {
    Checking,
    Savings,
    CreditCard,
    Investment,
    Cash,
}

pub struct Account {
    pub id: Uuid,
    pub user_id: Uuid,
    pub name: String,
    pub account_type: AccountType,
    pub currency: String,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}
```

### Transaction
```rust
pub struct Transaction {
    pub id: Uuid,
    pub user_id: Uuid,
    pub account_id: Uuid,
    pub category_id: Option<Uuid>,
    pub title: String,
    pub amount: Decimal,  // Stored with 2 decimals, formatted to 2 decimals for UI
    pub date: DateTime<Utc>,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

pub struct TransactionSplit {
    pub id: Uuid,
    pub transaction_id: Uuid,
    pub person_id: Uuid,
    pub amount: Decimal,
    pub created_at: DateTime<Utc>,
}
```

### Category
```rust
pub struct Category {
    pub id: Uuid,
    pub user_id: Uuid,
    pub name: String,
    pub icon: Option<String>,
    pub color: Option<String>,
    pub parent_category_id: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}
```

### Person
```rust
pub struct Person {
    pub id: Uuid,
    pub user_id: Uuid,
    pub name: String,
    pub email: Option<String>,
    pub phone: Option<String>,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}
```

### Budget
```rust
pub enum BudgetPeriod {
    Daily,
    Weekly,
    Monthly,
    Quarterly,
    Yearly,
}

pub struct Budget {
    pub id: Uuid,
    pub user_id: Uuid,
    pub name: String,
    pub filters: serde_json::Value,  // JSONB filters
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

pub struct BudgetRange {
    pub id: Uuid,
    pub budget_id: Uuid,
    pub limit_amount: Decimal,
    pub period: BudgetPeriod,
    pub start_date: NaiveDate,
    pub end_date: NaiveDate,
    pub created_at: DateTime<Utc>,
}
```

## Decimal Formatting

All monetary values use `Decimal` type and are formatted to 2 decimal places:

```rust
use rust_decimal::Decimal;
use serde::{Serialize, Serializer};

pub fn format_decimal(decimal: &Decimal) -> String {
    format!("{:.2}", decimal)
}

// Custom serializer for API responses
pub fn serialize_decimal<S>(decimal: &Decimal, serializer: S) -> Result<S::Ok, S::Error>
where
    S: Serializer,
{
    serializer.serialize_str(&format!("{:.2}", decimal))
}
```
