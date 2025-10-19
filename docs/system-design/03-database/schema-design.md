# Database Schema Design

## Overview

Master of Coin uses PostgreSQL 16 for its relational database with ACID compliance and complex query support.

## Complete Schema

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create ENUMs
CREATE TYPE account_type AS ENUM ('CHECKING', 'SAVINGS', 'CREDIT_CARD', 'INVESTMENT', 'CASH');
CREATE TYPE currency_code AS ENUM ('USD', 'EUR', 'GBP', 'INR', 'JPY', 'AUD', 'CAD');
CREATE TYPE budget_period AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY');

-- Users table
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

-- Accounts table
CREATE TABLE accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    account_type account_type NOT NULL,
    currency currency_code DEFAULT 'USD',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_accounts_user_id ON accounts(user_id);

-- Categories table (user-defined)
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
CREATE INDEX idx_categories_parent ON categories(parent_category_id);

-- People table
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

-- Transactions table
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    amount DECIMAL(19, 2) NOT NULL, -- Positive = income, Negative = expense
    date TIMESTAMP WITH TIME ZONE NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_transactions_user_id ON transactions(user_id); # Check if this is needed later, can we only use idx_transactions_user_date?
CREATE INDEX idx_transactions_account_id ON transactions(account_id);
CREATE INDEX idx_transactions_category_id ON transactions(category_id);
CREATE INDEX idx_transactions_date ON transactions(date DESC);
CREATE INDEX idx_transactions_user_date ON transactions(user_id, date DESC);

-- Transaction splits table
CREATE TABLE transaction_splits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    person_id UUID NOT NULL REFERENCES people(id) ON DELETE RESTRICT,
    amount DECIMAL(19, 2) NOT NULL, -- Amount this person owes/paid
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_splits_transaction_id ON transaction_splits(transaction_id);
CREATE INDEX idx_splits_person_id ON transaction_splits(person_id);

-- Budgets table
CREATE TABLE budgets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    filters JSONB NOT NULL, -- Flexible filters for matching transactions
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_budgets_user_id ON budgets(user_id);
CREATE INDEX idx_budgets_filters ON budgets USING GIN(filters);

-- Budget ranges table
CREATE TABLE budget_ranges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    budget_id UUID NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
    limit_amount DECIMAL(19, 2) NOT NULL,
    period budget_period NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT valid_date_range CHECK (end_date >= start_date),
    CONSTRAINT positive_limit CHECK (limit_amount > 0)
);

CREATE INDEX idx_budget_ranges_budget_id ON budget_ranges(budget_id);
CREATE INDEX idx_budget_ranges_dates ON budget_ranges(start_date, end_date);

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_accounts_updated_at BEFORE UPDATE ON accounts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_categories_updated_at BEFORE UPDATE ON categories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_people_updated_at BEFORE UPDATE ON people
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_transactions_updated_at BEFORE UPDATE ON transactions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_budgets_updated_at BEFORE UPDATE ON budgets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

## Key Design Decisions

### 1. Decimal Precision
- All monetary amounts: `DECIMAL(19, 2)`
- Stores up to 17 digits before decimal, 2 after
- Prevents floating-point errors
- Format to 2 decimals when returning to UI

### 2. Soft Deletes vs Hard Deletes
- Hard deletes with CASCADE for user data (GDPR compliance)
- RESTRICT on foreign keys that shouldn't be deleted (accounts with transactions)
- SET NULL for optional references (categories)

### 3. Timestamps
- All tables have `created_at` and `updated_at`
- Use `TIMESTAMP WITH TIME ZONE` for proper timezone handling
- Automatic `updated_at` via triggers

### 4. Indexes
- Primary keys (UUID) automatically indexed
- Foreign keys indexed for join performance
- Date fields indexed for time-based queries
- Composite indexes for common query patterns
- GIN index on JSONB for budget filters

### 5. Budget Filters (JSONB)
```json
{
  "category_id": "uuid",
  "account_ids": ["uuid1", "uuid2", "*"],
  "min_amount": 0,
  "max_amount": 1000
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

Using SQLx migrations:

```
migrations/
├── 20240101000001_create_users.sql
├── 20240101000002_create_accounts.sql
├── 20240101000003_create_categories.sql
├── 20240101000004_create_people.sql
├── 20240101000005_create_transactions.sql
├── 20240101000006_create_transaction_splits.sql
├── 20240101000007_create_budgets.sql
└── 20240101000008_create_budget_ranges.sql
```

## Performance Considerations

1. **Partitioning** (Future): Partition transactions by date if volume grows
2. **Materialized Views** (Future): For dashboard aggregations
3. **Connection Pooling**: SQLx pool with 5-20 connections
4. **Query Optimization**: Use EXPLAIN ANALYZE for slow queries
5. **Indexes**: Monitor and add indexes based on query patterns

## Data Integrity

1. **Foreign Key Constraints**: Enforce referential integrity
2. **Check Constraints**: Validate data at database level
3. **Unique Constraints**: Prevent duplicates
4. **NOT NULL**: Required fields enforced
5. **Triggers**: Automatic timestamp updates

## Backup Strategy

1. **Daily backups**: Full database backup
2. **Point-in-time recovery**: WAL archiving
3. **Retention**: 30 days of backups
4. **Testing**: Regular restore testing
