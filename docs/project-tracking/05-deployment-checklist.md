# Deployment Checklist

## Overview
This checklist covers Docker containerization, Docker Compose configuration with 4 containers (cloudflared, backend, postgres, redis), Cloudflare Tunnel setup, and production deployment procedures.

**References:**
- [`docs/system-design/05-deployment/docker-architecture.md`](../system-design/05-deployment/docker-architecture.md)
- [`docs/system-design/05-deployment/infrastructure.md`](../system-design/05-deployment/infrastructure.md)

---

## Pre-Deployment Preparation

### Code Review
- [ ] Review all code for production readiness
- [ ] Remove debug statements and console.logs
- [ ] Remove test data and seed scripts
- [ ] Verify no hardcoded credentials
- [ ] Check for TODO/FIXME comments

### Security Audit
- [ ] Review authentication implementation
- [ ] Verify JWT secret is strong (min 32 characters)
- [ ] Check database password strength
- [ ] Verify no secrets in git history
- [ ] Review CORS configuration
- [ ] Check input validation
- [ ] Verify SQL injection protection

### Environment Variables
- [ ] Create `.env.production` file
- [ ] Document all required environment variables
- [ ] Generate strong secrets
- [ ] Verify no `.env` files in git

---

## Frontend Build Optimization

### Production Build Configuration
- [ ] Configure Vite for production
  ```typescript
  // vite.config.ts
  export default defineConfig({
    build: {
      outDir: 'dist',
      sourcemap: false,
      minify: 'terser',
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom', 'react-router-dom'],
            chakra: ['@chakra-ui/react', '@emotion/react'],
            charts: ['recharts'],
          },
        },
      },
    },
  });
  ```
- [ ] Enable code splitting
- [ ] Configure asset optimization
- [ ] Set up proper caching headers

### Build Process
- [ ] Navigate to frontend directory: `cd frontend`
- [ ] Install dependencies: `npm ci` (clean install)
- [ ] Run production build: `npm run build`
- [ ] Verify `dist/` folder created
- [ ] Check bundle sizes
  - [ ] Main bundle < 200KB gzipped
  - [ ] Vendor bundle < 300KB gzipped
  - [ ] Total < 500KB gzipped
- [ ] Test built files locally
  - [ ] `npm run preview`
  - [ ] Verify all features work

### Build Optimization
- [ ] Analyze bundle with visualizer
  ```bash
  npm install -D rollup-plugin-visualizer
  npm run build -- --mode analyze
  ```
- [ ] Identify large dependencies
- [ ] Consider lazy loading heavy components
- [ ] Optimize images and assets
- [ ] Remove unused dependencies

---

## Backend Dockerfile

### Create Backend Dockerfile (`backend/Dockerfile`)
- [ ] Create multi-stage Dockerfile
  ```dockerfile
  # Build stage
  FROM rust:1.75-slim as builder
  WORKDIR /app
  
  # Install dependencies
  RUN apt-get update && apt-get install -y \
      pkg-config \
      libssl-dev \
      && rm -rf /var/lib/apt/lists/*
  
  # Copy manifests
  COPY Cargo.toml Cargo.lock ./
  
  # Build dependencies (cached layer)
  RUN mkdir src && \
      echo "fn main() {}" > src/main.rs && \
      cargo build --release && \
      rm -rf src
  
  # Copy source code
  COPY src ./src
  COPY migrations ./migrations
  
  # Build application
  RUN cargo build --release
  
  # Runtime stage
  FROM debian:bookworm-slim
  WORKDIR /app
  
  # Install runtime dependencies
  RUN apt-get update && apt-get install -y \
      ca-certificates \
      libssl3 \
      && rm -rf /var/lib/apt/lists/*
  
  # Copy binary from builder
  COPY --from=builder /app/target/release/master-of-coin-backend /app/backend
  
  # Copy frontend static files
  COPY --from=frontend-build /app/dist /app/static
  
  # Create non-root user
  RUN useradd -m -u 1000 appuser && \
      chown -R appuser:appuser /app
  
  USER appuser
  
  EXPOSE 3000
  
  CMD ["/app/backend"]
  ```
- [ ] Test Dockerfile builds successfully
- [ ] Verify image size (target: < 200MB)

