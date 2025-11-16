# Integration Tests Documentation

## Overview

The integration tests for Master of Coin backend validate the complete application stack, including API endpoints, authentication, authorization, database operations, and business logic. These tests ensure that all components work together correctly in a realistic environment.

### What These Tests Cover

- **API Endpoints**: All REST API endpoints for accounts, transactions, categories, people, budgets, and dashboard
- **Authentication & Authorization**: JWT token generation, validation, and user isolation
- **Database Operations**: CRUD operations, relationships, custom types, and transactions
- **Data Validation**: Input validation, error handling, and edge cases
- **Business Logic**: Service layer operations, calculations, and data transformations

### Test Organization

```
backend/tests/integration/
├── api/                    # API endpoint tests
│   ├── test_auth.rs       # Authentication (register, login, token validation)
│   ├── test_accounts.rs   # Account management
│   ├── test_transactions.rs # Transaction operations
│   ├── test_categories.rs # Category management
│   ├── test_people.rs     # People/contact management
│   ├── test_budgets.rs    # Budget creation and tracking
│   └── test_dashboard.rs  # Dashboard analytics
├── database/              # Database-level tests
│   ├── test_connection.rs # Connection pool and setup
│   ├── test_user_crud.rs  # User CRUD operations
│   ├── test_relationships.rs # Foreign key relationships
│   ├── test_custom_types.rs # Custom enum types
│   ├── test_transactions.rs # Database transactions
│   └── test_async_bridge.rs # Async/sync bridge pattern
├── common/                # Shared test utilities
│   ├── test_server.rs     # Test server setup
│   ├── auth_helpers.rs    # Authentication utilities
│   ├── request_helpers.rs # HTTP request builders
│   └── factories.rs       # Test data factories
└── mod.rs                 # Test module root
```

## Test Structure

### Database Tests (`database/`)

Database-level tests validate the Diesel ORM integration and core database functionality:

- **`test_connection.rs`**: Database connection pool setup and configuration
- **`test_user_crud.rs`**: Basic CRUD operations for users
- **`test_relationships.rs`**: Foreign key constraints and cascading deletes
- **`test_custom_types.rs`**: Custom PostgreSQL types (AccountType, CurrencyCode, BudgetPeriod)
- **`test_transactions.rs`**: Database transaction commit and rollback
- **`test_async_bridge.rs`**: Async/sync bridge pattern with `tokio::spawn_blocking`

### API Tests (`api/`)

API tests validate HTTP endpoints, request/response handling, and business logic:

- **`test_auth.rs`**: User registration, login, token validation, and authentication flows
- **`test_accounts.rs`**: Account CRUD, user isolation, and account type validation
- **`test_transactions.rs`**: Transaction creation, updates, splits, and filtering
- **`test_categories.rs`**: Category management, hierarchies, and validation
- **`test_people.rs`**: Contact management, debt tracking, and relationships
- **`test_budgets.rs`**: Budget creation, ranges, tracking, and analytics
- **`test_dashboard.rs`**: Dashboard data aggregation and analytics

### Common Utilities (`common/`)

Shared utilities provide consistent test infrastructure:

#### `test_server.rs` - Test Server Setup

Provides functions to create and manage test server instances:

```rust
use integration::common::test_server::create_test_server;

#[tokio::test]
async fn test_example() {
    let server = create_test_server().await;
    let response = server.get("/api/v1/accounts").await;
    // ... assertions
}
```

**Key Functions:**

- `create_test_server()`: Creates a new test server with fresh database pool
- `get_base_url(&server)`: Gets the base URL for the test server

#### `auth_helpers.rs` - Authentication Utilities

Provides JWT token generation and user management:

```rust
use integration::common::auth_helpers::{
    register_test_user,
    login_test_user,
    bearer_token
};

#[tokio::test]
async fn test_authenticated_request() {
    let server = create_test_server().await;

    // Register a test user
    let auth = register_test_user(
        &server,
        "testuser",
        "test@example.com",
        "password123",
        "Test User"
    ).await;

    // Use the token for authenticated requests
    let token = &auth.token;
    // ... make authenticated requests
}
```

**Key Functions:**

- `register_test_user()`: Register a new user via API
- `login_test_user()`: Login and get JWT token
- `register_unique_test_user()`: Register with unique suffix
- `generate_test_token()`: Generate JWT for existing user
- `bearer_token()`: Format authorization header
- `create_test_account()`: Create test account via API
- `create_test_category()`: Create test category via API
- `create_test_person()`: Create test person via API

#### `request_helpers.rs` - HTTP Request Builders

Provides convenient wrappers for HTTP requests:

```rust
use integration::common::request_helpers::{
    get_authenticated,
    post_authenticated,
    put_authenticated,
    delete_authenticated,
    assert_status,
    extract_json
};

#[tokio::test]
async fn test_api_operations() {
    let server = create_test_server().await;
    let token = "valid_jwt_token";

    // GET request
    let response = get_authenticated(&server, "/api/v1/accounts", token).await;
    assert_status(&response, 200);

    // POST request
    let body = json!({"name": "New Account"});
    let response = post_authenticated(&server, "/api/v1/accounts", token, &body).await;
    assert_status(&response, 201);

    // Extract JSON response
    let account: AccountResponse = extract_json(response);
}
```

**Key Functions:**

- `get_authenticated()`: Authenticated GET request
- `post_authenticated()`: Authenticated POST with JSON body
- `put_authenticated()`: Authenticated PUT with JSON body
- `delete_authenticated()`: Authenticated DELETE request
- `get_unauthenticated()`: Unauthenticated GET request
- `post_unauthenticated()`: Unauthenticated POST request
- `extract_json()`: Deserialize JSON response
- `assert_status()`: Assert specific status code
- `assert_success()`: Assert 2xx status
- `assert_error()`: Assert 4xx/5xx status

#### `factories.rs` - Test Data Factories

Provides builder pattern factories for creating test data:

```rust
use integration::common::factories::{
    UserFactory,
    AccountFactory,
    CategoryFactory,
    PersonFactory,
    TransactionFactory,
    create_test_scenario
};

#[tokio::test]
async fn test_with_factories() {
    let pool = /* get test pool */;
    let mut conn = pool.get().unwrap();

    // Create a user
    let user = UserFactory::new()
        .username("testuser")
        .email("test@example.com")
        .name("Test User")
        .build(&mut conn);

    // Create an account for the user
    let account = AccountFactory::new(user.id)
        .name("Checking Account")
        .account_type(AccountType::Checking)
        .currency(CurrencyCode::Usd)
        .build(&mut conn);

    // Create a complete test scenario
    let (user, checking, savings, expense_cat, income_cat) =
        create_test_scenario(&mut conn);
}
```

**Available Factories:**

- `UserFactory`: Create test users with customizable fields
- `AccountFactory`: Create test accounts
- `CategoryFactory`: Create test categories
- `PersonFactory`: Create test people/contacts
- `TransactionFactory`: Create test transactions
- `create_test_scenario()`: Create complete test setup (user + accounts + categories)

## Running Tests

### Prerequisites

1. **PostgreSQL Database**: Ensure PostgreSQL is running and accessible
2. **Environment Variables**: Configure `.env` file with test database URL:
   ```bash
   DATABASE_URL=postgresql://username:password@localhost/master_of_coin_test
   JWT_SECRET=your_test_secret_key_at_least_32_characters_long
   ```

### Test Commands

#### Run All Integration Tests

```bash
cargo test --test integration
```

#### Run Specific Test Suite

```bash
# Database tests only
cargo test --test integration database::

# API tests only
cargo test --test integration api::

# Specific endpoint tests
cargo test --test integration api::test_accounts::
cargo test --test integration api::test_transactions::
cargo test --test integration api::test_budgets::
```

#### Run Specific Test

```bash
cargo test --test integration test_create_account
```

#### Run with Output/Logging

```bash
# Show println! output
cargo test --test integration -- --nocapture

# Show test names as they run
cargo test --test integration -- --nocapture --test-threads=1
```

#### Run Tests in Serial (One at a Time)

```bash
cargo test --test integration -- --test-threads=1
```

This is useful when tests might interfere with each other or when debugging specific test failures.

#### Run Tests in Parallel (Default)

```bash
cargo test --test integration
```

Tests run in parallel by default for faster execution. Each test uses isolated database transactions or unique test data to prevent conflicts.

### Example Test Execution

```bash
# Run all tests with output
cargo test --test integration -- --nocapture

# Run only authentication tests
cargo test --test integration api::test_auth:: -- --nocapture

# Run a specific test with detailed output
cargo test --test integration test_register_user -- --nocapture --test-threads=1
```

## Test Coverage Summary

### Total Test Count: 176 Tests

