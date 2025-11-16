// Database integration tests
//
// These tests validate database operations including:
// - Connection pooling
// - Custom type serialization/deserialization
// - CRUD operations
// - Relationships between models
// - Transaction handling
// - Async/sync bridge pattern

#[path = "../common/mod.rs"]
mod common;

mod test_async_bridge;
mod test_connection;
mod test_custom_types;
mod test_relationships;
mod test_transactions;
mod test_user_crud;
