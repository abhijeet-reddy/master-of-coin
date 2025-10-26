# Database Migration Guide

## Overview

Master of Coin uses Diesel for database migrations. This document explains the migration system, how to create new migrations, and best practices.

---

## Migration System

### Diesel Migrations

- **Tool:** Diesel CLI
- **Location:** `backend/migrations/`
- **Tracking:** Migrations are tracked in the `__diesel_schema_migrations` table
- **Format:** Directories with `up.sql` and `down.sql` files

### Migration Directory Structure

Each migration is a directory containing two files:

- `up.sql` - Applied when running migrations
- `down.sql` - Applied when reverting migrations

Format: `YYYY-MM-DD-HHMMSS_description/`

Example: `2025-10-25-000001_create_enums/`

---

## Current Migrations

### Migration History

| Order | Timestamp      | Description                     | Status     |
| ----- | -------------- | ------------------------------- | ---------- |
| 1     | 20251024000001 | create_enums                    | ✅ Applied |
| 2     | 20251024000002 | create_users_table              | ✅ Applied |
| 3     | 20251024000003 | create_accounts_table           | ✅ Applied |
| 4     | 20251024000004 | create_categories_table         | ✅ Applied |
| 5     | 20251024000005 | create_people_table             | ✅ Applied |
| 6     | 20251024000006 | create_transactions_table       | ✅ Applied |
| 7     | 20251024000007 | create_transaction_splits_table | ✅ Applied |
| 8     | 20251024000008 | create_budgets_table            | ✅ Applied |
| 9     | 20251024000009 | create_budget_ranges_table      | ✅ Applied |
| 10    | 20251024000010 | create_triggers                 | ✅ Applied |

---

## Creating New Migrations

### Step 1: Create Migration Directory

```bash
cd backend
diesel migration generate <description>
```

Example:

```bash
diesel migration generate add_tags_to_transactions
```

This creates: `migrations/YYYY-MM-DD-HHMMSS_add_tags_to_transactions/` with `up.sql` and `down.sql`

### Step 2: Write Migration SQL

Edit `up.sql` with your forward migration:

```sql
-- up.sql
-- Add tags column to transactions
ALTER TABLE transactions
ADD COLUMN tags TEXT[];

-- Create index for tag searches
CREATE INDEX idx_transactions_tags ON transactions USING GIN(tags);
```

Edit `down.sql` with your rollback migration:

```sql
-- down.sql
-- Remove tags column and index
DROP INDEX IF EXISTS idx_transactions_tags;
ALTER TABLE transactions DROP COLUMN IF EXISTS tags;
```

### Step 3: Test Migration

```bash
# Set DATABASE_URL
export DATABASE_URL="postgresql://little-finger:password@localhost:5432/master_of_coin"

# Run migration
diesel migration run

# Verify
diesel migration list

# Test rollback
diesel migration revert

# Re-apply
diesel migration run
```

### Step 4: Verify in Database

```sql
-- Check table structure
\d transactions

-- Test the new column
SELECT id, title, tags FROM transactions LIMIT 1;
```

---

## Running Migrations

### Using Diesel CLI

```bash
# Navigate to backend directory
cd backend

# Set database URL
export DATABASE_URL="postgresql://little-finger:password@localhost:5432/master_of_coin"

# Run all pending migrations
diesel migration run

# Check migration status
diesel migration list

# Revert last migration
diesel migration revert

# Redo last migration (revert then run)
diesel migration redo
```

### Using Docker Compose

Migrations run automatically when using Docker Compose:

```bash
docker-compose up -d postgres
```

The initialization script handles:

1. Database creation
2. Extension installation
3. Migration execution
4. Seed data loading

### Using Make Commands

```bash
# Run migrations
make db-migrate

# Full database initialization
make db-init

# Reset database (drop and recreate)
make db-reset
```

---

## Migration Best Practices

### 1. Always Use Transactions

