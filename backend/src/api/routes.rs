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
//!
//! Protected routes automatically require a valid JWT token or API key in the
//! `Authorization: Bearer <token>` header.
use crate::{AppState, handlers, middleware::auth::require_auth};
use axum::{
    Router, middleware,
    routing::{get, post, put},
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
        .route("/auth/login", post(handlers::auth::login));

    // Protected routes (authentication required)
    let protected_routes = Router::new()
        // Auth routes
        .route("/auth/me", get(handlers::auth::get_current_user))
        // Dashboard
        .route("/dashboard", get(handlers::dashboard::get_summary))
        // Transactions
        .route(
            "/transactions",
            get(handlers::transactions::list).post(handlers::transactions::create),
        )
        .route(
            "/transactions/:id",
            get(handlers::transactions::get)
                .put(handlers::transactions::update)
                .delete(handlers::transactions::delete),
        )
        // Accounts
        .route(
            "/accounts",
            get(handlers::accounts::list).post(handlers::accounts::create),
        )
        .route(
            "/accounts/:id",
            get(handlers::accounts::get)
                .put(handlers::accounts::update)
                .delete(handlers::accounts::delete),
        )
        // Budgets
        .route(
            "/budgets",
            get(handlers::budgets::list).post(handlers::budgets::create),
        )
        .route(
            "/budgets/:id",
            get(handlers::budgets::get)
                .put(handlers::budgets::update)
                .delete(handlers::budgets::delete),
        )
        .route("/budgets/:id/ranges", post(handlers::budgets::add_range))
        // People
        .route(
            "/people",
            get(handlers::people::list).post(handlers::people::create),
        )
        .route(
            "/people/:id",
            get(handlers::people::get)
                .put(handlers::people::update)
                .delete(handlers::people::delete),
        )
        .route("/people/:id/debts", get(handlers::people::get_debts))
        .route("/people/:id/settle", post(handlers::people::settle_debt))
        // Categories
        .route(
            "/categories",
            get(handlers::categories::list).post(handlers::categories::create),
        )
        .route(
            "/categories/:id",
            put(handlers::categories::update).delete(handlers::categories::delete),
        )
        // API Keys
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
