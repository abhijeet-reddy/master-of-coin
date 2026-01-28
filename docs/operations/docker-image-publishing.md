# Docker Image Publishing Guide

This guide explains how to build, publish, and deploy Docker images for Master of Coin using GitHub Container Registry (ghcr.io).

## Overview

Master of Coin uses a multi-stage Docker build that includes:

- **Frontend**: React/TypeScript application built with Vite
- **Backend**: Rust application with Diesel ORM
- **Runtime**: Minimal Debian-based image serving both frontend and backend

Images are automatically built and published to GitHub Container Registry when you create a release.

## Table of Contents

1. [Automated Publishing (Recommended)](#automated-publishing-recommended)
2. [Using Pre-built Images](#using-pre-built-images)
3. [Manual Building and Publishing](#manual-building-and-publishing)
4. [Image Tags Explained](#image-tags-explained)
5. [Troubleshooting](#troubleshooting)

---

## Automated Publishing (Recommended)

### How It Works

The GitHub Actions workflow (`.github/workflows/docker-publish.yml`) automatically builds and publishes Docker images when you create a GitHub release.

### Step-by-Step Process

#### 1. Create a Release

```bash
# Create and push a version tag
git tag -a v1.0.0 -m "Release version 1.0.0"
git push origin v1.0.0
```

#### 2. Publish the Release on GitHub

1. Go to your repository: https://github.com/abhijeet-reddy/master-of-coin
2. Click on "Releases" → "Create a new release"
3. Select the tag you just created (v1.0.0)
4. Add release notes describing changes
5. Click "Publish release"

#### 3. Automatic Build

The workflow will automatically:

- Build the Docker image for both AMD64 and ARM64 architectures
- Tag the image with multiple tags:
  - `ghcr.io/abhijeet-reddy/master-of-coin:v1.0.0` (full version)
  - `ghcr.io/abhijeet-reddy/master-of-coin:v1.0` (major.minor)
  - `ghcr.io/abhijeet-reddy/master-of-coin:v1` (major only)
  - `ghcr.io/abhijeet-reddy/master-of-coin:latest` (latest release)
- Push all tags to GitHub Container Registry
- Generate cryptographic attestation for supply chain security

#### 4. Monitor Progress

- Go to the "Actions" tab in your repository
- Watch the "Build and Publish Docker Image" workflow
- Build typically takes 10-15 minutes

---

## Using Pre-built Images

### Quick Start

Use the provided example docker-compose file to deploy with pre-built images:

```bash
# Copy the example file
cp docker-compose.image.example.yml docker-compose.prod.yml

# Start services
docker-compose -f docker-compose.prod.yml up -d
```

### Image Variants

#### Latest Release (Recommended for Production)

```yaml
image: ghcr.io/abhijeet-reddy/master-of-coin:latest
```

#### Specific Version (Most Stable)

```yaml
image: ghcr.io/abhijeet-reddy/master-of-coin:v1.0.0
```

#### Major Version (Auto-updates Minor/Patch)

```yaml
image: ghcr.io/abhijeet-reddy/master-of-coin:v1
```

### Authentication

#### Public Images

No authentication needed for public repositories.

#### Private Images

If your repository is private, authenticate first:

```bash
# Create a Personal Access Token (PAT) with 'read:packages' scope
# Go to: Settings → Developer settings → Personal access tokens

# Login to GitHub Container Registry
echo $GITHUB_TOKEN | docker login ghcr.io -u USERNAME --password-stdin
```

---

## Manual Building and Publishing

### Prerequisites

- Docker installed and running
- GitHub account with access to the repository
- Personal Access Token with `write:packages` permission

### Build Locally

```bash
# Build the image
docker build -t ghcr.io/abhijeet-reddy/master-of-coin:local .

# Test the image
docker run -p 13153:13153 \
  -e DATABASE_URL=postgresql://postgres:postgres@host.docker.internal:5432/master_of_coin \
  -e JWT_SECRET=your-secret-key-min-32-characters \
  ghcr.io/abhijeet-reddy/master-of-coin:local
```

### Push to Registry

```bash
# Login to GitHub Container Registry
echo $GITHUB_TOKEN | docker login ghcr.io -u abhijeet-reddy --password-stdin

# Tag the image
docker tag ghcr.io/abhijeet-reddy/master-of-coin:local \
  ghcr.io/abhijeet-reddy/master-of-coin:v1.0.0

# Push to registry
docker push ghcr.io/abhijeet-reddy/master-of-coin:v1.0.0
```

### Multi-Architecture Build

For production, build for both AMD64 and ARM64:

```bash
# Create and use a new builder
docker buildx create --name multiarch --use

# Build and push for multiple platforms
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  --tag ghcr.io/abhijeet-reddy/master-of-coin:v1.0.0 \
  --tag ghcr.io/abhijeet-reddy/master-of-coin:latest \
  --push \
  .
```

---

## Image Tags Explained

### Tag Strategy

| Tag Pattern                | Example  | Description           | Use Case                |
| -------------------------- | -------- | --------------------- | ----------------------- |
| `latest`                   | `latest` | Most recent release   | Development/Testing     |
| `v{major}.{minor}.{patch}` | `v1.2.3` | Specific version      | Production (pinned)     |
| `v{major}.{minor}`         | `v1.2`   | Latest patch in minor | Production (auto-patch) |
| `v{major}`                 | `v1`     | Latest minor in major | Staging (auto-minor)    |

### Version Selection Guide

**Production (Stable)**

```yaml
image: ghcr.io/abhijeet-reddy/master-of-coin:v1.0.0
```

- ✅ Predictable and reproducible
- ✅ No surprise updates
- ❌ Manual updates required

**Production (Auto-patch)**

```yaml
image: ghcr.io/abhijeet-reddy/master-of-coin:v1.0
```

- ✅ Automatic security patches
- ✅ Bug fixes without manual update
- ⚠️ May introduce minor changes

**Staging/Development**

```yaml
image: ghcr.io/abhijeet-reddy/master-of-coin:latest
```

- ✅ Always up-to-date
- ✅ Test new features early
- ❌ May break unexpectedly

---

## Troubleshooting

### Image Pull Fails

**Error**: `Error response from daemon: pull access denied`

**Solution**:

```bash
# Verify the image exists
docker manifest inspect ghcr.io/abhijeet-reddy/master-of-coin:latest

# If private, authenticate
echo $GITHUB_TOKEN | docker login ghcr.io -u abhijeet-reddy --password-stdin
```

### Build Fails in GitHub Actions

**Error**: Build timeout or out of memory

**Solution**:

- Check the Actions logs for specific errors
- Verify Dockerfile syntax
- Ensure all source files are committed
- Check if dependencies are accessible

### Image Size Too Large

**Current size**: ~150-200 MB (optimized)

**If larger**:

- Verify multi-stage build is working
- Check if unnecessary files are copied
- Ensure `.dockerignore` is properly configured

### Container Fails to Start

**Check logs**:

```bash
docker logs master-of-coin-server
```

**Common issues**:

1. **Database connection**: Verify `DATABASE_URL` is correct
2. **Missing JWT_SECRET**: Set environment variable
3. **Port conflict**: Ensure port 13153 is available

---

## Best Practices

### 1. Use Specific Versions in Production

```yaml
# ✅ Good
image: ghcr.io/abhijeet-reddy/master-of-coin:v1.0.0

# ❌ Avoid in production
image: ghcr.io/abhijeet-reddy/master-of-coin:latest
```

### 2. Always Test Before Releasing

```bash
# Build and test locally first
docker build -t test-image .
docker run --rm test-image

# Then create the release
git tag v1.0.0
git push origin v1.0.0
```

### 3. Use Semantic Versioning

- **MAJOR** (v2.0.0): Breaking changes
- **MINOR** (v1.1.0): New features, backward compatible
- **PATCH** (v1.0.1): Bug fixes, backward compatible

### 4. Document Changes in Releases

Include in release notes:

- New features
- Bug fixes
- Breaking changes
- Migration steps (if any)

### 5. Monitor Image Size

```bash
# Check image size
docker images ghcr.io/abhijeet-reddy/master-of-coin

# Inspect layers
docker history ghcr.io/abhijeet-reddy/master-of-coin:latest
```

---

## Additional Resources

- [GitHub Container Registry Documentation](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry)
- [Docker Multi-stage Builds](https://docs.docker.com/build/building/multi-stage/)
- [Semantic Versioning](https://semver.org/)
- [Docker Buildx](https://docs.docker.com/buildx/working-with-buildx/)

---

## Quick Reference

### Common Commands

```bash
# Pull latest image
docker pull ghcr.io/abhijeet-reddy/master-of-coin:latest

# Run with docker-compose (pre-built image)
docker-compose -f docker-compose.image.example.yml up -d

# Run with docker-compose (local build)
docker-compose up -d

# View running containers
docker ps

# View logs
docker logs -f master-of-coin-server

# Stop services
docker-compose down
```

### Environment Variables

| Variable       | Required | Default   | Description                              |
| -------------- | -------- | --------- | ---------------------------------------- |
| `DATABASE_URL` | Yes      | -         | PostgreSQL connection string             |
| `JWT_SECRET`   | Yes      | -         | Secret key for JWT tokens (min 32 chars) |
| `SERVER_HOST`  | No       | `0.0.0.0` | Server bind address                      |
| `SERVER_PORT`  | No       | `13153`   | Server port                              |
| `RUST_LOG`     | No       | `info`    | Log level (error/warn/info/debug/trace)  |
