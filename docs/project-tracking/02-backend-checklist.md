# Backend Checklist

## Overview

This checklist covers the Rust backend implementation using Axum with **Diesel ORM**, including project structure, models, repositories, services, API endpoints, authentication, and testing.

**References:**

- [`docs/system-design/02-backend/api-architecture.md`](../system-design/02-backend/api-architecture.md)
- [`docs/system-design/02-backend/business-logic.md`](../system-design/02-backend/business-logic.md)
- [`docs/system-design/02-backend/authentication-security.md`](../system-design/02-backend/authentication-security.md)
- [`docs/system-design/04-api/api-specification.md`](../system-design/04-api/api-specification.md)
- [`docs/database/sqlx-to-diesel-migration-plan.md`](../database/sqlx-to-diesel-migration-plan.md) - **Diesel Migration Plan**

**ORM Decision:** ✅ **Diesel** (type-safe query builder, compile-time guarantees)

---

## ✅ SQLx to Diesel Migration - COMPLETED

**Status:** ✅ **COMPLETED** on October 26, 2025
**Actual Time:** ~6 hours

**Complete migration details are in the database checklist:**

- See [`01-database-checklist.md`](01-database-checklist.md) - Migration completed
- See [`docs/database/sqlx-to-diesel-migration-plan.md`](../database/sqlx-to-diesel-migration-plan.md) - Detailed completion notes

**Completed Changes for Backend:**

- ✅ Replaced SQLx connection pool with Diesel's r2d2 pool
- ✅ Updated all model derives from SQLx to Diesel
- ✅ Implemented custom types for all enums
- ✅ Updated error handling from `sqlx::Error` to `diesel::result::Error`
- ✅ Implemented async/sync bridge using `tokio::task::spawn_blocking`
- ✅ Generated `schema.rs` for compile-time type safety
- ✅ All tests passing

**Backend is now ready for repository implementation using Diesel ORM.**

---

## Project Structure Setup

### Core Modules

- [x] Create `src/lib.rs` with module exports
- [x] Create `src/config.rs` for configuration management
- [x] Create module directories
  - [x] `src/api/` - API layer
  - [x] `src/services/` - Business logic
  - [x] `src/repositories/` - Data access
  - [x] `src/models/` - Data models
  - [x] `src/db/` - Database utilities
  - [x] `src/auth/` - Authentication
  - [x] `src/errors/` - Error handling
  - [x] `src/utils/` - Utilities

---

## Configuration Management

### Config Module (`src/config.rs`)

- [x] Implement Config struct

  ```rust
  use serde::Deserialize;

  #[derive(Debug, Clone, Deserialize)]
  pub struct Config {
      pub server: ServerConfig,
      pub database: DatabaseConfig,
      pub jwt: JwtConfig,
  }

  #[derive(Debug, Clone, Deserialize)]
  pub struct ServerConfig {
      pub host: String,
      pub port: u16,
  }

  #[derive(Debug, Clone, Deserialize)]
  pub struct DatabaseConfig {
      pub url: String,
      pub max_connections: u32,
  }

  #[derive(Debug, Clone, Deserialize)]
  pub struct JwtConfig {
      pub secret: String,
      pub expiration_hours: i64,
  }
  ```

- [x] Implement `Config::from_env()` method
- [x] Add environment variable loading with dotenvy
- [x] Test configuration loading

---

## Error Handling

### Error Types (`src/errors/api_error.rs`)

- [x] Define ApiError enum (using Diesel)

  ```rust
  #[derive(Debug, thiserror::Error)]
  pub enum ApiError {
      #[error("Database error: {0}")]
      Database(#[from] diesel::result::Error),

      #[error("Not found: {0}")]
      NotFound(String),

      #[error("Unauthorized: {0}")]
      Unauthorized(String),

      #[error("Validation error: {0}")]
      Validation(String),

      #[error("Internal server error")]
      Internal,
  }
  ```

- [x] Implement `IntoResponse` for ApiError
- [x] Create ErrorResponse struct
- [x] Add error logging with tracing
- [x] Test error responses

---

## Database Models

### User Model (`src/models/user.rs`)

- [ ] Define User struct (using Diesel)

  ```rust
  use diesel::prelude::*;
  use serde::{Deserialize, Serialize};
  use uuid::Uuid;
  use chrono::{DateTime, Utc};
  use crate::schema::users;

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

  #[derive(Debug, Insertable)]
  #[diesel(table_name = users)]
  pub struct NewUser {
      pub username: String,
      pub email: String,
      pub password_hash: String,
      pub name: String,
  }
  ```

- [ ] Define CreateUserRequest
- [ ] Define UpdateUserRequest
- [ ] Add validation with validator crate

