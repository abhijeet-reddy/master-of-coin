# Database Schema Documentation

## Overview

Master of Coin uses PostgreSQL 16 with a relational schema designed for personal finance management. The schema supports multi-user operations, transaction tracking, budgeting, and expense splitting.

## Database Information

- **Database Name:** master_of_coin
- **PostgreSQL Version:** 16
- **Extensions:** uuid-ossp
- **Character Set:** UTF-8

## Tables

### users

Stores user account information.

| Column        | Type                     | Constraints               | Description                |
| ------------- | ------------------------ | ------------------------- | -------------------------- |
| id            | UUID                     | PRIMARY KEY, DEFAULT      | Unique user identifier     |
| username      | VARCHAR(50)              | UNIQUE, NOT NULL          | User's login username      |
| email         | VARCHAR(255)             | UNIQUE, NOT NULL          | User's email address       |
| password_hash | VARCHAR(255)             | NOT NULL                  | Hashed password            |
| name          | VARCHAR(255)             | NOT NULL                  | User's display name        |
| created_at    | TIMESTAMP WITH TIME ZONE | DEFAULT CURRENT_TIMESTAMP | Account creation timestamp |
| updated_at    | TIMESTAMP WITH TIME ZONE | DEFAULT CURRENT_TIMESTAMP | Last update timestamp      |

**Indexes:**

- `idx_users_username` on username
- `idx_users_email` on email

**Triggers:**

- `update_users_updated_at` - Automatically updates updated_at on row modification

---

### accounts

Stores financial accounts (checking, savings, credit cards, etc.).

| Column       | Type                     | Constraints               | Description               |
| ------------ | ------------------------ | ------------------------- | ------------------------- |
| id           | UUID                     | PRIMARY KEY, DEFAULT      | Unique account identifier |
| user_id      | UUID                     | NOT NULL, FK → users      | Owner of the account      |
| name         | VARCHAR(255)             | NOT NULL                  | Account name              |
| account_type | account_type (ENUM)      | NOT NULL                  | Type of account           |
| currency     | currency_code (ENUM)     | DEFAULT 'EUR'             | Account currency          |
| notes        | TEXT                     |                           | Additional notes          |
| created_at   | TIMESTAMP WITH TIME ZONE | DEFAULT CURRENT_TIMESTAMP | Creation timestamp        |
| updated_at   | TIMESTAMP WITH TIME ZONE | DEFAULT CURRENT_TIMESTAMP | Last update timestamp     |

**Account Types (ENUM):**

- CHECKING
- SAVINGS
- CREDIT_CARD
- INVESTMENT
- CASH

**Currency Codes (ENUM):**

- USD, EUR, GBP, INR, JPY, AUD, CAD

**Indexes:**

- `idx_accounts_user_id` on user_id
- `idx_accounts_type` on account_type

**Triggers:**

- `update_accounts_updated_at` - Automatically updates updated_at on row modification

**Foreign Keys:**

- user_id → users(id) ON DELETE CASCADE

---

### categories

Stores transaction categories with hierarchical support.

| Column             | Type                     | Constraints               | Description                     |
| ------------------ | ------------------------ | ------------------------- | ------------------------------- |
| id                 | UUID                     | PRIMARY KEY, DEFAULT      | Unique category identifier      |
| user_id            | UUID                     | NOT NULL, FK → users      | Owner of the category           |
| name               | VARCHAR(255)             | NOT NULL                  | Category name                   |
| icon               | VARCHAR(50)              |                           | Icon identifier                 |
| color              | VARCHAR(7)               |                           | Hex color code                  |
| parent_category_id | UUID                     | FK → categories           | Parent category (for hierarchy) |
| created_at         | TIMESTAMP WITH TIME ZONE | DEFAULT CURRENT_TIMESTAMP | Creation timestamp              |
| updated_at         | TIMESTAMP WITH TIME ZONE | DEFAULT CURRENT_TIMESTAMP | Last update timestamp           |

