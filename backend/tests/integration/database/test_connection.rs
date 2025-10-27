use super::common;

use master_of_coin_backend::db::{create_pool, get_connection, run_migrations};
use serial_test::serial;

#[test]
#[serial]
fn test_database_connection() {
    let database_url = common::get_test_database_url();
    let pool = create_pool(&database_url, 5);

    assert!(pool.is_ok(), "Failed to create connection pool");

    let pool = pool.unwrap();
    let conn = get_connection(&pool);

    assert!(conn.is_ok(), "Failed to get connection from pool");
}

#[test]
#[serial]
fn test_connection_pool_settings() {
    let database_url = common::get_test_database_url();
    let max_connections = 3;
    let pool = create_pool(&database_url, max_connections).expect("Failed to create pool");

    // Verify we can get multiple connections
    let conn1 = pool.get();
    let conn2 = pool.get();
    let conn3 = pool.get();

    assert!(conn1.is_ok(), "Failed to get first connection");
    assert!(conn2.is_ok(), "Failed to get second connection");
    assert!(conn3.is_ok(), "Failed to get third connection");
}

#[test]
#[serial]
fn test_migrations() {
    let database_url = common::get_test_database_url();
    let pool = create_pool(&database_url, 5).expect("Failed to create pool");
    let mut conn = pool.get().expect("Failed to get connection");

    let result = run_migrations(&mut conn);
    assert!(
        result.is_ok(),
        "Failed to run migrations: {:?}",
        result.err()
    );
}
