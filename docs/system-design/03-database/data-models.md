# Data Models

## Overview

All data models are implemented in Rust using SQLx for database interaction. Models are located in [`backend/src/models/`](../../../backend/src/models/).

## Core Models

### User ([`backend/src/models/user.rs`](../../../backend/src/models/user.rs))

```rust
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct User {
    pub id: Uuid,
    pub username: String,
    pub email: String,
    #[serde(skip_serializing)]
    pub password_hash: String,
    pub name: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateUser {
    pub username: String,
    pub email: String,
    pub password: String,
    pub name: String,
}

#[derive(Debug, Deserialize)]
pub struct UpdateUser {
    pub username: Option<String>,
    pub email: Option<String>,
    pub name: Option<String>,
}
```

**Key Features:**

- Password hash is excluded from serialization with `#[serde(skip_serializing)]`
- Separate DTOs for create and update operations

### Account ([`backend/src/models/account.rs`](../../../backend/src/models/account.rs))

```rust
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "account_type", rename_all = "SCREAMING_SNAKE_CASE")]
pub enum AccountType {
    Checking,
    Savings,
    CreditCard,
    Investment,
    Cash,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "currency_code", rename_all = "SCREAMING_SNAKE_CASE")]
pub enum CurrencyCode {
    Usd,
    Eur,
    Gbp,
    Inr,
    Jpy,
    Aud,
    Cad,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Account {
    pub id: Uuid,
    pub user_id: Uuid,
    pub name: String,
    #[sqlx(rename = "type")]
    pub account_type: AccountType,
    pub currency: CurrencyCode,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateAccount {
    pub name: String,
    pub account_type: AccountType,
    pub currency: Option<CurrencyCode>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateAccount {
    pub name: Option<String>,
    pub account_type: Option<AccountType>,
    pub currency: Option<CurrencyCode>,
    pub notes: Option<String>,
}
```

**Key Features:**

- ENUMs map to PostgreSQL ENUM types with `#[sqlx(type_name)]`
- `SCREAMING_SNAKE_CASE` matches database enum values
- Field renamed from `type` to `account_type` with `#[sqlx(rename = "type")]`
- Currency is strongly typed as `CurrencyCode` enum

### Category ([`backend/src/models/category.rs`](../../../backend/src/models/category.rs))

```rust
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
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

#[derive(Debug, Deserialize)]
pub struct CreateCategory {
    pub name: String,
    pub icon: Option<String>,
    pub color: Option<String>,
    pub parent_category_id: Option<Uuid>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateCategory {
    pub name: Option<String>,
    pub icon: Option<String>,
    pub color: Option<String>,
    pub parent_category_id: Option<Uuid>,
}
```

**Key Features:**

- Supports hierarchical categories via `parent_category_id`
- Icon and color are optional for UI customization

### Person ([`backend/src/models/person.rs`](../../../backend/src/models/person.rs))

```rust
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
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

#[derive(Debug, Deserialize)]
pub struct CreatePerson {
    pub name: String,
    pub email: Option<String>,
    pub phone: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdatePerson {
    pub name: Option<String>,
    pub email: Option<String>,
    pub phone: Option<String>,
    pub notes: Option<String>,
}
```

**Key Features:**

- Used for tracking people in split transactions
- All contact information is optional

### Transaction ([`backend/src/models/transaction.rs`](../../../backend/src/models/transaction.rs))

```rust
use bigdecimal::BigDecimal;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Transaction {
    pub id: Uuid,
    pub user_id: Uuid,
    pub account_id: Uuid,
    pub category_id: Option<Uuid>,
    pub title: String,
    pub amount: BigDecimal,
    pub date: DateTime<Utc>,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateTransaction {
    pub account_id: Uuid,
    pub category_id: Option<Uuid>,
    pub title: String,
    pub amount: BigDecimal,
    pub date: DateTime<Utc>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateTransaction {
    pub account_id: Option<Uuid>,
    pub category_id: Option<Uuid>,
    pub title: Option<String>,
    pub amount: Option<BigDecimal>,
    pub date: Option<DateTime<Utc>>,
    pub notes: Option<String>,
}
```

