# Database Selection

## Choice: PostgreSQL 16

### Justification

**Why PostgreSQL:**

1. **ACID Compliance**
   - Critical for financial data integrity
   - Transactions ensure consistency
   - No data loss on crashes

2. **Complex Queries**
   - Excellent for aggregations (dashboard, reports)
   - Window functions for financial calculations
   - CTEs for complex analytics
   - Full-text search for transactions

3. **JSON Support**
   - JSONB for flexible budget filters
   - Indexed JSON queries
   - Schema flexibility where needed

4. **Scalability**
   - Can handle millions of transactions
   - Partitioning support for growth
   - Read replicas if needed

5. **Mature & Reliable**
   - Battle-tested in production
   - Excellent tooling
   - Strong community support

6. **Type System**
   - ENUMs for account types, currencies
   - Custom types support
   - Strong data validation

**Why NOT MongoDB:**
- Financial data needs ACID guarantees
- Complex relationships (accounts, transactions, people, budgets)
- Need for complex joins and aggregations
- Schema validation important for financial data

**Why NOT SQLite:**
- Limited concurrent writes
- No built-in replication
- Less suitable for production
- Harder to scale

## Performance Characteristics

For 1-2 users with high transaction volume:
- Insert: < 10ms per transaction
- Query: < 50ms for filtered lists
- Aggregation: < 200ms for dashboard
- Bulk operations: Efficient with batch inserts

## Scaling Strategy

### Current (1-2 users)
- Single PostgreSQL instance
- Connection pooling (5-20 connections)
- Basic indexing

### Future (if needed)
- Read replicas for analytics
- Partitioning by date
- Materialized views for dashboards
- Connection pooling optimization
