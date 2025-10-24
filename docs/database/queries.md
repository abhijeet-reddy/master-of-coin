# Common Database Queries

## Overview

This document contains common SQL queries used in Master of Coin for reference and optimization purposes.

---

## User Queries

### Get User by Username

```sql
SELECT id, username, email, name, created_at, updated_at
FROM users
WHERE username = $1;
```

**Index Used:** `idx_users_username`

### Get User by Email

```sql
SELECT id, username, email, name, created_at, updated_at
FROM users
WHERE email = $1;
```

**Index Used:** `idx_users_email`

---

## Account Queries

### Get All User Accounts

```sql
SELECT id, name, account_type, currency, notes, created_at, updated_at
FROM accounts
WHERE user_id = $1
ORDER BY created_at DESC;
```

**Index Used:** `idx_accounts_user_id`

### Get Accounts by Type

```sql
SELECT id, name, account_type, currency, notes
FROM accounts
WHERE user_id = $1 AND account_type = $2
ORDER BY name;
```

**Indexes Used:** `idx_accounts_user_id`, `idx_accounts_type`

---

## Category Queries

### Get All User Categories

```sql
SELECT id, name, icon, color, parent_category_id, created_at, updated_at
FROM categories
WHERE user_id = $1
ORDER BY name;
```

**Index Used:** `idx_categories_user_id`

### Get Category Hierarchy

```sql
WITH RECURSIVE category_tree AS (
    -- Base case: root categories
    SELECT id, name, icon, color, parent_category_id, 0 as level
    FROM categories
    WHERE user_id = $1 AND parent_category_id IS NULL

    UNION ALL

    -- Recursive case: child categories
    SELECT c.id, c.name, c.icon, c.color, c.parent_category_id, ct.level + 1
    FROM categories c
    INNER JOIN category_tree ct ON c.parent_category_id = ct.id
    WHERE c.user_id = $1
)
SELECT * FROM category_tree
ORDER BY level, name;
```

**Index Used:** `idx_categories_parent`

---

## Transaction Queries

### Get Recent Transactions

```sql
SELECT t.id, t.title, t.amount, t.date, t.notes,
       a.name as account_name,
       c.name as category_name, c.icon as category_icon, c.color as category_color
FROM transactions t
LEFT JOIN accounts a ON t.account_id = a.id
LEFT JOIN categories c ON t.category_id = c.id
WHERE t.user_id = $1
ORDER BY t.date DESC, t.created_at DESC
LIMIT $2 OFFSET $3;
```

**Index Used:** `idx_transactions_user_date`

**Performance:** 0.025ms for 50 records

### Get Transactions by Date Range

```sql
SELECT t.id, t.title, t.amount, t.date, t.notes,
       a.name as account_name,
       c.name as category_name
FROM transactions t
LEFT JOIN accounts a ON t.account_id = a.id
LEFT JOIN categories c ON t.category_id = c.id
WHERE t.user_id = $1
  AND t.date >= $2
  AND t.date <= $3
ORDER BY t.date DESC;
```

**Index Used:** `idx_transactions_user_date`

### Get Transactions by Account

```sql
SELECT t.id, t.title, t.amount, t.date, t.notes,
       c.name as category_name, c.icon as category_icon
FROM transactions t
LEFT JOIN categories c ON t.category_id = c.id
WHERE t.account_id = $1
ORDER BY t.date DESC
LIMIT $2;
```

**Index Used:** `idx_transactions_account_id`

### Get Transactions by Category

```sql
SELECT t.id, t.title, t.amount, t.date, t.notes,
       a.name as account_name
FROM transactions t
LEFT JOIN accounts a ON t.account_id = a.id
WHERE t.category_id = $1
ORDER BY t.date DESC
LIMIT $2;
```

**Index Used:** `idx_transactions_category_id`

### Get Transaction with Splits

