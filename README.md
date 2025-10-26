# Master of Coin

A personal finance tracker application designed for 1-2 users to manage their finances comprehensively, including multi-account management, transaction tracking with split payments, debt tracking, and budget management.

## Features

- **Multi-Account Management**: Support for checking, savings, credit cards, investments, and cash accounts
- **Transaction Tracking**: Detailed transaction records with split payment support for group expenses
- **Debt Tracking**: Automatic debt calculation based on split payments, track who owes whom
- **Budget Management**: Flexible budgets with date ranges and multiple period types (daily/weekly/monthly/quarterly/yearly)
- **User-Defined Categories**: Fully customizable categories with icons and colors
- **Dashboard Analytics**: Net worth tracking, spending trends, category breakdowns, budget progress
- **Reports**: Monthly summaries, year-over-year comparisons, category analysis, tax reports

## Tech Stack

### Frontend

- **Framework**: React 18 with TypeScript
- **UI Library**: Chakra UI
- **State Management**: TanStack Query (React Query)
- **Routing**: React Router v6
- **Forms**: React Hook Form with Zod validation
- **Charts**: Recharts
- **HTTP Client**: Axios
- **Build Tool**: Vite

### Backend

- **Language**: Rust
- **Web Framework**: Axum
- **Database**: PostgreSQL 16
- **ORM**: Diesel
- **Authentication**: JWT with Argon2 password hashing
- **Async Runtime**: Tokio

### Deployment

- **Containerization**: Docker & Docker Compose
- **Reverse Proxy**: Cloudflare Tunnels for secure external access

## Prerequisites

Before you begin, ensure you have the following installed:

- **Rust**: 1.90.0 or higher

  ```bash
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
  ```

- **Node.js**: v20.19.3 or higher

  ```bash
  # Using nvm (recommended)
  nvm install 20.19.3
  nvm use 20.19.3
  ```

- **PostgreSQL**: 16.10 or higher

  ```bash

  ```

- **Diesel CLI**: For database migrations

  ```bash
  cargo install diesel_cli --no-default-features --features postgres
  ```

  # macOS

  brew install postgresql@16

  # Ubuntu/Debian

  sudo apt-get install postgresql-16

  ```

  ```

- **Docker**: 28.4.0 or higher (for deployment)

  ```bash
  # macOS
  brew install docker

  # Ubuntu/Debian
  sudo apt-get install docker.io docker-compose
  ```

## Setup Instructions

### 1. Clone the Repository

```bash
git clone <repository-url>
cd master-of-coin
```

### 2. Environment Configuration

Copy the example environment file and update with your values:

```bash
cp .env.example .env
```

Edit `.env` and update the following:

- `DATABASE_URL`: Your PostgreSQL connection string
- `JWT_SECRET`: A secure random string for JWT signing
- `VITE_API_URL`: Backend API URL (default: http://localhost:3001)

### 3. Database Setup

Start PostgreSQL and create the database:

```bash
# Start PostgreSQL service
# macOS
brew services start postgresql@16

# Ubuntu/Debian
sudo systemctl start postgresql

# Create database
createdb master_of_coin

# Run migrations with Diesel CLI
cd backend
diesel migration run
```

### 4. Backend Setup

```bash
cd backend

# Build the backend
cargo build

# Run the backend (development mode)
cargo run
```

The backend will start on `http://localhost:3001`

### 5. Frontend Setup

```bash
cd frontend

# Install dependencies (already done during initialization)
npm install

# Start development server
npm run dev
```

The frontend will start on `http://localhost:5173`

## Development Commands

### Backend

```bash
# Run in development mode with auto-reload
cargo watch -x run

# Run tests
cargo test

# Check code without building
cargo check

# Format code
cargo fmt

# Lint code
cargo clippy
```

### Frontend

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Lint code
npm run lint
```

## Project Structure

```
master-of-coin/
├── backend/                 # Rust backend
│   ├── src/
│   │   ├── main.rs         # Application entry point
│   │   ├── routes/         # API route handlers
│   │   ├── models/         # Data models
│   │   ├── services/       # Business logic
│   │   └── middleware/     # Custom middleware
│   ├── migrations/         # Database migrations
│   └── Cargo.toml          # Rust dependencies
│
├── frontend/               # React frontend
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── pages/          # Page components
│   │   ├── hooks/          # Custom React hooks
│   │   ├── services/       # API service layer
│   │   ├── utils/          # Utility functions
│   │   └── App.tsx         # Root component
│   ├── public/             # Static assets
│   └── package.json        # Node dependencies
│
├── docs/                   # Documentation
│   ├── system-design/      # System design documents
│   └── project-tracking/   # Project tracking checklists
│
├── .github/                # GitHub workflows
│   └── workflows/          # CI/CD pipelines
│
├── docker-compose.yml      # Docker composition (to be created)
├── .env.example            # Example environment variables
└── README.md              # This file
```

## Database Schema

The application uses PostgreSQL with the following main tables:

- `users`: User accounts
- `accounts`: Financial accounts (checking, savings, credit cards, etc.)
- `categories`: User-defined transaction categories
- `transactions`: Financial transactions
- `transaction_splits`: Split payment details
- `budgets`: Budget definitions
- `budget_ranges`: Budget amount ranges over time

For detailed schema information, see `docs/system-design/03-database/schema-design.md`

## API Documentation

The backend provides a RESTful API. Key endpoints include:

- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login
- `GET /api/accounts` - List accounts
- `POST /api/transactions` - Create transaction
- `GET /api/budgets` - List budgets
- `GET /api/dashboard` - Dashboard analytics

For complete API specification, see `docs/system-design/04-api/api-specification.md`

## Docker Deployment

To deploy using Docker:

```bash
# Build and start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

## Contributing

This is a personal project, but suggestions and improvements are welcome. Please follow these guidelines:

1. Follow the existing code style
2. Write tests for new features
3. Update documentation as needed
4. Keep commits atomic and well-described

## License

This project is private and not licensed for public use.

## Roadmap

- [ ] Phase 1: Database setup and migrations
- [ ] Phase 2: Backend API implementation
- [ ] Phase 3: Frontend UI development
- [ ] Phase 4: Integration and testing
- [ ] Phase 5: Docker deployment setup
- [ ] Phase 6: Production deployment

## Support

For issues or questions, please refer to the documentation in the `docs/` directory or create an issue in the repository.
