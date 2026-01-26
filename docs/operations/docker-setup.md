# Docker Setup and Operations Guide

Complete guide for setting up, running, and managing the Master of Coin application using Docker.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Initial Setup](#initial-setup)
- [Building the Application](#building-the-application)
- [Starting Services](#starting-services)
- [Stopping Services](#stopping-services)
- [Viewing Logs](#viewing-logs)
- [Accessing the Application](#accessing-the-application)
- [Common Docker Commands](#common-docker-commands)
- [Container Health Monitoring](#container-health-monitoring)
- [Development Workflow](#development-workflow)
- [Troubleshooting](#troubleshooting)
- [Resource Management](#resource-management)

---

## Prerequisites

Before you begin, ensure you have the following installed:

- **Docker Engine**: Version 20.10 or higher
- **Docker Compose**: Version 2.0 or higher
- **Disk Space**: At least 2GB free for images and data
- **Memory**: Minimum 2GB RAM available for containers

### Verify Installation

Check your Docker installation:

```bash
docker --version
# Expected output: Docker version 20.10.x or higher

docker-compose --version
# Expected output: Docker Compose version 2.x.x or higher
```

✅ **Success**: If both commands return version numbers, you're ready to proceed.

⚠️ **Warning**: If either command fails, install Docker Desktop (macOS/Windows) or Docker Engine (Linux) from [docker.com](https://docs.docker.com/get-docker/).

---

## Initial Setup

### 1. Clone the Repository

```bash
git clone <repository-url>
cd master-of-coin
```

### 2. Create Environment File

Copy the example environment file and configure it:

```bash
cp .env.example .env
```

### 3. Configure Environment Variables

Edit the `.env` file with your preferred text editor:

```bash
nano .env
# or
vim .env
# or
code .env
```

**Required Changes** (⚠️ CRITICAL for security):

```bash
# Change these values before first run!
POSTGRES_PASSWORD=your_secure_database_password_here
JWT_SECRET=your_secure_jwt_secret_minimum_32_characters_long_required
```

**Optional Configuration**:

```bash
# Database Configuration
POSTGRES_USER=postgres                    # Default: postgres
POSTGRES_DB=master_of_coin               # Default: master_of_coin

# JWT Configuration
JWT_EXPIRATION_HOURS=24                  # Default: 24 hours

# Server Configuration
SERVER_HOST=0.0.0.0                      # Default: 0.0.0.0
SERVER_PORT=13153                        # Internal port (mapped to 3000)

# Logging
RUST_LOG=info                            # Options: trace, debug, info, warn, error

# Database Connection Pool
DATABASE_MAX_CONNECTIONS=10              # Default: 10

# Data Directory (optional - for custom data storage location)
# DATA_DIR=/var/lib/master-of-coin      # Default: ./data (relative to project root)
```

**Data Directory Configuration**:

The `DATA_DIR` environment variable allows you to customize where Docker stores persistent data (PostgreSQL and Redis).

- **Default behavior** (if not set): Uses `./data` relative to project root
- **Relative paths**: Interpreted relative to project root (e.g., `DATA_DIR=./custom-data`)
- **Absolute paths**: Can point anywhere on your system (e.g., `DATA_DIR=/var/lib/master-of-coin`)
- **External storage**: Can point to mounted drives (e.g., `DATA_DIR=/mnt/storage/master-of-coin-data`)

**Examples**:

```bash
# Use default location (./data)
# Leave DATA_DIR unset or commented out

# Use custom relative path
DATA_DIR=./my-data

# Use absolute path for production
DATA_DIR=/var/lib/master-of-coin

# Use external drive
DATA_DIR=/mnt/backup-drive/master-of-coin-data
```

**Important Notes**:

- The directory must exist and have proper permissions before starting Docker
- If using a custom path, ensure it's included in your backup strategy
- For production deployments, consider using an absolute path on a dedicated volume

✅ **Success**: Environment file is configured and ready.

---

## Building the Application

The application uses a multi-stage Docker build that compiles both the frontend and backend.

### Build All Services

```bash
docker-compose build
```

**Expected output**:

```
[+] Building 120.5s (24/24) FINISHED
 => [frontend-builder 1/6] FROM docker.io/library/node:20-alpine
 => [rust-builder 1/8] FROM docker.io/library/rust:slim-bookworm
 => [stage-3 1/6] FROM docker.io/library/debian:bookworm-slim
 ...
 => => naming to docker.io/library/master-of-coin-backend
```

✅ **Success**: Build completes without errors.

### Build with No Cache (Clean Build)

If you need to rebuild from scratch:

```bash
docker-compose build --no-cache
```

⚠️ **Warning**: This will take longer as it rebuilds all layers.

### Build Specific Service

```bash
docker-compose build backend
```

---

## Starting Services

### Start All Services (Detached Mode)

```bash
docker-compose up -d
```

**Expected output**:

```
[+] Running 3/3
 ✔ Container master-of-coin-redis     Started
 ✔ Container master-of-coin-db        Started
 ✔ Container master-of-coin-backend   Started
```

✅ **Success**: All containers are running.

### Start with Logs (Foreground)

To see real-time logs while starting:

```bash
docker-compose up
```

Press `Ctrl+C` to stop (containers will be stopped).

### Start Specific Service

```bash
docker-compose up -d backend
```

### Verify Services Are Running

```bash
docker-compose ps
```

**Expected output**:

```
NAME                       IMAGE                    STATUS         PORTS
master-of-coin-backend     master-of-coin-backend   Up 2 minutes   0.0.0.0:3000->13153/tcp
master-of-coin-db          postgres:16-alpine       Up 2 minutes   0.0.0.0:5432->5432/tcp
master-of-coin-redis       redis:7-alpine           Up 2 minutes   0.0.0.0:6379->6379/tcp
```

✅ **Success**: All services show "Up" status with healthy indicators.

---

## Stopping Services

### Stop All Services

```bash
docker-compose down
```

**Expected output**:

```
[+] Running 4/4
 ✔ Container master-of-coin-backend   Removed
 ✔ Container master-of-coin-db        Removed
 ✔ Container master-of-coin-redis     Removed
 ✔ Network master-of-coin_app-network Removed
```

✅ **Success**: All containers stopped and removed.

### Stop Without Removing Containers

```bash
docker-compose stop
```

To restart later:

```bash
docker-compose start
```

### Stop and Remove Volumes

⚠️ **DANGER**: This will delete all data (database, Redis cache):

```bash
docker-compose down -v
```

**Use this only when you want to completely reset the application.**

---

## Viewing Logs

### View All Service Logs

```bash
docker-compose logs -f
```

Press `Ctrl+C` to exit (containers keep running).

### View Specific Service Logs

```bash
# Backend logs
docker-compose logs -f backend

# Database logs
docker-compose logs -f postgres

# Redis logs
docker-compose logs -f redis
```

### View Last N Lines

```bash
# Last 100 lines
docker-compose logs --tail=100 backend

# Last 50 lines from all services
docker-compose logs --tail=50
```

### View Logs Since Timestamp

```bash
docker-compose logs --since 2024-01-25T10:00:00 backend
```

### View Logs with Timestamps

```bash
docker-compose logs -f -t backend
```

---

## Accessing the Application

Once services are running, access the application at:

- **Frontend**: http://localhost:3000
- **API Documentation**: http://localhost:3000/api
- **Database**: localhost:5432 (PostgreSQL)
- **Redis**: localhost:6379

### Test API Health

```bash
curl http://localhost:3000/api/health
```

**Expected output**:

```json
{ "status": "healthy" }
```

✅ **Success**: Application is responding.

---

## Common Docker Commands

### Restart Services

```bash
# Restart all services
docker-compose restart

# Restart specific service
docker-compose restart backend
```

### Rebuild and Restart

```bash
docker-compose up -d --build
```

### Execute Commands in Containers

```bash
# Open shell in backend container
docker-compose exec backend sh

# Access PostgreSQL CLI
docker-compose exec postgres psql -U postgres master_of_coin

# Access Redis CLI
docker-compose exec redis redis-cli

# Run a one-off command
docker-compose exec backend ls -la /app
```

### View Container Resource Usage

```bash
docker stats
```

**Expected output**:

```
CONTAINER ID   NAME                     CPU %   MEM USAGE / LIMIT
abc123         master-of-coin-backend   0.50%   45MiB / 2GiB
def456         master-of-coin-db        0.20%   30MiB / 2GiB
ghi789         master-of-coin-redis     0.10%   10MiB / 2GiB
```

### Inspect Container Details

```bash
docker-compose exec backend env
docker inspect master-of-coin-backend
```

### Remove All Stopped Containers

```bash
docker container prune
```

### Remove Unused Images

```bash
docker image prune -a
```

⚠️ **Warning**: This removes all unused images, not just Master of Coin.

---

## Container Health Monitoring

### Check Health Status

```bash
docker-compose ps
```

Look for "(healthy)" in the STATUS column.

### View Health Check Logs

```bash
docker inspect master-of-coin-backend --format='{{json .State.Health}}' | jq
```

### Manual Health Check

```bash
# Backend health
curl -f http://localhost:3000/ || echo "Backend unhealthy"

# Database health
docker-compose exec postgres pg_isready -U postgres

# Redis health
docker-compose exec redis redis-cli ping
```

**Expected outputs**:

- Backend: HTTP 200 response
- Database: `accepting connections`
- Redis: `PONG`

✅ **Success**: All services are healthy.

---

## Development Workflow

### Making Code Changes

When you modify code, follow these steps:

#### Backend Changes (Rust)

1. Make your changes to backend code
2. Rebuild the backend container:

```bash
docker-compose build backend
```

3. Restart the backend:

```bash
docker-compose up -d backend
```

4. View logs to verify:

```bash
docker-compose logs -f backend
```

#### Frontend Changes (React/TypeScript)

1. Make your changes to frontend code
2. Rebuild (frontend is built into backend image):

```bash
docker-compose build backend
```

3. Restart:

```bash
docker-compose up -d backend
```

#### Database Schema Changes (Migrations)

1. Create migration files in `backend/migrations/`
2. Rebuild and restart:

```bash
docker-compose build backend
docker-compose up -d backend
```

Migrations run automatically on backend startup.

### Quick Rebuild Workflow

```bash
# Stop, rebuild, and start in one command
docker-compose down && docker-compose up -d --build
```

### Development with Live Logs

```bash
# Rebuild and watch logs
docker-compose up --build
```

---

## Troubleshooting

### Port Already in Use

**Error**: `Bind for 0.0.0.0:3000 failed: port is already allocated`

**Solution**:

```bash
# Find process using port 3000
lsof -i :3000
# or on Linux
netstat -tulpn | grep 3000

# Kill the process or change port in docker-compose.yml
# Edit docker-compose.yml:
ports:
  - "3001:13153"  # Use port 3001 instead
```

### Build Failures

**Error**: Build fails with compilation errors

**Solution**:

```bash
# Clean build with no cache
docker-compose build --no-cache

# Remove old images
docker image prune -a

# Check disk space
df -h
```

### Database Connection Issues

**Error**: `could not connect to server: Connection refused`

**Solution**:

```bash
# Check if postgres is healthy
docker-compose ps postgres

# View postgres logs
docker-compose logs postgres

# Restart postgres
docker-compose restart postgres

# Verify postgres is accepting connections
docker-compose exec postgres pg_isready -U postgres
```

### Backend Won't Start

**Error**: Backend container exits immediately

**Solution**:

```bash
# View backend logs
docker-compose logs backend

# Common issues:
# 1. Invalid JWT_SECRET (must be 32+ characters)
echo "JWT_SECRET=your_secure_jwt_secret_minimum_32_characters_long" >> .env

# 2. Database not ready - wait for health check
docker-compose ps postgres

# 3. Port conflict - change port mapping
# Edit docker-compose.yml ports section
```

### Health Check Failures

**Error**: Container shows "unhealthy" status

**Solution**:

```bash
# Check health check logs
docker inspect master-of-coin-backend --format='{{json .State.Health}}' | jq

# Test endpoint manually
curl -v http://localhost:3000/

# Restart with fresh logs
docker-compose restart backend
docker-compose logs -f backend
```

### Frontend Not Loading

**Error**: Blank page or 404 errors

**Solution**:

```bash
# Verify static files were copied
docker-compose exec backend ls -la /app/static

# Check backend logs for errors
docker-compose logs backend | grep -i error

# Rebuild with no cache
docker-compose build --no-cache backend
docker-compose up -d backend
```

### Out of Disk Space

**Error**: `no space left on device`

**Solution**:

```bash
# Check disk usage
df -h

# Clean up Docker resources
docker system prune -a --volumes

# Remove old images
docker image prune -a

# Remove unused volumes
docker volume prune
```

⚠️ **Warning**: `docker system prune -a --volumes` removes ALL unused Docker resources.

### Permission Denied Errors

**Error**: Permission denied when accessing files

**Solution**:

```bash
# Fix data directory permissions
sudo chown -R $USER:$USER ./data

# Or run with sudo (not recommended)
sudo docker-compose up -d
```

### Container Keeps Restarting

**Error**: Container in restart loop

**Solution**:

```bash
# View logs to identify issue
docker-compose logs --tail=100 backend

# Check environment variables
docker-compose exec backend env | grep -E 'DATABASE|JWT|SERVER'

# Verify .env file is correct
cat .env

# Stop restart policy temporarily
docker update --restart=no master-of-coin-backend
```

---

## Resource Management

### Monitor Resource Usage

```bash
# Real-time stats
docker stats

# Detailed container info
docker-compose top
```

### Set Resource Limits

Edit `docker-compose.yml` to add resource limits:

```yaml
services:
  backend:
    deploy:
      resources:
        limits:
          cpus: "1.0"
          memory: 512M
        reservations:
          cpus: "0.5"
          memory: 256M
```

### Optimize Docker Performance

#### 1. Prune Regularly

```bash
# Remove unused resources weekly
docker system prune -f
```

#### 2. Limit Log Size

Add to `docker-compose.yml`:

```yaml
services:
  backend:
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

#### 3. Use BuildKit

```bash
# Enable BuildKit for faster builds
export DOCKER_BUILDKIT=1
docker-compose build
```

### Data Directory Management

Monitor data directory size:

```bash
# Check size (default location)
du -sh ./data/*

# Check size (custom location)
du -sh ${DATA_DIR:-./data}/*

# Expected sizes:
# postgres: 50-500MB (depends on data)
# redis: 1-10MB (cache data)
```

**Setting Up Custom Data Directory**:

If you want to use a custom data directory location:

```bash
# 1. Create the directory
mkdir -p /path/to/custom/data

# 2. Set proper permissions
chmod 755 /path/to/custom/data

# 3. Add to .env file
echo "DATA_DIR=/path/to/custom/data" >> .env

# 4. Restart services
docker-compose down
docker-compose up -d

# 5. Verify the location is being used
docker-compose config | grep -A2 volumes
```

### Backup Before Cleanup

⚠️ **Always backup before major cleanup operations**:

```bash
# Backup database
docker-compose exec postgres pg_dump -U postgres master_of_coin > backup.sql

# Backup data directory (if using custom location)
tar -czf data_backup_$(date +%Y%m%d).tar.gz ${DATA_DIR:-./data}

# Then cleanup
docker-compose down -v
```

See [backup-restore.md](./backup-restore.md) for detailed backup procedures.

---

## Additional Resources

- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Docker CLI Reference](https://docs.docker.com/engine/reference/commandline/cli/)
- [Backup and Restore Guide](./backup-restore.md)
- [Production Deployment Guide](./deployment.md)
- [Main Docker Documentation](../../DOCKER.md)

---

## Quick Reference

### Essential Commands

```bash
# Start services
docker-compose up -d

# Stop services
docker-compose down

# View logs
docker-compose logs -f backend

# Rebuild
docker-compose build

# Restart
docker-compose restart

# Check status
docker-compose ps

# Execute command
docker-compose exec backend sh
```

### Emergency Commands

```bash
# Stop everything immediately
docker-compose down

# Force remove containers
docker-compose rm -f

# Complete reset (⚠️ DELETES DATA)
docker-compose down -v
docker system prune -a -f
```

---

**Last Updated**: 2026-01-25  
**Version**: 1.0.0
