# Diesel Usage Guide

## Overview

This guide provides comprehensive information on using Diesel ORM in the Master of Coin project. Diesel is a safe, extensible ORM and query builder for Rust that provides compile-time guarantees and excellent PostgreSQL support.

**Key Benefits:**

- Compile-time query validation
- Type-safe query builder
- Zero-cost abstractions
- Excellent PostgreSQL support
- Automatic schema generation

---

## Table of Contents

1. [Setup and Configuration](#setup-and-configuration)
2. [Schema Management](#schema-management)
3. [Basic CRUD Operations](#basic-crud-operations)
4. [Query Patterns](#query-patterns)
5. [Async Integration](#async-integration)
6. [Custom Types](#custom-types)
7. [Relationships and Joins](#relationships-and-joins)
8. [Transactions](#transactions)
9. [Common Patterns](#common-patterns)
10. [Troubleshooting](#troubleshooting)
11. [Best Practices](#best-practices)

---

## Setup and Configuration

### Installation

```toml
# Cargo.toml
[dependencies]
diesel = { version = "2.1", features = ["postgres", "uuid", "chrono", "numeric", "r2d2"] }
diesel_migrations = "2.1"
diesel-derive-enum = { version = "2.1", features = ["postgres"] }
```

### Diesel CLI

```bash
# Install Diesel CLI
cargo install diesel_cli --no-default-features --features postgres

# Initialize Diesel
diesel setup

# Verify installation
diesel --version
```

### Configuration File

`diesel.toml`:

```toml
[print_schema]
file = "src/schema.rs"
custom_type_derives = ["diesel::query_builder::QueryId"]

[migrations_directory]
dir = "migrations"
```

---

## Schema Management

### Creating Migrations

```bash
# Create a new migration
diesel migration generate create_users_table

# This creates:
# migrations/YYYY-MM-DD-HHMMSS_create_users_table/
#   ├── up.sql
#   └── down.sql
```

### Migration Files

**up.sql** (forward migration):

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_email ON users(email);
```

**down.sql** (rollback migration):

```sql
DROP TABLE IF EXISTS users CASCADE;
```

### Running Migrations

```bash
# Run all pending migrations
diesel migration run

# Revert last migration
diesel migration revert

# Redo last migration (revert then run)
diesel migration redo

# List migration status
diesel migration list

# Generate schema.rs from database
diesel print-schema > src/schema.rs
```

### Generated Schema

Diesel automatically generates `src/schema.rs`:

```rust
// src/schema.rs (auto-generated)
diesel::table! {
    users (id) {
        id -> Uuid,
        username -> Varchar,
        email -> Varchar,
        password_hash -> Varchar,
        name -> Varchar,
        created_at -> Timestamptz,
        updated_at -> Timestamptz,
    }
}

diesel::table! {
    accounts (id) {
        id -> Uuid,
        user_id -> Uuid,
        name -> Varchar,
        account_type -> Varchar,
        currency -> Varchar,
        notes -> Nullable<Text>,
        created_at -> Timestamptz,
        updated_at -> Timestamptz,
    }
}

diesel::joinable!(accounts -> users (user_id));
diesel::allow_tables_to_appear_in_same_query!(users, accounts);
```

---

## Basic CRUD Operations

### Model Definitions

```rust
use diesel::prelude::*;
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use chrono::{DateTime, Utc};
use crate::schema::users;

// Query model (for reading from database)
#[derive(Debug, Clone, Queryable, Identifiable, Serialize, Deserialize)]
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

// Insert model (for creating new records)
#[derive(Debug, Insertable)]
#[diesel(table_name = users)]
pub struct NewUser {
    pub username: String,
    pub email: String,
    pub password_hash: String,
    pub name: String,
}

// Update model (for updating existing records)
#[derive(Debug, AsChangeset)]
#[diesel(table_name = users)]
pub struct UpdateUser {
    pub name: Option<String>,
    pub email: Option<String>,
}
```

### Create (Insert)

```rust
use diesel::prelude::*;
use crate::schema::users;

pub fn create_user(conn: &mut PgConnection, new_user: NewUser) -> QueryResult<User> {
    diesel::insert_into(users::table)
        .values(&new_user)
        .get_result(conn)
}

// Insert multiple records
pub fn create_users(conn: &mut PgConnection, new_users: Vec<NewUser>) -> QueryResult<Vec<User>> {
    diesel::insert_into(users::table)
        .values(&new_users)
        .get_results(conn)
}
```

### Read (Select)

```rust
use crate::schema::users::dsl::*;

// Find by ID
pub fn find_user(conn: &mut PgConnection, user_id: Uuid) -> QueryResult<User> {
    users.find(user_id).first(conn)
}

// Find by username
pub fn find_by_username(conn: &mut PgConnection, target_username: &str) -> QueryResult<User> {
    users
        .filter(username.eq(target_username))
        .first(conn)
}

// List all users
pub fn list_users(conn: &mut PgConnection) -> QueryResult<Vec<User>> {
    users.load(conn)
}

// List with limit and offset
pub fn list_users_paginated(
    conn: &mut PgConnection,
    limit_val: i64,
    offset_val: i64,
) -> QueryResult<Vec<User>> {
    users
        .limit(limit_val)
        .offset(offset_val)
        .load(conn)
}
```

### Update

```rust
// Update specific user
pub fn update_user(
    conn: &mut PgConnection,
    user_id: Uuid,
    changes: UpdateUser,
) -> QueryResult<User> {
    diesel::update(users.find(user_id))
        .set(&changes)
        .get_result(conn)
}

// Update with filter
pub fn update_user_email(
    conn: &mut PgConnection,
    user_id: Uuid,
    new_email: &str,
) -> QueryResult<usize> {
    diesel::update(users.find(user_id))
        .set(email.eq(new_email))
        .execute(conn)
}
```

### Delete

```rust
// Delete by ID
pub fn delete_user(conn: &mut PgConnection, user_id: Uuid) -> QueryResult<usize> {
    diesel::delete(users.find(user_id)).execute(conn)
}

// Delete with filter
pub fn delete_inactive_users(conn: &mut PgConnection) -> QueryResult<usize> {
    diesel::delete(users.filter(last_login.lt(some_date)))
        .execute(conn)
}
```

---

## Query Patterns

### Filtering

```rust
use crate::schema::transactions::dsl::*;

// Single filter
let results = transactions
    .filter(user_id.eq(target_user_id))
    .load::<Transaction>(conn)?;

// Multiple filters (AND)
let results = transactions
    .filter(user_id.eq(target_user_id))
    .filter(amount.gt(100.0))
    .filter(date.ge(start_date))
    .load::<Transaction>(conn)?;

// OR conditions
use diesel::dsl::*;
let results = transactions
    .filter(
        category_id.eq(cat1)
            .or(category_id.eq(cat2))
    )
    .load::<Transaction>(conn)?;

// IN clause
let category_ids = vec![cat1, cat2, cat3];
let results = transactions
    .filter(category_id.eq_any(category_ids))
    .load::<Transaction>(conn)?;

// LIKE pattern
let results = transactions
    .filter(title.like("%grocery%"))
    .load::<Transaction>(conn)?;

// IS NULL / IS NOT NULL
let results = transactions
    .filter(category_id.is_null())
    .load::<Transaction>(conn)?;
```

### Ordering

```rust
// Single order
let results = transactions
    .order(date.desc())
    .load::<Transaction>(conn)?;

// Multiple orders
let results = transactions
    .order((date.desc(), created_at.desc()))
    .load::<Transaction>(conn)?;

// Conditional ordering
let results = if sort_by_date {
    transactions.order(date.desc())
} else {
    transactions.order(amount.desc())
}.load::<Transaction>(conn)?;
```

### Aggregations

```rust
use diesel::dsl::*;

// Count
let count: i64 = transactions
    .filter(user_id.eq(target_user_id))
    .count()
    .get_result(conn)?;

// Sum
let total: Option<BigDecimal> = transactions
    .filter(user_id.eq(target_user_id))
    .select(sum(amount))
    .first(conn)?;

// Average
let avg: Option<BigDecimal> = transactions
    .select(avg(amount))
    .first(conn)?;

// Min/Max
let max_amount: Option<BigDecimal> = transactions
    .select(max(amount))
    .first(conn)?;

// Group by
let results: Vec<(Uuid, i64)> = transactions
    .group_by(category_id)
    .select((category_id, count(id)))
    .load(conn)?;
```

### Subqueries

```rust
// Subquery in WHERE clause
let subquery = accounts::table
    .filter(accounts::user_id.eq(target_user_id))
    .select(accounts::id);

let results = transactions::table
    .filter(transactions::account_id.eq_any(subquery))
    .load::<Transaction>(conn)?;
```

---

## Async Integration

Diesel is synchronous, so we use `tokio::task::spawn_blocking` for async contexts:

### Basic Pattern

```rust
use tokio::task;
use diesel::r2d2::{self, ConnectionManager, Pool};
use diesel::PgConnection;

pub type DbPool = Pool<ConnectionManager<PgConnection>>;

// Async wrapper for Diesel query
pub async fn get_user(pool: &DbPool, user_id: Uuid) -> Result<User, Error> {
    let pool = pool.clone();
    task::spawn_blocking(move || {
        let mut conn = pool.get()?;
        users::table.find(user_id).first(&mut conn)
    })
    .await
    .map_err(|e| Error::Internal(e.to_string()))?
}
```

### Repository Pattern

```rust
pub struct UserRepository {
    pool: DbPool,
}

impl UserRepository {
    pub fn new(pool: DbPool) -> Self {
        Self { pool }
    }

    pub async fn create(&self, new_user: NewUser) -> Result<User, Error> {
        let pool = self.pool.clone();
        task::spawn_blocking(move || {
            let mut conn = pool.get()?;
            diesel::insert_into(users::table)
                .values(&new_user)
                .get_result(&mut conn)
        })
        .await?
    }

    pub async fn find_by_id(&self, user_id: Uuid) -> Result<User, Error> {
        let pool = self.pool.clone();
        task::spawn_blocking(move || {
            let mut conn = pool.get()?;
            users::table.find(user_id).first(&mut conn)
        })
        .await?
    }

    pub async fn list(&self, limit: i64, offset: i64) -> Result<Vec<User>, Error> {
        let pool = self.pool.clone();
        task::spawn_blocking(move || {
            let mut conn = pool.get()?;
            users::table
                .limit(limit)
                .offset(offset)
                .load(&mut conn)
        })
        .await?
    }
}
```

### Axum Handler Example

```rust
use axum::{
    extract::{State, Path},
    Json,
};

pub async fn get_user_handler(
    State(pool): State<DbPool>,
    Path(user_id): Path<Uuid>,
) -> Result<Json<User>, ApiError> {
    let user = get_user(&pool, user_id).await?;
    Ok(Json(user))
}
```

---

## Custom Types

### PostgreSQL ENUM Types

```rust
use diesel::deserialize::{self, FromSql};
use diesel::pg::Pg;
use diesel::serialize::{self, ToSql, Output};
use diesel::sql_types::Text;
use std::io::Write;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, AsExpression, FromSqlRow)]
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

### Using diesel-derive-enum (Simpler)

```rust
use diesel_derive_enum::DbEnum;

#[derive(Debug, Clone, Copy, DbEnum, Serialize, Deserialize)]
#[ExistingTypePath = "crate::schema::sql_types::AccountType"]
pub enum AccountType {
    Checking,
    Savings,
    CreditCard,
    Investment,
    Cash,
}
```

---

## Relationships and Joins

### One-to-Many

```rust
// Get user with their accounts
let results: Vec<(User, Account)> = users::table
    .inner_join(accounts::table)
    .filter(users::id.eq(user_id))
    .load::<(User, Account)>(conn)?;

// Left join (includes users without accounts)
let results: Vec<(User, Option<Account>)> = users::table
    .left_join(accounts::table)
    .load::<(User, Option<Account>)>(conn)?;
```

### Complex Joins

```rust
// Transaction with account and category
let results = transactions::table
    .inner_join(accounts::table)
    .left_join(categories::table)
    .filter(transactions::user_id.eq(user_id))
    .select((
        transactions::all_columns,
        accounts::name,
        categories::name.nullable(),
    ))
    .load::<(Transaction, String, Option<String>)>(conn)?;
```

### Associations (Using Diesel's Associations)

```rust
#[derive(Queryable, Identifiable, Associations)]
#[diesel(belongs_to(User))]
#[diesel(table_name = accounts)]
pub struct Account {
    pub id: Uuid,
    pub user_id: Uuid,
    pub name: String,
    // ... other fields
}

// Load associated records
let user = users::table.find(user_id).first::<User>(conn)?;
let user_accounts = Account::belonging_to(&user)
    .load::<Account>(conn)?;
```

---

## Transactions

### Basic Transaction

```rust
use diesel::Connection;

pub fn transfer_funds(
    conn: &mut PgConnection,
    from_account: Uuid,
    to_account: Uuid,
    amount: BigDecimal,
) -> QueryResult<()> {
    conn.transaction(|conn| {
        // Debit from account
        diesel::insert_into(transactions::table)
            .values(&NewTransaction {
                account_id: from_account,
                amount: -amount.clone(),
                // ... other fields
            })
            .execute(conn)?;

        // Credit to account
        diesel::insert_into(transactions::table)
            .values(&NewTransaction {
                account_id: to_account,
                amount: amount,
                // ... other fields
            })
            .execute(conn)?;

        Ok(())
    })
}
```

### Async Transaction

```rust
pub async fn transfer_funds_async(
    pool: &DbPool,
    from_account: Uuid,
    to_account: Uuid,
    amount: BigDecimal,
) -> Result<(), Error> {
    let pool = pool.clone();
    task::spawn_blocking(move || {
        let mut conn = pool.get()?;
        conn.transaction(|conn| {
            // Transaction logic here
            Ok(())
        })
    })
    .await?
}
```

---

## Common Patterns

### Pagination

```rust
pub struct PaginationParams {
    pub page: i64,
    pub per_page: i64,
}

impl PaginationParams {
    pub fn offset(&self) -> i64 {
        (self.page - 1) * self.per_page
    }
}

pub async fn list_paginated(
    pool: &DbPool,
    params: PaginationParams,
) -> Result<Vec<Transaction>, Error> {
    let pool = pool.clone();
    task::spawn_blocking(move || {
        let mut conn = pool.get()?;
        transactions::table
            .limit(params.per_page)
            .offset(params.offset())
            .load(&mut conn)
    })
    .await?
}
```

### Dynamic Queries

```rust
use diesel::query_dsl::methods::BoxedDsl;

pub fn build_transaction_query(
    filters: TransactionFilters,
) -> BoxedSelectStatement<transactions::table> {
    let mut query = transactions::table.into_boxed();

    if let Some(user_id) = filters.user_id {
        query = query.filter(transactions::user_id.eq(user_id));
    }

    if let Some(start_date) = filters.start_date {
        query = query.filter(transactions::date.ge(start_date));
    }

    if let Some(end_date) = filters.end_date {
        query = query.filter(transactions::date.le(end_date));
    }

    if let Some(category_id) = filters.category_id {
        query = query.filter(transactions::category_id.eq(category_id));
    }

    query
}
```

### Upsert (Insert or Update)

```rust
use diesel::pg::upsert::*;

pub fn upsert_user(conn: &mut PgConnection, user: NewUser) -> QueryResult<User> {
    diesel::insert_into(users::table)
        .values(&user)
        .on_conflict(users::email)
        .do_update()
        .set(&user)
        .get_result(conn)
}
```

---

## Troubleshooting

### Common Errors

**Error: "the trait bound `models::User: Queryable<_, _>` is not satisfied"**

- Solution: Ensure field order in struct matches database column order
- Or use `#[diesel(table_name = users)]` attribute

**Error: "no field `column_name` on type `users::table`"**

- Solution: Regenerate schema with `diesel print-schema > src/schema.rs`

**Error: "cannot borrow `*conn` as mutable more than once"**

- Solution: Use separate connections or restructure queries

**Error: "the trait `diesel::Expression` is not implemented"**

- Solution: Import `diesel::prelude::*` or specific expression traits

### Debugging Queries

```rust
// Print generated SQL
let query = users::table.filter(username.eq("test"));
println!("{}", diesel::debug_query::<diesel::pg::Pg, _>(&query));

// Enable query logging
use diesel::connection::SimpleConnection;
conn.batch_execute("SET client_min_messages TO 'debug'")?;
```

---

## Best Practices

### 1. Always Use spawn_blocking for Async

```rust
// ✅ Correct
pub async fn get_user(pool: &DbPool, id: Uuid) -> Result<User, Error> {
    let pool = pool.clone();
    task::spawn_blocking(move || {
        let mut conn = pool.get()?;
        users::table.find(id).first(&mut conn)
    })
    .await?
}

// ❌ Wrong - blocks async runtime
pub async fn get_user(pool: &DbPool, id: Uuid) -> Result<User, Error> {
    let mut conn = pool.get()?;
    users::table.find(id).first(&mut conn)
}
```

### 2. Use Query Builder Over Raw SQL

```rust
// ✅ Preferred - type-safe
let users = users::table
    .filter(email.eq(target_email))
    .first::<User>(conn)?;

// ❌ Avoid - no compile-time checking
let users = diesel::sql_query("SELECT * FROM users WHERE email = $1")
    .bind::<Text, _>(target_email)
    .load::<User>(conn)?;
```

### 3. Keep Transactions Short

```rust
// ✅ Good - minimal transaction scope
conn.transaction(|conn| {
    let user = create_user(conn, new_user)?;
    create_default_categories(conn, user.id)?;
    Ok(user)
})?;

// ❌ Bad - includes non-database work
conn.transaction(|conn| {
    let user = create_user(conn, new_user)?;
    send_welcome_email(&user)?; // Don't do this in transaction
    Ok(user)
})?;
```

### 4. Use Proper Error Handling

```rust
// ✅ Good - specific error handling
match diesel::insert_into(users::table)
    .values(&new_user)
    .execute(conn)
{
    Ok(_) => Ok(()),
    Err(diesel::result::Error::DatabaseError(
        diesel::result::DatabaseErrorKind::UniqueViolation,
        _,
    )) => Err(ApiError::Conflict("User already exists")),
    Err(e) => Err(ApiError::Database(e)),
}
```

### 5. Regenerate Schema After Migrations

```bash
# Always run after migrations
diesel migration run
diesel print-schema > src/schema.rs
```

### 6. Use Connection Pooling

```rust
// ✅ Good - use pool
let pool = create_pool(&database_url, 5)?;

// ❌ Bad - new connection each time
let conn = PgConnection::establish(&database_url)?;
```

---

## Resources

- [Diesel Official Documentation](https://diesel.rs/)
- [Diesel Getting Started Guide](https://diesel.rs/guides/getting-started)
- [Diesel Query Builder Guide](https://diesel.rs/guides/all-about-queries.html)
- [Diesel Associations Guide](https://diesel.rs/guides/associations.html)
- [Diesel Custom Types Guide](https://diesel.rs/guides/custom-types.html)
- [Diesel GitHub Repository](https://github.com/diesel-rs/diesel)

---

## Summary

Diesel provides a powerful, type-safe way to interact with PostgreSQL databases in Rust. Key takeaways:

1. **Use the query builder** for type safety and compile-time guarantees
2. **Always use spawn_blocking** when integrating with async code
3. **Regenerate schema.rs** after every migration
4. **Keep transactions short** and focused on database operations
5. **Leverage Diesel's type system** to catch errors at compile time

For project-specific patterns and examples, refer to the repository implementations in `src/repositories/`.