**Constraints:**

- UNIQUE(user_id, name) - Category names must be unique per user

**Indexes:**

- `idx_categories_user_id` on user_id
- `idx_categories_parent` on parent_category_id

**Triggers:**

- `update_categories_updated_at` - Automatically updates updated_at on row modification

**Foreign Keys:**

- user_id → users(id) ON DELETE CASCADE
- parent_category_id → categories(id) ON DELETE SET NULL

---

### people

Stores people for expense splitting.

| Column     | Type                     | Constraints               | Description                |
| ---------- | ------------------------ | ------------------------- | -------------------------- |
| id         | UUID                     | PRIMARY KEY, DEFAULT      | Unique person identifier   |
| user_id    | UUID                     | NOT NULL, FK → users      | Owner of the person record |
| name       | VARCHAR(255)             | NOT NULL                  | Person's name              |
| email      | VARCHAR(255)             |                           | Person's email             |
| phone      | VARCHAR(50)              |                           | Person's phone number      |
| notes      | TEXT                     |                           | Additional notes           |
| created_at | TIMESTAMP WITH TIME ZONE | DEFAULT CURRENT_TIMESTAMP | Creation timestamp         |
| updated_at | TIMESTAMP WITH TIME ZONE | DEFAULT CURRENT_TIMESTAMP | Last update timestamp      |

**Indexes:**

- `idx_people_user_id` on user_id
- `idx_people_user_name` on (user_id, name)

**Triggers:**

- `update_people_updated_at` - Automatically updates updated_at on row modification

**Foreign Keys:**

- user_id → users(id) ON DELETE CASCADE

---

### transactions

Stores financial transactions.

| Column      | Type                     | Constraints               | Description                   |
| ----------- | ------------------------ | ------------------------- | ----------------------------- |
| id          | UUID                     | PRIMARY KEY, DEFAULT      | Unique transaction identifier |
| user_id     | UUID                     | NOT NULL, FK → users      | Owner of the transaction      |
| account_id  | UUID                     | NOT NULL, FK → accounts   | Associated account            |
| category_id | UUID                     | FK → categories           | Transaction category          |
| title       | VARCHAR(255)             | NOT NULL                  | Transaction description       |
| amount      | DECIMAL(19, 2)           | NOT NULL                  | Transaction amount            |
| date        | TIMESTAMP WITH TIME ZONE | NOT NULL                  | Transaction date              |
| notes       | TEXT                     |                           | Additional notes              |
| created_at  | TIMESTAMP WITH TIME ZONE | DEFAULT CURRENT_TIMESTAMP | Creation timestamp            |
| updated_at  | TIMESTAMP WITH TIME ZONE | DEFAULT CURRENT_TIMESTAMP | Last update timestamp         |

**Indexes:**

- `idx_transactions_user_id` on user_id
- `idx_transactions_account_id` on account_id
- `idx_transactions_category_id` on category_id
- `idx_transactions_date` on date DESC
- `idx_transactions_user_date` on (user_id, date DESC)
- `idx_transactions_amount` on amount

**Triggers:**

- `update_transactions_updated_at` - Automatically updates updated_at on row modification

**Foreign Keys:**

- user_id → users(id) ON DELETE CASCADE
- account_id → accounts(id) ON DELETE RESTRICT
- category_id → categories(id) ON DELETE SET NULL

---

### transaction_splits

Stores split payment information for transactions.

| Column         | Type                     | Constraints                 | Description             |
| -------------- | ------------------------ | --------------------------- | ----------------------- |
| id             | UUID                     | PRIMARY KEY, DEFAULT        | Unique split identifier |
| transaction_id | UUID                     | NOT NULL, FK → transactions | Associated transaction  |
| person_id      | UUID                     | NOT NULL, FK → people       | Person in the split     |
| amount         | DECIMAL(19, 2)           | NOT NULL                    | Split amount            |
| created_at     | TIMESTAMP WITH TIME ZONE | DEFAULT CURRENT_TIMESTAMP   | Creation timestamp      |

