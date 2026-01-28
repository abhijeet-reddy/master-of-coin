# Docker Deployment Guide

This guide explains how to build and deploy the Master of Coin application using Docker.

## Architecture Overview

The application uses a **single-container architecture** for the backend:

- **Backend Container**: Rust/Axum application that serves:
  - REST API endpoints at `/api/*`
  - Frontend static files at `/` (React/Vite build)
- **PostgreSQL Container**: Database
- **Redis Container**: Caching layer

The frontend is **NOT** a separate container. It's built during the Docker image build process and served by the Rust backend.

## Prerequisites

- Docker Engine 20.10+
- Docker Compose 2.0+
- At least 2GB of free disk space

## Deployment Options

Master of Coin supports two deployment methods:

### Option 1: Using Pre-built Images (Recommended)

Use published images from GitHub Container Registry - no build required:

```bash
# Copy the example file
cp docker-compose.image.example.yml docker-compose.prod.yml

# Start services
docker-compose -f docker-compose.prod.yml up -d
```

**Benefits:**

- ✅ Faster deployment (no build time)
- ✅ Consistent images across environments
- ✅ Multi-architecture support (AMD64/ARM64)
- ✅ Automatic updates with version tags

See [Docker Image Publishing Guide](docs/operations/docker-image-publishing.md) for details.

### Option 2: Building Locally

Build from source for development or customization:

1. **Clone the repository and navigate to the project root**

   ```bash
   cd master-of-coin
   ```

2. **Create environment file**

   ```bash
   cp .env.example .env
   ```

3. **Edit `.env` and set secure values** (IMPORTANT!)

   ```bash
   # Minimum required changes:
   POSTGRES_PASSWORD=your_secure_database_password
   JWT_SECRET=your_secure_jwt_secret_minimum_32_characters_long
   ```

4. **Build and start all services**

   ```bash
   docker-compose up -d
   ```

5. **Check service status**

   ```bash
   docker-compose ps
   ```

6. **View logs**

   ```bash
   docker-compose logs -f server
   ```

7. **Access the application**
   - Frontend: http://localhost:13153
   - API: http://localhost:13153/api
   - Database: localhost:5432
   - Redis: localhost:6379

## Building the Docker Image

The Dockerfile uses a **multi-stage build** for optimization:

### Stage 1: Frontend Builder

- Base: `node:20-alpine`
- Builds React/TypeScript/Vite application
- Output: `dist/` directory with optimized static files

### Stage 2: Rust Builder

- Base: `rust:1.75-alpine`
- Compiles Rust backend with release optimizations
- Strips debug symbols for smaller binary size

### Stage 3: Runtime

- Base: `alpine:3.19`
- Minimal production image (~50MB)
- Runs as non-root user for security
- Includes health checks

### Build Command

```bash
# Build with docker-compose (recommended)
docker-compose build

# Or build manually
docker build -t master-of-coin:latest .
```

## Publishing Docker Images

Master of Coin automatically publishes Docker images to GitHub Container Registry (ghcr.io) when you create a release.

### Automatic Publishing (Recommended)

1. **Create a version tag:**

   ```bash
   git tag -a v1.0.0 -m "Release version 1.0.0"
   git push origin v1.0.0
   ```

2. **Create a GitHub release:**
   - Go to: https://github.com/abhijeet-reddy/master-of-coin/releases
   - Click "Create a new release"
   - Select your tag (v1.0.0)
   - Add release notes
   - Click "Publish release"

3. **Automatic build:**
   - GitHub Actions builds and publishes the image
   - Multiple tags are created: `v1.0.0`, `v1.0`, `v1`, `latest`
   - Supports both AMD64 and ARM64 architectures

### Available Image Tags

| Tag                        | Example                                        | Description         |
| -------------------------- | ---------------------------------------------- | ------------------- |
| `latest`                   | `ghcr.io/abhijeet-reddy/master-of-coin:latest` | Most recent release |
| `v{major}.{minor}.{patch}` | `ghcr.io/abhijeet-reddy/master-of-coin:v1.0.0` | Specific version    |
| `v{major}.{minor}`         | `ghcr.io/abhijeet-reddy/master-of-coin:v1.0`   | Latest patch        |
| `v{major}`                 | `ghcr.io/abhijeet-reddy/master-of-coin:v1`     | Latest minor        |

### Using Published Images

```bash
# Pull specific version
docker pull ghcr.io/abhijeet-reddy/master-of-coin:v1.0.0

# Pull latest
docker pull ghcr.io/abhijeet-reddy/master-of-coin:latest

# Deploy with docker-compose
docker-compose -f docker-compose.image.example.yml up -d
```

For detailed information, see [Docker Image Publishing Guide](docs/operations/docker-image-publishing.md).

## Environment Variables

### Required Variables