### Backend Static File Serving
- [ ] Configure Axum to serve static files
  ```rust
  use tower_http::services::ServeDir;
  
  let app = Router::new()
      .nest("/api", api_routes())
      .nest_service("/", ServeDir::new("static"))
      .fallback_service(ServeFile::new("static/index.html"));
  ```
- [ ] Test static file serving
- [ ] Verify SPA routing works (fallback to index.html)
- [ ] Test API routes still work

---

## Docker Compose Configuration

### Create docker-compose.yml
- [ ] Create `docker-compose.yml` in project root
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
      depends_on:
        - backend
  
    backend:
      build:
        context: .
        dockerfile: backend/Dockerfile
      container_name: master-of-coin-backend
      environment:
        - DATABASE_URL=postgresql://postgres:${DB_PASSWORD}@postgres:5432/master_of_coin
        - JWT_SECRET=${JWT_SECRET}
        - RUST_LOG=info
        - SERVER_HOST=0.0.0.0
        - SERVER_PORT=3000
      ports:
        - "3000:3000"
      depends_on:
        postgres:
          condition: service_healthy
      restart: unless-stopped
      networks:
        - app-network
      healthcheck:
        test: ["CMD", "curl", "-f", "http://localhost:3000/api/health"]
        interval: 30s
        timeout: 10s
        retries: 3
        start_period: 40s
  
    postgres:
      image: postgres:16-alpine
      container_name: master-of-coin-db
      environment:
        - POSTGRES_DB=master_of_coin
        - POSTGRES_USER=postgres
        - POSTGRES_PASSWORD=${DB_PASSWORD}
      volumes:
        - postgres-data:/var/lib/postgresql/data
        - ./backend/migrations:/docker-entrypoint-initdb.d
      ports:
        - "5432:5432"
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
      command: redis-server --appendonly yes --requirepass ${REDIS_PASSWORD}
      ports:
        - "6379:6379"
      healthcheck:
        test: ["CMD", "redis-cli", "--raw", "incr", "ping"]
        interval: 10s
        timeout: 5s
        retries: 5
      restart: unless-stopped
      networks:
        - app-network
  
  networks:
    app-network:
      driver: bridge
  
  volumes:
    postgres-data:
      driver: local
    redis-data:
      driver: local
  ```
- [ ] Verify YAML syntax
- [ ] Test docker-compose configuration

### Environment Variables Setup
- [ ] Create `.env.production` file
  ```env
  # Database
  DB_PASSWORD=<generate_strong_password>
  
  # Backend
  JWT_SECRET=<generate_min_32_char_secret>
  RUST_LOG=info
  
  # Redis
  REDIS_PASSWORD=<generate_strong_password>
  
  # Cloudflare Tunnel
  CLOUDFLARE_TUNNEL_TOKEN=<your_tunnel_token>
  ```
- [ ] Generate strong passwords
  ```bash
  # Generate random password
  openssl rand -base64 32
  ```
- [ ] Document environment variables
- [ ] Add `.env.production` to `.gitignore`
- [ ] Create `.env.example` for reference

---

## Cloudflare Tunnel Setup

### Cloudflare Account Setup
- [ ] Create Cloudflare account (if not exists)
- [ ] Add domain to Cloudflare
- [ ] Verify domain ownership
- [ ] Configure DNS settings

### Create Cloudflare Tunnel
- [ ] Install cloudflared locally (for setup)
  ```bash
  # macOS
  brew install cloudflare/cloudflare/cloudflared
  
  # Linux
  wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
  sudo dpkg -i cloudflared-linux-amd64.deb
  ```
- [ ] Login to Cloudflare
  ```bash
  cloudflared tunnel login
  ```
- [ ] Create tunnel
  ```bash
  cloudflared tunnel create master-of-coin
  ```
- [ ] Note the tunnel ID and credentials
- [ ] Get tunnel token
  ```bash
  cloudflared tunnel token master-of-coin
  ```
- [ ] Save token to `.env.production`

### Configure Tunnel Routes
- [ ] Create tunnel configuration
  ```bash
  cloudflared tunnel route dns master-of-coin app.yourdomain.com
  ```
- [ ] Verify DNS record created
- [ ] Test tunnel connectivity
  ```bash
  cloudflared tunnel run master-of-coin
  ```

### Tunnel Configuration File (Optional)
- [ ] Create `config.yml` for cloudflared
  ```yaml
  tunnel: <tunnel-id>
  credentials-file: /root/.cloudflared/<tunnel-id>.json
  
  ingress:
    - hostname: app.yourdomain.com
      service: http://backend:3000
    - service: http_status:404
  ```
- [ ] Test configuration

---

## Database Migration in Production

### Migration Strategy
- [ ] Plan migration approach
  - [ ] Fresh database (first deployment)
  - [ ] Migrate existing data (if applicable)
- [ ] Backup strategy (for future updates)

### Run Migrations
- [ ] Ensure migrations are in `backend/migrations/`
- [ ] Migrations will run automatically on container start
- [ ] Alternative: Run manually
  ```bash
  docker-compose exec backend sqlx migrate run
  ```
- [ ] Verify migrations applied
  ```bash
  docker-compose exec postgres psql -U postgres -d master_of_coin -c "\dt"
  ```
- [ ] Check migration status
  ```bash
  docker-compose exec backend sqlx migrate info
  ```

### Seed Data (Optional)
- [ ] Decide if seed data needed
- [ ] Create production seed script (minimal)
- [ ] Run seed script if needed
  ```bash
  docker-compose exec postgres psql -U postgres -d master_of_coin -f /path/to/seed.sql
  ```

---

## SSL/TLS Configuration

### Cloudflare SSL
- [ ] Enable SSL in Cloudflare dashboard
- [ ] Select SSL mode: "Full (strict)" recommended
- [ ] Verify SSL certificate active
- [ ] Test HTTPS access
- [ ] Configure automatic HTTPS redirects

### SSL Certificate (Alternative - if not using Cloudflare)
- [ ] Generate SSL certificate with Let's Encrypt
- [ ] Configure Nginx for SSL (if using)
- [ ] Set up auto-renewal
- [ ] Test HTTPS access

---

## Deployment Execution

### Pre-Deployment Checks
- [ ] All tests passing
- [ ] Code reviewed and approved
- [ ] Environment variables configured
- [ ] Secrets generated and stored securely
- [ ] Backup plan in place
- [ ] Rollback plan documented

### Build and Deploy
- [ ] Build frontend
  ```bash
  cd frontend
  npm ci
  npm run build
  cd ..
  ```
- [ ] Copy frontend build to backend
  ```bash
  mkdir -p backend/static
  cp -r frontend/dist/* backend/static/
  ```
- [ ] Build Docker images
  ```bash
  docker-compose build --no-cache
  ```
- [ ] Start services
  ```bash
  docker-compose up -d
  ```
- [ ] Monitor startup logs
  ```bash
  docker-compose logs -f
  ```
- [ ] Wait for all services to be healthy
  ```bash
  docker-compose ps
  ```

### Verify Deployment
- [ ] Check all containers running
  ```bash
  docker-compose ps
  ```
- [ ] Check container logs for errors
  ```bash
  docker-compose logs backend
  docker-compose logs postgres
  docker-compose logs redis
  docker-compose logs cloudflared
  ```
- [ ] Test database connection
  ```bash
  docker-compose exec postgres psql -U postgres -d master_of_coin -c "SELECT 1;"
  ```
- [ ] Test backend health endpoint
  ```bash
  curl http://localhost:3000/api/health
  ```
- [ ] Test frontend access
  ```bash
  curl http://localhost:3000/
  ```

---

## Health Checks & Monitoring

### Health Check Endpoints
- [ ] Implement backend health endpoint
  ```rust
  async fn health_check() -> impl IntoResponse {
      Json(json!({
          "status": "healthy",
          "timestamp": Utc::now(),
      }))
  }
  ```
- [ ] Test health endpoint
- [ ] Configure Docker health checks (already in docker-compose)

### Monitoring Setup
- [ ] Set up log aggregation
  - [ ] Configure Docker logging driver
  - [ ] Set log rotation
  ```yaml
  logging:
    driver: "json-file"
    options:
      max-size: "10m"
      max-file: "3"
  ```
- [ ] Monitor container resource usage
  ```bash
  docker stats
  ```
- [ ] Set up alerts (optional)
  - [ ] Disk space alerts
  - [ ] Memory usage alerts
  - [ ] Container down alerts

### Application Monitoring
- [ ] Monitor API response times
- [ ] Monitor error rates
- [ ] Monitor database connections
- [ ] Monitor Redis cache hit rate
- [ ] Set up uptime monitoring (e.g., UptimeRobot)

---

## Backup & Restore Procedures

### Database Backup
- [ ] Create backup script
  ```bash
  #!/bin/bash
  # backup.sh
  BACKUP_DIR="./backups"
  TIMESTAMP=$(date +%Y%m%d_%H%M%S)
  mkdir -p $BACKUP_DIR
  
  docker-compose exec -T postgres pg_dump -U postgres master_of_coin | \
    gzip > "$BACKUP_DIR/backup_$TIMESTAMP.sql.gz"
  
  echo "Backup created: backup_$TIMESTAMP.sql.gz"
  
  # Keep only last 7 days of backups
  find $BACKUP_DIR -name "backup_*.sql.gz" -mtime +7 -delete
  ```
- [ ] Make script executable
  ```bash
  chmod +x backup.sh
  ```
- [ ] Test backup script
  ```bash
  ./backup.sh
  ```
- [ ] Set up automated backups (cron)
  ```bash
  # Run daily at 2 AM
  0 2 * * * /path/to/backup.sh
  ```

### Database Restore
- [ ] Create restore script
  ```bash
  #!/bin/bash
  # restore.sh
  if [ -z "$1" ]; then
    echo "Usage: ./restore.sh <backup_file>"
    exit 1
  fi
  
  gunzip -c "$1" | docker-compose exec -T postgres psql -U postgres master_of_coin
  echo "Database restored from $1"
  ```
- [ ] Make script executable
  ```bash
  chmod +x restore.sh
  ```
- [ ] Test restore on test database
  ```bash
  ./restore.sh backups/backup_20240115_020000.sql.gz
  ```

### Volume Backup
- [ ] Backup Docker volumes
  ```bash
  docker run --rm -v master-of-coin_postgres-data:/data \
    -v $(pwd)/backups:/backup \
    alpine tar czf /backup/postgres-volume-backup.tar.gz /data
  ```
- [ ] Test volume restore
- [ ] Document backup locations

---

## Rollback Procedures

### Rollback Strategy
- [ ] Document current version/commit
- [ ] Keep previous Docker images
  ```bash
  docker tag master-of-coin-backend:latest master-of-coin-backend:previous
  ```
- [ ] Document rollback steps

### Rollback Execution
- [ ] Stop current containers
  ```bash
  docker-compose down
  ```
- [ ] Restore previous version
  ```bash
  git checkout <previous-commit>
  docker-compose up -d
  ```
- [ ] Restore database if needed
  ```bash
  ./restore.sh backups/backup_before_deployment.sql.gz
  ```
- [ ] Verify rollback successful
- [ ] Document rollback reason

---

## Performance Optimization

### Docker Optimization
- [ ] Use multi-stage builds (already implemented)
- [ ] Minimize layer count
- [ ] Use .dockerignore
  ```
  # .dockerignore
  node_modules
  target
  dist
  .git
  .env*
  *.log
  ```
- [ ] Optimize image size
- [ ] Use specific image tags (not :latest)

### Database Optimization
- [ ] Configure PostgreSQL for production
  ```sql
  -- Increase shared_buffers
  ALTER SYSTEM SET shared_buffers = '256MB';
  
  -- Increase work_mem
  ALTER SYSTEM SET work_mem = '16MB';
  
  -- Enable query logging for slow queries
  ALTER SYSTEM SET log_min_duration_statement = 1000;
  ```
- [ ] Set up connection pooling (already in backend)
- [ ] Monitor query performance
- [ ] Create necessary indexes (already in migrations)

### Redis Configuration
- [ ] Configure Redis persistence
- [ ] Set memory limits
  ```yaml
  redis:
    command: redis-server --maxmemory 256mb --maxmemory-policy allkeys-lru
  ```
- [ ] Monitor Redis memory usage

---

## Security Hardening

### Container Security
- [ ] Run containers as non-root user (already implemented)
- [ ] Use read-only file systems where possible
- [ ] Limit container resources
  ```yaml
  deploy:
    resources:
      limits:
        cpus: '1'
        memory: 1G
      reservations:
        cpus: '0.5'
        memory: 512M
  ```
- [ ] Scan images for vulnerabilities
  ```bash
  docker scan master-of-coin-backend
  ```

### Network Security
- [ ] Use internal Docker network (already implemented)
- [ ] Don't expose unnecessary ports
- [ ] Configure firewall rules
- [ ] Enable Cloudflare DDoS protection
- [ ] Enable Cloudflare WAF (Web Application Firewall)

### Application Security
- [ ] Verify JWT secret is strong
- [ ] Enable HTTPS only
- [ ] Set secure cookie flags
- [ ] Implement rate limiting (optional)
- [ ] Enable CORS with specific origins
- [ ] Sanitize all user inputs
- [ ] Use parameterized queries (SQLx does this)

---

## Post-Deployment Verification

### Functional Testing
- [ ] Test user registration
- [ ] Test user login
- [ ] Test creating account
- [ ] Test creating transaction
- [ ] Test creating budget
- [ ] Test dashboard loading
- [ ] Test all major features
- [ ] Test on different devices
- [ ] Test on different browsers

### Performance Testing
- [ ] Measure page load times
- [ ] Measure API response times
- [ ] Test with concurrent users (if applicable)
- [ ] Monitor resource usage
- [ ] Check for memory leaks

### Security Testing
- [ ] Verify HTTPS working
- [ ] Test authentication flow
- [ ] Verify authorization working
- [ ] Test for common vulnerabilities
- [ ] Verify secrets not exposed

---

## Documentation

### Deployment Documentation
- [ ] Document deployment process
- [ ] Document environment setup
- [ ] Document troubleshooting steps
- [ ] Document rollback procedures
- [ ] Document backup/restore procedures

### Operations Documentation
- [ ] Document monitoring procedures
- [ ] Document maintenance tasks
- [ ] Document update procedures
- [ ] Document scaling procedures (if applicable)

### User Documentation
- [ ] Create user guide
- [ ] Document features
- [ ] Create FAQ
- [ ] Document known issues

---

## Maintenance Procedures

### Regular Maintenance
- [ ] Schedule regular backups (daily)
- [ ] Monitor disk space
- [ ] Monitor logs for errors
- [ ] Update dependencies regularly
- [ ] Review security advisories
- [ ] Clean up old Docker images
  ```bash
  docker system prune -a
  ```

### Update Procedures
- [ ] Document update process
- [ ] Test updates in staging first
- [ ] Create backup before update
- [ ] Apply updates
- [ ] Verify functionality
- [ ] Monitor for issues

---

## Troubleshooting Guide

### Common Issues

#### Container Won't Start
- [ ] Check logs: `docker-compose logs <service>`
- [ ] Check environment variables
- [ ] Check port conflicts
- [ ] Check disk space
- [ ] Verify network connectivity

#### Database Connection Issues
- [ ] Verify postgres container running
- [ ] Check DATABASE_URL format
- [ ] Verify credentials
- [ ] Check network connectivity
- [ ] Review postgres logs

#### Frontend Not Loading
- [ ] Verify backend serving static files
- [ ] Check build output in dist/
- [ ] Verify static files copied to backend
- [ ] Check browser console for errors
- [ ] Verify API endpoints working

#### Cloudflare Tunnel Issues
- [ ] Verify tunnel token correct
- [ ] Check cloudflared logs
- [ ] Verify DNS configuration
- [ ] Test tunnel connectivity
- [ ] Check Cloudflare dashboard

---

## Completion Checklist

- [ ] Frontend built and optimized
- [ ] Backend Dockerfile created and tested
- [ ] Docker Compose configured with 4 containers
- [ ] Cloudflare Tunnel set up and working
- [ ] Environment variables configured
- [ ] Database migrations applied
- [ ] SSL/TLS configured
- [ ] All services deployed and running
- [ ] Health checks passing
- [ ] Monitoring set up
- [ ] Backup procedures implemented
- [ ] Rollback procedures documented
- [ ] Security hardening completed
- [ ] Post-deployment testing passed
- [ ] Documentation completed

**Estimated Time:** 2-3 days

**Next Steps:** Proceed to [`06-testing-qa-checklist.md`](06-testing-qa-checklist.md)