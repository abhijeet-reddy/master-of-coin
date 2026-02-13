//! API routing configuration.
//!
//! This module defines all HTTP routes for the application, organized into
//! public and protected route groups.
//!
//! ## Route Structure
//!
//! All routes are prefixed with `/api/v1`:
//!
//! ### Public Routes (No Authentication)
//! - `POST /api/v1/auth/register` - User registration
//! - `POST /api/v1/auth/login` - User login
//! - `GET /api/v1/integrations/splitwise/callback` - Handle Splitwise OAuth callback (user identified via encrypted state)
//!
//! ### Protected Routes (Authentication Required)
//! - `GET /api/v1/auth/me` - Get current user
//! - `GET /api/v1/dashboard` - Dashboard summary
//! - `/api/v1/transactions/*` - Transaction management
//! - `/api/v1/accounts/*` - Account management
//! - `/api/v1/budgets/*` - Budget management
//! - `/api/v1/people/*` - People and debt management
//! - `/api/v1/categories/*` - Category management
//! - `/api/v1/api-keys/*` - API key management
//! - `/api/v1/integrations/*` - Split provider integrations
//!
//! ### Integration Routes (Authentication Required)
//! - `GET /api/v1/integrations/splitwise/auth-url` - Get Splitwise OAuth URL
//! - `GET /api/v1/integrations/splitwise/callback` - Handle Splitwise OAuth callback
//! - `GET /api/v1/integrations/splitwise/friends` - List Splitwise friends
//! - `GET /api/v1/integrations/providers` - List configured providers
//! - `DELETE /api/v1/integrations/providers/:id` - Disconnect a provider
//! - `GET /api/v1/integrations/providers/:id/friends` - Get provider friends
//!
//! ### Person Split Config Routes (Authentication Required)
//! - `PUT /api/v1/people/:id/split-config` - Set split provider config for person
//! - `GET /api/v1/people/:id/split-config` - Get split provider config for person
//! - `DELETE /api/v1/people/:id/split-config` - Delete split provider config for person
//!
//! ### Split Sync Routes (Authentication Required)
//! - `GET /api/v1/splits/:id/sync-status` - Get sync status for a split
//! - `POST /api/v1/splits/:id/retry-sync` - Retry a failed sync
//!
//! Protected routes automatically require a valid JWT token or API key in the
//! `Authorization: Bearer <token>` header.
//!
//! ## Scope Enforcement
//!
//! API keys are subject to scope-based authorization. Each route checks if the
//! API key has the required permission (read or write) for the resource type.
//! JWT tokens have full access to all resources.
use crate::{
    AppState, handlers,
    middleware::{auth::require_auth, scope::require_scope},
    models::{OperationType, ResourceType},
};
use axum::{
    Router, middleware,
    routing::{delete, get, post, put},
};
use std::path::PathBuf;
use tower_http::services::{ServeDir, ServeFile};

