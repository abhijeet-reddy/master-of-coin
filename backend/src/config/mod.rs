//! Application configuration management.
//!
//! This module handles loading and validating configuration from environment variables.
//! Configuration is loaded from a `.env` file (if present) and environment variables.
//!
//! ## Required Environment Variables
//!
//! - `DATABASE_URL`: PostgreSQL connection string
//! - `JWT_SECRET`: Secret key for JWT token signing (minimum 32 characters)
//!
//! ## Optional Environment Variables
//!
//! - `SERVER_HOST`: Server bind address (default: "127.0.0.1")
//! - `SERVER_PORT`: Server port (default: "13153")
//! - `DATABASE_MAX_CONNECTIONS`: Maximum database connections (default: 10)
//! - `JWT_EXPIRATION_HOURS`: JWT token expiration in hours (default: 24)

use serde::Deserialize;

/// Main configuration structure containing all application settings
#[derive(Debug, Clone, Deserialize)]
pub struct Config {
    pub server: ServerConfig,
    pub database: DatabaseConfig,
    pub jwt: JwtConfig,
}

/// Server configuration
#[derive(Debug, Clone, Deserialize)]
pub struct ServerConfig {
    pub host: String,
    pub port: u16,
}

/// Database configuration
#[derive(Debug, Clone, Deserialize)]
pub struct DatabaseConfig {
    pub url: String,
    pub max_connections: u32,
}

/// JWT configuration
#[derive(Debug, Clone, Deserialize)]
pub struct JwtConfig {
    pub secret: String,
    pub expiration_hours: i64,
}

impl Config {
    /// Load configuration from environment variables
    pub fn from_env() -> Result<Self, ConfigError> {
        // Load .env file if it exists
        dotenvy::dotenv().ok();

        let config = Config {
            server: ServerConfig {
                host: std::env::var("SERVER_HOST").unwrap_or_else(|_| "127.0.0.1".to_string()),
                port: std::env::var("SERVER_PORT")
                    .unwrap_or_else(|_| "13153".to_string())
                    .parse()
                    .map_err(|_| ConfigError::InvalidPort)?,
            },
            database: DatabaseConfig {
                url: std::env::var("DATABASE_URL")
                    .map_err(|_| ConfigError::MissingEnvVar("DATABASE_URL".to_string()))?,
                max_connections: std::env::var("DATABASE_MAX_CONNECTIONS")
                    .unwrap_or_else(|_| "10".to_string())
                    .parse()
                    .unwrap_or(10),
            },
            jwt: JwtConfig {
                secret: std::env::var("JWT_SECRET")
                    .map_err(|_| ConfigError::MissingEnvVar("JWT_SECRET".to_string()))?,
                expiration_hours: std::env::var("JWT_EXPIRATION_HOURS")
                    .unwrap_or_else(|_| "24".to_string())
                    .parse()
                    .unwrap_or(24),
            },
        };

        // Validate configuration
        config.validate()?;

        Ok(config)
    }

    /// Validate configuration
    fn validate(&self) -> Result<(), ConfigError> {
        if self.jwt.secret.len() < 32 {
            return Err(ConfigError::InvalidConfig(
                "JWT secret must be at least 32 characters".to_string(),
            ));
        }

        if self.jwt.expiration_hours <= 0 {
            return Err(ConfigError::InvalidConfig(
                "JWT expiration must be positive".to_string(),
            ));
        }

        if self.database.max_connections == 0 {
            return Err(ConfigError::InvalidConfig(
                "Database max connections must be greater than 0".to_string(),
            ));
        }

        if self.server.port == 0 {
            return Err(ConfigError::InvalidConfig(
                "Server port must be greater than 0".to_string(),
            ));
        }

        Ok(())
    }
}

/// Configuration errors
#[derive(Debug)]
pub enum ConfigError {
    MissingEnvVar(String),
    InvalidPort,
    InvalidConfig(String),
}

impl std::fmt::Display for ConfigError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ConfigError::MissingEnvVar(var) => write!(f, "Missing environment variable: {}", var),
            ConfigError::InvalidPort => write!(f, "Invalid port number"),
            ConfigError::InvalidConfig(msg) => write!(f, "Invalid configuration: {}", msg),
        }
    }
}

impl std::error::Error for ConfigError {}
