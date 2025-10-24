# Database Selection

## Choice: PostgreSQL 16

### Justification

**Why PostgreSQL:**

1. **ACID Compliance**

   - Critical for financial data integrity
   - Transactions ensure consistency
   - No data loss on crashes
   - Reliable for money-related operations

2. **Complex Queries**

   - Excellent for aggregations (dashboard, reports)
   - Window functions for financial calculations
   - CTEs (Common Table Expressions) for complex analytics
   - Full-text search capabilities for transactions
   - Efficient JOIN operations across related tables

3. **JSON Support**

   - JSONB for flexible budget filters
   - Indexed JSON queries with GIN indexes
   - Schema flexibility where needed
   - Allows dynamic filter structures without schema changes

4. **Scalability**

   - Can handle millions of transactions
   - Partitioning support for growth
   - Read replicas if needed
   - Proven performance at scale

5. **Mature & Reliable**

   - Battle-tested in production environments
   - Excellent tooling ecosystem
   - Strong community support
   - Regular updates and security patches

6. **Type System**

   - ENUMs for account types, currencies, budget periods
   - Custom types support
   - Strong data validation at database level
   - UUID support built-in

7. **Developer Experience**
   - Excellent Rust integration via SQLx
   - Compile-time query verification
   - Type-safe database operations
   - Great documentation

**Why NOT MongoDB:**

- Financial data needs ACID guarantees
- Complex relationships (accounts, transactions, people, budgets)
- Need for complex joins and aggregations
- Schema validation important for financial data
- Lack of true transactions across documents

**Why NOT SQLite:**

- Limited concurrent writes
- No built-in replication
- Less suitable for production deployments
- Harder to scale horizontally
- Limited user management features

**Why NOT MySQL:**

- PostgreSQL has better JSON support (JSONB)
- Superior handling of complex queries
- Better ENUM and custom type support
- More advanced indexing options

## Implementation Details

### Connection Management

- **SQLx**: Async Rust database library
- **Connection Pool**: Configured in backend
- **Migrations**: Managed via SQLx CLI
- **Type Safety**: Compile-time query verification

### Database Configuration

```rust
// Example from backend configuration
DATABASE_URL=postgresql://user:password@localhost:5432/master_of_coin
```

### Key Features Used

1. **UUID Extension**: `uuid-ossp` for UUID generation
2. **ENUM Types**: Custom types for account_type, currency_code, budget_period
3. **JSONB**: Flexible budget filters with GIN indexing
4. **Triggers**: Automatic `updated_at` timestamp management
5. **Constraints**: CHECK constraints for data validation
6. **Indexes**: Strategic indexing for query performance

## Performance Characteristics

For 1-2 users with high transaction volume:

- **Insert**: < 10ms per transaction
- **Query**: < 50ms for filtered lists
- **Aggregation**: < 200ms for dashboard calculations
- **Bulk operations**: Efficient with batch inserts
- **Index lookups**: Sub-millisecond for UUID primary keys

### Optimization Strategies Implemented

1. **Indexes**:

   - Foreign keys indexed for JOIN performance
   - Composite indexes on `(user_id, date DESC)` for transaction queries
   - GIN index on JSONB budget filters
   - Unique indexes on username and email

2. **Data Types**:

   - `DECIMAL(19, 2)` for precise monetary values
   - `TIMESTAMP WITH TIME ZONE` for proper timezone handling
   - `UUID` for globally unique identifiers
   - `JSONB` for flexible structured data

3. **Query Patterns**:
   - Efficient use of foreign key relationships
   - Optimized date range queries
   - Proper use of indexes in WHERE clauses

## Scaling Strategy

### Current (1-2 users)

- Single PostgreSQL instance
- Connection pooling (5-20 connections via SQLx)
- Strategic indexing on common query patterns
- Regular backups via `backup.sh` script

### Future (if needed)

- **Read replicas**: For analytics and reporting
- **Partitioning**: By date for transaction table
- **Materialized views**: For dashboard aggregations
- **Connection pooling optimization**: Adjust pool size based on load
- **Query optimization**: Use EXPLAIN ANALYZE for slow queries
- **Caching layer**: Redis for frequently accessed data

## Backup and Recovery

### Current Implementation

- **Backup Script**: [`backend/scripts/backup.sh`](../../../backend/scripts/backup.sh)
- **Restore Script**: [`backend/scripts/restore.sh`](../../../backend/scripts/restore.sh)
- **Format**: SQL dump files with timestamps
- **Storage**: Local `./backups/` directory

### Recommendations for Production

1. **Automated backups**: Daily scheduled backups
2. **Point-in-time recovery**: WAL (Write-Ahead Logging) archiving
3. **Retention policy**: 30 days of backups
4. **Off-site storage**: Cloud backup storage
5. **Regular testing**: Periodic restore testing

## Development Workflow

### Initial Setup

```bash
# Initialize database
./backend/scripts/init-db.sh

# This script:
# 1. Creates database if needed
# 2. Enables UUID extension
# 3. Runs all migrations
# 4. Loads seed data
```

### Running Migrations

```bash
cd backend
sqlx migrate run
```

### Creating New Migrations

```bash
cd backend
sqlx migrate add <migration_name>
```

### Seed Data

Test data includes:

- 1 test user (little-finger / knowledge-is-power)
- 8 default categories with icons and colors
- 3 sample accounts
- 2 sample people
- 10 sample transactions
- 1 sample budget with monthly range

See [`backend/scripts/seed.sql`](../../../backend/scripts/seed.sql) for details.
