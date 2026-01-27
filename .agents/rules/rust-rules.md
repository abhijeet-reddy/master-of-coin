# Rust Development Rules

## Code Organization Principles

### 1. Module Structure and Separation of Concerns

- **Keep modules focused**: Each module should have a single, clear responsibility.
- **Use `mod.rs` for public API**: Re-export types and functions that should be public from the module.
- **Separate business logic from infrastructure**: Keep domain logic independent of frameworks and external dependencies.

**Example:**

```rust
// ❌ Bad: Everything in one file
// src/main.rs with 1000+ lines

// ✅ Good: Organized module structure
// src/
//   main.rs
//   lib.rs
//   models/
//     mod.rs
//     user.rs
//     transaction.rs
//   services/
//     mod.rs
//     user_service.rs
//     transaction_service.rs
//   handlers/
//     mod.rs
//     user_handlers.rs
```

### 2. Error Handling

- **Use `Result<T, E>` for recoverable errors**: Never use `unwrap()` or `expect()` in production code.
- **Create custom error types**: Use `thiserror` or similar for domain-specific errors.
- **Propagate errors with `?`**: Let errors bubble up to appropriate handling layers.
- **Handle errors at boundaries**: API handlers, main functions, etc.

**Example:**

```rust
// ❌ Bad: Using unwrap in production
fn get_user(id: i32) -> User {
    database.query(id).unwrap() // Panics on error!
}

// ✅ Good: Proper error handling
use thiserror::Error;

#[derive(Error, Debug)]
pub enum UserError {
    #[error("User not found: {0}")]
    NotFound(i32),
    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),
}

fn get_user(id: i32) -> Result<User, UserError> {
    database.query(id)
        .await?
        .ok_or(UserError::NotFound(id))
}
```

### 3. Type Safety and Newtype Pattern

- **Use newtype pattern for domain concepts**: Wrap primitive types to add type safety.
- **Leverage the type system**: Make invalid states unrepresentable.
- **Use enums for state machines**: Model state transitions explicitly.

**Example:**

```rust
// ❌ Bad: Using primitives everywhere
fn transfer_money(from: i32, to: i32, amount: f64) -> Result<()> {
    // Easy to mix up parameters
}

// ✅ Good: Strong typing with newtypes
#[derive(Debug, Clone, Copy)]
pub struct AccountId(i32);

#[derive(Debug, Clone, Copy)]
pub struct Amount(Decimal);

fn transfer_money(
    from: AccountId,
    to: AccountId,
    amount: Amount
) -> Result<()> {
    // Type system prevents mixing up parameters
}

// ✅ Good: Use enums for states
pub enum TransactionStatus {
    Pending,
    Completed { timestamp: DateTime<Utc> },
    Failed { reason: String },
}
```

### 4. Ownership and Borrowing

- **Prefer borrowing over cloning**: Use references (`&T`) when you don't need ownership.
- **Use `&str` over `String` for function parameters**: More flexible, works with both.
- **Clone only when necessary**: Cloning should be intentional and documented.
- **Use `Cow<str>` for conditional ownership**: When you might need to own or borrow.

**Example:**

```rust
// ❌ Bad: Unnecessary cloning
fn process_name(name: String) -> String {
    name.to_uppercase()
}

// ✅ Good: Borrow when possible
fn process_name(name: &str) -> String {
    name.to_uppercase()
}

// ✅ Good: Return borrowed data when possible
fn get_first_word(text: &str) -> &str {
    text.split_whitespace().next().unwrap_or("")
}
```

### 5. Async/Await Best Practices

- **Use `async/await` for I/O operations**: Database queries, HTTP requests, file operations.
- **Avoid blocking in async code**: Never use `std::thread::sleep` in async functions.
- **Use `tokio::spawn` for concurrent tasks**: When tasks can run independently.
- **Be mindful of `.await` points**: Each `.await` is a potential cancellation point.

**Example:**

```rust
// ❌ Bad: Blocking in async
async fn process_data() {
    std::thread::sleep(Duration::from_secs(1)); // Blocks the executor!
}

// ✅ Good: Async sleep
async fn process_data() {
    tokio::time::sleep(Duration::from_secs(1)).await;
}

// ✅ Good: Concurrent operations
async fn fetch_user_data(user_id: i32) -> Result<UserData> {
    let (profile, transactions, settings) = tokio::try_join!(
        fetch_profile(user_id),
        fetch_transactions(user_id),
        fetch_settings(user_id),
    )?;

    Ok(UserData { profile, transactions, settings })
}
```

## Database and Diesel Best Practices

### 6. Query Organization

- **Keep queries in service layer**: Don't put database logic in handlers.
- **Use Diesel's type-safe query builder**: Avoid raw SQL when possible.
- **Create reusable query functions**: Extract common query patterns.
- **Use transactions for multi-step operations**: Ensure data consistency.