```sql
SELECT t.id, t.title, t.amount, t.date, t.notes,
       a.name as account_name,
       c.name as category_name,
       json_agg(
           json_build_object(
               'person_id', ts.person_id,
               'person_name', p.name,
               'amount', ts.amount
           )
       ) FILTER (WHERE ts.id IS NOT NULL) as splits
FROM transactions t
LEFT JOIN accounts a ON t.account_id = a.id
LEFT JOIN categories c ON t.category_id = c.id
LEFT JOIN transaction_splits ts ON t.id = ts.transaction_id
LEFT JOIN people p ON ts.person_id = p.id
WHERE t.id = $1
GROUP BY t.id, a.name, c.name;
```

---

## Budget Queries

### Get Active Budgets

```sql
SELECT b.id, b.name, b.filters,
       br.limit_amount, br.period, br.start_date, br.end_date
FROM budgets b
INNER JOIN budget_ranges br ON b.id = br.budget_id
WHERE b.user_id = $1
  AND br.start_date <= CURRENT_DATE
  AND br.end_date >= CURRENT_DATE
ORDER BY b.name;
```

**Index Used:** `idx_budgets_user_id`, `idx_budget_ranges_dates`

### Calculate Budget Usage

```sql
WITH budget_transactions AS (
    SELECT t.amount
    FROM transactions t
    WHERE t.user_id = $1
      AND t.date >= $2  -- budget start_date
      AND t.date <= $3  -- budget end_date
      AND t.category_id = ANY($4)  -- categories from budget filters
)
SELECT
    COALESCE(SUM(amount), 0) as spent,
    $5 as limit_amount,  -- from budget_ranges
    $5 - COALESCE(SUM(amount), 0) as remaining,
    CASE
        WHEN $5 > 0 THEN (COALESCE(SUM(amount), 0) / $5 * 100)
        ELSE 0
    END as percentage_used
FROM budget_transactions;
```

---

## Analytics Queries

### Monthly Spending by Category

```sql
SELECT
    c.name as category_name,
    c.icon,
    c.color,
    SUM(t.amount) as total_amount,
    COUNT(t.id) as transaction_count
FROM transactions t
INNER JOIN categories c ON t.category_id = c.id
WHERE t.user_id = $1
  AND t.date >= date_trunc('month', CURRENT_DATE)
  AND t.date < date_trunc('month', CURRENT_DATE) + interval '1 month'
  AND t.amount < 0  -- expenses only
GROUP BY c.id, c.name, c.icon, c.color
ORDER BY total_amount ASC
LIMIT 10;
```

### Income vs Expenses (Monthly)

```sql
SELECT
    date_trunc('month', date) as month,
    SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) as income,
    SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END) as expenses,
    SUM(amount) as net
FROM transactions
WHERE user_id = $1
  AND date >= $2  -- start date
  AND date <= $3  -- end date
GROUP BY date_trunc('month', date)
ORDER BY month DESC;
```

### Top Spending Categories (Year to Date)

```sql
SELECT
    c.name as category_name,
    c.icon,
    c.color,
    SUM(ABS(t.amount)) as total_spent,
    COUNT(t.id) as transaction_count,
    AVG(ABS(t.amount)) as avg_transaction
FROM transactions t
INNER JOIN categories c ON t.category_id = c.id
WHERE t.user_id = $1
  AND t.date >= date_trunc('year', CURRENT_DATE)
  AND t.amount < 0  -- expenses only
GROUP BY c.id, c.name, c.icon, c.color
ORDER BY total_spent DESC
LIMIT 10;
```

### Account Balances

```sql
SELECT
    a.id,
    a.name,
    a.account_type,
    a.currency,
    COALESCE(SUM(t.amount), 0) as balance
FROM accounts a
LEFT JOIN transactions t ON a.id = t.account_id
WHERE a.user_id = $1
GROUP BY a.id, a.name, a.account_type, a.currency
ORDER BY a.name;
```

### Daily Spending Trend (Last 30 Days)

```sql
SELECT
    DATE(date) as day,
    SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END) as daily_expenses,
    COUNT(CASE WHEN amount < 0 THEN 1 END) as transaction_count
FROM transactions
WHERE user_id = $1
  AND date >= CURRENT_DATE - interval '30 days'
GROUP BY DATE(date)
ORDER BY day DESC;
```

