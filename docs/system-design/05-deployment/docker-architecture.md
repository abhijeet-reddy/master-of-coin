# Docker Architecture

## Docker Compose Structure

```yaml
version: '3.8'

services:
  cloudflared:
    image: cloudflare/cloudflared:latest
    container_name: master-of-coin-tunnel
    command: tunnel --no-autoupdate run
    environment:
      - TUNNEL_TOKEN=${CLOUDFLARE_TUNNEL_TOKEN}
    restart: unless-stopped
    networks:
      - app-network

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: master-of-coin-backend
    environment:
      - DATABASE_URL=postgresql://postgres:${DB_PASSWORD}@postgres:5432/master_of_coin
      - JWT_SECRET=${JWT_SECRET}
      - RUST_LOG=info
    ports:
      - "3000:3000"
    depends_on:
      postgres:
        condition: service_healthy
    restart: unless-stopped
    networks:
      - app-network

  postgres:
    image: postgres:16-alpine
    container_name: master-of-coin-db
    environment:
      - POSTGRES_DB=master_of_coin
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=${DB_PASSWORD}
    volumes:
      - postgres-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped
    networks:
      - app-network

  redis:
    image: redis:7-alpine
    container_name: master-of-coin-cache
    volumes:
      - redis-data:/data
    command: redis-server --appendonly yes
    restart: unless-stopped
    networks:
      - app-network

networks:
  app-network:
    driver: bridge

volumes:
  postgres-data:
  redis-data:
```

## Frontend Deployment Strategy

**The frontend is NOT in a separate Docker container.**

### Build Process

1. **Local Build**
   ```bash
   cd frontend
   npm run build
   # Creates dist/ folder with optimized static files
   ```

2. **Copy to Backend**
   - The `dist/` folder is copied into the backend Docker image
   - Backend Dockerfile includes: `COPY --from=frontend-build /app/dist /app/static`

3. **Rust Serves Static Files**
   ```rust
   use tower_http::services::ServeDir;
   
   let app = Router::new()
       .nest("/api", api_routes())
       .nest_service("/", ServeDir::new("static"));
   ```

### Why This Approach?

**Advantages:**
- Simpler deployment (3 containers vs 4)
- No CORS issues (same origin)
- Rust is fast enough for 1-2 users
- Single endpoint for everything
- Easier to manage

**When to Change:**
- If you need advanced caching
- If traffic grows significantly
- If you want CDN integration
- Then add Nginx container


## Backend Dockerfile

```dockerfile
FROM rust:1.75-slim as builder
WORKDIR /app
RUN apt-get update && apt-get install -y pkg-config libssl-dev
COPY Cargo.toml Cargo.lock ./
RUN mkdir src && echo "fn main() {}" > src/main.rs && cargo build --release && rm -rf src
COPY src ./src
RUN cargo build --release

FROM debian:bookworm-slim
WORKDIR /app
RUN apt-get update && apt-get install -y ca-certificates libssl3
COPY --from=builder /app/target/release/master-of-coin-backend /app/backend
COPY --from=frontend-build /app/dist /app/static
RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /app
USER appuser
EXPOSE 3000
CMD ["/app/backend"]
```

## Environment Variables

```bash
DB_PASSWORD=secure_password
JWT_SECRET=min_32_char_secret
CLOUDFLARE_TUNNEL_TOKEN=your_token
RUST_LOG=info
```

## Deployment

```bash
docker-compose up -d
docker-compose logs -f
docker-compose ps
```
