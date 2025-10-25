# SQLx to Diesel Migration Plan

**Status**: Planning Phase  
**Estimated Effort**: 4-7 hours  
**Risk Level**: Low (no production code yet)  
**Created**: 2025-10-25

## Executive Summary

This document outlines the migration plan from SQLx to Diesel ORM for the Master of Coin backend. Since no repository query code has been written yet, this is the optimal time to make this change with minimal effort.

## Current State Analysis

### SQLx Usage Inventory

1. **Dependencies** (`backend/Cargo.toml`)

   - `sqlx = { version = "0.8", features = ["runtime-tokio-rustls", "postgres", "uuid", "chrono", "bigdecimal"] }`

2. **Database Module** (`backend/src/db/mod.rs`)

   - Connection pool creation using `PgPoolOptions`
   - Migration runner using `sqlx::migrate!`

3. **Model Files** (8 files using SQLx)

   - `models/user.rs` - User model with `FromRow`
   - `models/account.rs` - Account model with `FromRow` + custom enums (AccountType, CurrencyCode)
   - `models/transaction.rs` - Transaction model with `FromRow` + TransactionType enum
   - `models/category.rs` - Category model with `FromRow` + CategoryType enum
   - `models/budget.rs` - Budget model with `FromRow` + BudgetPeriod enum
   - `models/budget_range.rs` - BudgetRange model with `FromRow`
   - `models/person.rs` - Person model with `FromRow`
   - `models/transaction_split.rs` - TransactionSplit model with `FromRow`

4. **Error Handling** (`backend/src/errors/mod.rs`)

   - `DatabaseError(sqlx::Error)` variant
   - `From<sqlx::Error>` implementation

5. **Repositories** (`backend/src/repositories/`)
   - **EMPTY** - No query code written yet ✅

### Custom Types Requiring Migration

The following custom PostgreSQL enums need Diesel implementations:

- `account_type` (CHECKING, SAVINGS, CREDIT_CARD, INVESTMENT, CASH)
- `currency_code` (USD, EUR, GBP, INR, JPY, AUD, CAD)
- `category_type` (INCOME, EXPENSE, TRANSFER)
- `budget_period` (WEEKLY, MONTHLY, QUARTERLY, YEARLY)
- `transaction_type` (INCOME, EXPENSE, TRANSFER)

## Migration Strategy

### Phase 1: Setup & Dependencies (1 hour)

#### 1.1 Install Diesel CLI

```bash
cargo install diesel_cli --no-default-features --features postgres
```

#### 1.2 Update Cargo.toml

Replace SQLx with Diesel:

```toml
# Remove
sqlx = { version = "0.8", features = [...] }

# Add
diesel = { version = "2.1", features = ["postgres", "uuid", "chrono", "numeric"] }
diesel_migrations = "2.1"
```

#### 1.3 Initialize Diesel

```bash
cd backend
diesel setup
```

This creates:

- `diesel.toml` configuration file
- `migrations/` directory (merge with existing)

### Phase 2: Migration Files (30 minutes)

#### 2.1 Convert Existing Migrations

- Review existing SQLx migrations in `backend/migrations/`
- Ensure they're compatible with Diesel's migration format
- Diesel migrations use `up.sql` and `down.sql` pairs
- May need to split existing migrations into separate up/down files

#### 2.2 Generate Schema

```bash
diesel migration run
diesel print-schema > src/schema.rs
```

This auto-generates the `schema.rs` file with table definitions.

### Phase 3: Database Connection (30 minutes)

#### 3.1 Rewrite `db/mod.rs`

Replace SQLx connection pool with Diesel:

```rust
use diesel::pg::PgConnection;
use diesel::r2d2::{self, ConnectionManager, Pool};
use diesel_migrations::{embed_migrations, EmbeddedMigrations, MigrationHarness};

pub type DbPool = Pool<ConnectionManager<PgConnection>>;

pub const MIGRATIONS: EmbeddedMigrations = embed_migrations!("migrations");

pub fn create_pool(database_url: &str, max_connections: u32) -> Result<DbPool, r2d2::Error> {
    let manager = ConnectionManager::<PgConnection>::new(database_url);
    Pool::builder()
        .max_size(max_connections)
        .build(manager)
}

pub fn run_migrations(pool: &DbPool) -> Result<(), Box<dyn std::error::Error>> {
    let mut conn = pool.get()?;
    conn.run_pending_migrations(MIGRATIONS)?;
    Ok(())
}
```

### Phase 4: Custom Type Implementations (2-3 hours)

#### 4.1 Implement Diesel Custom Types for Enums

For each enum (AccountType, CurrencyCode, etc.), implement:

```rust
use diesel::deserialize::{self, FromSql};
use diesel::pg::Pg;
use diesel::serialize::{self, ToSql, Output};
use diesel::sql_types::Text;
use std::io::Write;

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
```

Repeat for:

- `CurrencyCode`
- `CategoryType`
- `BudgetPeriod`
- `TransactionType`

### Phase 5: Model Definitions (1-2 hours)

#### 5.1 Update Model Derives

Replace `sqlx::FromRow` with Diesel derives:

**Before (SQLx):**

```rust
use sqlx::FromRow;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct User {
    pub id: Uuid,
    pub username: String,
    // ...
}
```

**After (Diesel):**