| Domain             | Test Count | Coverage                                                                   |
| ------------------ | ---------- | -------------------------------------------------------------------------- |
| **Authentication** | 14         | Registration, login, token validation, error cases                         |
| **Accounts**       | 25         | CRUD operations, user isolation, validation, account types                 |
| **Transactions**   | 27         | Creation, updates, splits, filtering, date ranges                          |
| **Categories**     | 18         | CRUD, hierarchies, validation, user isolation                              |
| **People**         | 32         | CRUD, debt tracking, settlements, validation                               |
| **Budgets**        | 30         | Creation, ranges, tracking, analytics, validation                          |
| **Dashboard**      | 11         | Analytics, aggregations, date filtering                                    |
| **Database**       | 19         | Connections, CRUD, relationships, custom types, transactions, async bridge |

### Recent Improvements

The following improvements were made during the integration test implementation:

#### Backend API Improvements

- **Proper HTTP Status Codes**: Validation errors now correctly return 422 (Unprocessable Entity) instead of 400 (Bad Request)
- **Authorization Handling**: Added `ApiError::Forbidden` variant for proper 403 responses when users try to access resources they don't own
- **Authentication Error Messages**: Enhanced error messages for missing/invalid tokens
- **BigDecimal Formatting**: Fixed decimal formatting for consistent 2-decimal place display in transaction amounts

#### API Design Improvements

- **Budget Range Endpoint**: Removed redundant `budget_id` from request body in `POST /api/v1/budgets/{budget_id}/ranges` - now uses only the path parameter
- **Consistent Error Handling**: All services now properly distinguish between Unauthorized (401), Forbidden (403), and Not Found (404) errors

#### Test Infrastructure

- **Comprehensive Test Utilities**: Created reusable helpers for server setup, authentication, HTTP requests, and test data factories
- **Parallel Test Execution**: Tests use unique timestamps to avoid data conflicts during parallel execution
- **100% Pass Rate**: All 176 integration tests pass successfully

### Coverage Highlights

✅ **CRUD Operations**: All entities support Create, Read, Update, Delete  
✅ **Error Cases**: Invalid inputs, missing fields, unauthorized access  
✅ **Authorization**: User data isolation, permission checks  
✅ **Data Validation**: Type validation, required fields, format checks  
✅ **Business Logic**: Calculations, aggregations, complex queries  
✅ **Edge Cases**: Empty lists, boundary values, concurrent operations

## Writing New Tests

### Guidelines for Adding Tests

1. **Use Test Utilities**: Leverage existing helpers and factories
2. **Test Isolation**: Each test should be independent and not affect others
3. **Proper Cleanup**: Tests clean up after themselves (handled by test utilities)
4. **Clear Naming**: Use descriptive test names that explain what is being tested
5. **Arrange-Act-Assert**: Follow the AAA pattern for test structure

### Common Test Patterns

#### Pattern 1: API Endpoint Test

```rust
#[tokio::test]
async fn test_create_resource() {
    // Arrange: Set up test server and authentication
    let server = create_test_server().await;
    let auth = register_unique_test_user(&server, "1").await;
    let token = &auth.token;

    // Act: Make API request
    let request = json!({
        "name": "Test Resource",
        "field": "value"
    });
    let response = post_authenticated(&server, "/api/v1/resources", token, &request).await;

    // Assert: Verify response
    assert_status(&response, 201);
    let resource: ResourceResponse = extract_json(response);
    assert_eq!(resource.name, "Test Resource");
}
```

#### Pattern 2: Authorization Test

```rust
#[tokio::test]
async fn test_user_isolation() {
    let server = create_test_server().await;

    // Create two users
    let user1 = register_unique_test_user(&server, "1").await;
    let user2 = register_unique_test_user(&server, "2").await;

    // User 1 creates a resource
    let resource = create_test_resource(&server, &user1.token).await;

    // User 2 should not be able to access it
    let response = get_authenticated(
        &server,
        &format!("/api/v1/resources/{}", resource.id),
        &user2.token
    ).await;
    assert_status(&response, 404);
}
```

#### Pattern 3: Database Test with Factories

```rust
#[tokio::test]
async fn test_database_operation() {
    let pool = create_test_db_pool();
    let mut conn = pool.get().unwrap();

    // Use factories to create test data
    let user = UserFactory::new()
        .username("testuser")
        .build(&mut conn);

    let account = AccountFactory::new(user.id)
        .name("Test Account")
        .build(&mut conn);

    // Perform database operations and assertions
}
```

### Test Scenarios to Cover

When adding new features, ensure tests cover:

1. **Happy Path**: Normal, expected usage
2. **Validation Errors**: Invalid inputs, missing required fields
3. **Authorization**: User isolation, permission checks
4. **Edge Cases**: Empty lists, boundary values, null fields
5. **Error Handling**: Database errors, network issues, invalid states
6. **Business Logic**: Calculations, aggregations, complex operations

### Best Practices Learned

