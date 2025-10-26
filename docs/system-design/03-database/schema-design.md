# Database Schema Design

## Overview

Master of Coin uses PostgreSQL 16 for its relational database with ACID compliance and complex query support. The schema is implemented through Diesel migrations located in [`backend/migrations/`](../../../backend/migrations/).

## Complete Schema

The database schema is implemented across 10 migration files:

### 1. ENUM Types ([`2025-10-25-000001_create_enums`](../../../backend/migrations/2025-10-25-000001_create_enums/))

```sql
CREATE TYPE account_type AS ENUM (
    'CHECKING',
    'SAVINGS',
    'CREDIT_CARD',
    'INVESTMENT',
    'CASH'
);

CREATE TYPE currency_code AS ENUM (
    'USD',
    'EUR',
    'GBP',
    'INR',
    'JPY',
    'AUD',
    'CAD'
);

CREATE TYPE budget_period AS ENUM (
    'DAILY',
    'WEEKLY',
    'MONTHLY',
    'QUARTERLY',
    'YEARLY'
);
```

### 2. Users Table ([`2025-10-25-000002_create_users_table`](../../../backend/migrations/2025-10-25-000002_create_users_table/))

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_email ON users(email);
```

### 3. Accounts Table ([`2025-10-25-000003_create_accounts_table`](../../../backend/migrations/2025-10-25-000003_create_accounts_table/))

```sql
CREATE TABLE accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    type account_type NOT NULL,
    currency currency_code DEFAULT 'EUR',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_accounts_user_id ON accounts(user_id);
```

### 4. Categories Table ([`2025-10-25-000004_create_categories_table`](../../../backend/migrations/2025-10-25-000004_create_categories_table/))

```sql
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    icon VARCHAR(50), -- Icon identifier
    color VARCHAR(7), -- Hex color code
    parent_category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, name)
);

