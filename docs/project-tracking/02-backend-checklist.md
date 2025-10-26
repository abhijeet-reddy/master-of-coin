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

- [ ] Create `src/lib.rs` with module exports
- [ ] Create `src/config.rs` for configuration management
- [ ] Create module directories
  - [ ] `src/api/` - API layer
  - [ ] `src/services/` - Business logic
  - [ ] `src/repositories/` - Data access
  - [ ] `src/models/` - Data models
  - [ ] `src/db/` - Database utilities
  - [ ] `src/auth/` - Authentication
  - [ ] `src/errors/` - Error handling
  - [ ] `src/utils/` - Utilities

---

## Configuration Management

### Config Module (`src/config.rs`)

- [ ] Implement Config struct

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

- [ ] Implement `Config::from_env()` method
- [ ] Add environment variable loading with dotenvy
- [ ] Test configuration loading

---

## Error Handling

### Error Types (`src/errors/api_error.rs`)

- [ ] Define ApiError enum (using Diesel)

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

- [ ] Implement `IntoResponse` for ApiError
- [ ] Create ErrorResponse struct
- [ ] Add error logging with tracing
- [ ] Test error responses

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

- [ ] Implement `create_user()`
- [ ] Implement `find_by_id()`
- [ ] Implement `find_by_username()`
- [ ] Implement `find_by_email()`
- [ ] Implement `update_user()`
- [ ] Implement `delete_user()`
- [ ] Add unit tests

### Account Repository (`src/repositories/account_repo.rs`)

- [ ] Implement `create_account()`
- [ ] Implement `find_by_id()`
- [ ] Implement `list_by_user()`
- [ ] Implement `update_account()`
- [ ] Implement `delete_account()`
- [ ] Implement `calculate_balance()`
- [ ] Add unit tests

### Transaction Repository (`src/repositories/transaction_repo.rs`)

- [ ] Implement `create_transaction()`
- [ ] Implement `find_by_id()`
- [ ] Implement `list_by_user()` with filters
- [ ] Implement `update_transaction()`
- [ ] Implement `delete_transaction()`
- [ ] Implement `create_split()`
- [ ] Implement `get_splits_for_transaction()`
- [ ] Implement `delete_splits_for_transaction()`
- [ ] Add pagination support
- [ ] Add unit tests

### Category Repository (`src/repositories/category_repo.rs`)

- [ ] Implement `create_category()`
- [ ] Implement `find_by_id()`
- [ ] Implement `list_by_user()`
- [ ] Implement `update_category()`
- [ ] Implement `delete_category()`
- [ ] Add unit tests

### Person Repository (`src/repositories/person_repo.rs`)

- [ ] Implement `create_person()`
- [ ] Implement `find_by_id()`
- [ ] Implement `list_by_user()`
- [ ] Implement `update_person()`
- [ ] Implement `delete_person()`
- [ ] Add unit tests

### Budget Repository (`src/repositories/budget_repo.rs`)

- [ ] Implement `create_budget()`
- [ ] Implement `find_by_id()`
- [ ] Implement `list_by_user()`
- [ ] Implement `update_budget()`
- [ ] Implement `delete_budget()`
- [ ] Implement `create_range()`
- [ ] Implement `get_active_range()`
- [ ] Implement `list_ranges_for_budget()`
- [ ] Add unit tests

---

## Service Layer

### Transaction Service (`src/services/transaction_service.rs`)

- [ ] Implement `create_transaction()` with split handling
- [ ] Implement `get_transaction()`
- [ ] Implement `list_transactions()` with filters
- [ ] Implement `update_transaction()`
- [ ] Implement `delete_transaction()`
- [ ] Implement split calculation logic
- [ ] Add business rule validation
- [ ] Add unit tests

### Account Service (`src/services/account_service.rs`)

- [ ] Implement `create_account()`
- [ ] Implement `get_account()` with balance
- [ ] Implement `list_accounts()` with balances
- [ ] Implement `update_account()`
- [ ] Implement `delete_account()` with transaction check
- [ ] Add unit tests

### Budget Service (`src/services/budget_service.rs`)

- [ ] Implement `create_budget()`
- [ ] Implement `get_budget()` with current spending
- [ ] Implement `list_budgets()` with status
- [ ] Implement `update_budget()`
- [ ] Implement `delete_budget()`
- [ ] Implement `add_range()`
- [ ] Implement `calculate_budget_status()`
- [ ] Implement budget filter matching logic
- [ ] Add unit tests

