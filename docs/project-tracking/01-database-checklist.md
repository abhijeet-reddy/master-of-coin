# Database Checklist

## Overview
This checklist covers PostgreSQL database setup, schema implementation, migrations, and initial data seeding for Master of Coin.

**Reference:** [`docs/system-design/03-database/schema-design.md`](../system-design/03-database/schema-design.md)

---

## PostgreSQL Setup

### Database Creation
- [ ] Ensure PostgreSQL 16 is running
  - [ ] Check: `docker ps` or `pg_isready`
- [ ] Create database
  - [ ] Connect: `psql -U postgres`
  - [ ] Create: `CREATE DATABASE master_of_coin;`
  - [ ] Verify: `\l` (list databases)
- [ ] Create database user (if not using postgres)
  ```sql
  CREATE USER moc_user WITH PASSWORD 'secure_password';
  GRANT ALL PRIVILEGES ON DATABASE master_of_coin TO moc_user;
  ```

### Extension Installation
- [ ] Connect to database: `psql -U postgres -d master_of_coin`
- [ ] Enable UUID extension
  ```sql
  CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
  ```
- [ ] Verify: `\dx` (list extensions)

---

## SQLx Migration Setup

### SQLx CLI Installation
- [ ] Install SQLx CLI
  ```bash
  cargo install sqlx-cli --no-default-features --features postgres
  ```
- [ ] Verify: `sqlx --version`

### Migration Directory Setup
- [ ] Navigate to backend directory: `cd backend`
- [ ] Create migrations directory: `mkdir -p migrations`
- [ ] Initialize SQLx
  ```bash
  sqlx database create
  ```

---

## Schema Implementation

### Migration Files Creation

#### Migration 1: Create ENUMs
- [ ] Create migration file
  ```bash
  sqlx migrate add create_enums
  ```
- [ ] Edit `migrations/XXXXXX_create_enums.sql`
  ```sql
  -- Create ENUM types
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

#### Migration 2: Create Users Table
- [ ] Create migration file
  ```bash
  sqlx migrate add create_users_table
  ```
- [ ] Edit migration file
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

#### Migration 3: Create Accounts Table
- [ ] Create migration file
  ```bash
  sqlx migrate add create_accounts_table
  ```
- [ ] Edit migration file
  ```sql
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
  CREATE INDEX idx_accounts_type ON accounts(account_type);
  ```

#### Migration 4: Create Categories Table
- [ ] Create migration file
  ```bash
  sqlx migrate add create_categories_table
  ```
- [ ] Edit migration file
  ```sql
  CREATE TABLE categories (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      icon VARCHAR(50),
      color VARCHAR(7),
      parent_category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, name)
  );
  
  CREATE INDEX idx_categories_user_id ON categories(user_id);
  CREATE INDEX idx_categories_parent ON categories(parent_category_id);
  ```

#### Migration 5: Create People Table
- [ ] Create migration file
  ```bash
  sqlx migrate add create_people_table
  ```
- [ ] Edit migration file
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
  CREATE INDEX idx_people_name ON people(name);
  ```

#### Migration 6: Create Transactions Table
- [ ] Create migration file
  ```bash
  sqlx migrate add create_transactions_table
  ```
- [ ] Edit migration file
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
  CREATE INDEX idx_transactions_date ON transactions(date DESC);
  CREATE INDEX idx_transactions_user_date ON transactions(user_id, date DESC);
  CREATE INDEX idx_transactions_amount ON transactions(amount);
  ```

#### Migration 7: Create Transaction Splits Table
- [ ] Create migration file
  ```bash
  sqlx migrate add create_transaction_splits_table
  ```
- [ ] Edit migration file
  ```sql
  CREATE TABLE transaction_splits (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
      person_id UUID NOT NULL REFERENCES people(id) ON DELETE RESTRICT,
      amount DECIMAL(19, 2) NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  );
  
  CREATE INDEX idx_splits_transaction_id ON transaction_splits(transaction_id);
  CREATE INDEX idx_splits_person_id ON transaction_splits(person_id);
  ```

#### Migration 8: Create Budgets Table
- [ ] Create migration file
  ```bash
  sqlx migrate add create_budgets_table
  ```
- [ ] Edit migration file
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

#### Migration 9: Create Budget Ranges Table
- [ ] Create migration file
  ```bash
  sqlx migrate add create_budget_ranges_table
  ```
- [ ] Edit migration file
  ```sql
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
  CREATE INDEX idx_budget_ranges_period ON budget_ranges(period);
  ```

#### Migration 10: Create Triggers
- [ ] Create migration file
  ```bash
  sqlx migrate add create_triggers
  ```
- [ ] Edit migration file
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
  ```

