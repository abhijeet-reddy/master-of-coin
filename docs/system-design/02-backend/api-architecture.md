# Backend API Architecture

## Overview

Master of Coin backend is built with Rust using the Axum web framework and **Diesel ORM**, providing a high-performance, type-safe REST API.

**Database Layer**: Migrating from SQLx to Diesel ORM. See [`docs/database/sqlx-to-diesel-migration-plan.md`](../../database/sqlx-to-diesel-migration-plan.md) for migration details.

## Project Structure

```
backend/
├── src/
│   ├── main.rs                 # Application entry point
│   ├── config.rs               # Configuration management
│   ├── lib.rs                  # Library exports
│   │
│   ├── api/                    # API layer
│   │   ├── mod.rs
│   │   ├── routes.rs           # Route definitions
│   │   ├── middleware.rs       # Middleware (auth, logging, etc.)
│   │   ├── handlers/           # Request handlers
│   │   │   ├── mod.rs
│   │   │   ├── auth.rs
│   │   │   ├── transactions.rs
│   │   │   ├── accounts.rs
│   │   │   ├── budgets.rs
│   │   │   ├── people.rs
│   │   │   └── dashboard.rs
│   │   └── extractors.rs       # Custom extractors
│   │
│   ├── services/               # Business logic layer
│   │   ├── mod.rs
│   │   ├── transaction_service.rs
│   │   ├── account_service.rs
│   │   ├── budget_service.rs
│   │   ├── debt_service.rs
│   │   └── analytics_service.rs
│   │
│   ├── repositories/           # Data access layer
│   │   ├── mod.rs
│   │   ├── transaction_repo.rs
│   │   ├── account_repo.rs
│   │   ├── budget_repo.rs
│   │   ├── person_repo.rs
│   │   └── category_repo.rs
│   │
│   ├── models/                 # Data models
│   │   ├── mod.rs
│   │   ├── transaction.rs
│   │   ├── account.rs
│   │   ├── budget.rs
│   │   ├── person.rs
│   │   └── category.rs
│   │
│   ├── db/                     # Database
│   │   ├── mod.rs
│   │   ├── pool.rs             # Connection pool
│   │   └── migrations/         # SQL migrations
│   │
│   ├── auth/                   # Authentication
│   │   ├── mod.rs
│   │   ├── jwt.rs
│   │   └── password.rs
│   │
│   ├── errors/                 # Error handling
│   │   ├── mod.rs
│   │   └── api_error.rs
│   │
│   └── utils/                  # Utilities
│       ├── mod.rs
│       └── validators.rs
│
├── migrations/                 # Database migrations
├── tests/                      # Integration tests
├── Cargo.toml                  # Dependencies
└── Dockerfile                  # Container definition
```

## Main Application Setup

```rust
// main.rs
use axum::{Router, Server};
use tower_http::cors::CorsLayer;
use tower_http::trace::TraceLayer;

#[tokio::main]
async fn main() -> Result<()> {
    // Initialize tracing
    tracing_subscriber::fmt::init();

    // Load configuration
    let config = Config::from_env()?;

    // Setup database pool
    let db_pool = setup_database(&config).await?;

    // Build application state
    let app_state = AppState {
        db: db_pool,
        config: config.clone(),
    };

    // Build router
    let app = Router::new()
        .nest("/api/v1", api_routes())
        .layer(CorsLayer::permissive())
        .layer(TraceLayer::new_for_http())
        .with_state(app_state);

    // Start server
    let addr = format!("{}:{}", config.host, config.port);
    tracing::info!("Starting server on {}", addr);

    Server::bind(&addr.parse()?)
        .serve(app.into_make_service())
        .await?;

    Ok(())
}
```

## Route Definitions