```rust
use diesel::prelude::*;
use crate::schema::users;

#[derive(Debug, Clone, Serialize, Deserialize, Queryable, Identifiable)]
#[diesel(table_name = users)]
pub struct User {
    pub id: Uuid,
    pub username: String,
    // ...
}

#[derive(Debug, Insertable)]
#[diesel(table_name = users)]
pub struct NewUser {
    pub username: String,
    pub email: String,
    pub password_hash: String,
    pub name: String,
}
```

#### 5.2 Update All 8 Model Files

Apply similar changes to:

- `models/user.rs`
- `models/account.rs`
- `models/transaction.rs`
- `models/category.rs`
- `models/budget.rs`
- `models/budget_range.rs`
- `models/person.rs`
- `models/transaction_split.rs`

Key changes:

- Add `Queryable` derive for reading from database
- Add `Insertable` derive for creating records
- Add `AsChangeset` derive for updates
- Reference schema table with `#[diesel(table_name = ...)]`
- Create separate `New*` structs for insertions

### Phase 6: Error Handling (30 minutes)

#### 6.1 Update Error Types

**In `errors/mod.rs`:**

```rust
// Replace
DatabaseError(sqlx::Error),

// With
DatabaseError(diesel::result::Error),
```

#### 6.2 Update Error Conversions

```rust
impl From<diesel::result::Error> for ApiError {
    fn from(error: diesel::result::Error) -> Self {
        match error {
            diesel::result::Error::NotFound => {
                ApiError::NotFound("Resource not found".to_string())
            }
            diesel::result::Error::DatabaseError(
                diesel::result::DatabaseErrorKind::UniqueViolation,
                _,
            ) => ApiError::Conflict("Resource already exists".to_string()),
            _ => ApiError::DatabaseError(error),
        }
    }
}
```

### Phase 7: Testing & Validation (1 hour)

#### 7.1 Compilation Check

```bash
cd backend
cargo check
```

#### 7.2 Migration Test

```bash
diesel migration run
diesel migration redo
```

#### 7.3 Update Tests

- Update any existing database tests to use Diesel
- Verify connection pool works
- Test custom type serialization/deserialization

## Rollback Plan

If issues arise during migration:

1. **Git Revert**: All changes are in version control
2. **Keep SQLx Branch**: Create a branch before starting migration
3. **Parallel Development**: Can maintain both implementations temporarily

## Post-Migration Tasks

### Immediate (Day 1)

- [ ] Update README.md with Diesel setup instructions
- [ ] Update CONTRIBUTING.md with Diesel query patterns
- [ ] Document custom type implementations

### Short-term (Week 1)

- [ ] Create repository query examples
- [ ] Add Diesel best practices guide
- [ ] Update CI/CD if needed

### Long-term (Month 1)

- [ ] Performance benchmarking vs SQLx (if needed)
- [ ] Query optimization patterns
- [ ] Advanced Diesel features (associations, joins)

## Key Differences: SQLx vs Diesel

### Query Style

**SQLx (Raw SQL):**

```rust
let user = sqlx::query_as::<_, User>(
    "SELECT * FROM users WHERE email = $1"
)
.bind(email)
.fetch_one(&pool)
.await?;
```

**Diesel (Query Builder):**

```rust
use crate::schema::users::dsl::*;

let user = users
    .filter(email.eq(email_param))
    .first::<User>(&mut conn)?;
```

### Async vs Sync

- **SQLx**: Native async/await
- **Diesel**: Synchronous (use `tokio::task::spawn_blocking` for async contexts)

### Type Safety

- **SQLx**: Compile-time SQL validation (requires database connection)
- **Diesel**: Compile-time query builder validation (no database needed)

## Decision Factors

### Choose Diesel If:

- ✅ You prefer type-safe query builders
- ✅ You want compile-time guarantees without database
- ✅ You value mature ORM features
- ✅ You're comfortable with synchronous database operations

### Stick with SQLx If:

- ✅ You prefer writing raw SQL
- ✅ You need native async/await
- ✅ You want more flexibility with dynamic queries
- ✅ You're already familiar with SQLx patterns

## Timeline

| Phase                | Duration      | Dependencies |
| -------------------- | ------------- | ------------ |
| Setup & Dependencies | 1 hour        | None         |
| Migration Files      | 30 min        | Phase 1      |
| Database Connection  | 30 min        | Phase 1      |
| Custom Types         | 2-3 hours     | Phase 2, 3   |
| Model Definitions    | 1-2 hours     | Phase 4      |
| Error Handling       | 30 min        | Phase 5      |
| Testing              | 1 hour        | All phases   |
| **Total**            | **4-7 hours** | -            |

## Resources

- [Diesel Getting Started Guide](https://diesel.rs/guides/getting-started)
- [Diesel Custom Types](https://diesel.rs/guides/custom-types)
- [Diesel Associations](https://diesel.rs/guides/associations)
- [Migration from SQLx Discussion](https://github.com/diesel-rs/diesel/discussions)

## Approval Checklist

Before proceeding with migration:

- [ ] Team agreement on ORM choice
- [ ] Development environment setup verified
- [ ] Backup of current codebase created
- [ ] Timeline approved
- [ ] Resources allocated

## Notes

- This migration is **low risk** because no repository code exists yet
- The effort is **minimal** compared to migrating after queries are written
- **Now is the optimal time** to make this decision
- All SQL migrations can be reused with minimal changes
