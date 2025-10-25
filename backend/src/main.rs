mod config;
mod db;

use config::Config;

#[tokio::main]
async fn main() {
    dotenvy::dotenv().ok();

    let config = Config::from_env().expect("Failed to load configuration");
    config.validate().expect("Invalid configuration");

    // Initialize tracing
    tracing_subscriber::fmt()
        .with_env_filter(std::env::var("RUST_LOG").unwrap_or_else(|_| "info".to_string()))
        .init();

    tracing::info!("Master of Coin Backend starting...");
    tracing::info!(
        "Server will run on {}:{}",
        config.server.host,
        config.server.port
    );
    tracing::info!("Configuration loaded and validated successfully");
}