Wrap DDL statements in transactions when possible:

```sql
BEGIN;

ALTER TABLE transactions ADD COLUMN new_field VARCHAR(255);
CREATE INDEX idx_transactions_new_field ON transactions(new_field);

COMMIT;
```

### 2. Make Migrations Idempotent

Use `IF EXISTS` and `IF NOT EXISTS`:

```sql
-- Safe to run multiple times
CREATE TABLE IF NOT EXISTS new_table (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4()
);

ALTER TABLE existing_table
ADD COLUMN IF NOT EXISTS new_column VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_name ON table_name(column_name);
```

### 3. Add Indexes Concurrently

For production, create indexes without locking:

```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_name
ON table_name(column_name);
```

### 4. Handle Data Migration Carefully

When changing data types or structures:

```sql
-- Step 1: Add new column
ALTER TABLE transactions ADD COLUMN new_amount DECIMAL(19,4);

-- Step 2: Migrate data
UPDATE transactions SET new_amount = amount::DECIMAL(19,4);

-- Step 3: Add constraints
ALTER TABLE transactions ALTER COLUMN new_amount SET NOT NULL;

-- Step 4: Drop old column (in separate migration)
-- ALTER TABLE transactions DROP COLUMN amount;
-- ALTER TABLE transactions RENAME COLUMN new_amount TO amount;
```

### 5. Test on Development First

Always test migrations on a development database before production:

```bash
# Create test database
createdb master_of_coin_test

# Test migration
DATABASE_URL="postgresql://user:pass@localhost/master_of_coin_test" sqlx migrate run

# Verify
psql master_of_coin_test -c "\dt"
```

### 6. Document Complex Migrations

Add comments explaining the purpose:

```sql
-- Migration: Add support for recurring transactions
-- Purpose: Allow users to set up automatic recurring transactions
-- Impact: Adds new table and foreign key to transactions table
-- Rollback: Drop recurring_transactions table and remove foreign key

CREATE TABLE recurring_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    -- ... rest of schema
);
```

### 7. Keep Migrations Small

One logical change per migration:

❌ Bad:

```sql
-- Too many changes in one migration
CREATE TABLE new_table1 (...);
CREATE TABLE new_table2 (...);
ALTER TABLE old_table ADD COLUMN ...;
CREATE INDEX ...;
```

✅ Good:

```sql
-- Migration 1: Create new_table1
CREATE TABLE new_table1 (...);

-- Migration 2: Create new_table2
CREATE TABLE new_table2 (...);

-- Migration 3: Add column to old_table
ALTER TABLE old_table ADD COLUMN ...;
```

---

## Rollback Strategy

### Diesel Rollback Support

Diesel provides built-in rollback support through `down.sql` files:

1. **Automatic Rollbacks**: Use `diesel migration revert`
2. **Database Backups**: Still recommended before major migrations
3. **Version Control**: Keep migration history in git

### Rollback Example

The `down.sql` file is automatically used when reverting:

```bash
# Revert the last migration
diesel migration revert

# Revert multiple migrations
diesel migration revert --all

# Redo a migration (revert then run)
diesel migration redo
```

### Backup Before Migration

```bash
# Create backup
./backend/scripts/backup.sh

# Run migration
sqlx migrate run

# If needed, restore
./backend/scripts/restore.sh backups/backup_YYYYMMDD_HHMMSS.sql
```

---

## Common Migration Patterns

### Adding a Column

```sql
ALTER TABLE table_name
ADD COLUMN column_name TYPE DEFAULT value;

-- Add index if needed
CREATE INDEX idx_table_column ON table_name(column_name);
```

### Modifying a Column

```sql
-- Change type
ALTER TABLE table_name
ALTER COLUMN column_name TYPE new_type USING column_name::new_type;

-- Add constraint
ALTER TABLE table_name
ALTER COLUMN column_name SET NOT NULL;

-- Change default
ALTER TABLE table_name
ALTER COLUMN column_name SET DEFAULT new_value;
```