CREATE INDEX idx_categories_user_id ON categories(user_id);
```

### 5. People Table ([`2025-10-25-000005_create_people_table`](../../../backend/migrations/2025-10-25-000005_create_people_table/))

```sql
CREATE TABLE people (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_people_user_id ON people(user_id);
CREATE INDEX idx_people_user_name ON people(user_id, name);
```

### 6. Transactions Table ([`2025-10-25-000006_create_transactions_table`](../../../backend/migrations/2025-10-25-000006_create_transactions_table/))

```sql
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    amount DECIMAL(19, 2) NOT NULL,
    date TIMESTAMP WITH TIME ZONE NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_transactions_user_id ON transactions(user_id);
CREATE INDEX idx_transactions_account_id ON transactions(account_id);
CREATE INDEX idx_transactions_category_id ON transactions(category_id);
CREATE INDEX idx_transactions_user_date ON transactions(user_id, date DESC);
CREATE INDEX idx_transactions_amount ON transactions(user_id, amount);
```

### 7. Transaction Splits Table ([`2025-10-25-000007_create_transaction_splits_table`](../../../backend/migrations/2025-10-25-000007_create_transaction_splits_table/))

```sql
CREATE TABLE transaction_splits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    person_id UUID NOT NULL REFERENCES people(id) ON DELETE RESTRICT,
    amount DECIMAL(19, 2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_splits_transaction_id ON transaction_splits(transaction_id);
CREATE INDEX idx_splits_person_id ON transaction_splits(person_id);
```

### 8. Budgets Table ([`2025-10-25-000008_create_budgets_table`](../../../backend/migrations/2025-10-25-000008_create_budgets_table/))

```sql
CREATE TABLE budgets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    filters JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_budgets_user_id ON budgets(user_id);
CREATE INDEX idx_budgets_filters ON budgets USING GIN(filters);
```

### 9. Budget Ranges Table ([`2025-10-25-000009_create_budget_ranges_table`](../../../backend/migrations/2025-10-25-000009_create_budget_ranges_table/))

```sql
CREATE TABLE budget_ranges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    budget_id UUID NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
    limit_amount DECIMAL(19, 2) NOT NULL,
    period budget_period NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT valid_date_range CHECK (end_date >= start_date),
    CONSTRAINT positive_limit CHECK (limit_amount > 0)
);

CREATE INDEX idx_budget_ranges_budget_id ON budget_ranges(budget_id);
```

### 10. Triggers ([`2025-10-25-000010_create_triggers`](../../../backend/migrations/2025-10-25-000010_create_triggers/))

```sql
-- Updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers to all tables with updated_at
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_accounts_updated_at
    BEFORE UPDATE ON accounts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_categories_updated_at
    BEFORE UPDATE ON categories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_people_updated_at
    BEFORE UPDATE ON people
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_transactions_updated_at
    BEFORE UPDATE ON transactions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_budgets_updated_at
    BEFORE UPDATE ON budgets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_budget_ranges_updated_at
    BEFORE UPDATE ON budget_ranges
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_transaction_splits_updated_at
    BEFORE UPDATE ON transaction_splits
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

## Key Design Decisions

### 1. Decimal Precision

- All monetary amounts: `DECIMAL(19, 2)`
- Stores up to 17 digits before decimal, 2 after
- Prevents floating-point errors
- Rust uses `BigDecimal` type from the `bigdecimal` crate
- Format to 2 decimals when returning to UI

### 2. Soft Deletes vs Hard Deletes

- Hard deletes with CASCADE for user data (GDPR compliance)
- RESTRICT on foreign keys that shouldn't be deleted (accounts with transactions, people with splits)
- SET NULL for optional references (categories)

### 3. Timestamps

- All tables have `created_at` and `updated_at` (except `transaction_splits` which only has `created_at` in the initial design, but `updated_at` was added via trigger)
- Use `TIMESTAMP WITH TIME ZONE` for proper timezone handling
- Automatic `updated_at` via triggers for all tables
- Budget ranges use `DATE` type for `start_date` and `end_date`

### 4. Indexes

- Primary keys (UUID) automatically indexed
- Foreign keys indexed for join performance
- Users: indexed on `username` and `email` for authentication
- People: composite index on `(user_id, name)` for efficient lookups
- Transactions: composite indexes on `(user_id, date DESC)` and `(user_id, amount)` for common query patterns
- Categories: indexed on `user_id` only (no parent index in implementation)
- GIN index on JSONB for budget filters

### 5. Currency Default

- Accounts default to `'EUR'` currency (not `'USD'` as originally planned)
- Reflects the primary user base location

### 6. Budget Filters (JSONB)

Example filter structure:

```json
{
  "category_id": "10000000-0000-0000-0000-000000000001",
  "account_ids": ["*"]
}
```

## Common Queries

### Get Account Balance

```sql
SELECT COALESCE(SUM(amount), 0) as balance
FROM transactions
WHERE account_id = $1;
```

### Get Transactions for Month

```sql
SELECT t.*, c.name as category_name, a.name as account_name
FROM transactions t
LEFT JOIN categories c ON t.category_id = c.id
LEFT JOIN accounts a ON t.account_id = a.id
WHERE t.user_id = $1
  AND t.date >= $2  -- Start of month
  AND t.date < $3   -- Start of next month
ORDER BY t.date DESC;
```

### Calculate Debt for Person

```sql
SELECT
    p.id,
    p.name,
    COALESCE(SUM(ts.amount), 0) as total_owed
FROM people p
LEFT JOIN transaction_splits ts ON p.id = ts.person_id
LEFT JOIN transactions t ON ts.transaction_id = t.id
WHERE p.user_id = $1 AND p.id = $2
GROUP BY p.id, p.name;
```

### Get Active Budget Range

```sql
SELECT br.*
FROM budget_ranges br
WHERE br.budget_id = $1
  AND $2 BETWEEN br.start_date AND br.end_date
ORDER BY br.created_at DESC
LIMIT 1;
```

### Calculate Budget Spending

```sql
-- For monthly budget
SELECT COALESCE(SUM(ABS(amount)), 0) as spent
FROM transactions
WHERE user_id = $1
  AND category_id = $2
  AND date >= date_trunc('month', CURRENT_DATE)
  AND date < date_trunc('month', CURRENT_DATE) + interval '1 month'
  AND amount < 0; -- Only expenses
```

## Migrations

Using Diesel migrations in [`backend/migrations/`](../../../backend/migrations/):

```
backend/migrations/
├── 2025-10-25-000001_create_enums/
│   ├── up.sql
│   └── down.sql
├── 2025-10-25-000002_create_users_table/
│   ├── up.sql
│   └── down.sql
├── 2025-10-25-000003_create_accounts_table/
│   ├── up.sql
│   └── down.sql
├── 2025-10-25-000004_create_categories_table/
│   ├── up.sql
│   └── down.sql
├── 2025-10-25-000005_create_people_table/
│   ├── up.sql
│   └── down.sql
├── 2025-10-25-000006_create_transactions_table/
│   ├── up.sql
│   └── down.sql
├── 2025-10-25-000007_create_transaction_splits_table/
│   ├── up.sql
│   └── down.sql
├── 2025-10-25-000008_create_budgets_table/
│   ├── up.sql
│   └── down.sql
├── 2025-10-25-000009_create_budget_ranges_table/
│   ├── up.sql
│   └── down.sql
└── 2025-10-25-000010_create_triggers/
    ├── up.sql
    └── down.sql
```

Run migrations with:

```bash
cd backend
diesel migration run
```

Generate schema after migrations:

```bash
diesel print-schema > src/schema.rs
```

Or use the initialization script:

```bash
./backend/scripts/init-db.sh
```

## Performance Considerations

1. **Partitioning** (Future): Partition transactions by date if volume grows
2. **Materialized Views** (Future): For dashboard aggregations
3. **Connection Pooling**: Diesel r2d2 pool with 5-20 connections
4. **Query Optimization**: Use EXPLAIN ANALYZE for slow queries
5. **Indexes**: Monitor and add indexes based on query patterns

## Data Integrity

1. **Foreign Key Constraints**: Enforce referential integrity
2. **Check Constraints**: Validate data at database level
3. **Unique Constraints**: Prevent duplicates
4. **NOT NULL**: Required fields enforced
5. **Triggers**: Automatic timestamp updates

## Database Scripts

### Initialization ([`backend/scripts/init-db.sh`](../../../backend/scripts/init-db.sh))

- Creates database if it doesn't exist
- Enables UUID extension
- Runs all migrations
- Loads seed data
- Displays database summary

Usage:

```bash
./backend/scripts/init-db.sh
```

### Seed Data ([`backend/scripts/seed.sql`](../../../backend/scripts/seed.sql))

- Creates test user: `little-finger` / `knowledge-is-power`
- Loads 8 default categories with icons and colors
- Creates 3 sample accounts (Checking, Savings, Credit Card)
- Adds 2 sample people (Varys, Pycelle)
- Inserts 10 sample transactions
- Creates sample budget with monthly range

### Backup ([`backend/scripts/backup.sh`](../../../backend/scripts/backup.sh))

- Creates timestamped backup files
- Stores in `./backups/` directory
- Uses `pg_dump` for full database backup

Usage:

```bash
./backend/scripts/backup.sh
```

### Restore ([`backend/scripts/restore.sh`](../../../backend/scripts/restore.sh))

- Restores database from backup file
- Drops and recreates database
- Requires confirmation before proceeding
- Displays summary after restore

Usage:

```bash
./backend/scripts/restore.sh ./backups/backup_20251024_120000.sql
```

## Backup Strategy

1. **Manual backups**: Use `backup.sh` script
2. **Timestamped files**: Format `backup_YYYYMMDD_HHMMSS.sql`
3. **Storage**: Local `./backups/` directory
4. **Restore**: Use `restore.sh` with backup file path