**Indexes:**

- `idx_splits_transaction_id` on transaction_id
- `idx_splits_person_id` on person_id

**Foreign Keys:**

- transaction_id → transactions(id) ON DELETE CASCADE
- person_id → people(id) ON DELETE RESTRICT

---

### budgets

Stores budget definitions with flexible filtering.

| Column     | Type                     | Constraints               | Description              |
| ---------- | ------------------------ | ------------------------- | ------------------------ |
| id         | UUID                     | PRIMARY KEY, DEFAULT      | Unique budget identifier |
| user_id    | UUID                     | NOT NULL, FK → users      | Owner of the budget      |
| name       | VARCHAR(255)             | NOT NULL                  | Budget name              |
| filters    | JSONB                    | NOT NULL                  | Budget filter criteria   |
| created_at | TIMESTAMP WITH TIME ZONE | DEFAULT CURRENT_TIMESTAMP | Creation timestamp       |
| updated_at | TIMESTAMP WITH TIME ZONE | DEFAULT CURRENT_TIMESTAMP | Last update timestamp    |

**Indexes:**

- `idx_budgets_user_id` on user_id
- `idx_budgets_filters` GIN index on filters (for JSONB queries)

**Triggers:**

- `update_budgets_updated_at` - Automatically updates updated_at on row modification

**Foreign Keys:**

- user_id → users(id) ON DELETE CASCADE

---

### budget_ranges

Stores time-based budget limits.

| Column       | Type                     | Constraints               | Description             |
| ------------ | ------------------------ | ------------------------- | ----------------------- |
| id           | UUID                     | PRIMARY KEY, DEFAULT      | Unique range identifier |
| budget_id    | UUID                     | NOT NULL, FK → budgets    | Associated budget       |
| limit_amount | DECIMAL(19, 2)           | NOT NULL, CHECK > 0       | Budget limit amount     |
| period       | budget_period (ENUM)     | NOT NULL                  | Budget period type      |
| start_date   | DATE                     | NOT NULL                  | Period start date       |
| end_date     | DATE                     | NOT NULL                  | Period end date         |
| created_at   | TIMESTAMP WITH TIME ZONE | DEFAULT CURRENT_TIMESTAMP | Creation timestamp      |

**Budget Periods (ENUM):**

- DAILY
- WEEKLY
- MONTHLY
- QUARTERLY
- YEARLY

**Constraints:**

- CHECK (end_date >= start_date) - Valid date range
- CHECK (limit_amount > 0) - Positive limit

**Indexes:**

- `idx_budget_ranges_budget_id` on budget_id
- `idx_budget_ranges_dates` on (start_date, end_date)
- `idx_budget_ranges_period` on period

**Foreign Keys:**

- budget_id → budgets(id) ON DELETE CASCADE

---

## Relationships

### One-to-Many Relationships

1. **users → accounts**: One user can have multiple accounts
2. **users → categories**: One user can have multiple categories
3. **users → people**: One user can have multiple people records
4. **users → transactions**: One user can have multiple transactions
5. **users → budgets**: One user can have multiple budgets
6. **accounts → transactions**: One account can have multiple transactions
7. **categories → transactions**: One category can be used in multiple transactions
8. **categories → categories**: Categories can have child categories (hierarchical)
9. **transactions → transaction_splits**: One transaction can have multiple splits
10. **people → transaction_splits**: One person can be in multiple splits
11. **budgets → budget_ranges**: One budget can have multiple time ranges

### Cascade Behaviors