```rust
// api/routes.rs
use axum::{Router, routing::{get, post, put, delete}};

pub fn api_routes() -> Router<AppState> {
    Router::new()
        // Auth routes
        .route("/auth/register", post(handlers::auth::register))
        .route("/auth/login", post(handlers::auth::login))
        .route("/auth/refresh", post(handlers::auth::refresh))

        // Protected routes
        .nest("/", protected_routes())
}

fn protected_routes() -> Router<AppState> {
    Router::new()
        // Dashboard
        .route("/dashboard", get(handlers::dashboard::get_summary))

        // Transactions
        .route("/transactions", get(handlers::transactions::list))
        .route("/transactions", post(handlers::transactions::create))
        .route("/transactions/:id", get(handlers::transactions::get))
        .route("/transactions/:id", put(handlers::transactions::update))
        .route("/transactions/:id", delete(handlers::transactions::delete))

        // Accounts
        .route("/accounts", get(handlers::accounts::list))
        .route("/accounts", post(handlers::accounts::create))
        .route("/accounts/:id", get(handlers::accounts::get))
        .route("/accounts/:id", put(handlers::accounts::update))
        .route("/accounts/:id", delete(handlers::accounts::delete))

        // Budgets
        .route("/budgets", get(handlers::budgets::list))
        .route("/budgets", post(handlers::budgets::create))
        .route("/budgets/:id", get(handlers::budgets::get))
        .route("/budgets/:id", put(handlers::budgets::update))
        .route("/budgets/:id", delete(handlers::budgets::delete))

        // People
        .route("/people", get(handlers::people::list))
        .route("/people", post(handlers::people::create))
        .route("/people/:id", get(handlers::people::get))
        .route("/people/:id", put(handlers::people::update))
        .route("/people/:id", delete(handlers::people::delete))
        .route("/people/:id/debts", get(handlers::people::get_debts))

        // Categories (user-defined)
        .route("/categories", get(handlers::categories::list))
        .route("/categories", post(handlers::categories::create))
        .route("/categories/:id", put(handlers::categories::update))
        .route("/categories/:id", delete(handlers::categories::delete))

        // Apply auth middleware to all protected routes
        .layer(middleware::from_fn_with_state(
            app_state.clone(),
            middleware::auth::require_auth
        ))
}
```

## Handler Example

```rust
// api/handlers/transactions.rs
use axum::{
    extract::{Path, Query, State},
    Json,
};

pub async fn list(
    State(state): State<AppState>,
    Query(params): Query<TransactionFilters>,
    user: AuthUser,
) -> Result<Json<Vec<Transaction>>, ApiError> {
    let transactions = state
        .transaction_service
        .list_transactions(user.id, params)
        .await?;

    Ok(Json(transactions))
}

pub async fn create(
    State(state): State<AppState>,
    user: AuthUser,
    Json(payload): Json<CreateTransactionRequest>,
) -> Result<Json<Transaction>, ApiError> {
    // Validate
    payload.validate()?;

    // Create transaction
    let transaction = state
        .transaction_service
        .create_transaction(user.id, payload)
        .await?;

    Ok(Json(transaction))
}

pub async fn get(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    user: AuthUser,
) -> Result<Json<Transaction>, ApiError> {
    let transaction = state
        .transaction_service
        .get_transaction(user.id, id)
        .await?;

    Ok(Json(transaction))
}
```

## Middleware

```rust
// api/middleware/auth.rs
use axum::{
    extract::State,
    http::{Request, StatusCode},
    middleware::Next,
    response::Response,
};

pub async fn require_auth<B>(
    State(state): State<AppState>,
    mut req: Request<B>,
    next: Next<B>,
) -> Result<Response, StatusCode> {
    // Extract token from Authorization header
    let token = req
        .headers()
        .get("Authorization")
        .and_then(|h| h.to_str().ok())
        .and_then(|h| h.strip_prefix("Bearer "))
        .ok_or(StatusCode::UNAUTHORIZED)?;

    // Verify JWT
    let claims = state
        .auth_service
        .verify_token(token)
        .map_err(|_| StatusCode::UNAUTHORIZED)?;

    // Add user to request extensions
    req.extensions_mut().insert(AuthUser {
        id: claims.user_id,
        email: claims.email,
    });

    Ok(next.run(req).await)
}
```

## Error Handling