---

## Migration Execution

### Run Migrations
- [ ] Run all migrations
  ```bash
  sqlx migrate run
  ```
- [ ] Verify migrations applied
  ```bash
  sqlx migrate info
  ```
- [ ] Check database schema
  ```sql
  \dt  -- List tables
  \d users  -- Describe users table
  \dT  -- List types (ENUMs)
  ```

### Verify Schema
- [ ] Verify all tables created
  - [ ] users
  - [ ] accounts
  - [ ] categories
  - [ ] people
  - [ ] transactions
  - [ ] transaction_splits
  - [ ] budgets
  - [ ] budget_ranges
- [ ] Verify all indexes created
- [ ] Verify all foreign keys created
- [ ] Verify all triggers created
- [ ] Verify all ENUMs created

---

## Seed Data Creation

### Create Seed Script
- [ ] Create `backend/scripts/seed.sql`
- [ ] Add test user (password: "password123")
  ```sql
  -- Insert test user (password hash for "password123")
  INSERT INTO users (id, username, email, password_hash, name)
  VALUES (
    '00000000-0000-0000-0000-000000000001',
    'testuser',
    'test@example.com',
    '$argon2id$v=19$m=19456,t=2,p=1$...',  -- Generate proper hash
    'Test User'
  );
  ```

### Seed Categories
- [ ] Add default categories
  ```sql
  INSERT INTO categories (user_id, name, icon, color) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Food & Dining', '🍔', '#FF6B6B'),
  ('00000000-0000-0000-0000-000000000001', 'Transportation', '🚗', '#4ECDC4'),
  ('00000000-0000-0000-0000-000000000001', 'Shopping', '🛍️', '#95E1D3'),
  ('00000000-0000-0000-0000-000000000001', 'Bills & Utilities', '💡', '#F38181'),
  ('00000000-0000-0000-0000-000000000001', 'Entertainment', '🎮', '#AA96DA'),
  ('00000000-0000-0000-0000-000000000001', 'Healthcare', '🏥', '#FCBAD3'),
  ('00000000-0000-0000-0000-000000000001', 'Income', '💰', '#A8E6CF'),
  ('00000000-0000-0000-0000-000000000001', 'Other', '📦', '#C7CEEA');
  ```

### Seed Accounts
- [ ] Add sample accounts
  ```sql
  INSERT INTO accounts (user_id, name, account_type, currency) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Checking Account', 'CHECKING', 'USD'),
  ('00000000-0000-0000-0000-000000000001', 'Savings Account', 'SAVINGS', 'USD'),
  ('00000000-0000-0000-0000-000000000001', 'Credit Card', 'CREDIT_CARD', 'USD');
  ```

### Seed People
- [ ] Add sample people for split payments
  ```sql
  INSERT INTO people (user_id, name, email) VALUES
  ('00000000-0000-0000-0000-000000000001', 'John Doe', 'john@example.com'),
  ('00000000-0000-0000-0000-000000000001', 'Jane Smith', 'jane@example.com');
  ```

### Seed Transactions
- [ ] Add sample transactions
  ```sql
  -- Get IDs for reference
  WITH 
    checking_id AS (SELECT id FROM accounts WHERE name = 'Checking Account' LIMIT 1),
    food_id AS (SELECT id FROM categories WHERE name = 'Food & Dining' LIMIT 1)
  INSERT INTO transactions (user_id, account_id, category_id, title, amount, date)
  SELECT 
    '00000000-0000-0000-0000-000000000001',
    (SELECT id FROM checking_id),
    (SELECT id FROM food_id),
    'Grocery Store',
    -85.50,
    CURRENT_TIMESTAMP - INTERVAL '2 days';
  ```

### Run Seed Script
- [ ] Execute seed script
  ```bash
  psql -U postgres -d master_of_coin -f backend/scripts/seed.sql
  ```
- [ ] Verify seed data
  ```sql
  SELECT COUNT(*) FROM users;
  SELECT COUNT(*) FROM categories;
  SELECT COUNT(*) FROM accounts;
  SELECT COUNT(*) FROM transactions;
  ```

