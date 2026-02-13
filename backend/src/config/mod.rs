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
//!
//! ## Optional Integration Environment Variables
//!
//! - `ENCRYPTION_KEY`: AES-256-GCM encryption key for provider credentials (base64-encoded)
//! - `SPLITWISE_CLIENT_ID`: Splitwise OAuth2 client ID
//! - `SPLITWISE_CLIENT_SECRET`: Splitwise OAuth2 client secret
//! - `SPLITWISE_REDIRECT_URI`: Splitwise OAuth2 redirect URI

use serde::Deserialize;

/// Main configuration structure containing all application settings
#[derive(Debug, Clone, Deserialize)]
pub struct Config {
    pub server: ServerConfig,
    pub database: DatabaseConfig,
    pub jwt: JwtConfig,
    pub import: ImportConfig,
    pub splitwise: Option<SplitwiseConfig>,
    pub encryption_key_configured: bool,
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

/// Import configuration
#[derive(Debug, Clone, Deserialize)]
pub struct ImportConfig {
    /// Maximum file size for uploads in bytes (default: 5MB)
    pub max_file_size: usize,
    /// Maximum number of transactions per import (default: 1000)
    pub max_transactions: usize,
    /// Minimum confidence level for duplicate detection (default: "MEDIUM")
    pub duplicate_confidence_threshold: String,
}

impl Default for ImportConfig {
    fn default() -> Self {
        Self {
            max_file_size: 5 * 1024 * 1024, // 5MB
            max_transactions: 1000,
            duplicate_confidence_threshold: "MEDIUM".to_string(),
        }
    }
}

/// Splitwise OAuth2 configuration (optional - only needed for Splitwise integration)
#[derive(Debug, Clone, Deserialize)]
pub struct SplitwiseConfig {
    /// Splitwise OAuth2 client ID
    pub client_id: String,
    /// Splitwise OAuth2 client secret
    pub client_secret: String,
    /// Splitwise OAuth2 redirect URI
    pub redirect_uri: String,
}

impl Config {
    /// Load configuration from environment variables
    pub fn from_env() -> Result<Self, ConfigError> {
        // Load .env file if it exists
        dotenvy::dotenv().ok();

        // Load optional Splitwise OAuth configuration
        let splitwise = match (
            std::env::var("SPLITWISE_CLIENT_ID"),
            std::env::var("SPLITWISE_CLIENT_SECRET"),
            std::env::var("SPLITWISE_REDIRECT_URI"),
        ) {
            (Ok(client_id), Ok(client_secret), Ok(redirect_uri))
                if !client_id.is_empty()
                    && !client_id.starts_with("your_")
                    && !client_secret.is_empty()
                    && !client_secret.starts_with("your_") =>
            {
                Some(SplitwiseConfig {
                    client_id,
                    client_secret,
                    redirect_uri,
                })
            }
            _ => None,
        };

        // Check if encryption key is configured (needed for split provider credentials)
        let encryption_key_configured = std::env::var("ENCRYPTION_KEY")
            .map(|key| !key.is_empty() && !key.starts_with("generate_"))
            .unwrap_or(false);

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
            import: ImportConfig {
                max_file_size: std::env::var("IMPORT_MAX_FILE_SIZE")
                    .unwrap_or_else(|_| (5 * 1024 * 1024).to_string())
                    .parse()
                    .unwrap_or(5 * 1024 * 1024),
                max_transactions: std::env::var("IMPORT_MAX_TRANSACTIONS")
                    .unwrap_or_else(|_| "1000".to_string())
                    .parse()
                    .unwrap_or(1000),
                duplicate_confidence_threshold: std::env::var("IMPORT_DUPLICATE_THRESHOLD")
                    .unwrap_or_else(|_| "MEDIUM".to_string()),
            },
            splitwise,
            encryption_key_configured,
        };

        // Validate configuration
        config.validate()?;

        Ok(config)
    }

    /// Check if Splitwise integration is fully configured
    pub fn is_splitwise_configured(&self) -> bool {
        self.splitwise.is_some() && self.encryption_key_configured
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

        // Validate import config
        if self.import.max_file_size == 0 {
            return Err(ConfigError::InvalidConfig(
                "Import max file size must be greater than 0".to_string(),
            ));
        }

        if self.import.max_transactions == 0 {
            return Err(ConfigError::InvalidConfig(
                "Import max transactions must be greater than 0".to_string(),
            ));
        }

        // Validate duplicate confidence threshold using enum
        use crate::types::ConfidenceLevel;
        ConfidenceLevel::from_str(&self.import.duplicate_confidence_threshold)
            .map_err(|e| ConfigError::InvalidConfig(e))?;

        // Validate Splitwise config consistency: if Splitwise is configured, encryption key must be too
        if self.splitwise.is_some() && !self.encryption_key_configured {
            return Err(ConfigError::InvalidConfig(
                "ENCRYPTION_KEY must be configured when Splitwise OAuth is enabled. \
                 Generate one with: openssl rand -base64 32"
                    .to_string(),
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
