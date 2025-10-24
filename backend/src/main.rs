mod config;
mod db;

use config::Config;

#[tokio::main]
async fn main() {
    dotenv::dotenv().ok();

    let config = Config::from_env().expect("Failed to load configuration");

    tracing_subscriber::fmt()
        .with_env_filter(&config.rust_log)
        .init();

    println!("Master of Coin Backend");
    println!("Configuration loaded successfully");
}