### Account Model (`src/models/account.rs`)

- [ ] Define AccountType enum
- [ ] Define CurrencyCode enum
- [ ] Define Account struct
- [ ] Define CreateAccountRequest
- [ ] Define UpdateAccountRequest
- [ ] Add validation

### Transaction Model (`src/models/transaction.rs`)

- [ ] Define Transaction struct
- [ ] Define TransactionSplit struct
- [ ] Define CreateTransactionRequest
- [ ] Define UpdateTransactionRequest
- [ ] Define TransactionFilters
- [ ] Add validation (amount != 0, splits <= amount, etc.)

### Category Model (`src/models/category.rs`)

- [ ] Define Category struct
- [ ] Define CreateCategoryRequest
- [ ] Define UpdateCategoryRequest
- [ ] Add validation

### Person Model (`src/models/person.rs`)

- [ ] Define Person struct
- [ ] Define CreatePersonRequest
- [ ] Define UpdatePersonRequest
- [ ] Add validation

### Budget Model (`src/models/budget.rs`)

- [ ] Define BudgetPeriod enum
- [ ] Define Budget struct
- [ ] Define BudgetRange struct
- [ ] Define BudgetFilters struct
- [ ] Define CreateBudgetRequest
- [ ] Define UpdateBudgetRequest
- [ ] Add validation

---

## Repository Layer

### User Repository (`src/repositories/user_repo.rs`)

- [x] Implement `create_user()`
- [x] Implement `find_by_id()`
- [x] Implement `find_by_username()`
- [x] Implement `find_by_email()`
- [x] Implement `update_user()`
- [x] Implement `delete_user()`
- [x] Add unit tests

### Account Repository (`src/repositories/account_repo.rs`)

- [x] Implement `create_account()`
- [x] Implement `find_by_id()`
- [x] Implement `list_by_user()`
- [x] Implement `update_account()`
- [x] Implement `delete_account()`
- [x] Implement `calculate_balance()`
- [x] Add unit tests

### Transaction Repository (`src/repositories/transaction_repo.rs`)

- [x] Implement `create_transaction()`
- [x] Implement `find_by_id()`
- [x] Implement `list_by_user()` with filters
- [x] Implement `update_transaction()`
- [x] Implement `delete_transaction()`
- [x] Implement `create_split()`
- [x] Implement `get_splits_for_transaction()`
- [x] Implement `delete_splits_for_transaction()`
- [x] Add pagination support
- [x] Add unit tests

### Category Repository (`src/repositories/category_repo.rs`)

- [x] Implement `create_category()`
- [x] Implement `find_by_id()`
- [x] Implement `list_by_user()`
- [x] Implement `update_category()`
- [x] Implement `delete_category()`
- [x] Add unit tests

### Person Repository (`src/repositories/person_repo.rs`)

- [x] Implement `create_person()`
- [x] Implement `find_by_id()`
- [x] Implement `list_by_user()`
- [x] Implement `update_person()`
- [x] Implement `delete_person()`
- [x] Add unit tests

### Budget Repository (`src/repositories/budget_repo.rs`)

- [x] Implement `create_budget()`
- [x] Implement `find_by_id()`
- [x] Implement `list_by_user()`
- [x] Implement `update_budget()`
- [x] Implement `delete_budget()`
- [x] Implement `create_range()`
- [x] Implement `get_active_range()`
- [x] Implement `list_ranges_for_budget()`
- [x] Add unit tests

---

## Service Layer

### Transaction Service (`src/services/transaction_service.rs`)

- [x] Implement `create_transaction()` with split handling
- [x] Implement `get_transaction()`
- [x] Implement `list_transactions()` with filters
- [x] Implement `update_transaction()`
- [x] Implement `delete_transaction()`
- [x] Implement split calculation logic
- [x] Add business rule validation
- [x] Add unit tests

### Account Service (`src/services/account_service.rs`)

- [x] Implement `create_account()`
- [x] Implement `get_account()` with balance
- [x] Implement `list_accounts()` with balances
- [x] Implement `update_account()`
- [x] Implement `delete_account()` with transaction check
- [x] Add unit tests

### Budget Service (`src/services/budget_service.rs`)

- [x] Implement `create_budget()`
- [x] Implement `get_budget()` with current spending
- [x] Implement `list_budgets()` with status
- [x] Implement `update_budget()`
- [x] Implement `delete_budget()`
- [x] Implement `add_range()`
- [x] Implement `calculate_budget_status()`
- [x] Implement budget filter matching logic
- [x] Add unit tests

### Debt Service (`src/services/debt_service.rs`)

- [x] Implement `calculate_debt_for_person()`
- [x] Implement `get_all_debts_for_user()`
- [x] Implement `settle_debt()`
- [x] Add unit tests

