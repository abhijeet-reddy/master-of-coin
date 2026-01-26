# Production Deployment Guide

Complete guide for deploying Master of Coin to a production server with security best practices.

## Table of Contents

- [Overview](#overview)
- [Server Requirements](#server-requirements)
- [Initial Server Setup](#initial-server-setup)
- [Security Hardening](#security-hardening)
- [Domain and DNS Configuration](#domain-and-dns-configuration)
- [Reverse Proxy Setup](#reverse-proxy-setup)
- [SSL Certificate Setup](#ssl-certificate-setup)
- [Production Environment Configuration](#production-environment-configuration)
- [First-Time Deployment](#first-time-deployment)
- [Update and Upgrade Procedures](#update-and-upgrade-procedures)
- [Rollback Procedures](#rollback-procedures)
- [Monitoring and Logging](#monitoring-and-logging)
- [Performance Optimization](#performance-optimization)
- [Maintenance Schedule](#maintenance-schedule)

---

## Overview

This guide covers deploying Master of Coin to a production server with:

- **Security**: Firewall, SSL/TLS, secure secrets management
- **Reliability**: Automated restarts, health monitoring, backups
- **Performance**: Resource optimization, caching, compression
- **Maintainability**: Update procedures, logging, monitoring

⚠️ **Important**: This is a personal finance application. Security is paramount!

---

## Server Requirements

### Minimum Requirements

| Resource | Minimum | Notes                         |
| -------- | ------- | ----------------------------- |
| CPU      | 1 core  | 2.0 GHz or higher             |
| RAM      | 1 GB    | 2 GB recommended              |
| Disk     | 10 GB   | SSD recommended               |
| Network  | 10 Mbps | Stable connection             |
| OS       | Linux   | Ubuntu 22.04 LTS or Debian 12 |

### Recommended Requirements

| Resource | Recommended      | Notes                     |
| -------- | ---------------- | ------------------------- |
| CPU      | 2 cores          | Better performance        |
| RAM      | 2 GB             | Comfortable headroom      |
| Disk     | 20 GB SSD        | Fast I/O, room for growth |
| Network  | 100 Mbps         | Better user experience    |
| OS       | Ubuntu 22.04 LTS | Long-term support         |

### Supported Operating Systems

- ✅ **Ubuntu 22.04 LTS** (Recommended)
- ✅ **Ubuntu 20.04 LTS**
- ✅ **Debian 12 (Bookworm)**
- ✅ **Debian 11 (Bullseye)**
- ⚠️ **CentOS/RHEL 8+** (Requires adaptation)

---

## Initial Server Setup

### Step 1: Update System

```bash
# Update package lists
sudo apt update

# Upgrade installed packages
sudo apt upgrade -y

# Install essential tools
sudo apt install -y curl git ufw fail2ban
```

✅ **Success**: System updated and essential tools installed.

### Step 2: Create Non-Root User

⚠️ **Security**: Never run applications as root!

```bash
# Create user
sudo adduser master-of-coin

# Add to sudo group
sudo usermod -aG sudo master-of-coin

# Switch to new user
sudo su - master-of-coin
```

### Step 3: Install Docker

```bash
# Install Docker using official script
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add user to docker group
sudo usermod -aG docker $USER

# Apply group changes (logout/login or use newgrp)
newgrp docker

# Verify installation
docker --version
```

**Expected output**:

```
Docker version 24.0.x, build xxxxx
```

### Step 4: Install Docker Compose

```bash
# Install Docker Compose plugin
sudo apt install -y docker-compose-plugin

# Verify installation
docker compose version
```

**Expected output**:

```
Docker Compose version v2.x.x
```

✅ **Success**: Docker and Docker Compose installed.

### Step 5: Configure Firewall

```bash
# Enable UFW
sudo ufw enable

# Allow SSH (IMPORTANT - do this first!)
sudo ufw allow 22/tcp

# Allow HTTP and HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Check status
sudo ufw status
```

**Expected output**:

```
Status: active

To                         Action      From
--                         ------      ----
22/tcp                     ALLOW       Anywhere
80/tcp                     ALLOW       Anywhere
443/tcp                    ALLOW       Anywhere
```

⚠️ **Warning**: Always allow SSH before enabling UFW to avoid lockout!

✅ **Success**: Firewall configured.

---

## Security Hardening

### 1. Generate Strong Secrets

#### JWT Secret (32+ characters)

```bash
# Generate secure random string
openssl rand -base64 32
```

**Example output**:

```
8KJh3nF9mP2qR5tY7wX0zB4cD6eG8iH1jK3lM5nO7pQ=
```

Copy this value for your `.env` file.

#### Database Password

```bash
# Generate strong password
openssl rand -base64 24
```

**Example output**:

```
xY2zA4bC6dE8fG0hI2jK4lM6nO8pQ=
```

### 2. Secure Environment Variables

```bash
# Create .env file with secure permissions
touch .env
chmod 600 .env

# Edit with secure values
nano .env
```

**Production `.env` template**:

```bash
# Database Configuration
POSTGRES_USER=postgres
POSTGRES_PASSWORD=<STRONG_PASSWORD_FROM_ABOVE>
POSTGRES_DB=master_of_coin

# JWT Configuration (CRITICAL - 32+ characters)
JWT_SECRET=<STRONG_SECRET_FROM_ABOVE>
JWT_EXPIRATION_HOURS=24

# Server Configuration
SERVER_HOST=0.0.0.0
SERVER_PORT=13153

# Logging (use 'info' or 'warn' in production)
RUST_LOG=info

# Database Connection Pool
DATABASE_MAX_CONNECTIONS=10
```

⚠️ **Security Checklist**:

- [ ] JWT_SECRET is 32+ characters
- [ ] POSTGRES_PASSWORD is strong and unique
- [ ] RUST_LOG is set to 'info' or 'warn' (not 'debug')
- [ ] File permissions are 600 (readable only by owner)

### 3. Disable Password Authentication (SSH)

```bash
# Edit SSH config
sudo nano /etc/ssh/sshd_config

# Set these values:
PasswordAuthentication no
PermitRootLogin no
PubkeyAuthentication yes

# Restart SSH
sudo systemctl restart sshd
```

⚠️ **Warning**: Ensure you have SSH key access before disabling password auth!

### 4. Configure Fail2Ban

```bash
# Install fail2ban (if not already installed)
sudo apt install -y fail2ban

# Create local config
sudo cp /etc/fail2ban/jail.conf /etc/fail2ban/jail.local

# Edit config
sudo nano /etc/fail2ban/jail.local

# Enable SSH protection (find [sshd] section):
[sshd]
enabled = true
port = 22
maxretry = 3
bantime = 3600

# Restart fail2ban
sudo systemctl restart fail2ban
sudo systemctl enable fail2ban

# Check status
sudo fail2ban-client status
```

✅ **Success**: Fail2ban configured to protect SSH.

### 5. Regular Security Updates

```bash
# Enable automatic security updates
sudo apt install -y unattended-upgrades

# Configure
sudo dpkg-reconfigure -plow unattended-upgrades
```

---

## Domain and DNS Configuration

### Step 1: Register Domain

Register a domain name with a registrar (e.g., Namecheap, Google Domains, Cloudflare).

### Step 2: Configure DNS Records

Add an A record pointing to your server's IP address:

```
Type: A
Name: @ (or subdomain like 'finance')
Value: <YOUR_SERVER_IP>
TTL: 3600 (1 hour)
```

**Example**:

```
A     @              203.0.113.42
A     finance        203.0.113.42
```

### Step 3: Verify DNS Propagation

```bash
# Check DNS resolution
dig yourdomain.com +short
nslookup yourdomain.com

# Or use online tool
# https://dnschecker.org
```

**Expected**: Should return your server's IP address.

⏱️ **Note**: DNS propagation can take up to 48 hours, but usually completes within 1-2 hours.

---

## Reverse Proxy Setup

Using Nginx as a reverse proxy provides:

- SSL/TLS termination
- Request routing
- Static file caching
- Security headers
- Rate limiting

### Step 1: Install Nginx

```bash
sudo apt install -y nginx
```

### Step 2: Create Nginx Configuration

```bash
sudo nano /etc/nginx/sites-available/master-of-coin
```

**Configuration**:

```nginx
# HTTP server - redirect to HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name yourdomain.com www.yourdomain.com;

    # Redirect all HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

# HTTPS server
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    # SSL certificates (will be configured by certbot)
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    # SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Logging
    access_log /var/log/nginx/master-of-coin-access.log;
    error_log /var/log/nginx/master-of-coin-error.log;

    # Client body size limit (for file uploads)
    client_max_body_size 10M;

    # Proxy settings
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Optional: Rate limiting for API endpoints
    location /api/ {
        limit_req zone=api_limit burst=20 nodelay;
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# Rate limiting zone (add to http block in nginx.conf)
# limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;
```

### Step 3: Enable Configuration

```bash
# Create symbolic link
sudo ln -s /etc/nginx/sites-available/master-of-coin /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t
```

**Expected output**:

```
nginx: configuration file /etc/nginx/nginx.conf test is successful
```

### Step 4: Configure Rate Limiting (Optional)

```bash
# Edit main nginx config
sudo nano /etc/nginx/nginx.conf

# Add inside http block:
http {
    # ... existing config ...

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;

    # ... rest of config ...
}
```

⚠️ **Note**: Don't restart Nginx yet - we'll configure SSL first.

---

## SSL Certificate Setup

Using Let's Encrypt for free SSL certificates.

### Step 1: Install Certbot

```bash
# Install certbot and nginx plugin
sudo apt install -y certbot python3-certbot-nginx
```

### Step 2: Obtain SSL Certificate

```bash
# Get certificate (interactive)
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Follow prompts:
# - Enter email address
# - Agree to terms of service
# - Choose whether to redirect HTTP to HTTPS (recommended: yes)
```

**Expected output**:

```
Successfully received certificate.
Certificate is saved at: /etc/letsencrypt/live/yourdomain.com/fullchain.pem
Key is saved at: /etc/letsencrypt/live/yourdomain.com/privkey.pem
```

✅ **Success**: SSL certificate obtained and configured.

### Step 3: Test SSL Configuration

```bash
# Restart Nginx
sudo systemctl restart nginx

# Test SSL
curl -I https://yourdomain.com
```

**Expected**: Should return HTTP 200 with HTTPS.

### Step 4: Setup Auto-Renewal

```bash
# Test renewal process
sudo certbot renew --dry-run
```

**Expected output**:

```
Congratulations, all simulated renewals succeeded
```

Certbot automatically creates a systemd timer for renewal. Verify:

```bash
sudo systemctl status certbot.timer
```

✅ **Success**: SSL auto-renewal configured.

### Step 5: Verify SSL Grade

Visit: https://www.ssllabs.com/ssltest/analyze.html?d=yourdomain.com

**Target**: Grade A or A+

---

## Production Environment Configuration

### Step 1: Clone Repository

```bash
# Navigate to home directory
cd ~

# Clone repository
git clone <repository-url> master-of-coin
cd master-of-coin
```

### Step 2: Configure Environment

```bash
# Copy example env file
cp .env.example .env

# Edit with production values
nano .env
```

Use the secure values generated in [Security Hardening](#security-hardening).

### Step 3: Create Data Directories

```bash
# Option 1: Use default location (./data)
mkdir -p data/postgres data/redis
chmod 755 data
chmod 700 data/postgres data/redis

# Option 2: Use custom location (recommended for production)
# Set DATA_DIR in .env first, then:
mkdir -p ${DATA_DIR}/postgres ${DATA_DIR}/redis
chmod 755 ${DATA_DIR}
chmod 700 ${DATA_DIR}/postgres ${DATA_DIR}/redis
```

**Production Data Directory Recommendations**:

For production deployments, consider using a dedicated volume or partition:

```bash
# Example: Using a dedicated volume mounted at /mnt/data
DATA_DIR=/mnt/data/master-of-coin

# Create directory structure
sudo mkdir -p ${DATA_DIR}/postgres ${DATA_DIR}/redis

# Set ownership (999:999 is the postgres user in the container)
sudo chown -R 999:999 ${DATA_DIR}/postgres
sudo chown -R 999:999 ${DATA_DIR}/redis

# Add to .env file
echo "DATA_DIR=${DATA_DIR}" >> .env
```

**Benefits of Custom Data Directory**:

- Separate data from application code
- Easier to manage backups
- Can use dedicated storage with better performance
- Simplifies server migrations
- Better disk space management

### Step 4: Configure Docker Compose for Production

Create `docker-compose.prod.yml`:

```yaml
version: "3.8"

services:
  backend:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: master-of-coin-backend
    environment:
      - DATABASE_URL=postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}
      - JWT_SECRET=${JWT_SECRET}
      - SERVER_HOST=0.0.0.0
      - SERVER_PORT=13153
      - RUST_LOG=${RUST_LOG:-info}
    ports:
      - "127.0.0.1:3000:13153" # Only bind to localhost
    depends_on:
      postgres:
        condition: service_healthy
    restart: unless-stopped
    networks:
      - app-network
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
    deploy:
      resources:
        limits:
          cpus: "1.0"
          memory: 512M
        reservations:
          cpus: "0.5"
          memory: 256M

  postgres:
    image: postgres:16-alpine
    container_name: master-of-coin-db
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
    ports:
      - "127.0.0.1:5432:5432" # Only bind to localhost
    volumes:
      - ${DATA_DIR:-./data}/postgres:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped
    networks:
      - app-network
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

  redis:
    image: redis:7-alpine
    container_name: master-of-coin-redis
    ports:
      - "127.0.0.1:6379:6379" # Only bind to localhost
    volumes:
      - ${DATA_DIR:-./data}/redis:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped
    networks:
      - app-network
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

networks:
  app-network:
    driver: bridge
```

**Key Production Changes**:

- Ports bound to `127.0.0.1` (localhost only)
- `restart: unless-stopped` for automatic recovery
- Log rotation configured
- Resource limits set
- Health checks enabled

---

## First-Time Deployment

### Deployment Checklist

Before deploying, verify:

- [ ] Server meets minimum requirements
- [ ] Firewall configured (SSH, HTTP, HTTPS)
- [ ] Non-root user created
- [ ] Docker and Docker Compose installed
- [ ] Domain DNS configured and propagated
- [ ] Nginx installed and configured
- [ ] SSL certificate obtained
- [ ] `.env` file configured with secure values
- [ ] Data directory configured (DATA_DIR set if using custom location)
- [ ] Data directory created with proper permissions
- [ ] Backup strategy planned

### Step 1: Build Application

```bash
cd ~/master-of-coin

# Build using production compose file
docker compose -f docker-compose.prod.yml build
```

**Expected**: Build completes without errors.

### Step 2: Start Services

```bash
# Start all services
docker compose -f docker-compose.prod.yml up -d

# Check status
docker compose -f docker-compose.prod.yml ps
```

**Expected output**:

```
NAME                       STATUS              PORTS
master-of-coin-backend     Up (healthy)        127.0.0.1:3000->13153/tcp
master-of-coin-db          Up (healthy)        127.0.0.1:5432->5432/tcp
master-of-coin-redis       Up (healthy)        127.0.0.1:6379->6379/tcp
```

✅ **Success**: All services running and healthy.

### Step 3: Verify Application

```bash
# Test local access
curl http://localhost:3000/api/health

# Test via domain
curl https://yourdomain.com/api/health
```

**Expected**: Both return `{"status":"healthy"}`

### Step 4: Create First User

Visit `https://yourdomain.com` and register your first user account.

### Step 5: Setup Automated Backups

```bash
# Copy backup script
cp backend/scripts/backup.sh ~/backups/backup.sh

# Make executable
chmod +x ~/backups/backup.sh

# Test backup
~/backups/backup.sh
```

See [backup-restore.md](./backup-restore.md) for detailed backup configuration.

✅ **Success**: First deployment complete!

---

## Update and Upgrade Procedures

### Standard Update Procedure

#### Step 1: Backup Current State

```bash
cd ~/master-of-coin

# Create backup
docker compose -f docker-compose.prod.yml exec postgres pg_dump -U postgres master_of_coin > \
  backup_before_update_$(date +%Y%m%d_%H%M%S).sql
```

#### Step 2: Pull Latest Changes

```bash
# Fetch updates
git fetch origin

# View changes
git log HEAD..origin/main --oneline

# Pull updates
git pull origin main
```

#### Step 3: Rebuild and Restart

```bash
# Rebuild containers
docker compose -f docker-compose.prod.yml build

# Restart services
docker compose -f docker-compose.prod.yml up -d

# View logs
docker compose -f docker-compose.prod.yml logs -f backend
```

#### Step 4: Verify Update

```bash
# Check health
curl https://yourdomain.com/api/health

# Test login
# Browse to https://yourdomain.com and verify functionality
```

✅ **Success**: Update complete.

### Zero-Downtime Update (Advanced)

For minimal downtime during updates:

```bash
# 1. Build new image
docker compose -f docker-compose.prod.yml build backend

# 2. Start new container alongside old one
docker compose -f docker-compose.prod.yml up -d --no-deps --scale backend=2 backend

# 3. Wait for health check
sleep 10

# 4. Stop old container
docker compose -f docker-compose.prod.yml up -d --no-deps --scale backend=1 backend
```

---

## Rollback Procedures

### Quick Rollback (Git)

If the update causes issues:

```bash
# View recent commits
git log --oneline -5

# Rollback to previous commit
git reset --hard <previous-commit-hash>

# Rebuild and restart
docker compose -f docker-compose.prod.yml up -d --build
```

### Database Rollback

If database migrations cause issues:

```bash
# Stop backend
docker compose -f docker-compose.prod.yml stop backend

# Restore database
docker compose -f docker-compose.prod.yml exec -T postgres psql -U postgres master_of_coin < \
  backup_before_update_20260125_143022.sql

# Restart backend
docker compose -f docker-compose.prod.yml start backend
```

### Complete System Rollback

```bash
# Stop all services
docker compose -f docker-compose.prod.yml down

# Restore from full backup
tar -xzf full_backup_before_update.tar.gz

# Restart services
docker compose -f docker-compose.prod.yml up -d
```

---

## Monitoring and Logging

### Application Logs

```bash
# View all logs
docker compose -f docker-compose.prod.yml logs -f

# Backend logs only
docker compose -f docker-compose.prod.yml logs -f backend

# Last 100 lines
docker compose -f docker-compose.prod.yml logs --tail=100 backend
```

### Nginx Logs

```bash
# Access logs
sudo tail -f /var/log/nginx/master-of-coin-access.log

# Error logs
sudo tail -f /var/log/nginx/master-of-coin-error.log
```

### System Monitoring

```bash
# Container resource usage
docker stats

# Disk usage
df -h

# Memory usage
free -h

# System load
uptime
```

### Health Monitoring Script

Create `~/monitor.sh`:

```bash
#!/bin/bash

# Check if services are running
if ! docker compose -f ~/master-of-coin/docker-compose.prod.yml ps | grep -q "Up"; then
    echo "$(date): Services are down!" | mail -s "Master of Coin Alert" your@email.com
fi

# Check disk space
DISK_USAGE=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')
if [ $DISK_USAGE -gt 80 ]; then
    echo "$(date): Disk usage is ${DISK_USAGE}%" | mail -s "Disk Space Alert" your@email.com
fi
```

Add to crontab:

```bash
# Check every 5 minutes
*/5 * * * * ~/monitor.sh
```

---

## Performance Optimization

### 1. Enable Nginx Caching

Add to Nginx config:

```nginx
# Cache configuration
proxy_cache_path /var/cache/nginx levels=1:2 keys_zone=app_cache:10m max_size=100m inactive=60m;

location / {
    proxy_cache app_cache;
    proxy_cache_valid 200 5m;
    proxy_cache_use_stale error timeout http_500 http_502 http_503 http_504;
    # ... rest of proxy config ...
}
```

### 2. Enable Gzip Compression

Add to Nginx config:

```nginx
# Gzip compression
gzip on;
gzip_vary on;
gzip_min_length 1024;
gzip_types text/plain text/css text/xml text/javascript application/javascript application/json;
```

### 3. Optimize PostgreSQL

Edit `docker-compose.prod.yml`:

```yaml
postgres:
  command:
    - "postgres"
    - "-c"
    - "shared_buffers=256MB"
    - "-c"
    - "effective_cache_size=512MB"
    - "-c"
    - "max_connections=50"
```

### 4. Monitor Performance

```bash
# Database query performance
docker compose -f docker-compose.prod.yml exec postgres psql -U postgres master_of_coin -c \
  "SELECT query, calls, total_time, mean_time FROM pg_stat_statements ORDER BY total_time DESC LIMIT 10;"

# Container resource usage
docker stats --no-stream
```

---

## Maintenance Schedule

### Daily Tasks (Automated)

- [ ] Database backup (via cron)
- [ ] Log rotation (via Docker)
- [ ] Health check monitoring (via cron)

### Weekly Tasks

- [ ] Review application logs
- [ ] Check disk space usage
- [ ] Verify backup integrity
- [ ] Review security logs (fail2ban)

### Monthly Tasks

- [ ] Update system packages: `sudo apt update && sudo apt upgrade`
- [ ] Review and rotate old backups
- [ ] Test disaster recovery procedure
- [ ] Review SSL certificate expiration
- [ ] Check for application updates

### Quarterly Tasks

- [ ] Full security audit
- [ ] Performance review and optimization
- [ ] Disaster recovery drill
- [ ] Review and update documentation

---

## Quick Reference

### Essential Commands

```bash
# Start services
docker compose -f docker-compose.prod.yml up -d

# Stop services
docker compose -f docker-compose.prod.yml down

# View logs
docker compose -f docker-compose.prod.yml logs -f backend

# Restart services
docker compose -f docker-compose.prod.yml restart

# Update application
git pull && docker compose -f docker-compose.prod.yml up -d --build

# Backup database
docker compose -f docker-compose.prod.yml exec postgres pg_dump -U postgres master_of_coin > backup.sql

# Check status
docker compose -f docker-compose.prod.yml ps
```

### Emergency Commands

```bash
# Restart all services
docker compose -f docker-compose.prod.yml restart

# View recent errors
docker compose -f docker-compose.prod.yml logs --tail=100 backend | grep -i error

# Check system resources
docker stats --no-stream

# Emergency backup
docker compose -f docker-compose.prod.yml exec postgres pg_dump -U postgres master_of_coin > emergency_backup.sql
```

---

## Troubleshooting Production Issues

### Issue: Application Not Accessible

```bash
# Check Nginx status
sudo systemctl status nginx

# Check application status
docker compose -f docker-compose.prod.yml ps

# Check firewall
sudo ufw status

# Test local access
curl http://localhost:3000/api/health
```

### Issue: SSL Certificate Errors

```bash
# Check certificate validity
sudo certbot certificates

# Renew certificate
sudo certbot renew

# Restart Nginx
sudo systemctl restart nginx
```

### Issue: High Memory Usage

```bash
# Check container memory
docker stats --no-stream

# Restart services
docker compose -f docker-compose.prod.yml restart

# Check for memory leaks in logs
docker compose -f docker-compose.prod.yml logs backend | grep -i "memory\|oom"
```

### Issue: Database Connection Errors

```bash
# Check PostgreSQL status
docker compose -f docker-compose.prod.yml ps postgres

# Check PostgreSQL logs
docker compose -f docker-compose.prod.yml logs postgres

# Verify connection
docker compose -f docker-compose.prod.yml exec postgres pg_isready -U postgres
```

---

## Additional Resources

- [Docker Setup Guide](./docker-setup.md)
- [Backup and Restore Guide](./backup-restore.md)
- [Nginx Documentation](https://nginx.org/en/docs/)
- [Let's Encrypt Documentation](https://letsencrypt.org/docs/)
- [Docker Security Best Practices](https://docs.docker.com/engine/security/)
- [PostgreSQL Performance Tuning](https://wiki.postgresql.org/wiki/Performance_Optimization)

---

**Last Updated**: 2026-01-25  
**Version**: 1.0.0
