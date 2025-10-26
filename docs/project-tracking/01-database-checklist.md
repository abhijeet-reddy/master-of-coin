# Database Checklist

## Overview

This checklist covers PostgreSQL database setup, schema implementation, migrations, and initial data seeding for Master of Coin.

**References:**

- [`docs/system-design/03-database/schema-design.md`](../system-design/03-database/schema-design.md)
- [`docs/database/sqlx-to-diesel-migration-plan.md`](../database/sqlx-to-diesel-migration-plan.md) - **Diesel Migration Plan**

**ORM Decision:** ✅ **Diesel** (migration completed)

---

## ✅ SQLx to Diesel Migration - COMPLETED

**Status:** ✅ **COMPLETED** on October 26, 2025
**Actual Time:** ~6 hours
**Detailed Plan:** [`docs/database/sqlx-to-diesel-migration-plan.md`](../database/sqlx-to-diesel-migration-plan.md)

### Migration Summary

- [x] **Phase 1:** Setup & Dependencies (1 hour)
  - [x] Install Diesel CLI: `cargo install diesel_cli --no-default-features --features postgres`
  - [x] Remove SQLx from Cargo.toml
  - [x] Add Diesel dependencies
  - [x] Initialize Diesel: `diesel setup`
- [x] **Phase 2:** Migration Files (30 min)
  - [x] Convert existing SQL migrations to Diesel format
  - [x] Generate schema: `diesel migration run && diesel print-schema > src/schema.rs`
- [x] **Phase 3:** Database Connection (30 min)
  - [x] Rewrite `src/db/mod.rs` with Diesel connection pool (r2d2)
  - [x] Update migration runner for Diesel
- [x] **Phase 4:** Custom Type Implementations (2-3 hours)
  - [x] Implement Diesel custom types for all 5 enums
- [x] **Phase 5:** Model Definitions (1-2 hours)
  - [x] Update all 8 model files with Diesel derives
- [x] **Phase 6:** SQLx Cleanup (30 min)
  - [x] Remove all SQLx imports and derives
  - [x] Update error handling
  - [x] Verify no SQLx references remain
- [x] **Phase 7:** Testing & Validation (1 hour)
  - [x] Verify compilation and migrations
  - [x] Test custom type serialization

**All phases completed successfully. See migration plan for detailed completion notes.**

---

## 🚀 Quick Start (Automated Setup)

### Option 1: Docker Compose (Recommended)

- [x] Start database with automatic initialization
  ```bash
  docker-compose up -d postgres
  ```
  - Automatically creates database, extensions, and runs migrations
  - Loads comprehensive seed data (test user, categories, accounts, transactions, people)
  - Database ready in ~10 seconds with realistic test data

### Option 2: Local PostgreSQL with Scripts

- [x] Ensure PostgreSQL 16 is running locally
- [x] Run initialization script
  ```bash
  make db-init
  ```
  - Creates database and extensions
  - Runs all SQLx migrations
  - Loads seed data

### Option 3: Manual Setup (Development)

- [x] Use individual make commands
  ```bash
  make db-create    # Create database
  make db-migrate   # Run migrations
  make db-seed      # Load seed data
  make db-reset     # Drop and recreate (fresh start)
  ```

---

## 📋 Available Scripts

All database scripts are located in [`backend/scripts/`](../../backend/scripts/):

| Script       | Purpose                                                    | Usage                                 |
| ------------ | ---------------------------------------------------------- | ------------------------------------- |
| `init-db.sh` | Complete database initialization                           | `./backend/scripts/init-db.sh`        |
| `seed.sql`   | Comprehensive seed data (user, categories, accounts, etc.) | `psql -f backend/scripts/seed.sql`    |
| `backup.sh`  | Create database backup                                     | `./backend/scripts/backup.sh`         |
| `restore.sh` | Restore from backup                                        | `./backend/scripts/restore.sh <file>` |

---

## 🔧 Manual Setup (If Needed)

### PostgreSQL Setup

#### Database Creation

- [x] Ensure PostgreSQL 16 is running
  - [x] Check: `docker ps` or `pg_isready`
- [x] Create database
  - [x] Connect: `psql -U postgres`
  - [x] Create: `CREATE DATABASE master_of_coin;`
  - [x] Verify: `\l` (list databases)

#### Extension Installation

- [x] Connect to database: `psql -U postgres -d master_of_coin`
- [x] Enable UUID extension
  ```sql
  CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
  ```
- [x] Verify: `\dx` (list extensions)

---

## Migration Tool Setup

### Diesel (Current)

- [x] Diesel CLI installed
- [x] Migrations directory exists: `backend/migrations/`
- [x] Diesel initialized: `diesel.toml` created
- [x] Migrations converted to Diesel format (up.sql/down.sql pairs)
- [x] Schema generated: `src/schema.rs`
- [x] Migrations run automatically via Docker or `diesel migration run`