- **ON DELETE CASCADE**: When a user is deleted, all their accounts, categories, people, transactions, and budgets are deleted
- **ON DELETE RESTRICT**: Prevents deletion if referenced (e.g., can't delete an account with transactions)
- **ON DELETE SET NULL**: Sets foreign key to NULL when referenced record is deleted

---

## Index Strategy

### Performance Indexes

1. **User-based queries**: All tables have indexes on user_id for efficient user data retrieval
2. **Transaction queries**:
   - Composite index on (user_id, date DESC) for efficient transaction listing
   - Individual indexes on account_id, category_id for filtering
   - Index on amount for range queries
3. **Category hierarchy**: Index on parent_category_id for efficient tree traversal
4. **Budget queries**: GIN index on JSONB filters for flexible budget criteria matching
5. **Date-based queries**: Indexes on date columns for time-range queries

### Unique Constraints

1. **users**: username and email must be unique
2. **categories**: name must be unique per user

---

## Triggers

All tables with an `updated_at` column have an automatic trigger that updates this timestamp whenever a row is modified:

```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';
```

Applied to: users, accounts, categories, people, transactions, budgets

---

## Data Types

### Custom ENUM Types

1. **account_type**: CHECKING, SAVINGS, CREDIT_CARD, INVESTMENT, CASH
2. **currency_code**: USD, EUR, GBP, INR, JPY, AUD, CAD
3. **budget_period**: DAILY, WEEKLY, MONTHLY, QUARTERLY, YEARLY

### Standard Types

- **UUID**: Used for all primary keys (generated via uuid-ossp extension)
- **VARCHAR**: Used for text fields with length constraints
- **TEXT**: Used for unlimited text (notes, descriptions)
- **DECIMAL(19, 2)**: Used for monetary amounts (19 digits total, 2 decimal places)
- **TIMESTAMP WITH TIME ZONE**: Used for all timestamps to support international users
- **DATE**: Used for date-only fields (budget ranges)
- **JSONB**: Used for flexible filter criteria in budgets

---

## Migration History

All migrations are tracked in the `_sqlx_migrations` table:

1. **20251024000001**: Create ENUM types
2. **20251024000002**: Create users table
3. **20251024000003**: Create accounts table
4. **20251024000004**: Create categories table
5. **20251024000005**: Create people table
6. **20251024000006**: Create transactions table
7. **20251024000007**: Create transaction_splits table
8. **20251024000008**: Create budgets table
9. **20251024000009**: Create budget_ranges table
10. **20251024000010**: Create triggers

---

## Security Considerations

1. **Password Storage**: Passwords are stored as hashes, never in plain text
2. **User Isolation**: All user data is isolated via user_id foreign keys
3. **Cascade Deletion**: User deletion cascades to all owned data
4. **Referential Integrity**: Foreign key constraints prevent orphaned records
5. **Data Validation**: CHECK constraints ensure data validity (positive amounts, valid date ranges)

---

## Performance Considerations

1. **Index Coverage**: All common query patterns are covered by indexes
2. **Composite Indexes**: Used for multi-column queries (user_id + date)
3. **GIN Indexes**: Used for JSONB queries on budget filters
4. **Timestamp Indexes**: DESC indexes for efficient recent-first queries
5. **Connection Pooling**: Application uses connection pooling for efficient database access

---

## Backup and Maintenance

- **Backup Script**: `backend/scripts/backup.sh`
- **Restore Script**: `backend/scripts/restore.sh`
- **Seed Data**: `backend/scripts/seed.sql`
- **Initialization**: `backend/scripts/init-db.sh`

---

## Future Enhancements

Potential schema improvements for future versions:

1. **Recurring Transactions**: Add support for recurring transaction templates
2. **Multi-Currency**: Enhanced multi-currency support with exchange rates
3. **Attachments**: Support for receipt/document attachments
4. **Tags**: Flexible tagging system for transactions
5. **Goals**: Financial goal tracking
6. **Reports**: Pre-computed report tables for performance
7. **Audit Log**: Track all changes for compliance
8. **Soft Deletes**: Implement soft delete for data recovery
