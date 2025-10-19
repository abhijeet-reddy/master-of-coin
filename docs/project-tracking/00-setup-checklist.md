# Setup Checklist

## Overview
This checklist covers the initial development environment setup and project initialization for Master of Coin.

---

## Development Environment Setup

### System Requirements
- [x] Verify system meets minimum requirements
  - [x] macOS/Linux/Windows with WSL2
  - [x] At least 8GB RAM available
  - [x] At least 20GB free disk space

### Core Tools Installation

#### Rust Development
- [x] Install Rust toolchain (1.75+)
  - [x] Run: `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`
  - [x] Verify: `rustc --version`
  - [x] Verify: `cargo --version`
- [x] Install Rust development tools
  - [x] Install rust-analyzer: `rustup component add rust-analyzer`
  - [x] Install clippy: `rustup component add clippy`
  - [x] Install rustfmt: `rustup component add rustfmt`

#### Node.js & Frontend Tools
- [x] Install Node.js (v18+ LTS)
  - [x] Download from nodejs.org or use nvm
  - [x] Verify: `node --version`
  - [x] Verify: `npm --version`
- [x] Install pnpm (optional but recommended)
  - [x] Run: `npm install -g pnpm`
  - [x] Verify: `pnpm --version`

#### Database
- [x] Install PostgreSQL 16
  - [x] Download from postgresql.org
  - [x] Verify: `psql --version`
  - [x] Start PostgreSQL service
  - [x] Test connection: `psql -U postgres`
- [x] Install PostgreSQL client tools
  - [x] pgAdmin (GUI) or
  - [x] psql (CLI)

#### Docker & Container Tools
- [x] Install Docker Desktop
  - [x] Download from docker.com
  - [x] Verify: `docker --version`
  - [x] Verify: `docker-compose --version`
- [x] Start Docker daemon
- [x] Test Docker: `docker run hello-world`

#### Version Control
- [x] Install Git
  - [x] Verify: `git --version`
- [x] Configure Git
  - [x] Set name: `git config --global user.name "Your Name"`
  - [x] Set email: `git config --global user.email "your.email@example.com"`

---

## IDE Configuration

### VS Code Setup (Recommended)
- [x] Install Visual Studio Code
- [x] Install essential extensions
  - [x] rust-analyzer (Rust language support)
  - [x] CodeLLDB (Rust debugging)
  - [x] Even Better TOML (TOML syntax)
  - [x] ES7+ React/Redux/React-Native snippets
  - [x] ESLint
  - [x] Prettier - Code formatter
  - [x] Tailwind CSS IntelliSense (if using Tailwind)
  - [x] PostgreSQL (SQL syntax highlighting)
  - [x] Docker
  - [x] GitLens

### VS Code Settings
- [ ] Create `.vscode/settings.json`
  ```json
  {
    "rust-analyzer.checkOnSave.command": "clippy",
    "editor.formatOnSave": true,
    "editor.defaultFormatter": "esbenp.prettier-vscode",
    "[rust]": {
      "editor.defaultFormatter": "rust-lang.rust-analyzer"
    }
  }
  ```
- [ ] Create `.vscode/extensions.json` with recommended extensions

---

## Project Initialization

### Repository Setup
- [x] Create GitHub/GitLab repository
  - [x] Repository name: `master-of-coin`
  - [x] Initialize with README
  - [x] Add .gitignore (Rust + Node.js)
- [x] Clone repository locally
  - [x] `git clone <repository-url>`
  - [x] `cd master-of-coin`

### Project Structure
- [x] Create root directory structure
  ```
  master-of-coin/
  ├── backend/
  ├── frontend/
  ├── docs/
  ├── docker-compose.yml
  ├── .env.example
  ├── .gitignore
  └── README.md
  ```

### Backend Initialization
- [x] Navigate to backend directory: `cd backend`
- [x] Initialize Rust project
  - [x] Run: `cargo init --name master-of-coin-backend`
  - [x] Verify Cargo.toml created
- [ ] Create backend directory structure
  ```
  backend/
  ├── src/
  │   ├── main.rs
  │   ├── lib.rs
  │   ├── config.rs
  │   ├── api/
  │   ├── services/
  │   ├── repositories/
  │   ├── models/
  │   ├── db/
  │   ├── auth/
  │   ├── errors/
  │   └── utils/
  ├── migrations/
  ├── tests/
  ├── Cargo.toml
  ├── Cargo.lock
  └── Dockerfile
  ```
- [ ] Create placeholder files for each module

