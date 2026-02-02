# Backend Testing Guide

## Testing Your Changes

**CRITICAL:** After making any backend code changes, you MUST write tests and verify they pass before committing.

## Types of Tests

### 1. Unit Tests

**⚠️ IMPORTANT: Do NOT write unit tests in source files**

- All tests should be written in separate test files under `backend/tests/integration/`
- Do NOT use `#[cfg(test)] mod tests { ... }` in source files
- Keep source code clean and focused on implementation only

**Why?**

- Keeps source files focused and readable
- Easier to maintain and organize tests
- Follows project conventions
- Better separation of concerns
- Consistent test organization across the project

### 2. Integration Tests - API (`integration_api`)

- Test HTTP endpoints end-to-end
- Located in `backend/tests/integration/api/`
- Tests request/response, authentication, business logic
- Example: Creating an account via POST `/api/accounts`

### 3. Integration Tests - Database (`integration_database`)

- Test database operations directly
- Located in `backend/tests/integration/database/`
- Tests models, relationships, custom types
- Example: Testing user CRUD operations with Diesel

**When to write which test:**

- Changed a utility function? → Integration test (in `tests/integration/`)
- Changed an API endpoint? → API integration test
- Changed a database model? → Database integration test
- Added new authentication method? → Both API and database tests

## Prerequisites (One-Time Setup)

Ensure these are set up once:

1. **Create `.env` file** (if it doesn't exist):

   ```bash
   cp .env.example .env
   ```

2. **Start the database**:

   ```bash
   docker-compose up -d postgres
   ```

3. **Run migrations**:
   ```bash
   cd backend && diesel migration run
   ```

## Testing Workflow

### 1. Write a Test for Your Change

Add tests in the appropriate file under `backend/tests/integration/`:

- API changes → `api/test_*.rs`
- Database changes → `database/test_*.rs`

### 2. Run Your Specific Test File

Test just the file you're working on:

```bash
cd backend
cargo test --test integration_api test_accounts    # For accounts tests
cargo test --test integration_api test_transactions # For transaction tests
cargo test --test integration_api test_auth        # For auth tests
# etc.
```

### 3. Run All Tests

Before committing, run the full test suite:

```bash
cd backend
cargo test
```

## Quick Reference

**Single test:**

```bash
cd backend
cargo test --test integration_api test_accounts::test_create_account_success
```

**All API tests:**

```bash
cd backend
cargo test --test integration_api
```

**All database tests:**

```bash
cd backend
cargo test --test integration_database
```

**Everything:**

```bash
cd backend
cargo test
```

## Pre-Commit Checklist

- [ ] Write test for your change (in `tests/integration/`, NOT in source files)
- [ ] Run specific test file: `cargo test --test integration_api test_<module>`
- [ ] Run all tests: `cargo test`
- [ ] All tests pass ✅
- [ ] No unit tests added to source files (use integration tests instead)

## Common Issues

**"DATABASE_URL must be set"** → Create `.env` file: `cp .env.example .env`

**"Connection refused"** → Start database: `docker-compose up -d postgres`

**"Relation does not exist"** → Run migrations: `cd backend && diesel migration run`
