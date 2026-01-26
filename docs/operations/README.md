# Operations Documentation

Complete operations documentation for Master of Coin application deployment, maintenance, and management.

## 📚 Documentation Index

### 1. [Docker Setup Guide](./docker-setup.md)

**Complete guide for Docker-based development and operations**

Learn how to:

- Install and configure Docker and Docker Compose
- Build and run the application containers
- Manage services (start, stop, restart, rebuild)
- View logs and monitor container health
- Troubleshoot common Docker issues
- Optimize resource usage

**Start here if**: You're setting up the application for the first time or need to manage Docker containers.

---

### 2. [Backup and Restore Guide](./backup-restore.md)

**Comprehensive data protection and recovery procedures**

Learn how to:

- Create manual and automated backups
- Backup PostgreSQL database and configuration
- Set up automated backup schedules
- Restore from backups
- Handle disaster recovery scenarios
- Migrate to a new server
- Verify backup integrity

**Start here if**: You need to protect your data, restore from backup, or migrate servers.

---

### 3. [Production Deployment Guide](./deployment.md)

**Complete production deployment with security best practices**

Learn how to:

- Set up a production server
- Configure security (firewall, SSL, secrets)
- Set up domain and DNS
- Configure Nginx reverse proxy
- Obtain and configure SSL certificates
- Deploy the application to production
- Update and maintain production systems
- Monitor and optimize performance

**Start here if**: You're deploying to a production server or managing a live system.

---

## 🚀 Quick Start Paths

### For Development

1. Read [Docker Setup Guide](./docker-setup.md)
2. Follow "Initial Setup" and "Building the Application" sections
3. Start developing!

### For Production Deployment

1. Read [Production Deployment Guide](./deployment.md) - Complete server setup
2. Read [Docker Setup Guide](./docker-setup.md) - Application management
3. Read [Backup and Restore Guide](./backup-restore.md) - Data protection

### For Maintenance

1. [Docker Setup Guide](./docker-setup.md) - Day-to-day operations
2. [Backup and Restore Guide](./backup-restore.md) - Regular backups
3. [Production Deployment Guide](./deployment.md) - Updates and monitoring

---

## 📋 Common Tasks

### Initial Setup

- **Install Docker**: [Docker Setup → Prerequisites](./docker-setup.md#prerequisites)
- **Configure Environment**: [Docker Setup → Initial Setup](./docker-setup.md#initial-setup)
- **First Run**: [Docker Setup → Starting Services](./docker-setup.md#starting-services)

### Daily Operations

- **Start Application**: `docker-compose up -d`
- **View Logs**: `docker-compose logs -f backend`
- **Stop Application**: `docker-compose down`
- **Check Status**: `docker-compose ps`

### Backup & Recovery

- **Create Backup**: [Backup Guide → Manual Backup](./backup-restore.md#manual-backup-procedures)
- **Restore Backup**: [Backup Guide → Restore Procedures](./backup-restore.md#restore-procedures)
- **Automated Backups**: [Backup Guide → Automated Strategies](./backup-restore.md#automated-backup-strategies)

### Production Management

- **Deploy to Production**: [Deployment Guide → First-Time Deployment](./deployment.md#first-time-deployment)
- **Update Application**: [Deployment Guide → Update Procedures](./deployment.md#update-and-upgrade-procedures)
- **Monitor System**: [Deployment Guide → Monitoring](./deployment.md#monitoring-and-logging)

---

## 🔧 Troubleshooting

### Docker Issues

See: [Docker Setup → Troubleshooting](./docker-setup.md#troubleshooting)

Common issues:

- Port conflicts
- Build failures
- Database connection errors
- Container health check failures

### Backup Issues

See: [Backup Guide → Testing Backup Integrity](./backup-restore.md#testing-backup-integrity)

Common issues:

- Backup verification
- Restore failures
- Migration problems

### Production Issues

See: [Deployment Guide → Troubleshooting Production Issues](./deployment.md#troubleshooting-production-issues)

Common issues:

- Application not accessible
- SSL certificate errors
- High resource usage
- Database connection problems

---

## 📊 Architecture Overview

Master of Coin uses a containerized architecture:

```
┌─────────────────────────────────────────────┐
│           Nginx Reverse Proxy               │
│         (SSL/TLS Termination)               │
└─────────────────┬───────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────┐
│         Backend Container                   │
│  ┌─────────────────────────────────────┐   │
│  │   Rust/Axum API Server              │   │
│  │   - REST API endpoints              │   │
│  │   - Serves frontend static files    │   │
│  └─────────────────────────────────────┘   │
└─────────────┬───────────────┬───────────────┘
              │               │
              ▼               ▼
    ┌─────────────────┐  ┌──────────────┐
    │   PostgreSQL    │  │    Redis     │
    │   Container     │  │  Container   │
    │   (Database)    │  │   (Cache)    │
    └─────────────────┘  └──────────────┘
```

**Key Points**:

- Single backend container serves both API and frontend
- PostgreSQL for persistent data storage
- Redis for caching and session management
- Nginx for SSL termination and reverse proxy (production)
- Data persisted in `./data/` directory

---

## 🔐 Security Considerations

### Critical Security Tasks

1. **Change Default Passwords**: [Deployment → Security Hardening](./deployment.md#security-hardening)
2. **Use Strong JWT Secret**: Minimum 32 characters
3. **Enable Firewall**: [Deployment → Initial Server Setup](./deployment.md#initial-server-setup)
4. **Configure SSL/TLS**: [Deployment → SSL Certificate Setup](./deployment.md#ssl-certificate-setup)
5. **Regular Backups**: [Backup Guide → Backup Frequency](./backup-restore.md#backup-frequency-recommendations)
6. **Keep Systems Updated**: [Deployment → Maintenance Schedule](./deployment.md#maintenance-schedule)

### Security Checklist

- [ ] Changed all default passwords
- [ ] JWT_SECRET is 32+ characters
- [ ] Firewall configured (SSH, HTTP, HTTPS only)
- [ ] SSL certificate installed and auto-renewing
- [ ] Automated backups configured
- [ ] Fail2ban configured for SSH protection
- [ ] Regular security updates enabled
- [ ] `.env` file permissions set to 600

---

## 📖 Additional Resources

### Internal Documentation

- [Main README](../../README.md) - Project overview
- [Docker Guide](../../DOCKER.md) - Detailed Docker information
- [Contributing Guide](../../CONTRIBUTING.md) - Development guidelines

### External Resources

- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Nginx Documentation](https://nginx.org/en/docs/)
- [Let's Encrypt Documentation](https://letsencrypt.org/docs/)

---

## 🆘 Getting Help

### Documentation Not Clear?

1. Check the specific guide's troubleshooting section
2. Review the quick reference sections
3. Search for error messages in the documentation

### Found an Issue?

1. Check existing issues in the repository
2. Create a new issue with:
   - What you were trying to do
   - What happened instead
   - Relevant logs or error messages
   - Your environment (OS, Docker version, etc.)

---

## 📝 Documentation Maintenance

**Last Updated**: 2026-01-25  
**Version**: 1.0.0

### Version History

- **1.0.0** (2026-01-25): Initial comprehensive operations documentation
  - Docker setup and management guide
  - Backup and restore procedures
  - Production deployment guide

---

**Note**: This documentation is designed for personal use (1-2 users). For multi-user or enterprise deployments, additional considerations may be needed.