### Frontend Initialization
- [x] Navigate to frontend directory: `cd ../frontend`
- [x] Initialize Vite + React + TypeScript project
  - [x] Run: `npm create vite@latest . -- --template react-ts`
  - [x] Or: `pnpm create vite . -- --template react-ts`
- [x] Install dependencies: `npm install` or `pnpm install`
- [ ] Create frontend directory structure
  ```
  frontend/
  ├── src/
  │   ├── main.tsx
  │   ├── App.tsx
  │   ├── components/
  │   ├── pages/
  │   ├── hooks/
  │   ├── contexts/
  │   ├── services/
  │   ├── types/
  │   ├── utils/
  │   └── theme/
  ├── public/
  ├── index.html
  ├── package.json
  ├── tsconfig.json
  ├── vite.config.ts
  └── .eslintrc.js
  ```

---

## Configuration Files

### Root Configuration
- [x] Create `.env.example`
  ```env
  # Database
  DATABASE_URL=postgresql://postgres:password@localhost:5432/master_of_coin
  DB_PASSWORD=your_secure_password
  
  # Backend
  JWT_SECRET=your_jwt_secret_min_32_characters
  RUST_LOG=info
  
  # Cloudflare Tunnel (for deployment)
  CLOUDFLARE_TUNNEL_TOKEN=your_tunnel_token
  ```
- [x] Create `.env` from `.env.example` (add to .gitignore)
- [x] Create `.gitignore`
  ```
  # Rust
  target/
  Cargo.lock
  
  # Node
  node_modules/
  dist/
  .env
  .env.local
  
  # IDE
  .vscode/
  .idea/
  
  # OS
  .DS_Store
  Thumbs.db
  
  # Database
  *.db
  *.sqlite
  
  # Logs
  *.log
  ```

### Docker Compose (Initial)
- [ ] Create `docker-compose.yml` (development version)
  ```yaml
  version: '3.8'
  
  services:
    postgres:
      image: postgres:16-alpine
      container_name: master-of-coin-db-dev
      environment:
        POSTGRES_DB: master_of_coin
        POSTGRES_USER: postgres
        POSTGRES_PASSWORD: ${DB_PASSWORD}
      ports:
        - "5432:5432"
      volumes:
        - postgres-data:/var/lib/postgresql/data
      healthcheck:
        test: ["CMD-SHELL", "pg_isready -U postgres"]
        interval: 10s
        timeout: 5s
        retries: 5
  
  volumes:
    postgres-data:
  ```

---

## Dependency Installation

### Backend Dependencies
- [x] Add dependencies to `backend/Cargo.toml`
  ```toml
  [dependencies]
  # Web framework
  axum = "0.7"
  tokio = { version = "1", features = ["full"] }
  tower = "0.4"
  tower-http = { version = "0.5", features = ["cors", "trace", "fs"] }
  
  # Database
  sqlx = { version = "0.7", features = ["runtime-tokio", "postgres", "uuid", "chrono", "json"] }
  
  # Serialization
  serde = { version = "1.0", features = ["derive"] }
  serde_json = "1.0"
  
  # Authentication
  jsonwebtoken = "9.2"
  argon2 = "0.5"
  
  # Validation
  validator = { version = "0.16", features = ["derive"] }
  
  # Error handling
  thiserror = "1.0"
  anyhow = "1.0"
  
  # Logging
  tracing = "0.1"
  tracing-subscriber = { version = "0.3", features = ["env-filter"] }
  
  # Configuration
  config = "0.13"
  dotenvy = "0.15"
  
  # UUID
  uuid = { version = "1.6", features = ["serde", "v4"] }
  
  # Date/Time
  chrono = { version = "0.4", features = ["serde"] }
  ```
- [ ] Run: `cargo build` to download and compile dependencies
- [ ] Verify build succeeds

### Frontend Dependencies
- [ ] Install core dependencies
  ```bash
  npm install @chakra-ui/react @chakra-ui/icons @emotion/react @emotion/styled framer-motion
  ```
- [ ] Install routing
  ```bash
  npm install react-router-dom
  ```
- [ ] Install state management
  ```bash
  npm install @tanstack/react-query @tanstack/react-query-devtools
  ```
- [ ] Install form handling
  ```bash
  npm install react-hook-form @hookform/resolvers zod
  ```
- [ ] Install data visualization
  ```bash
  npm install recharts
  ```
- [ ] Install utilities
  ```bash
  npm install axios date-fns
  ```
- [ ] Install table library
  ```bash
  npm install @tanstack/react-table
  ```
