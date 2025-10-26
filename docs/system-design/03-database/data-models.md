# Data Models

## Overview

All data models are implemented in Rust using **Diesel ORM** for database interaction. Models are located in [`backend/src/models/`](../../../backend/src/models/).

**Migration Status**: ✅ Migration to Diesel completed. See [`docs/database/sqlx-to-diesel-migration-plan.md`](../../database/sqlx-to-diesel-migration-plan.md) for completion details.

## Core Models

### User ([`backend/src/models/user.rs`](../../../backend/src/models/user.rs))

```rust
use chrono::{DateTime, Utc};
use diesel::prelude::*;
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use crate::schema::users;

#[derive(Debug, Clone, Serialize, Deserialize, Queryable, Identifiable)]
#[diesel(table_name = users)]
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

#[derive(Debug, Insertable)]
#[diesel(table_name = users)]
pub struct NewUser {
    pub username: String,
    pub email: String,
    pub password_hash: String,
    pub name: String,
}

#[derive(Debug, AsChangeset)]
#[diesel(table_name = users)]
pub struct UpdateUser {
    pub username: Option<String>,
    pub email: Option<String>,
    pub name: Option<String>,
}
```

**Key Features:**

- `Queryable` derive for reading from database
- `Insertable` derive for creating new records
- `AsChangeset` derive for updates
- Password hash is excluded from serialization with `#[serde(skip_serializing)]`
- Separate structs for query, insert, and update operations

### Account ([`backend/src/models/account.rs`](../../../backend/src/models/account.rs))

```rust
use chrono::{DateTime, Utc};
use diesel::prelude::*;
use diesel::deserialize::{self, FromSql};
use diesel::serialize::{self, ToSql, Output};
use diesel::pg::Pg;
use diesel::sql_types::Text;
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use crate::schema::accounts;

// Custom Diesel type implementation for AccountType
#[derive(Debug, Clone, Serialize, Deserialize, AsExpression, FromSqlRow)]
#[diesel(sql_type = Text)]
pub enum AccountType {
    Checking,
    Savings,
    CreditCard,
    Investment,
    Cash,
}

impl ToSql<Text, Pg> for AccountType {
    fn to_sql<'b>(&'b self, out: &mut Output<'b, '_, Pg>) -> serialize::Result {
        let value = match self {
            AccountType::Checking => "CHECKING",
            AccountType::Savings => "SAVINGS",
            AccountType::CreditCard => "CREDIT_CARD",
            AccountType::Investment => "INVESTMENT",
            AccountType::Cash => "CASH",
        };
        out.write_all(value.as_bytes())?;
        Ok(serialize::IsNull::No)
    }
}

impl FromSql<Text, Pg> for AccountType {
    fn from_sql(bytes: diesel::pg::PgValue) -> deserialize::Result<Self> {
        match bytes.as_bytes() {
            b"CHECKING" => Ok(AccountType::Checking),
            b"SAVINGS" => Ok(AccountType::Savings),
            b"CREDIT_CARD" => Ok(AccountType::CreditCard),
            b"INVESTMENT" => Ok(AccountType::Investment),
            b"CASH" => Ok(AccountType::Cash),
            _ => Err("Unrecognized enum variant".into()),
        }
    }
}

// Similar implementation for CurrencyCode...

#[derive(Debug, Clone, Serialize, Deserialize, Queryable, Identifiable)]
#[diesel(table_name = accounts)]
pub struct Account {
    pub id: Uuid,
    pub user_id: Uuid,
    pub name: String,
    pub account_type: AccountType,
    pub currency: CurrencyCode,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Insertable)]
#[diesel(table_name = accounts)]
pub struct NewAccount {
    pub user_id: Uuid,
    pub name: String,
    pub account_type: AccountType,
    pub currency: CurrencyCode,
    pub notes: Option<String>,
}
```

**Key Features:**

- Custom Diesel type implementations for PostgreSQL ENUMs
- `ToSql` and `FromSql` traits for enum serialization
- `SCREAMING_SNAKE_CASE` matches database enum values
- `Queryable` for reading, `Insertable` for creating
- Currency is strongly typed as `CurrencyCode` enum

### Category ([`backend/src/models/category.rs`](../../../backend/src/models/category.rs))

