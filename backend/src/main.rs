use axum::middleware;
use diesel::PgConnection;
use diesel::r2d2::{self, ConnectionManager};
use diesel_migrations::{EmbeddedMigrations, MigrationHarness, embed_migrations};
use tracing_subscriber::EnvFilter;

pub const MIGRATIONS: EmbeddedMigrations = embed_migrations!("migrations");

#[tokio::main]
async fn main() {
    // Load environment variables from .env file if present
    dotenvy::dotenv().ok();

    // 1. Initialize logging with environment filter
    tracing_subscriber::fmt()
        .with_env_filter(
            EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info")),
        )
        .init();

    tracing::info!("🚀 Master of Coin Backend starting...");

    // 2. Load configuration from environment
    let config = master_of_coin_backend::Config::from_env().expect("Failed to load configuration");

    tracing::info!(
        "Configuration loaded - Server: {}:{}",
        config.server.host,
        config.server.port
    );

    // 3. Create database connection pool
    let database_url = &config.database.url;
    let manager = ConnectionManager::<PgConnection>::new(database_url);
    let pool = r2d2::Pool::builder()
        .max_size(config.database.max_connections)
        .build(manager)
        .expect("Failed to create database pool");

    tracing::info!(
        "Database pool created with max {} connections",
        config.database.max_connections
    );

    // 4. Run pending migrations
    {
        let mut conn = pool.get().expect("Failed to get database connection");
        conn.run_pending_migrations(MIGRATIONS)
            .expect("Failed to run database migrations");
        tracing::info!("✅ Database migrations completed successfully");
    }

    // 5. Build application state
    let state = master_of_coin_backend::AppState::new(pool, config.clone());

    // 6. Create router with middleware layers
    // Middleware is applied in reverse order (bottom to top):
    // - Routes with auth middleware (innermost, applied in routes.rs)
    // - Request logging middleware
    // - CORS middleware (outermost)
    let app = master_of_coin_backend::api::routes::create_router(state)
        .layer(middleware::from_fn(
            master_of_coin_backend::middleware::logging::log_request,
        ))
        .layer(master_of_coin_backend::middleware::cors::create_cors_layer());

    // 7. Bind to configured address and start server
    let addr = format!("{}:{}", config.server.host, config.server.port);
    let listener = tokio::net::TcpListener::bind(&addr)
        .await
        .unwrap_or_else(|e| {
            tracing::error!("Failed to bind to {}: {}", addr, e);
            std::process::exit(1);
        });

    tracing::info!("🚀 Server listening on {}", addr);
    tracing::info!(
        "📝 API documentation will be available at http://{}/api/docs",
        addr
    );
    tracing::info!("✨ Ready to accept requests!");

    // Start server with graceful shutdown capability
    axum::serve(listener, app).await.unwrap_or_else(|e| {
        tracing::error!("Server error: {}", e);
        std::process::exit(1);
    });
}
