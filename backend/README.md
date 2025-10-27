# Master of Coin - Backend

Rust backend API for Master of Coin personal finance application.

## Tech Stack

- **Framework**: Axum (async web framework)
- **ORM**: Diesel (type-safe query builder)
- **Database**: PostgreSQL
- **Authentication**: JWT + Argon2
- **Validation**: validator crate

## Features

- ✅ User authentication (register, login, JWT tokens)
- ✅ Account management (multiple accounts, balance tracking)
- ✅ Transaction management (income, expenses, transfers)
- ✅ Transaction splits (shared expenses)
- ✅ Budget tracking (with date ranges and filters)
- ✅ Category management (hierarchical categories)
- ✅ People management (for shared expenses)
- ✅ Debt tracking and settlement
- ✅ Analytics dashboard (net worth, spending trends, category breakdown)

## Getting Started

### Prerequisites

- Rust 1.70+
- PostgreSQL 14+
- Diesel CLI: `cargo install diesel_cli --no-default-features --features postgres`

### Setup

1. Copy environment variables:

   ```bash
   cp ../.env.example .env
   ```

2. Update `.env` with your database credentials

3. Run migrations:

   ```bash
   diesel migration run
   ```

4. Start the server:
   ```bash
   cargo run
   ```

Server will start on `http://127.0.0.1:8080`

## API Endpoints

### Authentication

- `POST /api/v1/auth/register` - Register new user
- `POST /api/v1/auth/login` - Login user
- `GET /api/v1/auth/me` - Get current user (protected)

### Transactions

- `GET /api/v1/transactions` - List transactions (with filters)
- `POST /api/v1/transactions` - Create transaction
- `GET /api/v1/transactions/:id` - Get transaction
- `PUT /api/v1/transactions/:id` - Update transaction
- `DELETE /api/v1/transactions/:id` - Delete transaction

### Accounts

- `GET /api/v1/accounts` - List accounts
- `POST /api/v1/accounts` - Create account
- `GET /api/v1/accounts/:id` - Get account
- `PUT /api/v1/accounts/:id` - Update account
- `DELETE /api/v1/accounts/:id` - Delete account

### Budgets

- `GET /api/v1/budgets` - List budgets
- `POST /api/v1/budgets` - Create budget
- `GET /api/v1/budgets/:id` - Get budget
- `PUT /api/v1/budgets/:id` - Update budget
- `DELETE /api/v1/budgets/:id` - Delete budget
- `POST /api/v1/budgets/:id/ranges` - Add budget range

### People

- `GET /api/v1/people` - List people
- `POST /api/v1/people` - Create person
- `GET /api/v1/people/:id` - Get person
- `PUT /api/v1/people/:id` - Update person
- `DELETE /api/v1/people/:id` - Delete person
- `GET /api/v1/people/:id/debts` - Get debts for person
- `POST /api/v1/people/:id/settle` - Settle debt

### Categories

- `GET /api/v1/categories` - List categories
- `POST /api/v1/categories` - Create category
- `PUT /api/v1/categories/:id` - Update category
- `DELETE /api/v1/categories/:id` - Delete category

### Dashboard

- `GET /api/v1/dashboard` - Get dashboard summary

## Development

### Run tests

```bash
cargo test
```

### Check code

```bash
cargo check
cargo clippy
```

### Format code

```bash
cargo fmt
```

## Architecture

```
src/
├── api/          # API routes and configuration
├── auth/         # Authentication (JWT, password hashing)
├── config/       # Configuration management
├── db/           # Database utilities
├── errors/       # Error types and handling
├── handlers/     # HTTP request handlers
├── middleware/   # Middleware (auth, logging, CORS)
├── models/       # Data models and DTOs
├── repositories/ # Data access layer (Diesel queries)
├── services/     # Business logic layer
├── types/        # Custom types (enums, etc.)
└── utils/        # Utility functions
```

## License

See LICENSE file in project root.