### Debt Service (`src/services/debt_service.rs`)

- [ ] Implement `calculate_debt_for_person()`
- [ ] Implement `get_all_debts_for_user()`
- [ ] Implement `settle_debt()`
- [ ] Add unit tests

### Analytics Service (`src/services/analytics_service.rs`)

- [ ] Implement `calculate_net_worth()`
- [ ] Implement `get_spending_trend()`
- [ ] Implement `get_category_breakdown()`
- [ ] Implement `get_dashboard_summary()`
- [ ] Use parallel queries with tokio::join!
- [ ] Add unit tests

---

## Authentication

### Password Hashing (`src/auth/password.rs`)

- [ ] Implement `hash_password()` with Argon2

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

- [ ] Implement `verify_password()`
- [ ] Add tests

### JWT Handling (`src/auth/jwt.rs`)

- [ ] Define Claims struct
  ```rust
  #[derive(Debug, Serialize, Deserialize)]
  pub struct Claims {
      pub sub: Uuid,        // user_id
      pub username: String,
      pub exp: i64,
      pub iat: i64,
  }
  ```
- [ ] Implement `generate_token()`
- [ ] Implement `verify_token()`
- [ ] Implement `decode_token()`
- [ ] Add tests

### Auth Middleware (`src/api/middleware/auth.rs`)

- [ ] Implement `require_auth` middleware
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
- [ ] Extract user from Authorization header
- [ ] Verify JWT token
- [ ] Add user to request extensions
- [ ] Add tests

---

## API Handlers

### Auth Handlers (`src/api/handlers/auth.rs`)

- [ ] Implement `register()` endpoint
  - [ ] Validate input
  - [ ] Check username/email uniqueness
  - [ ] Hash password
  - [ ] Create user
  - [ ] Generate JWT
  - [ ] Return user + token
- [ ] Implement `login()` endpoint
  - [ ] Validate credentials
  - [ ] Verify password
  - [ ] Generate JWT
  - [ ] Return user + token
- [ ] Implement `refresh()` endpoint (optional)
- [ ] Add tests

### Transaction Handlers (`src/api/handlers/transactions.rs`)

- [ ] Implement `list()` - GET /transactions
- [ ] Implement `create()` - POST /transactions
- [ ] Implement `get()` - GET /transactions/:id
- [ ] Implement `update()` - PUT /transactions/:id
- [ ] Implement `delete()` - DELETE /transactions/:id
- [ ] Extract AuthUser from request
- [ ] Add input validation
- [ ] Add tests

### Account Handlers (`src/api/handlers/accounts.rs`)

- [ ] Implement `list()` - GET /accounts
- [ ] Implement `create()` - POST /accounts
- [ ] Implement `get()` - GET /accounts/:id
- [ ] Implement `update()` - PUT /accounts/:id
- [ ] Implement `delete()` - DELETE /accounts/:id
- [ ] Add tests

### Budget Handlers (`src/api/handlers/budgets.rs`)

- [ ] Implement `list()` - GET /budgets
- [ ] Implement `create()` - POST /budgets
- [ ] Implement `get()` - GET /budgets/:id
- [ ] Implement `update()` - PUT /budgets/:id
- [ ] Implement `delete()` - DELETE /budgets/:id
- [ ] Implement `add_range()` - POST /budgets/:id/ranges
- [ ] Add tests

### People Handlers (`src/api/handlers/people.rs`)

- [ ] Implement `list()` - GET /people
- [ ] Implement `create()` - POST /people
- [ ] Implement `get()` - GET /people/:id
- [ ] Implement `update()` - PUT /people/:id
- [ ] Implement `delete()` - DELETE /people/:id
- [ ] Implement `get_debts()` - GET /people/:id/debts
- [ ] Implement `settle_debt()` - POST /people/:id/settle
- [ ] Add tests

### Category Handlers (`src/api/handlers/categories.rs`)

- [ ] Implement `list()` - GET /categories
- [ ] Implement `create()` - POST /categories
- [ ] Implement `update()` - PUT /categories/:id
- [ ] Implement `delete()` - DELETE /categories/:id
- [ ] Add tests