**Note:** All migrations successfully converted to Diesel format with up.sql/down.sql pairs.

---

## Schema Implementation

### Migration Files Creation

#### Migration 1: Create ENUMs

- [x] Create migration file
  ```bash
  sqlx migrate add create_enums
  ```
- [x] Edit `migrations/XXXXXX_create_enums.sql`

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

- [x] Create migration file
  ```bash
  sqlx migrate add create_users_table
  ```
- [x] Edit migration file

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

- [x] Create migration file
  ```bash
  sqlx migrate add create_accounts_table
  ```
- [x] Edit migration file

  ```sql
  CREATE TABLE accounts (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      account_type account_type NOT NULL,
      currency currency_code DEFAULT 'EUR',
      notes TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX idx_accounts_user_id ON accounts(user_id);
  CREATE INDEX idx_accounts_type ON accounts(account_type);
  ```

#### Migration 4: Create Categories Table

- [x] Create migration file
  ```bash
  sqlx migrate add create_categories_table
  ```
- [x] Edit migration file

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

- [x] Create migration file
  ```bash
  sqlx migrate add create_people_table
  ```
- [x] Edit migration file

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

- [x] Create migration file
  ```bash
  sqlx migrate add create_transactions_table
  ```
- [x] Edit migration file

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

- [x] Create migration file
  ```bash
  sqlx migrate add create_transaction_splits_table
  ```
- [x] Edit migration file

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

- [x] Create migration file
  ```bash
  sqlx migrate add create_budgets_table
  ```
- [x] Edit migration file

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

- [x] Create migration file
  ```bash
  sqlx migrate add create_budget_ranges_table
  ```
- [x] Edit migration file

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

- [x] Create migration file
  ```bash
  sqlx migrate add create_triggers
  ```
- [x] Edit migration file

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

- [x] Run all migrations
  ```bash
  sqlx migrate run
  ```
- [x] Verify migrations applied
  ```bash
  sqlx migrate info
  ```
- [x] Check database schema
  ```sql
  \dt  -- List tables
  \d users  -- Describe users table
  \dT  -- List types (ENUMs)
  ```

### Verify Schema

- [x] Verify all tables created
  - [x] users
  - [x] accounts
  - [x] categories
  - [x] people
  - [x] transactions
  - [x] transaction_splits
  - [x] budgets
  - [x] budget_ranges
- [x] Verify all indexes created
- [x] Verify all foreign keys created
- [x] Verify all triggers created
- [x] Verify all ENUMs created

---

## Seed Data

### Automated Loading

- [x] Seed data loads automatically via:
  - Docker Compose initialization
  - `make db-seed` command
  - Included in `make db-init`

### Comprehensive Seed Data Contents

The [`backend/scripts/seed.sql`](../../backend/scripts/seed.sql) includes:

**Test User:**

- Username: `little-finger`
- Email: `little-finger@master-of-coin.com`
- Password: `knowledge-is-power`
- ID: `00000000-0000-0000-0000-000000000001`

**Default Categories (8):**

