# Multi-stage Dockerfile for Master of Coin Backend with Frontend Integration
# This Dockerfile builds both the React frontend and Rust backend in a single optimized image
# Build context: . (root directory)

# ============================================================================
# Stage 1: Frontend Builder - Build React/TypeScript/Vite application
# ============================================================================
FROM node:20-alpine AS frontend-builder

WORKDIR /frontend

# Copy frontend package files for dependency installation
COPY frontend/package*.json ./

# Install dependencies using clean install for reproducible builds
RUN npm ci --only=production

# Copy frontend source code and environment file
COPY frontend/ ./

# Ensure .env file is present for build-time environment variables
# Vite will embed VITE_* variables during build
RUN if [ ! -f .env ]; then echo "VITE_API_URL=/api/v1" > .env; fi

# Build frontend static files (outputs to dist/)
RUN npm run build

# ============================================================================
# Stage 2: Rust Builder - Compile Rust backend with optimizations
# ============================================================================
FROM rust:slim-bookworm AS rust-builder

WORKDIR /app

# Install build dependencies for Rust and PostgreSQL
RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy Cargo manifest files first for better layer caching
COPY backend/Cargo.toml backend/Cargo.lock ./

# Create dummy source to cache dependencies
# This allows Docker to cache the dependency layer separately from source code
RUN mkdir src && \
    echo "fn main() {}" > src/main.rs && \
    cargo build --release && \
    rm -rf src

# Copy actual source code
COPY backend/src ./src
COPY backend/migrations ./migrations

# Build the actual application
# Touch main.rs to force rebuild of the binary with actual code
RUN touch src/main.rs && \
    cargo build --release --locked

# Strip debug symbols to reduce binary size
RUN strip /app/target/release/master-of-coin-backend

# ============================================================================
# Stage 3: Runtime - Minimal production image
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
# Docker Compose maps this to 3000 externally
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