### Dashboard Handler (`src/api/handlers/dashboard.rs`)

- [ ] Implement `get_summary()` - GET /dashboard
- [ ] Aggregate data from multiple services
- [ ] Use parallel queries
- [ ] Add caching (optional)
- [ ] Add tests

---

## API Routes

### Route Configuration (`src/api/routes.rs`)

- [ ] Create `api_routes()` function
- [ ] Define auth routes (public)
  ```rust
  Router::new()
      .route("/auth/register", post(handlers::auth::register))
      .route("/auth/login", post(handlers::auth::login))
  ```
- [ ] Define protected routes
  ```rust
  Router::new()
      .route("/dashboard", get(handlers::dashboard::get_summary))
      .route("/transactions", get(handlers::transactions::list))
      .route("/transactions", post(handlers::transactions::create))
      // ... more routes
      .layer(middleware::from_fn_with_state(state, middleware::auth::require_auth))
  ```
- [ ] Group routes by resource
- [ ] Apply middleware
- [ ] Add CORS configuration
- [ ] Add request logging

---

## Application State

### AppState (`src/lib.rs`)

- [ ] Define AppState struct (using Diesel)

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

- [ ] Implement helper methods for services
- [ ] Add to router state

---

## Main Application

### Server Setup (`src/main.rs`)

- [ ] Initialize tracing/logging
  ```rust
  tracing_subscriber::fmt()
      .with_env_filter(EnvFilter::from_default_env())
      .init();
  ```
- [ ] Load configuration
- [ ] Create database pool
- [ ] Run migrations
- [ ] Build AppState
- [ ] Create router with routes
- [ ] Add middleware layers
  - [ ] CORS
  - [ ] Tracing
  - [ ] Compression (optional)
- [ ] Start server
  ```rust
  let addr = format!("{}:{}", config.server.host, config.server.port);
  let listener = tokio::net::TcpListener::bind(&addr).await?;
  axum::serve(listener, app).await?;
  ```
- [ ] Add graceful shutdown
- [ ] Test server starts

---

## Middleware

### Logging Middleware (`src/api/middleware/logging.rs`)

- [ ] Add request ID generation
- [ ] Log request details
- [ ] Log response status and duration
- [ ] Use tracing spans

### CORS Middleware

- [ ] Configure CORS with tower-http

  ```rust
  use tower_http::cors::{CorsLayer, Any};

  let cors = CorsLayer::new()
      .allow_origin(Any)
      .allow_methods(Any)
      .allow_headers(Any);
  ```

- [ ] Restrict origins for production

---

## Testing

### Unit Tests

- [ ] Test all repository methods
- [ ] Test all service methods
- [ ] Test authentication functions
- [ ] Test error handling
- [ ] Test validation logic

### Integration Tests (`tests/`)

- [ ] Create test database setup
- [ ] Test auth endpoints
  - [ ] Register user
  - [ ] Login
  - [ ] Invalid credentials
- [ ] Test transaction endpoints
  - [ ] Create transaction
  - [ ] Create with splits
  - [ ] List transactions
  - [ ] Update transaction
  - [ ] Delete transaction
- [ ] Test account endpoints
- [ ] Test budget endpoints
- [ ] Test authorization (user can only access own data)
- [ ] Test error responses

### Test Utilities

- [ ] Create test database helper
- [ ] Create test user helper
- [ ] Create mock data generators
- [ ] Create API client helper

---

## Documentation

### API Documentation

- [ ] Add doc comments to all public functions
- [ ] Document error cases
- [ ] Document validation rules
- [ ] Create API examples

### Code Documentation

- [ ] Document complex business logic
- [ ] Add module-level documentation
- [ ] Document architectural decisions

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

- [ ] All models defined with validation
- [ ] All repositories implemented and tested
- [ ] All services implemented with business logic
- [ ] Authentication system working (JWT + Argon2)
- [ ] All API endpoints implemented
- [ ] Middleware configured (auth, CORS, logging)
- [ ] Error handling comprehensive
- [ ] Unit tests passing
- [ ] Integration tests passing
- [ ] API documentation complete
- [ ] Server starts and responds to requests

**Estimated Time:** 5-7 days

**Next Steps:** Proceed to [`03-frontend-checklist.md`](03-frontend-checklist.md)