- 🍔 Food & Dining (#FF6B6B)
- 🚗 Transportation (#4ECDC4)
- 🛍️ Shopping (#95E1D3)
- 💡 Bills & Utilities (#F38181)
- 🎮 Entertainment (#AA96DA)
- 🏥 Healthcare (#FCBAD3)
- 💰 Income (#A8E6CF)
- 📦 Other (#C7CEEA)

**Sample Accounts (3):**

- Checking Account (CHECKING, EUR)
- Savings Account (SAVINGS, EUR)
- Credit Card (CREDIT_CARD, EUR)

**Sample People (2):**

- Varys (varys@master-of-coin.com)
- Pycelle (pycelle@aster-of-coin.com)

**Sample Transactions (10+):**

- Mix of income and expenses
- Various categories and amounts
- Spread across last 30 days
- Some with split payments

**Sample Budget:**

- Monthly food budget with limit
- Active budget range for current month

### Manual Verification

- [x] Verify seed data loaded
  ```sql
  SELECT COUNT(*) FROM users;        -- Should be 1
  SELECT COUNT(*) FROM categories;   -- Should be 8
  SELECT COUNT(*) FROM accounts;     -- Should be 3
  SELECT COUNT(*) FROM people;       -- Should be 2
  SELECT COUNT(*) FROM transactions; -- Should be 10+
  SELECT COUNT(*) FROM budgets;      -- Should be 1
  ```

---

## Database Connection Testing

### Diesel Connection Pool (Current)

- [x] Diesel connection pool implemented in `backend/src/db/mod.rs`
- [x] Connection tests passing
- [x] Async/sync bridge implemented using `tokio::task::spawn_blocking`
- [x] Migration runner updated for Diesel

**Implementation:**

```rust
use diesel::pg::PgConnection;
use diesel::r2d2::{self, ConnectionManager, Pool};
use diesel_migrations::{embed_migrations, EmbeddedMigrations, MigrationHarness};

pub type DbPool = Pool<ConnectionManager<PgConnection>>;
pub const MIGRATIONS: EmbeddedMigrations = embed_migrations!("migrations");

pub fn create_pool(database_url: &str, max_connections: u32) -> Result<DbPool, r2d2::Error> {
    let manager = ConnectionManager::<PgConnection>::new(database_url);
    Pool::builder()
        .max_size(max_connections)
        .build(manager)
}

pub fn run_migrations(pool: &DbPool) -> Result<(), Box<dyn std::error::Error>> {
    let mut conn = pool.get()?;
    conn.run_pending_migrations(MIGRATIONS)?;
    Ok(())
}
```

**Note:** Diesel is synchronous, so all database operations in async handlers use `spawn_blocking`.

---

## Query Optimization

### Analyze Query Performance

- [x] Enable query logging in PostgreSQL
  ```sql
  ALTER DATABASE master_of_coin SET log_statement = 'all';
  ALTER DATABASE master_of_coin SET log_duration = on;
  ```
- [x] Test common queries with EXPLAIN ANALYZE
  ```sql
  EXPLAIN ANALYZE
  SELECT * FROM transactions
  WHERE user_id = '00000000-0000-0000-0000-000000000001'
  ORDER BY date DESC
  LIMIT 50;
  ```

### Index Verification

- [x] Verify indexes are being used
  ```sql
  SELECT schemaname, tablename, indexname, idx_scan
  FROM pg_stat_user_indexes
  ORDER BY idx_scan DESC;
  ```
- [x] Check for missing indexes
  ```sql
  SELECT schemaname, tablename, attname, n_distinct, correlation
  FROM pg_stats
  WHERE schemaname = 'public'
  ORDER BY abs(correlation) DESC;
  ```

---

## Backup Configuration

### Manual Backup

- [x] Create backup script `backend/scripts/backup.sh`

  ```bash
  #!/bin/bash
  BACKUP_DIR="./backups"
  TIMESTAMP=$(date +%Y%m%d_%H%M%S)
  mkdir -p $BACKUP_DIR

  pg_dump -U postgres master_of_coin > "$BACKUP_DIR/backup_$TIMESTAMP.sql"
  echo "Backup created: backup_$TIMESTAMP.sql"
  ```

- [x] Make executable: `chmod +x backend/scripts/backup.sh`
- [x] Test backup: `./backend/scripts/backup.sh`

### Restore Testing

- [x] Create restore script `backend/scripts/restore.sh`

  ```bash
  #!/bin/bash
  if [ -z "$1" ]; then
    echo "Usage: ./restore.sh <backup_file>"
    exit 1
  fi

  psql -U postgres -d master_of_coin < "$1"
  echo "Database restored from $1"
  ```

- [x] Make executable: `chmod +x backend/scripts/restore.sh`
- [x] Test restore on a test database

---

## Documentation

### Database Documentation

- [x] Document schema in `docs/database/schema.md`
  - [x] Table descriptions
  - [x] Column descriptions
  - [x] Relationship diagrams
  - [x] Index strategy
- [x] Document common queries in `docs/database/queries.md`
- [x] Document migration process in `docs/database/migrations.md`

### ERD Creation

- [ ] Generate Entity Relationship Diagram
  - [ ] Use tool like dbdiagram.io or draw.io
  - [ ] Include all tables and relationships
  - [ ] Save as `docs/database/erd.png`

---

## Completion Checklist

### Database Setup (Completed)

- [x] PostgreSQL 16 installed and running
- [x] Database created with UUID extension
- [x] All 10 migrations created and executed
- [x] All tables, indexes, and triggers verified
- [x] Seed data created and loaded
- [x] Query performance analyzed
- [x] Backup/restore scripts created and tested
- [x] Database documentation completed

### Migration to Diesel (Completed)

- [x] Diesel CLI installed
- [x] Diesel initialized (`diesel.toml` created)
- [x] Migrations converted to Diesel format
- [x] Schema generated (`src/schema.rs`)
- [x] Connection pool rewritten for Diesel
- [x] Custom enum types implemented
- [x] All model files updated with Diesel derives
- [x] SQLx completely removed from codebase
- [x] Migration tests passing
- [x] Connection tests passing with Diesel
- [x] Integration tests updated and passing
- [x] Documentation updated

**Actual Time:**

- Original database setup: 3-5 hours ✅
- Diesel migration: ~6 hours ✅

**Next Steps:**

1. Complete Diesel migration (see [`docs/database/sqlx-to-diesel-migration-plan.md`](../database/sqlx-to-diesel-migration-plan.md))
2. Proceed to [`02-backend-checklist.md`](02-backend-checklist.md)