---

## Database Connection Testing

### SQLx Connection Pool
- [ ] Create `backend/src/db/pool.rs`
- [ ] Implement connection pool setup
  ```rust
  use sqlx::postgres::PgPoolOptions;
  use sqlx::PgPool;
  
  pub async fn create_pool(database_url: &str) -> Result<PgPool, sqlx::Error> {
      PgPoolOptions::new()
          .max_connections(5)
          .connect(database_url)
          .await
  }
  ```

### Test Connection
- [ ] Create test in `backend/src/db/mod.rs`
  ```rust
  #[cfg(test)]
  mod tests {
      use super::*;
      
      #[tokio::test]
      async fn test_database_connection() {
          let pool = create_pool(&std::env::var("DATABASE_URL").unwrap())
              .await
              .expect("Failed to create pool");
          
          let result: (i64,) = sqlx::query_as("SELECT 1")
              .fetch_one(&pool)
              .await
              .expect("Failed to execute query");
          
          assert_eq!(result.0, 1);
      }
  }
  ```
- [ ] Run test: `cargo test test_database_connection`

---

## Query Optimization

### Analyze Query Performance
- [ ] Enable query logging in PostgreSQL
  ```sql
  ALTER DATABASE master_of_coin SET log_statement = 'all';
  ALTER DATABASE master_of_coin SET log_duration = on;
  ```
- [ ] Test common queries with EXPLAIN ANALYZE
  ```sql
  EXPLAIN ANALYZE 
  SELECT * FROM transactions 
  WHERE user_id = '00000000-0000-0000-0000-000000000001' 
  ORDER BY date DESC 
  LIMIT 50;
  ```

### Index Verification
- [ ] Verify indexes are being used
  ```sql
  SELECT schemaname, tablename, indexname, idx_scan
  FROM pg_stat_user_indexes
  ORDER BY idx_scan DESC;
  ```
- [ ] Check for missing indexes
  ```sql
  SELECT schemaname, tablename, attname, n_distinct, correlation
  FROM pg_stats
  WHERE schemaname = 'public'
  ORDER BY abs(correlation) DESC;
  ```

---

## Backup Configuration

### Manual Backup
- [ ] Create backup script `backend/scripts/backup.sh`
  ```bash
  #!/bin/bash
  BACKUP_DIR="./backups"
  TIMESTAMP=$(date +%Y%m%d_%H%M%S)
  mkdir -p $BACKUP_DIR
  
  pg_dump -U postgres master_of_coin > "$BACKUP_DIR/backup_$TIMESTAMP.sql"
  echo "Backup created: backup_$TIMESTAMP.sql"
  ```
- [ ] Make executable: `chmod +x backend/scripts/backup.sh`
- [ ] Test backup: `./backend/scripts/backup.sh`

### Restore Testing
- [ ] Create restore script `backend/scripts/restore.sh`
  ```bash
  #!/bin/bash
  if [ -z "$1" ]; then
    echo "Usage: ./restore.sh <backup_file>"
    exit 1
  fi
  
  psql -U postgres -d master_of_coin < "$1"
  echo "Database restored from $1"
  ```
- [ ] Make executable: `chmod +x backend/scripts/restore.sh`
- [ ] Test restore on a test database

---

## Documentation

### Database Documentation
- [ ] Document schema in `docs/database/schema.md`
  - [ ] Table descriptions
  - [ ] Column descriptions
  - [ ] Relationship diagrams
  - [ ] Index strategy
- [ ] Document common queries in `docs/database/queries.md`
- [ ] Document migration process in `docs/database/migrations.md`

### ERD Creation
- [ ] Generate Entity Relationship Diagram
  - [ ] Use tool like dbdiagram.io or draw.io
  - [ ] Include all tables and relationships
  - [ ] Save as `docs/database/erd.png`

---

## Completion Checklist

- [ ] PostgreSQL 16 installed and running
- [ ] Database created with UUID extension
- [ ] All 10 migrations created and executed
- [ ] All tables, indexes, and triggers verified
- [ ] Seed data created and loaded
- [ ] Connection pool implemented and tested
- [ ] Query performance analyzed
- [ ] Backup/restore scripts created and tested
- [ ] Database documentation completed

**Estimated Time:** 3-5 hours

**Next Steps:** Proceed to [`02-backend-checklist.md`](02-backend-checklist.md)