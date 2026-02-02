use diesel::prelude::*;
use diesel::r2d2::{ConnectionManager, Pool, PooledConnection};
use diesel_migrations::{EmbeddedMigrations, MigrationHarness, embed_migrations};
use std::time::Duration;

/// Type alias for the database connection pool
pub type DbPool = Pool<ConnectionManager<PgConnection>>;

/// Type alias for a pooled database connection
pub type DbConnection = PooledConnection<ConnectionManager<PgConnection>>;

/// Embedded migrations from the migrations directory
pub const MIGRATIONS: EmbeddedMigrations = embed_migrations!("migrations");

/// Create a PostgreSQL connection pool with the specified configuration
///
/// # Arguments``
/// * `database_url` - The PostgreSQL connection string
/// * `max_connections` - Maximum number of connections in the pool (default: 10)
///
/// # Returns
/// A configured DbPool or an error if connection fails
///
/// # Example
/// ```no_run
/// use master_of_coin_backend::db::create_pool;
///
/// let database_url = "postgresql://user:password@localhost/dbname";
/// let pool = create_pool(database_url, 10).expect("Failed to create pool");
/// ```
pub fn create_pool(
    database_url: &str,
    max_connections: u32,
) -> Result<DbPool, diesel::r2d2::Error> {
    let manager = ConnectionManager::<PgConnection>::new(database_url);

    Pool::builder()
        .max_size(max_connections)
        .connection_timeout(Duration::from_secs(30))
        .build(manager)
        .map_err(|e| {
            // Convert r2d2::Error to diesel::r2d2::Error
            // Since there's no direct conversion, we wrap it as a ConnectionError
            diesel::r2d2::Error::ConnectionError(diesel::ConnectionError::BadConnection(
                e.to_string(),
            ))
        })
}

/// Run database migrations
///
/// # Arguments
/// * `connection` - A mutable reference to a database connection
///
/// # Returns
/// Ok(()) if migrations succeed, or an error if they fail
///
/// # Example
/// ```no_run
/// use master_of_coin_backend::db::{create_pool, run_migrations};
///
/// let pool = create_pool("postgresql://localhost/dbname", 10).unwrap();
/// let mut conn = pool.get().unwrap();
/// run_migrations(&mut conn).expect("Failed to run migrations");
/// ```
pub fn run_migrations(
    connection: &mut PgConnection,
) -> Result<(), Box<dyn std::error::Error + Send + Sync + 'static>> {
    connection.run_pending_migrations(MIGRATIONS)?;
    Ok(())
}

/// Helper function to get a database connection from the pool in an async context
///
/// Since Diesel is synchronous and the application uses async (tokio/axum),
/// database operations should be wrapped in `tokio::task::spawn_blocking`.
///
/// # Arguments
/// * `pool` - Reference to the database connection pool
///
/// # Returns
/// A pooled database connection or an error
///
/// # Example
/// ```no_run
/// use master_of_coin_backend::db::{create_pool, get_connection};
///
/// async fn example() {
///     let pool = create_pool("postgresql://localhost/dbname", 10).unwrap();
///     
///     // Use spawn_blocking for database operations
///     let result = tokio::task::spawn_blocking(move || {
///         let mut conn = pool.get().expect("Failed to get connection");
///         // Perform database operations here
///         // Example: users::table.load::<User>(&mut conn)
///     }).await;
/// }
/// ```
pub fn get_connection(pool: &DbPool) -> Result<DbConnection, diesel::r2d2::Error> {
    pool.get().map_err(|e| {
        // Convert r2d2::Error to diesel::r2d2::Error
        diesel::r2d2::Error::ConnectionError(diesel::ConnectionError::BadConnection(e.to_string()))
    })
}
