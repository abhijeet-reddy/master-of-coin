# Backup and Restore Guide

Comprehensive guide for backing up and restoring Master of Coin application data.

## Table of Contents

- [Overview](#overview)
- [What Needs Backing Up](#what-needs-backing-up)
- [Manual Backup Procedures](#manual-backup-procedures)
- [Automated Backup Strategies](#automated-backup-strategies)
- [Backup Frequency Recommendations](#backup-frequency-recommendations)
- [Backup Storage Locations](#backup-storage-locations)
- [Restore Procedures](#restore-procedures)
- [Testing Backup Integrity](#testing-backup-integrity)
- [Disaster Recovery Scenarios](#disaster-recovery-scenarios)
- [Server Migration Guide](#server-migration-guide)
- [Database Migrations](#database-migrations)
- [Backup Verification Checklist](#backup-verification-checklist)

---

## Overview

Regular backups are essential for protecting your financial data. This guide covers:

- **Database backups**: PostgreSQL data (transactions, accounts, budgets, etc.)
- **Configuration backups**: Environment variables and settings
- **Data directory backups**: Complete data persistence
- **Application state**: Redis cache (optional)

⚠️ **Critical**: Always test your backups before you need them!

---

## What Needs Backing Up

### 1. PostgreSQL Database (CRITICAL)

**Location**: `${DATA_DIR:-./data}/postgres/` or via `pg_dump`

**Contains**:

- User accounts and authentication data
- Financial transactions
- Accounts and balances
- Budget configurations
- Categories and people
- All application data

**Priority**: 🔴 **HIGHEST** - This is your primary data

### 2. Environment Configuration (CRITICAL)

**Location**: `.env` file

**Contains**:

- Database credentials
- JWT secret
- Server configuration
- API keys (if any)

**Priority**: 🔴 **HIGHEST** - Required to restore functionality

### 3. Redis Cache (OPTIONAL)

**Location**: `${DATA_DIR:-./data}/redis/`

**Contains**:

- Session data
- Cached queries
- Temporary data

**Priority**: 🟡 **LOW** - Can be regenerated

### 4. Application Files (OPTIONAL)

**Location**: Uploaded files (if feature exists)

**Contains**:

- User-uploaded documents
- Receipts or attachments

**Priority**: 🟠 **MEDIUM** - If feature is used

---

## Manual Backup Procedures

### Method 1: Database Dump (Recommended)

This creates a SQL file that can be restored to any PostgreSQL instance.

#### Create Backup

```bash
# Using docker-compose
docker-compose exec postgres pg_dump -U postgres master_of_coin > backup_$(date +%Y%m%d_%H%M%S).sql

# Or using the provided script
./backend/scripts/backup.sh
```

**Expected output**:

```
💾 Master of Coin - Database Backup
====================================
📋 Backup Configuration:
  Database: master_of_coin
  Host: localhost:5432
  Backup file: ./backups/backup_20260125_143022.sql

🔄 Creating backup...
✅ Backup created successfully!
  File: ./backups/backup_20260125_143022.sql
  Size: 2.3M
```

✅ **Success**: SQL dump file created.

#### Verify Backup

```bash
# Check file exists and has content
ls -lh backup_*.sql

# View first few lines
head -n 20 backup_20260125_143022.sql
```

**Expected**: File should contain SQL statements starting with PostgreSQL header comments.

### Method 2: Data Directory Backup (Complete)

This backs up the entire PostgreSQL data directory.

#### Create Backup

```bash
# Stop the database first (IMPORTANT!)
docker-compose stop postgres

# Create compressed backup (default location)
tar -czf postgres_backup_$(date +%Y%m%d_%H%M%S).tar.gz ${DATA_DIR:-./data}/postgres/

# Restart database
docker-compose start postgres
```

**Expected output**:

```
[+] Running 1/1
 ✔ Container master-of-coin-db  Stopped
```

✅ **Success**: Compressed archive created.

⚠️ **Warning**: Database must be stopped to ensure data consistency.

### Method 3: Environment Configuration Backup

```bash
# Backup .env file
cp .env .env.backup_$(date +%Y%m%d_%H%M%S)

# Or create a secure backup
tar -czf env_backup_$(date +%Y%m%d_%H%M%S).tar.gz .env

# Verify
ls -lh .env.backup_* env_backup_*.tar.gz
```

✅ **Success**: Environment configuration backed up.

### Method 4: Complete System Backup

Backup everything at once:

```bash
# Stop all services
docker-compose down

# Create complete backup
tar -czf master_of_coin_full_backup_$(date +%Y%m%d_%H%M%S).tar.gz \
  ${DATA_DIR:-./data}/ \
  .env \
  docker-compose.yml

# Restart services
docker-compose up -d
```

**Backup includes**:

- PostgreSQL data directory
- Redis data directory
- Environment configuration
- Docker Compose configuration

✅ **Success**: Complete system backup created.

---

## Automated Backup Strategies

### Strategy 1: Cron Job (Linux/macOS)

Create automated daily backups using cron.

#### Setup Script

Create `backup-automated.sh`:

```bash
#!/bin/bash
set -e

# Configuration
BACKUP_DIR="/path/to/backups"
RETENTION_DAYS=30
PROJECT_DIR="/path/to/master-of-coin"

# Navigate to project
cd "$PROJECT_DIR"

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Create database backup
BACKUP_FILE="$BACKUP_DIR/backup_$(date +%Y%m%d_%H%M%S).sql"
docker-compose exec -T postgres pg_dump -U postgres master_of_coin > "$BACKUP_FILE"

# Compress backup
gzip "$BACKUP_FILE"

# Remove old backups (older than RETENTION_DAYS)
find "$BACKUP_DIR" -name "backup_*.sql.gz" -mtime +$RETENTION_DAYS -delete

# Log success
echo "$(date): Backup completed successfully" >> "$BACKUP_DIR/backup.log"
```

#### Make Executable

```bash
chmod +x backup-automated.sh
```

#### Add to Crontab

```bash
# Edit crontab
crontab -e

# Add daily backup at 2 AM
0 2 * * * /path/to/master-of-coin/backup-automated.sh
```

✅ **Success**: Automated daily backups configured.

### Strategy 2: Systemd Timer (Linux)

Create a systemd service and timer for backups.

#### Create Service File

`/etc/systemd/system/master-of-coin-backup.service`:

```ini
[Unit]
Description=Master of Coin Database Backup
After=docker.service

[Service]
Type=oneshot
User=your-username
WorkingDirectory=/path/to/master-of-coin
ExecStart=/path/to/master-of-coin/backup-automated.sh
```

#### Create Timer File

`/etc/systemd/system/master-of-coin-backup.timer`:

```ini
[Unit]
Description=Master of Coin Backup Timer

[Timer]
OnCalendar=daily
OnCalendar=02:00
Persistent=true

[Install]
WantedBy=timers.target
```

#### Enable Timer

```bash
sudo systemctl daemon-reload
sudo systemctl enable master-of-coin-backup.timer
sudo systemctl start master-of-coin-backup.timer

# Check status
sudo systemctl status master-of-coin-backup.timer
```

✅ **Success**: Systemd timer configured.

---

## Backup Frequency Recommendations

### Recommended Schedule

| Data Type           | Frequency | Retention | Priority    |
| ------------------- | --------- | --------- | ----------- |
| Database (SQL dump) | Daily     | 30 days   | 🔴 Critical |
| Full data directory | Weekly    | 4 weeks   | 🟠 High     |
| Environment config  | On change | Forever   | 🔴 Critical |
| Redis cache         | Never     | N/A       | 🟢 Optional |

### Personal Use (1-2 Users)

```
Daily:    Database SQL dump (automated)
Weekly:   Full system backup
Monthly:  Off-site backup copy
On-change: Environment configuration
```

### Production Use (Multiple Users)

```
Every 6 hours: Database SQL dump
Daily:         Full system backup
Weekly:        Off-site backup copy
On-change:     Environment configuration
```

---

## Backup Storage Locations

### Local Storage

**Pros**: Fast, simple, no cost  
**Cons**: Vulnerable to hardware failure

```bash
# Create dedicated backup directory
mkdir -p ~/backups/master-of-coin

# Store backups
cp backup_*.sql ~/backups/master-of-coin/
```

### Cloud Storage (Recommended)

#### AWS S3

```bash
# Install AWS CLI
# Upload backup
aws s3 cp backup_20260125_143022.sql.gz s3://your-bucket/master-of-coin/backups/

# Download backup
aws s3 cp s3://your-bucket/master-of-coin/backups/backup_20260125_143022.sql.gz .
```

#### Google Cloud Storage

```bash
# Install gcloud CLI
# Upload backup
gsutil cp backup_20260125_143022.sql.gz gs://your-bucket/master-of-coin/backups/

# Download backup
gsutil cp gs://your-bucket/master-of-coin/backups/backup_20260125_143022.sql.gz .
```

#### Dropbox/Google Drive

```bash
# Copy to synced folder
cp backup_20260125_143022.sql.gz ~/Dropbox/backups/master-of-coin/
```

### External Drive

```bash
# Mount external drive
# Copy backups
cp backup_*.sql.gz /mnt/external-drive/master-of-coin-backups/
```

⚠️ **Best Practice**: Use the 3-2-1 rule:

- **3** copies of data
- **2** different storage types
- **1** off-site backup

---

## Restore Procedures

### Method 1: Restore from SQL Dump (Recommended)

#### Step 1: Prepare for Restore

```bash
# Stop the backend to prevent new connections
docker-compose stop backend

# Verify backup file exists
ls -lh backup_20260125_143022.sql
```

#### Step 2: Restore Database

```bash
# Using docker-compose
docker-compose exec -T postgres psql -U postgres master_of_coin < backup_20260125_143022.sql

# Or using the provided script
./backend/scripts/restore.sh backup_20260125_143022.sql
```

**Expected output**:

```
♻️  Master of Coin - Database Restore
=====================================
📋 Restore Configuration:
  Database: master_of_coin
  Host: localhost:5432
  Backup file: backup_20260125_143022.sql

⚠️  WARNING: This will overwrite all data in the database!
Are you sure you want to continue? (yes/no): yes

🔄 Restoring database...
✅ Database restored successfully!

📊 Database Summary:
 users | categories | accounts | people | transactions | budgets
-------+------------+----------+--------+--------------+---------
     2 |         15 |        5 |      3 |          234 |       8
```

#### Step 3: Restart Services

```bash
docker-compose start backend

# Verify application works
curl http://localhost:3000/api/health
```

✅ **Success**: Database restored and application running.

### Method 2: Restore from Data Directory

#### Step 1: Stop All Services

```bash
docker-compose down
```

#### Step 2: Replace Data Directory

```bash
# Backup current data (just in case)
mv ${DATA_DIR:-./data}/postgres ${DATA_DIR:-./data}/postgres.old

# Extract backup
tar -xzf postgres_backup_20260125_143022.tar.gz

# Verify extraction
ls -la ${DATA_DIR:-./data}/postgres/
```

#### Step 3: Fix Permissions

```bash
# Ensure correct ownership (if needed)
sudo chown -R 999:999 ${DATA_DIR:-./data}/postgres/
```

#### Step 4: Start Services

```bash
docker-compose up -d

# Check logs
docker-compose logs -f postgres
```

✅ **Success**: Data directory restored.

### Method 3: Restore Environment Configuration

```bash
# Restore .env file
cp .env.backup_20260125_143022 .env

# Or extract from archive
tar -xzf env_backup_20260125_143022.tar.gz

# Verify
cat .env | grep -E 'POSTGRES_PASSWORD|JWT_SECRET'

# Restart services to apply changes
docker-compose restart
```

✅ **Success**: Environment configuration restored.

---

## Testing Backup Integrity

### Test 1: Verify SQL Dump

```bash
# Check file is valid SQL
head -n 50 backup_20260125_143022.sql

# Should see PostgreSQL dump header:
# PostgreSQL database dump
# Dumped from database version 16.x
```

### Test 2: Dry Run Restore

```bash
# Create test database
docker-compose exec postgres psql -U postgres -c "CREATE DATABASE test_restore;"

# Restore to test database
docker-compose exec -T postgres psql -U postgres test_restore < backup_20260125_143022.sql

# Verify data
docker-compose exec postgres psql -U postgres test_restore -c "SELECT COUNT(*) FROM users;"

# Cleanup
docker-compose exec postgres psql -U postgres -c "DROP DATABASE test_restore;"
```

✅ **Success**: Backup is valid and restorable.

### Test 3: Compare Record Counts

```bash
# Before backup
docker-compose exec postgres psql -U postgres master_of_coin -c "
  SELECT
    (SELECT COUNT(*) FROM users) as users,
    (SELECT COUNT(*) FROM transactions) as transactions;
"

# After restore (should match)
```

---

## Disaster Recovery Scenarios

### Scenario 1: Corrupted Database

**Symptoms**: Database errors, data inconsistencies

**Solution**:

```bash
# 1. Stop services
docker-compose down

# 2. Remove corrupted data
rm -rf ${DATA_DIR:-./data}/postgres/*

# 3. Start postgres
docker-compose up -d postgres

# 4. Wait for postgres to initialize
sleep 10

# 5. Restore from backup
docker-compose exec -T postgres psql -U postgres master_of_coin < backup_latest.sql

# 6. Start all services
docker-compose up -d
```

### Scenario 2: Accidental Data Deletion

**Symptoms**: Missing transactions, accounts, or users

**Solution**:

```bash
# 1. Immediately stop backend
docker-compose stop backend

# 2. Create emergency backup of current state
docker-compose exec postgres pg_dump -U postgres master_of_coin > emergency_backup.sql

# 3. Restore from last known good backup
./backend/scripts/restore.sh backup_before_deletion.sql

# 4. Restart services
docker-compose start backend
```

### Scenario 3: Complete Server Failure

**Symptoms**: Server hardware failure, disk crash

**Solution**: See [Server Migration Guide](#server-migration-guide) below.

### Scenario 4: Ransomware/Security Breach

**Symptoms**: Encrypted files, unauthorized access

**Solution**:

```bash
# 1. Immediately disconnect from network
# 2. Do NOT pay ransom
# 3. Restore from clean, offline backup
# 4. Change all passwords and secrets
# 5. Investigate breach source
# 6. Update security measures
```

⚠️ **Prevention**: Keep offline backups that ransomware cannot access.

---

## Server Migration Guide

Complete step-by-step guide for moving to a new server.

### Phase 1: Prepare New Server

#### 1. Install Prerequisites

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose
sudo apt install docker-compose-plugin

# Verify installation
docker --version
docker compose version
```

#### 2. Setup User and Directories

```bash
# Create application user
sudo useradd -m -s /bin/bash master-of-coin
sudo usermod -aG docker master-of-coin

# Switch to user
sudo su - master-of-coin

# Create application directory
mkdir -p ~/master-of-coin
cd ~/master-of-coin
```

### Phase 2: Backup Old Server

#### 1. Create Complete Backup

```bash
# On old server
cd /path/to/master-of-coin

# Stop services
docker-compose down

# Create full backup
tar -czf master_of_coin_migration_$(date +%Y%m%d).tar.gz \
  ${DATA_DIR:-./data}/ \
  .env \
  docker-compose.yml \
  Dockerfile

# Restart services
docker-compose up -d
```

#### 2. Transfer Backup

```bash
# From old server to new server
scp master_of_coin_migration_20260125.tar.gz user@new-server:~/
```

### Phase 3: Restore on New Server

#### 1. Clone Repository

```bash
# On new server
cd ~/master-of-coin
git clone <repository-url> .
```

#### 2. Extract Backup

```bash
# Extract data and configuration
tar -xzf ~/master_of_coin_migration_20260125.tar.gz

# Verify files
ls -la ${DATA_DIR:-./data}/
cat .env
```

#### 3. Build and Start

```bash
# Build containers
docker-compose build

# Start services
docker-compose up -d

# Check status
docker-compose ps
docker-compose logs -f
```

#### 4. Verify Migration

```bash
# Test API
curl http://localhost:3000/api/health

# Check database
docker-compose exec postgres psql -U postgres master_of_coin -c "SELECT COUNT(*) FROM users;"

# Test login via web interface
```

✅ **Success**: Migration complete!

### Phase 4: Update DNS

```bash
# Update DNS A record to point to new server IP
# Wait for DNS propagation (up to 48 hours)
# Monitor old server for any remaining traffic
```

### Phase 5: Decommission Old Server

```bash
# After 1 week of successful operation on new server:

# On old server
docker-compose down -v
# Keep final backup for 30 days before deletion
```

---

## Database Migrations

### Understanding Diesel Migrations

Master of Coin uses Diesel ORM for database migrations. Migrations are automatically applied on backend startup.

### Migration Files Location

```
backend/migrations/
├── 2025-10-25-000001_create_users_table/
│   ├── up.sql
│   └── down.sql
├── 2025-10-25-000002_create_categories_table/
│   ├── up.sql
│   └── down.sql
└── ...
```

### Applying Migrations Manually

```bash
# Migrations run automatically on backend startup
docker-compose up -d backend

# View migration logs
docker-compose logs backend | grep -i migration
```

**Expected output**:

```
Running migration 2025-10-25-000001_create_users_table
Running migration 2025-10-25-000002_create_categories_table
All migrations completed successfully
```

### Rolling Back Migrations

⚠️ **Warning**: Rolling back migrations can cause data loss!

```bash
# Diesel doesn't support automatic rollback
# To rollback, restore from backup before migration
./backend/scripts/restore.sh backup_before_migration.sql
```

### Migration Best Practices

1. **Always backup before applying new migrations**

   ```bash
   ./backend/scripts/backup.sh
   docker-compose up -d backend
   ```

2. **Test migrations in development first**

   ```bash
   # Test on development database
   # Verify data integrity
   # Then apply to production
   ```

3. **Keep migration backups**
   ```bash
   # Create backup with migration version in filename
   docker-compose exec postgres pg_dump -U postgres master_of_coin > \
     backup_before_migration_v2.0.0_$(date +%Y%m%d).sql
   ```

---

## Backup Verification Checklist

Use this checklist to verify your backup strategy:

### Daily Checks

- [ ] Automated backup completed successfully
- [ ] Backup file exists and has reasonable size
- [ ] Backup log shows no errors
- [ ] Disk space sufficient for backups

### Weekly Checks

- [ ] Test restore to temporary database
- [ ] Verify record counts match
- [ ] Check backup file integrity
- [ ] Rotate old backups (remove >30 days)

### Monthly Checks

- [ ] Full restore test on separate system
- [ ] Verify all data types restore correctly
- [ ] Test disaster recovery procedure
- [ ] Update backup documentation
- [ ] Review backup retention policy
- [ ] Copy backup to off-site location

### Quarterly Checks

- [ ] Full disaster recovery drill
- [ ] Review and update backup scripts
- [ ] Verify cloud backup accessibility
- [ ] Test migration procedure
- [ ] Audit backup security

---

## Quick Reference

### Backup Commands

```bash
# Quick database backup
docker-compose exec postgres pg_dump -U postgres master_of_coin > backup.sql

# Full system backup
docker-compose down
tar -czf full_backup.tar.gz ${DATA_DIR:-./data}/ .env
docker-compose up -d

# Using provided script
./backend/scripts/backup.sh
```

### Restore Commands

```bash
# Restore database
docker-compose exec -T postgres psql -U postgres master_of_coin < backup.sql

# Using provided script
./backend/scripts/restore.sh backup.sql

# Full system restore
docker-compose down
tar -xzf full_backup.tar.gz
docker-compose up -d
```

### Emergency Commands

```bash
# Emergency backup NOW
docker-compose exec postgres pg_dump -U postgres master_of_coin > emergency_$(date +%Y%m%d_%H%M%S).sql

# Quick restore
./backend/scripts/restore.sh latest_backup.sql
```

---

## Additional Resources

- [Docker Setup Guide](./docker-setup.md)
- [Production Deployment Guide](./deployment.md)
- [PostgreSQL Backup Documentation](https://www.postgresql.org/docs/current/backup.html)
- [Diesel Migrations Guide](https://diesel.rs/guides/getting-started.html)

---

**Last Updated**: 2026-01-25  
**Version**: 1.0.0