1. **Use Factories**: Prefer factories over manual data creation for consistency
2. **Unique Test Data**: Use UUIDs or unique suffixes to avoid conflicts
3. **Test Isolation**: Don't rely on test execution order
4. **Clear Assertions**: Use descriptive assertion messages
5. **Minimal Setup**: Only create data needed for the specific test
6. **Test One Thing**: Each test should verify one specific behavior
7. **Readable Tests**: Write tests that serve as documentation

## Troubleshooting

### Common Issues and Solutions

#### Database Connection Errors

**Problem**: `Failed to get connection from pool`

**Solutions**:

- Ensure PostgreSQL is running: `pg_ctl status`
- Verify DATABASE_URL in `.env` is correct
- Check database exists: `psql -l | grep master_of_coin_test`
- Increase connection pool size in test configuration

#### Test Failures Due to Data Conflicts

**Problem**: Tests fail with unique constraint violations

**Solutions**:

- Use `register_unique_test_user()` with unique suffixes
- Use factories with default UUID-based names
- Run tests serially: `cargo test -- --test-threads=1`
- Ensure proper test cleanup

#### JWT Token Issues

**Problem**: `Invalid token` or `Token expired` errors

**Solutions**:

- Verify JWT_SECRET is set in `.env`
- Ensure JWT_SECRET is at least 32 characters
- Check token is properly formatted with Bearer prefix
- Verify token generation uses correct configuration

#### Migration Errors

**Problem**: `relation does not exist` or schema errors

**Solutions**:

- Run migrations: `diesel migration run`
- Reset database: `diesel database reset`
- Verify migration files are correct
- Check DATABASE_URL points to test database

#### Slow Test Execution

**Problem**: Tests take too long to run

**Solutions**:

- Run tests in parallel (default behavior)
- Reduce connection pool size in tests
- Use factories instead of API calls for setup
- Profile tests to identify bottlenecks

### Debugging Tests

#### Enable Detailed Logging

```bash
RUST_LOG=debug cargo test --test integration -- --nocapture
```

#### Run Single Test with Full Output

```bash
cargo test --test integration test_name -- --nocapture --test-threads=1
```

#### Check Database State

```bash
# Connect to test database
psql $DATABASE_URL

# View tables
\dt

# Check data
SELECT * FROM users;
SELECT * FROM accounts;
```

### Environment Setup Issues

#### Missing Environment Variables

Ensure `.env` file exists in project root with:

```bash
DATABASE_URL=postgresql://username:password@localhost/master_of_coin_test
JWT_SECRET=test_secret_key_at_least_32_characters_long_for_testing
```

#### Database Permissions

Ensure database user has proper permissions:

```sql
GRANT ALL PRIVILEGES ON DATABASE master_of_coin_test TO your_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO your_user;
```

## CI/CD Integration

### GitHub Actions Configuration

Tests are automatically run in CI/CD pipelines on:

- Pull requests
- Pushes to main branch
- Release tags

### Test Execution in CI

```yaml
- name: Run integration tests
  run: cargo test --test integration
  env:
    DATABASE_URL: postgresql://postgres:postgres@localhost/test_db
    JWT_SECRET: test_secret_key_for_ci_at_least_32_chars
```

### Test Execution Time

- **Full Suite**: ~30-60 seconds (parallel execution)
- **Single Domain**: ~5-10 seconds
- **Single Test**: <1 second

### Parallel Test Execution

Tests are designed to run in parallel safely:

- Each test uses unique user data (UUIDs, unique suffixes)
- Database transactions provide isolation
- No shared global state
- Connection pool handles concurrent access

### CI Best Practices

1. **Use Test Database**: Separate database for CI/CD
2. **Fresh Migrations**: Run migrations before tests
3. **Parallel Execution**: Enable for faster CI runs
4. **Fail Fast**: Stop on first failure in CI
5. **Cache Dependencies**: Cache Cargo dependencies for speed

## Additional Resources

- [Diesel Documentation](https://diesel.rs/)
- [Axum Testing Guide](https://docs.rs/axum-test/)
- [Rust Testing Best Practices](https://doc.rust-lang.org/book/ch11-00-testing.html)
- [Project Database Schema](../../docs/database/schema.md)
- [API Specification](../../docs/system-design/04-api/api-specification.md)

## Contributing

When adding new features:

1. Write integration tests for new endpoints
2. Follow existing test patterns and structure
3. Ensure tests are isolated and repeatable
4. Update this documentation if adding new test utilities
5. Run full test suite before submitting PR

---

**Last Updated**: 2025-11-16  
**Total Tests**: 176
**Test Coverage**: Comprehensive coverage of all API endpoints and database operations