```rust
use chrono::{DateTime, Utc};
use diesel::prelude::*;
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use crate::schema::categories;

#[derive(Debug, Clone, Serialize, Deserialize, Queryable, Identifiable)]
#[diesel(table_name = categories)]
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

#[derive(Debug, Insertable)]
#[diesel(table_name = categories)]
pub struct NewCategory {
    pub user_id: Uuid,
    pub name: String,
    pub icon: Option<String>,
    pub color: Option<String>,
    pub parent_category_id: Option<Uuid>,
}

#[derive(Debug, AsChangeset)]
#[diesel(table_name = categories)]
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
use diesel::prelude::*;
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use crate::schema::people;

#[derive(Debug, Clone, Serialize, Deserialize, Queryable, Identifiable)]
#[diesel(table_name = people)]
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

#[derive(Debug, Insertable)]
#[diesel(table_name = people)]
pub struct NewPerson {
    pub user_id: Uuid,
    pub name: String,
    pub email: Option<String>,
    pub phone: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, AsChangeset)]
#[diesel(table_name = people)]
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
use diesel::prelude::*;
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use crate::schema::transactions;

#[derive(Debug, Clone, Serialize, Deserialize, Queryable, Identifiable)]
#[diesel(table_name = transactions)]
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

#[derive(Debug, Insertable)]
#[diesel(table_name = transactions)]
pub struct NewTransaction {
    pub user_id: Uuid,
    pub account_id: Uuid,
    pub category_id: Option<Uuid>,
    pub title: String,
    pub amount: BigDecimal,
    pub date: DateTime<Utc>,
    pub notes: Option<String>,
}

#[derive(Debug, AsChangeset)]
#[diesel(table_name = transactions)]
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
use diesel::prelude::*;
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use crate::schema::transaction_splits;

#[derive(Debug, Clone, Serialize, Deserialize, Queryable, Identifiable)]
#[diesel(table_name = transaction_splits)]
pub struct TransactionSplit {
    pub id: Uuid,
    pub transaction_id: Uuid,
    pub person_id: Uuid,
    pub amount: BigDecimal,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Insertable)]
#[diesel(table_name = transaction_splits)]
pub struct NewTransactionSplit {
    pub transaction_id: Uuid,
    pub person_id: Uuid,
    pub amount: BigDecimal,
}

#[derive(Debug, AsChangeset)]
#[diesel(table_name = transaction_splits)]
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
use diesel::prelude::*;
use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;
use uuid::Uuid;
use crate::schema::budgets;
use crate::types::budget_period::BudgetPeriod;

#[derive(Debug, Clone, Serialize, Deserialize, Queryable, Identifiable)]
#[diesel(table_name = budgets)]
pub struct Budget {
    pub id: Uuid,
    pub user_id: Uuid,
    pub name: String,
    pub filters: JsonValue,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Insertable)]
#[diesel(table_name = budgets)]
pub struct NewBudget {
    pub user_id: Uuid,
    pub name: String,
    pub filters: JsonValue,
}

#[derive(Debug, AsChangeset)]
#[diesel(table_name = budgets)]
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
use diesel::prelude::*;
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use crate::schema::budget_ranges;
use crate::types::budget_period::BudgetPeriod;

#[derive(Debug, Clone, Serialize, Deserialize, Queryable, Identifiable)]
#[diesel(table_name = budget_ranges)]
pub struct BudgetRange {
    pub id: Uuid,
    pub budget_id: Uuid,
    pub limit_amount: BigDecimal,
    pub period: BudgetPeriod,
    pub start_date: NaiveDate,
    pub end_date: NaiveDate,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Insertable)]
#[diesel(table_name = budget_ranges)]
pub struct NewBudgetRange {
    pub budget_id: Uuid,
    pub limit_amount: BigDecimal,
    pub period: BudgetPeriod,
    pub start_date: NaiveDate,
    pub end_date: NaiveDate,
}

#[derive(Debug, AsChangeset)]
#[diesel(table_name = budget_ranges)]
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

### Diesel Integration

All models use Diesel derives for database interaction:

- `#[derive(Queryable)]`: Automatic mapping from database rows to structs
- `#[derive(Insertable)]`: For creating new records with `NewModel` structs
- `#[derive(AsChangeset)]`: For updating existing records with `UpdateModel` structs
- `#[diesel(table_name = ...)]`: Links struct to database table in `schema.rs`
- Custom `ToSql`/`FromSql` implementations: Maps Rust enums to PostgreSQL ENUMs
- `#[serde(skip_serializing)]`: Excludes sensitive fields from API responses

**Compile-Time Safety:**
Diesel validates all queries at compile time against the generated `schema.rs`, catching type mismatches and invalid column references before runtime.

### Type Safety

- UUIDs for all IDs
- Strongly-typed enums for constrained values
- `Option<T>` for nullable database fields
- `DateTime<Utc>` for timestamps with timezone
- `NaiveDate` for date-only fields