---

## People and Split Queries

### Get All People for User

```sql
SELECT id, name, email, phone, notes, created_at, updated_at
FROM people
WHERE user_id = $1
ORDER BY name;
```

**Index Used:** `idx_people_user_id`

### Get Transactions with Person

```sql
SELECT
    t.id, t.title, t.amount, t.date,
    ts.amount as split_amount,
    a.name as account_name
FROM transaction_splits ts
INNER JOIN transactions t ON ts.transaction_id = t.id
INNER JOIN accounts a ON t.account_id = a.id
WHERE ts.person_id = $1
ORDER BY t.date DESC;
```

**Index Used:** `idx_splits_person_id`

### Calculate Amount Owed by Person

```sql
SELECT
    p.id,
    p.name,
    SUM(ts.amount) as total_owed
FROM people p
LEFT JOIN transaction_splits ts ON p.id = ts.person_id
WHERE p.user_id = $1
GROUP BY p.id, p.name
HAVING SUM(ts.amount) != 0
ORDER BY total_owed DESC;
```

---

## Search Queries

### Search Transactions

```sql
SELECT t.id, t.title, t.amount, t.date,
       a.name as account_name,
       c.name as category_name
FROM transactions t
LEFT JOIN accounts a ON t.account_id = a.id
LEFT JOIN categories c ON t.category_id = c.id
WHERE t.user_id = $1
  AND (
    t.title ILIKE $2
    OR t.notes ILIKE $2
    OR a.name ILIKE $2
    OR c.name ILIKE $2
  )
ORDER BY t.date DESC
LIMIT 50;
```

**Note:** ILIKE is case-insensitive. For better performance on large datasets, consider using full-text search with tsvector.

---

## Optimization Tips

### Use EXPLAIN ANALYZE

Always test query performance with EXPLAIN ANALYZE:

```sql
EXPLAIN ANALYZE
SELECT * FROM transactions
WHERE user_id = '00000000-0000-0000-0000-000000000001'
ORDER BY date DESC
LIMIT 50;
```

### Index Usage Verification

Check if indexes are being used:

```sql
SELECT schemaname, tablename, indexname, idx_scan
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;
```

### Query Performance Monitoring

Enable query logging in PostgreSQL:

```sql
ALTER DATABASE master_of_coin SET log_statement = 'all';
ALTER DATABASE master_of_coin SET log_duration = on;
ALTER DATABASE master_of_coin SET log_min_duration_statement = 100;  -- log queries > 100ms
```

---

## Best Practices

1. **Always filter by user_id first** - This ensures user data isolation and uses indexes effectively
2. **Use prepared statements** - Prevents SQL injection and improves performance
3. **Limit result sets** - Always use LIMIT for list queries
4. **Use appropriate indexes** - Verify indexes are being used with EXPLAIN
5. **Avoid SELECT \*** - Only select columns you need
6. **Use JOINs efficiently** - LEFT JOIN when optional, INNER JOIN when required
7. **Batch operations** - Use transactions for multiple related operations
8. **Cache frequently accessed data** - Consider application-level caching for static data
9. **Monitor slow queries** - Set up logging for queries taking > 100ms
10. **Regular VACUUM** - Keep database statistics up to date

---

## Connection Pool Configuration

Recommended SQLx pool settings:

```rust
PgPoolOptions::new()
    .max_connections(5)
    .acquire_timeout(Duration::from_secs(3))
    .connect(&database_url)
    .await
```

---

## Query Complexity Guidelines

- **Simple queries** (< 10ms): Direct table lookups with indexed columns
- **Medium queries** (10-100ms): Queries with JOINs and aggregations
- **Complex queries** (> 100ms): Recursive CTEs, multiple aggregations, full-text search

If a query consistently exceeds 100ms, consider:

1. Adding appropriate indexes
2. Denormalizing data
3. Using materialized views
4. Implementing caching
5. Breaking into smaller queries