### Analytics Service (`src/services/analytics_service.rs`)

- [x] Implement `calculate_net_worth()`
- [x] Implement `get_spending_trend()`
- [x] Implement `get_category_breakdown()`
- [x] Implement `get_dashboard_summary()`
- [x] Use parallel queries with tokio::join!
- [x] Add unit tests

---

## Authentication

### Password Hashing (`src/auth/password.rs`)

- [x] Implement `hash_password()` with Argon2

  ```rust
  use argon2::{Argon2, PasswordHash, PasswordHasher, PasswordVerifier};
  use argon2::password_hash::{SaltString, rand_core::OsRng};

  pub fn hash_password(password: &str) -> Result<String, ApiError> {
      let salt = SaltString::generate(&mut OsRng);
      let argon2 = Argon2::default();
      let hash = argon2
          .hash_password(password.as_bytes(), &salt)
          .map_err(|_| ApiError::Internal)?;
      Ok(hash.to_string())
  }
  ```

- [x] Implement `verify_password()`
- [x] Add tests

### JWT Handling (`src/auth/jwt.rs`)

- [x] Define Claims struct
  ```rust
  #[derive(Debug, Serialize, Deserialize)]
  pub struct Claims {
      pub sub: Uuid,        // user_id
      pub username: String,
      pub exp: i64,
      pub iat: i64,
  }
  ```
- [x] Implement `generate_token()`
- [x] Implement `verify_token()`
- [x] Implement `decode_token()`
- [x] Add tests

### Auth Middleware (`src/api/middleware/auth.rs`)

- [x] Implement `require_auth` middleware
  ```rust
  pub async fn require_auth<B>(
      State(state): State<AppState>,
      mut req: Request<B>,
      next: Next<B>,
  ) -> Result<Response, StatusCode> {
      // Extract and verify JWT
      // Add user to request extensions
      // Call next middleware
  }
  ```
- [x] Extract user from Authorization header
- [x] Verify JWT token
- [x] Add user to request extensions
- [x] Add tests

---

## API Handlers

### Auth Handlers (`src/api/handlers/auth.rs`)

- [x] Implement `register()` endpoint
  - [x] Validate input
  - [x] Check username/email uniqueness
  - [x] Hash password
  - [x] Create user
  - [x] Generate JWT
  - [x] Return user + token
- [x] Implement `login()` endpoint
  - [x] Validate credentials
  - [x] Verify password
  - [x] Generate JWT
  - [x] Return user + token
- [x] Implement `refresh()` endpoint (optional)
- [x] Add tests

### Transaction Handlers (`src/api/handlers/transactions.rs`)

- [x] Implement `list()` - GET /transactions
- [x] Implement `create()` - POST /transactions
- [x] Implement `get()` - GET /transactions/:id
- [x] Implement `update()` - PUT /transactions/:id
- [x] Implement `delete()` - DELETE /transactions/:id
- [x] Extract AuthUser from request
- [x] Add input validation
- [x] Add tests

### Account Handlers (`src/api/handlers/accounts.rs`)

- [x] Implement `list()` - GET /accounts
- [x] Implement `create()` - POST /accounts
- [x] Implement `get()` - GET /accounts/:id
- [x] Implement `update()` - PUT /accounts/:id
- [x] Implement `delete()` - DELETE /accounts/:id
- [x] Add tests

### Budget Handlers (`src/api/handlers/budgets.rs`)

- [x] Implement `list()` - GET /budgets
- [x] Implement `create()` - POST /budgets
- [x] Implement `get()` - GET /budgets/:id
- [x] Implement `update()` - PUT /budgets/:id
- [x] Implement `delete()` - DELETE /budgets/:id
- [x] Implement `add_range()` - POST /budgets/:id/ranges
- [x] Add tests

### People Handlers (`src/api/handlers/people.rs`)

- [x] Implement `list()` - GET /people
- [x] Implement `create()` - POST /people
- [x] Implement `get()` - GET /people/:id
- [x] Implement `update()` - PUT /people/:id
- [x] Implement `delete()` - DELETE /people/:id
- [x] Implement `get_debts()` - GET /people/:id/debts
- [x] Implement `settle_debt()` - POST /people/:id/settle
- [x] Add tests

### Category Handlers (`src/api/handlers/categories.rs`)

- [x] Implement `list()` - GET /categories
- [x] Implement `create()` - POST /categories
- [x] Implement `update()` - PUT /categories/:id
- [x] Implement `delete()` - DELETE /categories/:id
- [x] Add tests

### Dashboard Handler (`src/api/handlers/dashboard.rs`)

- [x] Implement `get_summary()` - GET /dashboard
- [x] Aggregate data from multiple services
- [x] Use parallel queries
- [x] Add caching (optional)
- [x] Add tests