- [ ] Install date picker
  ```bash
  npm install react-datepicker @types/react-datepicker
  ```
- [ ] Install icons
  ```bash
  npm install react-icons
  ```

### Development Dependencies
- [ ] Install frontend dev dependencies
  ```bash
  npm install -D @types/node @types/react @types/react-dom
  npm install -D eslint @typescript-eslint/eslint-plugin @typescript-eslint/parser
  npm install -D prettier eslint-config-prettier eslint-plugin-prettier
  npm install -D vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event
  ```

---

## Initial Configuration

### Backend Configuration
- [ ] Create `backend/src/config.rs` with basic structure
- [ ] Set up environment variable loading
- [ ] Configure logging with tracing

### Frontend Configuration
- [ ] Configure Chakra UI theme in `src/theme/index.ts`
- [ ] Set up React Query client
- [ ] Configure Axios defaults
- [ ] Set up routing structure

### ESLint & Prettier
- [ ] Create `frontend/.eslintrc.js`
- [ ] Create `frontend/.prettierrc`
- [ ] Add format scripts to package.json
  ```json
  {
    "scripts": {
      "format": "prettier --write \"src/**/*.{ts,tsx}\"",
      "lint": "eslint src --ext ts,tsx --report-unused-disable-directives --max-warnings 0"
    }
  }
  ```

---

## Verification Steps

### Backend Verification
- [ ] Run `cargo check` - should pass
- [ ] Run `cargo clippy` - should have no warnings
- [ ] Run `cargo test` - should pass (even with no tests)
- [ ] Run `cargo run` - should compile and start (may error without DB)

### Frontend Verification
- [ ] Run `npm run dev` - should start dev server
- [ ] Open http://localhost:5173 - should show Vite + React page
- [ ] Run `npm run build` - should create dist/ folder
- [ ] Run `npm run lint` - should pass
- [ ] Run `npm run format` - should format files

### Database Verification
- [ ] Start Docker Compose: `docker-compose up -d`
- [ ] Check PostgreSQL is running: `docker ps`
- [ ] Connect to database: `psql -h localhost -U postgres -d master_of_coin`
- [ ] Verify connection successful

---

## Documentation Setup

### Project Documentation
- [ ] Create comprehensive README.md
  - [ ] Project description
  - [ ] Features list
  - [ ] Tech stack
  - [ ] Setup instructions
  - [ ] Development workflow
  - [ ] Contributing guidelines
- [ ] Create CONTRIBUTING.md
- [ ] Create LICENSE file

### Development Documentation
- [ ] Document environment setup process
- [ ] Create architecture diagrams
- [ ] Document coding standards
- [ ] Create API documentation structure

---

## Git Workflow Setup

### Branch Strategy
- [ ] Create development branch: `git checkout -b develop`
- [ ] Set up branch protection rules (if using GitHub/GitLab)
  - [ ] Require PR reviews
  - [ ] Require status checks to pass

### Commit Convention
- [ ] Decide on commit message format (e.g., Conventional Commits)
- [ ] Document in CONTRIBUTING.md

### Initial Commit
- [ ] Stage all files: `git add .`
- [ ] Commit: `git commit -m "chore: initial project setup"`
- [ ] Push: `git push -u origin main`

---

## Troubleshooting Common Issues

### Rust Issues
- [ ] If compilation fails, check Rust version: `rustc --version`
- [ ] Update Rust: `rustup update`
- [ ] Clear cargo cache: `cargo clean`

### Node Issues
- [ ] If npm install fails, try: `npm cache clean --force`
- [ ] Delete node_modules and package-lock.json, reinstall
- [ ] Check Node version compatibility

### Docker Issues
- [ ] Ensure Docker daemon is running
- [ ] Check port 5432 is not already in use
- [ ] Reset Docker: `docker-compose down -v`

### PostgreSQL Issues
- [ ] Verify PostgreSQL is running: `docker ps`
- [ ] Check logs: `docker-compose logs postgres`
- [ ] Ensure DATABASE_URL is correct in .env

---

## Completion Checklist

- [ ] All tools installed and verified
- [ ] Project structure created
- [ ] Dependencies installed
- [ ] Configuration files in place
- [ ] Backend compiles successfully
- [ ] Frontend runs in development mode
- [ ] Database container running
- [x] Git repository initialized
- [ ] Documentation created
- [ ] Initial commit pushed

**Estimated Time:** 2-4 hours

**Next Steps:** Proceed to [`01-database-checklist.md`](01-database-checklist.md)