**Key Features:**

- Uses `BigDecimal` from `bigdecimal` crate for precise decimal arithmetic
- Positive amounts = income, negative = expenses
- Category is optional

### Transaction Split ([`backend/src/models/transaction_split.rs`](../../../backend/src/models/transaction_split.rs))

```rust
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
```

**Key Features:**

- Links transactions to people for expense splitting
- Amount represents what the person owes or paid

### Budget ([`backend/src/models/budget.rs`](../../../backend/src/models/budget.rs))

```rust
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "budget_period", rename_all = "SCREAMING_SNAKE_CASE")]
pub enum BudgetPeriod {
    Daily,
    Weekly,
    Monthly,
    Quarterly,
    Yearly,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Budget {
    pub id: Uuid,
    pub user_id: Uuid,
    pub name: String,
    pub filters: JsonValue,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateBudget {
    pub name: String,
    pub filters: JsonValue,
}

#[derive(Debug, Deserialize)]
pub struct UpdateBudget {
    pub name: Option<String>,
    pub filters: Option<JsonValue>,
}
```

**Key Features:**

- `BudgetPeriod` enum maps to PostgreSQL ENUM
- Filters stored as JSONB for flexibility
- Uses `serde_json::Value` for dynamic filter structure

### Budget Range ([`backend/src/models/budget_range.rs`](../../../backend/src/models/budget_range.rs))

```rust
use bigdecimal::BigDecimal;
use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

use super::budget::BudgetPeriod;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct BudgetRange {
    pub id: Uuid,
    pub budget_id: Uuid,
    pub limit_amount: BigDecimal,
    pub period: BudgetPeriod,
    pub start_date: NaiveDate,
    pub end_date: NaiveDate,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateBudgetRange {
    pub budget_id: Uuid,
    pub limit_amount: BigDecimal,
    pub period: BudgetPeriod,
    pub start_date: NaiveDate,
    pub end_date: NaiveDate,
}

#[derive(Debug, Deserialize)]
pub struct UpdateBudgetRange {
    pub limit_amount: Option<BigDecimal>,
    pub period: Option<BudgetPeriod>,
    pub start_date: Option<NaiveDate>,
    pub end_date: Option<NaiveDate>,
}
```

**Key Features:**

- Uses `NaiveDate` for date-only fields (no time component)
- Imports `BudgetPeriod` from parent budget module
- Represents specific time ranges for budget limits

## Decimal Handling

All monetary values use `BigDecimal` from the `bigdecimal` crate for precise decimal arithmetic:

```rust
use bigdecimal::BigDecimal;

// BigDecimal prevents floating-point errors
// Stored as DECIMAL(19, 2) in PostgreSQL
// Format to 2 decimal places when displaying in UI
```

**Benefits:**

- No floating-point rounding errors
- Exact decimal representation
- Compatible with PostgreSQL DECIMAL type
- Safe for financial calculations

## Common Patterns

### DTO Pattern

All models follow a consistent DTO (Data Transfer Object) pattern:

- Main struct: Database representation with all fields
- `Create*`: Input for creating new records (no ID, timestamps)
- `Update*`: Input for updating records (all fields optional)

### SQLx Integration

- `#[derive(FromRow)]`: Automatic mapping from database rows
- `#[sqlx(type_name)]`: Maps Rust enums to PostgreSQL ENUMs
- `#[sqlx(rename)]`: Handles SQL reserved keywords
- `#[serde(skip_serializing)]`: Excludes sensitive fields from API responses

### Type Safety

- UUIDs for all IDs
- Strongly-typed enums for constrained values
- `Option<T>` for nullable database fields
- `DateTime<Utc>` for timestamps with timezone
- `NaiveDate` for date-only fields