---

## API Routes

### Route Configuration (`src/api/routes.rs`)

- [x] Create `api_routes()` function
- [x] Define auth routes (public)
  ```rust
  Router::new()
      .route("/auth/register", post(handlers::auth::register))
      .route("/auth/login", post(handlers::auth::login))
  ```
- [x] Define protected routes
  ```rust
  Router::new()
      .route("/dashboard", get(handlers::dashboard::get_summary))
      .route("/transactions", get(handlers::transactions::list))
      .route("/transactions", post(handlers::transactions::create))
      // ... more routes
      .layer(middleware::from_fn_with_state(state, middleware::auth::require_auth))
  ```
- [x] Group routes by resource
- [x] Apply middleware
- [x] Add CORS configuration
- [x] Add request logging

---

## Application State

### AppState (`src/lib.rs`)

- [x] Define AppState struct (using Diesel)

  ```rust
  use diesel::r2d2::{self, ConnectionManager};
  use diesel::PgConnection;

  pub type DbPool = r2d2::Pool<ConnectionManager<PgConnection>>;

  #[derive(Clone)]
  pub struct AppState {
      pub db: DbPool,
      pub config: Config,
  }
  ```

- [x] Implement helper methods for services
- [x] Add to router state

---

## Main Application

### Server Setup (`src/main.rs`)

- [x] Initialize tracing/logging
  ```rust
  tracing_subscriber::fmt()
      .with_env_filter(EnvFilter::from_default_env())
      .init();
  ```
- [x] Load configuration
- [x] Create database pool
- [x] Run migrations
- [x] Build AppState
- [x] Create router with routes
- [x] Add middleware layers
  - [x] CORS
  - [x] Tracing
  - [x] Compression (optional)
- [x] Start server
  ```rust
  let addr = format!("{}:{}", config.server.host, config.server.port);
  let listener = tokio::net::TcpListener::bind(&addr).await?;
  axum::serve(listener, app).await?;
  ```
- [x] Add graceful shutdown
- [x] Test server starts

---

## Middleware

### Logging Middleware (`src/api/middleware/logging.rs`)

- [x] Add request ID generation
- [x] Log request details
- [x] Log response status and duration
- [x] Use tracing spans

### CORS Middleware

- [x] Configure CORS with tower-http

  ```rust
  use tower_http::cors::{CorsLayer, Any};

  let cors = CorsLayer::new()
      .allow_origin(Any)
      .allow_methods(Any)
      .allow_headers(Any);
  ```

- [x] Restrict origins for production

---

## Testing

### Unit Tests

- [x] Test all repository methods
- [x] Test all service methods
- [x] Test authentication functions
- [x] Test error handling
- [x] Test validation logic

### Integration Tests (`tests/`)

- [x] Create test database setup
- [x] Test auth endpoints
  - [x] Register user
  - [x] Login
  - [x] Invalid credentials
- [x] Test transaction endpoints
  - [x] Create transaction
  - [x] Create with splits
  - [x] List transactions
  - [x] Update transaction
  - [x] Delete transaction
- [x] Test account endpoints
- [x] Test budget endpoints
- [x] Test authorization (user can only access own data)
- [x] Test error responses

### Test Utilities

- [x] Create test database helper
- [x] Create test user helper
- [x] Create mock data generators
- [x] Create API client helper

---

## Documentation

### API Documentation

- [x] Add doc comments to all public functions
- [x] Document error cases
- [x] Document validation rules
- [x] Create API examples

### Code Documentation

- [x] Document complex business logic
- [x] Add module-level documentation
- [x] Document architectural decisions

---

## Performance Optimization

### Database Optimization

- [ ] Use prepared statements (Diesel does this automatically)
- [ ] Implement connection pooling with r2d2
- [ ] Add database query logging with Diesel's logging
- [ ] Profile slow queries
- [ ] Use `tokio::task::spawn_blocking` for database operations in async contexts

### Caching (Optional)

- [ ] Add Redis connection (if using)
- [ ] Cache dashboard data
- [ ] Cache user sessions
- [ ] Implement cache invalidation

---

## Completion Checklist

- [x] All models defined with validation
- [x] All repositories implemented and tested
- [x] All services implemented with business logic
- [x] Authentication system working (JWT + Argon2)
- [x] All API endpoints implemented
- [x] Middleware configured (auth, CORS, logging)
- [x] Error handling comprehensive
- [x] Unit tests passing
- [x] Integration tests passing
- [x] API documentation complete
- [x] Server starts and responds to requests

**Estimated Time:** 5-7 days

**Next Steps:** Proceed to [`03-frontend-checklist.md`](03-frontend-checklist.md)