```rust
// errors/api_error.rs
use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct ErrorResponse {
    pub error: String,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub details: Option<serde_json::Value>,
}

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

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        let (status, error_type, message) = match self {
            ApiError::Database(e) => {
                tracing::error!("Database error: {:?}", e);
                (StatusCode::INTERNAL_SERVER_ERROR, "database_error", "Database error occurred")
            }
            ApiError::NotFound(msg) => {
                (StatusCode::NOT_FOUND, "not_found", msg.as_str())
            }
            ApiError::Unauthorized(msg) => {
                (StatusCode::UNAUTHORIZED, "unauthorized", msg.as_str())
            }
            ApiError::Validation(msg) => {
                (StatusCode::BAD_REQUEST, "validation_error", msg.as_str())
            }
            ApiError::Internal => {
                (StatusCode::INTERNAL_SERVER_ERROR, "internal_error", "Internal server error")
            }
        };

        let body = Json(ErrorResponse {
            error: error_type.to_string(),
            message: message.to_string(),
            details: None,
        });

        (status, body).into_response()
    }
}
```

## Application State

```rust
// lib.rs
use diesel::r2d2::{self, ConnectionManager};
use diesel::PgConnection;

pub type DbPool = r2d2::Pool<ConnectionManager<PgConnection>>;

#[derive(Clone)]
pub struct AppState {
    pub db: DbPool,
    pub config: Config,
}

impl AppState {
    pub fn transaction_service(&self) -> TransactionService {
        TransactionService::new(self.db.clone())
    }

    pub fn account_service(&self) -> AccountService {
        AccountService::new(self.db.clone())
    }

    // ... other services
}
```

## Configuration

```rust
// config.rs
use serde::Deserialize;

#[derive(Debug, Clone, Deserialize)]
pub struct Config {
    pub host: String,
    pub port: u16,
    pub database_url: String,
    pub jwt_secret: String,
    pub jwt_expiration: i64,
}

impl Config {
    pub fn from_env() -> Result<Self> {
        config::Config::builder()
            .add_source(config::Environment::default())
            .build()?
            .try_deserialize()
            .map_err(Into::into)
    }
}
```

## Dependencies (Cargo.toml)

```toml
[package]
name = "master-of-coin-backend"
version = "0.1.0"
edition = "2021"

[dependencies]
# Web framework
axum = "0.7"
tokio = { version = "1", features = ["full"] }
tower = "0.4"
tower-http = { version = "0.5", features = ["cors", "trace"] }

# Database
diesel = { version = "2.1", features = ["postgres", "uuid", "chrono", "numeric"] }
diesel_migrations = "2.1"

# Serialization
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"

# Authentication
jsonwebtoken = "9.2"
argon2 = "0.5"

# Validation
validator = { version = "0.16", features = ["derive"] }

# Error handling
thiserror = "1.0"
anyhow = "1.0"

# Logging
tracing = "0.1"
tracing-subscriber = { version = "0.3", features = ["env-filter"] }

# Configuration
config = "0.13"

# UUID
uuid = { version = "1.6", features = ["serde", "v4"] }

# Date/Time
chrono = { version = "0.4", features = ["serde"] }

[dev-dependencies]
reqwest = "0.11"
```

## Database Operations in Async Context

Since Diesel is synchronous, database operations in async handlers require `tokio::task::spawn_blocking`:

```rust
use tokio::task;

pub async fn get_transaction(
    pool: &DbPool,
    user_id: Uuid,
    transaction_id: Uuid,
) -> Result<Transaction, ApiError> {
    let pool = pool.clone();

    task::spawn_blocking(move || {
        use crate::schema::transactions::dsl::*;
        let mut conn = pool.get()?;

        transactions
            .filter(id.eq(transaction_id))
            .filter(user_id.eq(user_id))
            .first(&mut conn)
    })
    .await
    .map_err(|_| ApiError::Internal)?
}
```

## Summary

- ✅ Clean layered architecture (API → Service → Repository)
- ✅ Type-safe with Rust and Diesel ORM
- ✅ Async/await with Tokio (using `spawn_blocking` for database)
- ✅ JWT authentication
- ✅ Structured error handling
- ✅ Middleware for cross-cutting concerns
- ✅ Configuration management
- ✅ Logging and tracing
- ✅ RESTful API design
- ✅ Compile-time query validation with Diesel
