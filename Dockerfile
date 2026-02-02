# Multi-stage Dockerfile for Master of Coin Backend with Frontend Integration
# This Dockerfile builds both the React frontend and Rust backend in a single optimized image
# Build context: . (root directory)

# ============================================================================
# Stage 1: Frontend Builder - Build React/TypeScript/Vite application
# ============================================================================
FROM node:20-alpine AS frontend-builder

# Build argument for exchange rate API key (passed from environment)
ARG EXCHANGE_RATE_API_KEY

WORKDIR /frontend

# Copy frontend package files for dependency installation
COPY frontend/package*.json ./

# Install dependencies using clean install for reproducible builds
RUN npm ci --only=production

# Copy frontend source code
COPY frontend/ ./

# Create .env file with build-time environment variables
# Vite will embed VITE_* variables during build
RUN echo "VITE_API_URL=/api/v1" > .env && \
    echo "VITE_EXCHANGE_RATE_API_KEY=${EXCHANGE_RATE_API_KEY}" >> .env

# Build frontend static files (outputs to dist/)
RUN npm run build

# ============================================================================
# Stage 2: Rust Chef - Prepare dependency recipe
# ============================================================================
FROM rust:slim-bookworm AS chef

WORKDIR /app

# Install cargo-chef for efficient dependency caching
RUN cargo install cargo-chef

# Install build dependencies for Rust and PostgreSQL
RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# ============================================================================
# Stage 3: Rust Planner - Analyze dependencies
# ============================================================================
FROM chef AS planner

# Copy all backend files to analyze dependencies
COPY backend/ .

# Generate dependency recipe (like a lock file for cargo-chef)
RUN cargo chef prepare --recipe-path recipe.json

# ============================================================================
# Stage 4: Rust Builder - Build dependencies and application
# ============================================================================
FROM chef AS rust-builder

# Copy the dependency recipe from planner
COPY --from=planner /app/recipe.json recipe.json

# Build dependencies only (cached layer)
# This layer is only rebuilt when dependencies change
RUN cargo chef cook --release --recipe-path recipe.json

# Copy actual source code
COPY backend/src ./src
COPY backend/migrations ./migrations
COPY backend/Cargo.toml backend/Cargo.lock ./

# Build the actual application
RUN cargo build --release --locked

# Strip debug symbols to reduce binary size
RUN strip /app/target/release/master-of-coin-backend

# ============================================================================
# Stage 5: Runtime - Minimal production image
# ============================================================================
FROM debian:bookworm-slim

WORKDIR /app

# Install only runtime dependencies
RUN apt-get update && apt-get install -y \
    ca-certificates \
    libpq5 \
    libssl3 \
    wget \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd -g 1000 appuser \
    && useradd -m -u 1000 -g appuser appuser

# Copy compiled binary from rust-builder stage
COPY --from=rust-builder /app/target/release/master-of-coin-backend /app/backend

# Copy frontend static files from frontend-builder stage
COPY --from=frontend-builder /frontend/dist /app/static

# Set ownership to non-root user
RUN chown -R appuser:appuser /app

# Switch to non-root user
USER appuser

# Expose application port
# Note: The application uses SERVER_PORT env var (default: 13153)
EXPOSE 13153

# Health check to ensure the application is running
# Uses a simple TCP check since we don't have a dedicated health endpoint
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:13153/ || exit 1

# Set environment variables with sensible defaults
ENV RUST_LOG=info \
    SERVER_HOST=0.0.0.0 \
    SERVER_PORT=13153

# Run the backend binary
CMD ["/app/backend"]
