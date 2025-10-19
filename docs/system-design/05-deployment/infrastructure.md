# Infrastructure & Deployment

## Hosting Strategy

### Local/Home Server Deployment

**Recommended Setup:**
- Docker host: Personal computer or home server
- OS: Linux (Ubuntu/Debian) or macOS
- Minimum specs: 2 CPU cores, 4GB RAM, 20GB storage
- Cloudflare Tunnel for external access

**Why Local Hosting:**
- Free (no cloud costs)
- Full control over data
- Sufficient for 1-2 users
- Easy to manage

## Deployment Process

### Initial Setup

```bash
# 1. Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# 2. Clone repository
git clone <your-repo>
cd master-of-coin

# 3. Build frontend
cd frontend
npm install
npm run build
cd ..

# 4. Setup environment
cp .env.example .env
# Edit .env with your values

# 5. Start services
docker-compose up -d

# 6. Check status
docker-compose ps
docker-compose logs -f
```

### Cloudflare Tunnel Setup

```bash
# 1. Install cloudflared
brew install cloudflare/cloudflare/cloudflared

# 2. Login to Cloudflare
cloudflared tunnel login

# 3. Create tunnel
cloudflared tunnel create master-of-coin

# 4. Get token
cloudflared tunnel token master-of-coin

# 5. Add token to .env
echo "CLOUDFLARE_TUNNEL_TOKEN=<your-token>" >> .env

# 6. Configure DNS in Cloudflare dashboard
# Point finance.yourdomain.com to tunnel
```

## Backup Strategy

### Database Backups

```bash
# Daily backup script
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
docker exec master-of-coin-db pg_dump -U postgres master_of_coin > backup_$DATE.sql
# Keep last 30 days
find . -name "backup_*.sql" -mtime +30 -delete
```

### Automated Backups

```bash
# Add to crontab
0 2 * * * /path/to/backup.sh
```

## Monitoring

### Health Checks

```bash
# Check all services
docker-compose ps

# Check backend health
curl http://localhost:3000/health

# Check database
docker-compose exec postgres pg_isready
```

### Logs

```bash
# View all logs
docker-compose logs -f

# View specific service
docker-compose logs -f backend
docker-compose logs -f postgres
```

## Updates

### Application Updates

```bash
# 1. Pull latest code
git pull

# 2. Rebuild frontend
cd frontend && npm run build && cd ..

# 3. Rebuild and restart backend
docker-compose up -d --build backend

# 4. Check logs
docker-compose logs -f backend
```

### Database Migrations

```bash
# Run migrations
docker-compose exec backend ./backend migrate

# Or using sqlx-cli
sqlx migrate run
```

## Security Checklist

- ✅ Strong passwords in .env
- ✅ JWT secret (min 32 characters)
- ✅ Cloudflare Tunnel configured
- ✅ No exposed ports
- ✅ Regular backups
- ✅ Keep Docker images updated
- ✅ Monitor logs for errors

## Troubleshooting

### Container won't start
```bash
docker-compose logs <service-name>
docker-compose down
docker-compose up -d
```

### Database connection issues
```bash
docker-compose exec postgres psql -U postgres -d master_of_coin
# Check if database exists and is accessible
```

### Cloudflare Tunnel issues
```bash
docker-compose logs cloudflared
# Check token is correct in .env
```

## Summary

- ✅ Local hosting with Docker
- ✅ Cloudflare Tunnel for access
- ✅ Automated backups
- ✅ Simple deployment process
- ✅ Easy updates
- ✅ Monitoring and logs
- ✅ Security best practices