**Example:**

```rust
// ❌ Bad: Database logic in handler
async fn create_user_handler(user: Json<NewUser>) -> Result<Json<User>> {
    let conn = pool.get()?;
    diesel::insert_into(users::table)
        .values(&user.0)
        .execute(&conn)?;
    // Handler doing too much!
}

// ✅ Good: Database logic in service
// In service layer
pub async fn create_user(
    pool: &DbPool,
    new_user: NewUser,
) -> Result<User, ServiceError> {
    let conn = pool.get()?;

    conn.transaction(|conn| {
        let user = diesel::insert_into(users::table)
            .values(&new_user)
            .get_result(conn)?;

        // Additional operations in transaction
        create_default_settings(conn, user.id)?;

        Ok(user)
    })
}

// In handler
async fn create_user_handler(
    pool: Data<DbPool>,
    user: Json<NewUser>,
) -> Result<Json<User>> {
    let user = create_user(&pool, user.0).await?;
    Ok(Json(user))
}
```

### 7. Connection Pool Management

- **Use connection pools**: Never create connections per request.
- **Configure pool size appropriately**: Based on expected load.
- **Handle pool exhaustion gracefully**: Return meaningful errors.

**Example:**

```rust
// ✅ Good: Proper pool configuration
use diesel::r2d2::{self, ConnectionManager};
use diesel::PgConnection;

pub type DbPool = r2d2::Pool<ConnectionManager<PgConnection>>;

pub fn create_pool(database_url: &str) -> Result<DbPool> {
    let manager = ConnectionManager::<PgConnection>::new(database_url);

    r2d2::Pool::builder()
        .max_size(15)
        .min_idle(Some(5))
        .connection_timeout(Duration::from_secs(30))
        .build(manager)
        .map_err(|e| anyhow!("Failed to create pool: {}", e))
}
```

## API and Handler Best Practices

### 8. Handler Structure

- **Keep handlers thin**: They should orchestrate, not implement business logic.
- **Extract validation logic**: Use dedicated validation functions or types.
- **Use extractors effectively**: Leverage framework extractors for common patterns.
- **Return appropriate HTTP status codes**: Be consistent and meaningful.

**Example:**

```rust
// ❌ Bad: Fat handler with business logic
async fn create_transaction_handler(
    pool: Data<DbPool>,
    transaction: Json<NewTransaction>,
) -> Result<Json<Transaction>> {
    // 100+ lines of validation and business logic
    // This should be in a service!
}

// ✅ Good: Thin handler
async fn create_transaction_handler(
    pool: Data<DbPool>,
    auth: AuthUser,
    transaction: Json<NewTransaction>,
) -> Result<HttpResponse> {
    // Validate
    transaction.validate()?;

    // Call service
    let result = transaction_service::create(
        &pool,
        auth.user_id,
        transaction.0,
    ).await?;

    // Return response
    Ok(HttpResponse::Created().json(result))
}
```

### 9. Authentication and Authorization

- **Use middleware for authentication**: Don't repeat auth logic in every handler.
- **Implement extractors for user context**: Make authenticated user easily accessible.
- **Separate authentication from authorization**: Check identity first, then permissions.

**Example:**

```rust
// ✅ Good: Auth extractor
pub struct AuthUser {
    pub user_id: i32,
    pub email: String,
}

impl FromRequest for AuthUser {
    type Error = AuthError;
    type Future = Ready<Result<Self, Self::Error>>;

    fn from_request(req: &HttpRequest, _: &mut Payload) -> Self::Future {
        // Extract and validate JWT token
        // Return authenticated user or error
    }
}

// Usage in handler
async fn get_profile(auth: AuthUser) -> Result<Json<Profile>> {
    // auth.user_id is automatically available
    let profile = fetch_profile(auth.user_id).await?;
    Ok(Json(profile))
}
```

## Testing Best Practices

### 10. Test Organization

- **Write unit tests for business logic**: Test pure functions thoroughly.
- **Write integration tests for APIs**: Test the full request/response cycle.
- **Use test fixtures**: Create reusable test data.
- **Mock external dependencies**: Use traits for dependency injection.

**Example:**

```rust
// ✅ Good: Testable service with trait
#[async_trait]
pub trait UserRepository {
    async fn find_by_id(&self, id: i32) -> Result<Option<User>>;
    async fn create(&self, user: NewUser) -> Result<User>;
}

pub struct UserService<R: UserRepository> {
    repo: R,
}

impl<R: UserRepository> UserService<R> {
    pub async fn get_user(&self, id: i32) -> Result<User> {
        self.repo.find_by_id(id)
            .await?
            .ok_or(UserError::NotFound(id))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    struct MockUserRepository {
        users: Vec<User>,
    }

    #[async_trait]
    impl UserRepository for MockUserRepository {
        async fn find_by_id(&self, id: i32) -> Result<Option<User>> {
            Ok(self.users.iter().find(|u| u.id == id).cloned())
        }
    }

    #[tokio::test]
    async fn test_get_user() {
        let mock_repo = MockUserRepository {
            users: vec![/* test data */],
        };
        let service = UserService { repo: mock_repo };

        let result = service.get_user(1).await;
        assert!(result.is_ok());
    }
}
```