### Adding a Foreign Key

```sql
-- Add column
ALTER TABLE child_table
ADD COLUMN parent_id UUID;

-- Add foreign key
ALTER TABLE child_table
ADD CONSTRAINT fk_child_parent
FOREIGN KEY (parent_id)
REFERENCES parent_table(id)
ON DELETE CASCADE;

-- Add index
CREATE INDEX idx_child_parent ON child_table(parent_id);
```

### Creating an ENUM

```sql
-- Create ENUM
CREATE TYPE status_type AS ENUM ('active', 'inactive', 'pending');

-- Use in table
ALTER TABLE table_name
ADD COLUMN status status_type DEFAULT 'active';
```

### Adding a Trigger

```sql
-- Create trigger function
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
CREATE TRIGGER update_table_timestamp
    BEFORE UPDATE ON table_name
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamp();
```

---

## Troubleshooting

### Migration Failed

```bash
# Check migration status
sqlx migrate info

# Check database logs
docker logs master-of-coin-db

# Connect to database
docker exec -it master-of-coin-db psql -U little-finger -d master_of_coin

# Check _sqlx_migrations table
SELECT * FROM _sqlx_migrations ORDER BY version;
```

### Migration Already Applied

If a migration shows as applied but you need to re-run it:

```sql
-- Remove from tracking table
DELETE FROM _sqlx_migrations WHERE version = 'YYYYMMDDHHMMSS';

-- Re-run migration
sqlx migrate run
```

### Fixing Failed Migration

1. Identify the issue in database logs
2. Fix the SQL in the migration file
3. Remove the failed migration from tracking:
   ```sql
   DELETE FROM _sqlx_migrations WHERE version = 'YYYYMMDDHHMMSS';
   ```
4. Re-run the migration

---

## Migration Checklist

Before running migrations in production:

- [ ] Test migration on development database
- [ ] Create database backup
- [ ] Review migration SQL for errors
- [ ] Check for breaking changes
- [ ] Verify indexes are created
- [ ] Test rollback procedure
- [ ] Document any manual steps required
- [ ] Notify team of downtime (if any)
- [ ] Monitor application after migration
- [ ] Verify data integrity

---

## Environment-Specific Considerations

### Development

- Fast iteration
- Can reset database frequently
- Test migrations thoroughly

### Staging

- Mirror production setup
- Test migrations before production
- Verify application compatibility

### Production

- **Always backup first**
- Run during low-traffic periods
- Monitor performance impact
- Have rollback plan ready
- Test on staging first
- Consider zero-downtime strategies

---

## Zero-Downtime Migrations

For production systems that can't have downtime:

### Strategy 1: Additive Changes

1. Add new column (nullable)
2. Deploy code that writes to both old and new
3. Backfill data
4. Deploy code that reads from new column
5. Remove old column (separate migration)

### Strategy 2: Blue-Green Deployment

1. Run migration on standby database
2. Switch traffic to updated database
3. Keep old database as backup

### Strategy 3: Feature Flags

1. Deploy code with feature flag (disabled)
2. Run migration
3. Enable feature flag
4. Monitor and rollback if needed

---

## Resources

- [Diesel Documentation](https://diesel.rs/)
- [Diesel Migration Guide](https://diesel.rs/guides/getting-started#migrations)
- [PostgreSQL ALTER TABLE](https://www.postgresql.org/docs/current/sql-altertable.html)
- [PostgreSQL Indexes](https://www.postgresql.org/docs/current/indexes.html)
- [Database Migration Best Practices](https://www.postgresql.org/docs/current/ddl.html)

---

## Getting Help

If you encounter issues:

1. Check Diesel documentation
2. Review PostgreSQL logs
3. Test on development database
4. Use `diesel migration list` to check status
5. Ask team for review
6. Create backup before attempting fixes