| Variable            | Description                       | Example                        |
| ------------------- | --------------------------------- | ------------------------------ |
| `POSTGRES_PASSWORD` | Database password                 | `secure_password_123`          |
| `JWT_SECRET`        | JWT signing secret (min 32 chars) | `your_secret_key_min_32_chars` |

### Optional Variables

| Variable                   | Default          | Description                                 |
| -------------------------- | ---------------- | ------------------------------------------- |
| `POSTGRES_USER`            | `postgres`       | Database username                           |
| `POSTGRES_DB`              | `master_of_coin` | Database name                               |
| `SERVER_HOST`              | `0.0.0.0`        | Backend bind address                        |
| `SERVER_PORT`              | `13153`          | Backend internal port                       |
| `RUST_LOG`                 | `info`           | Log level (trace, debug, info, warn, error) |
| `DATABASE_MAX_CONNECTIONS` | `10`             | Connection pool size                        |
| `JWT_EXPIRATION_HOURS`     | `24`             | JWT token lifetime                          |

## Data Persistence

Data is stored in bind mounts for easy backups:

```
./data/
├── postgres/    # PostgreSQL data
└── redis/       # Redis data
```

### Backup Database

```bash
# Create backup
docker-compose exec postgres pg_dump -U postgres master_of_coin > backup.sql

# Or use the backup script
./backend/scripts/backup.sh
```

### Restore Database

```bash
# Restore from backup
docker-compose exec -T postgres psql -U postgres master_of_coin < backup.sql

# Or use the restore script
./backend/scripts/restore.sh backup.sql
```

## Docker Compose Commands

### Start Services

```bash
# Start in background
docker-compose up -d

# Start with logs
docker-compose up

# Start specific service
docker-compose up -d backend
```

### Stop Services

```bash
# Stop all services
docker-compose down

# Stop and remove volumes (WARNING: deletes data)
docker-compose down -v
```

### View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend

# Last 100 lines
docker-compose logs --tail=100 backend
```

### Rebuild Services

```bash
# Rebuild all
docker-compose build

# Rebuild specific service
docker-compose build backend

# Rebuild and restart
docker-compose up -d --build
```

### Execute Commands

```bash
# Open shell in backend container
docker-compose exec backend sh

# Run database migrations manually
docker-compose exec backend /app/backend

# Access PostgreSQL
docker-compose exec postgres psql -U postgres master_of_coin
```

## Health Checks

The backend container includes a health check that verifies the API is responding:

```dockerfile
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:13153/api/health || exit 1
```

Check health status:

```bash
docker-compose ps
```

## Troubleshooting

### Backend won't start

```bash
# Check logs
docker-compose logs backend

# Common issues:
# 1. Database not ready - wait for postgres health check
# 2. Invalid JWT_SECRET - must be at least 32 characters
# 3. Port already in use - change port mapping in docker-compose.yml
```

### Database connection errors

```bash
# Verify postgres is healthy
docker-compose ps postgres

# Check database logs
docker-compose logs postgres

# Test connection
docker-compose exec postgres pg_isready -U postgres
```

### Frontend not loading

```bash
# The frontend is served by the backend at http://localhost:3000
# Check backend logs for errors
docker-compose logs backend

# Verify static files were copied
docker-compose exec backend ls -la /app/static
```

### Rebuild from scratch

```bash
# Stop and remove everything
docker-compose down -v

# Remove images
docker-compose rm -f
docker rmi master-of-coin-backend

# Rebuild
docker-compose up -d --build
```

## Production Deployment

### Security Checklist

- [ ] Change all default passwords
- [ ] Use strong JWT_SECRET (32+ characters)
- [ ] Set RUST_LOG=info (not debug)
- [ ] Configure firewall rules
- [ ] Use HTTPS (add reverse proxy like Nginx/Caddy)
- [ ] Regular database backups
- [ ] Monitor disk space for `./data/` directory

### Recommended Production Setup

1. Use a reverse proxy (Nginx/Caddy) with SSL
2. Set up automated backups
3. Configure log rotation
4. Use Docker secrets for sensitive data
5. Set resource limits in docker-compose.yml
6. Monitor container health and logs

### Resource Limits (Optional)

Add to docker-compose.yml:

```yaml
services:
  backend:
    deploy:
      resources:
        limits:
          cpus: "1"
          memory: 512M
        reservations:
          cpus: "0.5"
          memory: 256M
```

## Development vs Production

### Development

- Use `.env` file with development settings
- Mount source code as volumes for hot reload
- Expose database ports for direct access
- Use `RUST_LOG=debug` for detailed logs

### Production

- Use environment variables or Docker secrets
- Don't expose database ports externally
- Use `RUST_LOG=info` or `warn`
- Enable health checks and monitoring
- Set up automated backups

## Additional Resources

- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Rust Docker Best Practices](https://docs.docker.com/language/rust/)
- [Alpine Linux](https://alpinelinux.org/)