## Performance and Optimization

### 11. Efficient Data Structures

- **Use appropriate collections**: `Vec` for sequential, `HashMap` for lookups, `BTreeMap` for sorted.
- **Pre-allocate when size is known**: Use `Vec::with_capacity()`.
- **Use iterators over loops**: More idiomatic and often more efficient.
- **Avoid unnecessary allocations**: Reuse buffers when possible.

**Example:**

```rust
// ❌ Bad: Unnecessary allocations
fn process_items(items: &[Item]) -> Vec<String> {
    let mut result = Vec::new();
    for item in items {
        result.push(item.name.clone());
    }
    result
}

// ✅ Good: Pre-allocate and use iterators
fn process_items(items: &[Item]) -> Vec<String> {
    items.iter()
        .map(|item| item.name.clone())
        .collect()
}

// ✅ Even better: Avoid cloning if possible
fn process_items(items: &[Item]) -> Vec<&str> {
    items.iter()
        .map(|item| item.name.as_str())
        .collect()
}
```

### 12. Serialization and Deserialization

- **Use `serde` derive macros**: Simplify serialization code.
- **Rename fields for API consistency**: Use `#[serde(rename = "...")]` for camelCase/snake_case.
- **Skip optional fields**: Use `#[serde(skip_serializing_if = "Option::is_none")]`.
- **Validate on deserialization**: Use `#[serde(deserialize_with = "...")]` for custom validation.

**Example:**

```rust
// ✅ Good: Well-configured serde
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Transaction {
    pub id: i32,
    pub account_id: i32,
    pub amount: Decimal,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,

    #[serde(with = "chrono::serde::ts_seconds")]
    pub created_at: DateTime<Utc>,
}
```

## Code Quality and Maintenance

### 13. Documentation

- **Document public APIs**: Use `///` for public items.
- **Include examples in docs**: Show how to use the API.
- **Document panics and errors**: Be explicit about failure modes.
- **Keep docs up to date**: Update docs when changing code.

**Example:**

````rust
/// Creates a new transaction between two accounts.
///
/// # Arguments
///
/// * `from_account` - The account to debit
/// * `to_account` - The account to credit
/// * `amount` - The amount to transfer (must be positive)
///
/// # Returns
///
/// Returns the created transaction on success.
///
/// # Errors
///
/// Returns `TransactionError::InsufficientFunds` if the source account
/// has insufficient balance.
///
/// # Example
///
/// ```
/// let transaction = create_transaction(
///     AccountId(1),
///     AccountId(2),
///     Amount::from_str("100.00")?,
/// ).await?;
/// ```
pub async fn create_transaction(
    from_account: AccountId,
    to_account: AccountId,
    amount: Amount,
) -> Result<Transaction, TransactionError> {
    // Implementation
}
````

### 14. Clippy and Formatting

- **Run `cargo clippy` regularly**: Fix all warnings.
- **Use `cargo fmt`**: Keep code consistently formatted.
- **Enable additional lints**: Add to `Cargo.toml` for stricter checks.
- **Use `#[allow(...)]` sparingly**: Only when you have a good reason.

**Example:**

```toml
# In Cargo.toml
[lints.rust]
unsafe_code = "forbid"
missing_docs = "warn"

[lints.clippy]
all = "warn"
pedantic = "warn"
nursery = "warn"
```

### 15. Dependency Management

- **Keep dependencies minimal**: Only add what you need.
- **Use specific versions**: Avoid wildcards in production.
- **Audit dependencies regularly**: Use `cargo audit`.
- **Prefer well-maintained crates**: Check last update date and issue count.

## Summary Checklist

Before committing Rust code, verify:

- [ ] No `unwrap()` or `expect()` in production code
- [ ] Proper error handling with custom error types
- [ ] Business logic separated from handlers
- [ ] Using borrowing over cloning where possible
- [ ] Async operations don't block
- [ ] Database queries in service layer
- [ ] Handlers are thin and focused
- [ ] Tests cover critical business logic
- [ ] Public APIs are documented
- [ ] `cargo clippy` passes with no warnings
- [ ] Code is formatted with `cargo fmt`

---

_These rules promote safe, efficient, and maintainable Rust code. When in doubt, favor explicitness and type safety._