/// Creates the main application router with all API routes.
///
/// This function sets up both public and protected routes, applies authentication
/// middleware to protected routes, and nests everything under the `/api/v1` prefix.
///
/// # Arguments
///
/// * `state` - Application state containing database pool and configuration
///
/// # Returns
///
/// A configured [`Router`] ready to be served by Axum
pub fn create_router(state: AppState) -> Router {
    // Public routes (no authentication required)
    let auth_routes = Router::new()
        .route("/auth/register", post(handlers::auth::register))
        .route("/auth/login", post(handlers::auth::login))
        // Splitwise OAuth callback - must be public since it's a browser redirect from Splitwise
        // User identity is verified via encrypted state parameter
        .route(
            "/integrations/splitwise/callback",
            get(handlers::splitwise_integration::oauth_callback),
        );

    // Protected routes (authentication required)
    let protected_routes = Router::new()
        // Auth routes (no scope check needed - always accessible)
        .route("/auth/me", get(handlers::auth::get_current_user))
        // Dashboard (no scope check - read-only summary)
        .route("/dashboard", get(handlers::dashboard::get_summary))
        // Exchange rates (no scope check - read-only utility)
        .route(
            "/exchange-rates",
            get(handlers::exchange_rates::get_exchange_rates),
        )
        // Transactions - with scope enforcement
        .route(
            "/transactions",
            get(handlers::transactions::list).layer(middleware::from_fn(|auth, req, next| {
                require_scope(
                    ResourceType::Transactions,
                    OperationType::Read,
                    auth,
                    req,
                    next,
                )
            })),
        )
        .route(
            "/transactions",
            post(handlers::transactions::create).layer(middleware::from_fn(|auth, req, next| {
                require_scope(
                    ResourceType::Transactions,
                    OperationType::Write,
                    auth,
                    req,
                    next,
                )
            })),
        )
        .route(
            "/transactions/:id",
            get(handlers::transactions::get).layer(middleware::from_fn(|auth, req, next| {
                require_scope(
                    ResourceType::Transactions,
                    OperationType::Read,
                    auth,
                    req,
                    next,
                )
            })),
        )
        .route(
            "/transactions/:id",
            put(handlers::transactions::update).layer(middleware::from_fn(|auth, req, next| {
                require_scope(
                    ResourceType::Transactions,
                    OperationType::Write,
                    auth,
                    req,
                    next,
                )
            })),
        )
        .route(
            "/transactions/:id",
            delete(handlers::transactions::delete).layer(middleware::from_fn(|auth, req, next| {
                require_scope(
                    ResourceType::Transactions,
                    OperationType::Write,
                    auth,
                    req,
                    next,
                )
            })),
        )
        // Bulk create transactions (general purpose)
        .route(
            "/transactions/bulk-create",
            post(handlers::transactions::bulk_create).layer(middleware::from_fn(
                |auth, req, next| {
                    require_scope(
                        ResourceType::Transactions,
                        OperationType::Write,
                        auth,
                        req,
                        next,
                    )
                },
            )),
        )
        // Import routes - CSV parsing
        .route(
            "/transactions/import/parse",
            post(handlers::import::parse_csv).layer(middleware::from_fn(|auth, req, next| {
                require_scope(
                    ResourceType::Transactions,
                    OperationType::Write,
                    auth,
                    req,
                    next,
                )
            })),
        )
        // Accounts - with scope enforcement
        .route(
            "/accounts",
            get(handlers::accounts::list).layer(middleware::from_fn(|auth, req, next| {
                require_scope(ResourceType::Accounts, OperationType::Read, auth, req, next)
            })),
        )
        .route(
            "/accounts",
            post(handlers::accounts::create).layer(middleware::from_fn(|auth, req, next| {
                require_scope(
                    ResourceType::Accounts,
                    OperationType::Write,
                    auth,
                    req,
                    next,
                )
            })),
        )
        .route(
            "/accounts/:id",
            get(handlers::accounts::get).layer(middleware::from_fn(|auth, req, next| {
                require_scope(ResourceType::Accounts, OperationType::Read, auth, req, next)
            })),
        )
        .route(
            "/accounts/:id",
            put(handlers::accounts::update).layer(middleware::from_fn(|auth, req, next| {
                require_scope(
                    ResourceType::Accounts,
                    OperationType::Write,
                    auth,
                    req,
                    next,
                )
            })),
        )
        .route(
            "/accounts/:id",
            delete(handlers::accounts::delete).layer(middleware::from_fn(|auth, req, next| {
                require_scope(
                    ResourceType::Accounts,
                    OperationType::Write,
                    auth,
                    req,
                    next,
                )
            })),
        )
        // Budgets - with scope enforcement
        .route(
            "/budgets",
            get(handlers::budgets::list).layer(middleware::from_fn(|auth, req, next| {
                require_scope(ResourceType::Budgets, OperationType::Read, auth, req, next)
            })),
        )
        .route(
            "/budgets",
            post(handlers::budgets::create).layer(middleware::from_fn(|auth, req, next| {
                require_scope(ResourceType::Budgets, OperationType::Write, auth, req, next)
            })),
        )
        .route(
            "/budgets/:id",
            get(handlers::budgets::get).layer(middleware::from_fn(|auth, req, next| {
                require_scope(ResourceType::Budgets, OperationType::Read, auth, req, next)
            })),
        )
        .route(
            "/budgets/:id",
            put(handlers::budgets::update).layer(middleware::from_fn(|auth, req, next| {
                require_scope(ResourceType::Budgets, OperationType::Write, auth, req, next)
            })),
        )
        .route(
            "/budgets/:id",
            delete(handlers::budgets::delete).layer(middleware::from_fn(|auth, req, next| {
                require_scope(ResourceType::Budgets, OperationType::Write, auth, req, next)
            })),
        )
        .route(
            "/budgets/:id/ranges",
            post(handlers::budgets::add_range).layer(middleware::from_fn(|auth, req, next| {
                require_scope(ResourceType::Budgets, OperationType::Write, auth, req, next)
            })),
        )
        // People - with scope enforcement
        .route(
            "/people",
            get(handlers::people::list).layer(middleware::from_fn(|auth, req, next| {
                require_scope(ResourceType::People, OperationType::Read, auth, req, next)
            })),
        )
        .route(
            "/people",
            post(handlers::people::create).layer(middleware::from_fn(|auth, req, next| {
                require_scope(ResourceType::People, OperationType::Write, auth, req, next)
            })),
        )
        .route(
            "/people/:id",
            get(handlers::people::get).layer(middleware::from_fn(|auth, req, next| {
                require_scope(ResourceType::People, OperationType::Read, auth, req, next)
            })),
        )
        .route(
            "/people/:id",
            put(handlers::people::update).layer(middleware::from_fn(|auth, req, next| {
                require_scope(ResourceType::People, OperationType::Write, auth, req, next)
            })),
        )
        .route(
            "/people/:id",
            delete(handlers::people::delete).layer(middleware::from_fn(|auth, req, next| {
                require_scope(ResourceType::People, OperationType::Write, auth, req, next)
            })),
        )
        .route(
            "/people/:id/debts",
            get(handlers::people::get_debts).layer(middleware::from_fn(|auth, req, next| {
                require_scope(ResourceType::People, OperationType::Read, auth, req, next)
            })),
        )
        .route(
            "/people/:id/settle",
            post(handlers::people::settle_debt).layer(middleware::from_fn(|auth, req, next| {
                require_scope(ResourceType::People, OperationType::Write, auth, req, next)
            })),
        )
        // Person split config routes - with scope enforcement (uses People scope)
        .route(
            "/people/:id/split-config",
            get(handlers::people::get_split_config).layer(middleware::from_fn(
                |auth, req, next| {
                    require_scope(ResourceType::People, OperationType::Read, auth, req, next)
                },
            )),
        )
        .route(
            "/people/:id/split-config",
            put(handlers::people::set_split_config).layer(middleware::from_fn(
                |auth, req, next| {
                    require_scope(ResourceType::People, OperationType::Write, auth, req, next)
                },
            )),
        )
        .route(
            "/people/:id/split-config",
            delete(handlers::people::delete_split_config).layer(middleware::from_fn(
                |auth, req, next| {
                    require_scope(ResourceType::People, OperationType::Write, auth, req, next)
                },
            )),
        )
        // Categories - with scope enforcement
        .route(
            "/categories",
            get(handlers::categories::list).layer(middleware::from_fn(|auth, req, next| {
                require_scope(
                    ResourceType::Categories,
                    OperationType::Read,
                    auth,
                    req,
                    next,
                )
            })),
        )
        .route(
            "/categories",
            post(handlers::categories::create).layer(middleware::from_fn(|auth, req, next| {
                require_scope(
                    ResourceType::Categories,
                    OperationType::Write,
                    auth,
                    req,
                    next,
                )
            })),
        )
        .route(
            "/categories/:id",
            put(handlers::categories::update).layer(middleware::from_fn(|auth, req, next| {
                require_scope(
                    ResourceType::Categories,
                    OperationType::Write,
                    auth,
                    req,
                    next,
                )
            })),
        )
        .route(
            "/categories/:id",
            delete(handlers::categories::delete).layer(middleware::from_fn(|auth, req, next| {
                require_scope(
                    ResourceType::Categories,
                    OperationType::Write,
                    auth,
                    req,
                    next,
                )
            })),
        )
        // Split sync status - with scope enforcement (uses Transactions scope)
        .route(
            "/splits/:id/sync-status",
            get(handlers::split_sync::get_sync_status).layer(middleware::from_fn(
                |auth, req, next| {
                    require_scope(
                        ResourceType::Transactions,
                        OperationType::Read,
                        auth,
                        req,
                        next,
                    )
                },
            )),
        )
        .route(
            "/splits/:id/retry-sync",
            post(handlers::split_sync::retry_sync).layer(middleware::from_fn(|auth, req, next| {
                require_scope(
                    ResourceType::Transactions,
                    OperationType::Write,
                    auth,
                    req,
                    next,
                )
            })),
        )
        // Splitwise OAuth integration routes (no scope check - always accessible)
        // Note: callback route is in public routes (auth_routes) since it's a browser redirect
        .route(
            "/integrations/splitwise/auth-url",
            get(handlers::splitwise_integration::get_auth_url),
        )
        .route(
            "/integrations/splitwise/friends",
            get(handlers::splitwise_integration::list_splitwise_friends),
        )
        // Provider management routes (no scope check - always accessible)
        .route(
            "/integrations/providers",
            get(handlers::split_providers::list_providers),
        )
        .route(
            "/integrations/providers/:id",
            delete(handlers::split_providers::disconnect_provider),
        )
        .route(
            "/integrations/providers/:id/friends",
            get(handlers::split_providers::get_provider_friends),
        )
        // API Keys - no scope enforcement (always accessible to authenticated users)
        // API keys cannot manage other API keys via API key authentication
        .route(
            "/api-keys",
            get(handlers::api_keys::list).post(handlers::api_keys::create),
        )
        .route(
            "/api-keys/:id",
            get(handlers::api_keys::get)
                .patch(handlers::api_keys::update)
                .delete(handlers::api_keys::revoke),
        )
        // Apply authentication middleware to all protected routes
        .layer(middleware::from_fn_with_state(
            state.db.clone(),
            require_auth,
        ));

    // API routes under /api/v1 prefix
    let api_routes = Router::new()
        .nest("/api/v1", auth_routes.merge(protected_routes))
        .with_state(state.clone());

    // Static file serving for frontend with SPA fallback
    // ServeDir will serve files if they exist, otherwise fall back to index.html for SPA routing
    let static_dir = PathBuf::from("/app/static");
    let index_file = PathBuf::from("/app/static/index.html");

    let serve_dir = ServeDir::new(&static_dir)
        .append_index_html_on_directories(true)
        .not_found_service(ServeFile::new(&index_file));

    // Combine API routes with static file serving
    // API routes take precedence, then ServeDir handles everything else (including SPA fallback)
    Router::new().merge(api_routes).fallback_service(serve_dir)
}
