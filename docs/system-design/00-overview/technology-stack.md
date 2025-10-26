# Technology Stack

## Overview

This document details the technology selections for Master of Coin, with justifications based on project requirements: 1-2 users, high transaction volume, strict React patterns, and Docker deployment.

## Frontend Stack

### Core Framework: React 18+

**Choice**: React with functional components and hooks

**Justification**:

- Specified requirement
- Mature ecosystem with excellent tooling
- Strong TypeScript support
- Large community and resources
- Excellent performance with concurrent features

**Key Libraries**:

```json
{
  "react": "^18.2.0",
  "react-dom": "^18.2.0",
  "typescript": "^5.0.0"
}
```

### UI Component Library: Chakra UI

**Choice**: Chakra UI v2

**Justification**:

- **Accessibility-first**: WCAG compliant components out of the box
- **Composable**: Build complex components from simple primitives
- **Themeable**: Powerful theming system with design tokens
- **TypeScript**: Excellent TypeScript support
- **Developer experience**: Intuitive API, great documentation
- **Performance**: Lightweight, tree-shakeable
- **Styling**: CSS-in-JS with emotion, responsive props
- **Dark mode**: Built-in dark mode support
- **Active community**: Well-maintained, regular updates

**Why Chakra UI for Finance App**:

- Clean, modern aesthetic perfect for financial dashboards
- Flexible theming for custom branding
- Excellent form components with validation
- Responsive design system
- Smaller bundle size than Ant Design
- Better customization for unique financial UI needs

**Components for Finance App**:

- Table component (will need enhancement or use TanStack Table)
- Form components (Input, Select, NumberInput)
- Card and Box for layouts
- Stat component for KPIs
- Modal, Drawer for overlays
- Toast for notifications
- Tabs for navigation

**Additional Libraries Needed**:

- **TanStack Table**: For advanced data tables with sorting, filtering, pagination
- **React DatePicker**: For date range selection (Chakra doesn't include one)

```json
{
  "@chakra-ui/react": "^2.8.0",
  "@chakra-ui/icons": "^2.1.0",
  "@emotion/react": "^11.11.0",
  "@emotion/styled": "^11.11.0",
  "framer-motion": "^10.16.0",
  "@tanstack/react-table": "^8.10.0",
  "react-datepicker": "^4.21.0"
}
```

### Charting Library: Recharts

**Choice**: Recharts

**Justification**:

- **React-native**: Built specifically for React, uses React components
- **Declarative**: Fits React's component model perfectly
- **Responsive**: Works well on different screen sizes
- **Customizable**: Easy to style and theme
- **Good documentation**: Clear examples for financial charts
- **Lightweight**: Smaller bundle than alternatives
- **Active development**: Regular updates

**Chart Types Needed**:

- Line charts: Spending trends over time
- Bar charts: Category comparisons
- Pie charts: Budget distribution
- Area charts: Account balance history
- Composed charts: Multiple metrics

**Alternative Considered**: Chart.js with react-chartjs-2

- Rejected: Less React-native, more imperative API

**Alternative Considered**: Victory

- Rejected: Larger bundle size, more complex API

```json
{
  "recharts": "^2.10.0"
}
```

### State Management: React Query + Context API

**Choice**: TanStack Query (React Query) v5 + React Context

**Justification**:

**React Query for Server State**:

- Automatic caching and invalidation
- Background refetching
- Optimistic updates
- Request deduplication
- Perfect for API data management
- Reduces boilerplate significantly

**Context API for Client State**:

- Built-in, no extra dependencies
- Perfect for authentication state
- Simple for small-scale apps
- Meets the "simple hooks" requirement

**Why Not Redux/Zustand**:

- Overkill for 1-2 users
- More boilerplate
- Server state better handled by React Query
- Violates "simple components" principle

```json
{
  "@tanstack/react-query": "^5.0.0",
  "@tanstack/react-query-devtools": "^5.0.0"
}
```

### Routing: React Router v6

**Choice**: React Router v6

**Justification**:

- Industry standard for React SPAs
- Declarative routing
- Nested routes support
- Code splitting integration
- TypeScript support
- Excellent documentation

```json
{
  "react-router-dom": "^6.20.0"
}
```

### Form Management: React Hook Form

**Choice**: React Hook Form

**Justification**:

- Minimal re-renders (performance)
- Built with hooks (matches requirement)
- Excellent validation support
- Works well with Ant Design
- Small bundle size
- TypeScript support

**Alternative Considered**: Formik

- Rejected: More re-renders, larger bundle

```json
{
  "react-hook-form": "^7.48.0",
  "@hookform/resolvers": "^3.3.0",
  "zod": "^3.22.0"
}
```

### Date Handling: date-fns

**Choice**: date-fns

**Justification**:

- Lightweight (tree-shakeable)
- Immutable
- TypeScript support
- Works well with Ant Design DatePicker
- Simple API

**Alternative Considered**: Moment.js

- Rejected: Large bundle, mutable, deprecated

**Alternative Considered**: Day.js

- Considered: Smaller, but date-fns has better TypeScript support

```json
{
  "date-fns": "^3.0.0"
}
```

### HTTP Client: Axios

**Choice**: Axios

**Justification**:

- Automatic JSON transformation
- Interceptors for auth tokens
- Request/response transformation
- Better error handling than fetch
- Works seamlessly with React Query

```json
{
  "axios": "^1.6.0"
}
```

### Build Tool: Vite

**Choice**: Vite

**Justification**:

- Extremely fast development server
- Fast production builds
- Built-in TypeScript support
- Excellent React support
- Modern ESM-based
- Better than Create React App

```json
{
  "vite": "^5.0.0",
  "@vitejs/plugin-react": "^4.2.0"
}
```

### Testing: Vitest + React Testing Library

**Choice**: Vitest + React Testing Library

**Justification**:

- Vitest: Fast, Vite-native, Jest-compatible API
- RTL: Best practices for React testing
- User-centric testing approach

```json
{
  "vitest": "^1.0.0",
  "@testing-library/react": "^14.1.0",
  "@testing-library/jest-dom": "^6.1.0",
  "@testing-library/user-event": "^14.5.0"
}
```

## Backend Stack

### Core Framework: Rust with Axum

**Choice**: Axum web framework

**Justification**:

- **Modern**: Built on tokio, hyper, and tower
- **Type-safe**: Leverages Rust's type system
- **Performance**: Excellent for high transaction volume
- **Ergonomic**: Clean API, less boilerplate than Actix
- **Extractors**: Type-safe request handling
- **Middleware**: Tower middleware ecosystem
- **Active development**: Backed by Tokio team

**Alternative Considered**: Actix-web

- Also excellent, slightly more mature
- More complex API
- Axum chosen for cleaner code

**Alternative Considered**: Rocket

- Rejected: Less async-native, smaller ecosystem

```toml
[dependencies]
axum = "0.7"
tokio = { version = "1", features = ["full"] }
tower = "0.4"
tower-http = { version = "0.5", features = ["cors", "trace"] }
```

### Database ORM: Diesel

**Choice**: Diesel ORM

**Justification**:

- **Type-safe query builder**: Compile-time guarantees without raw SQL
- **Zero-cost abstractions**: No runtime overhead
- **Excellent PostgreSQL support**: Full feature support
- **Migrations**: Built-in migration system with CLI
- **Schema generation**: Automatic schema.rs generation
- **Custom types**: Strong support for PostgreSQL enums
- **Mature ecosystem**: Well-established, extensive documentation
- **Compile-time validation**: Catches errors before runtime

**Trade-offs**:

- **Synchronous**: Requires `tokio::task::spawn_blocking` for async contexts
- **Learning curve**: Query builder syntax vs raw SQL
- **Migration effort**: Requires updating from SQLx (4-7 hours)

**Why Diesel Over SQLx**:

- **Type safety**: Query builder provides stronger compile-time guarantees
- **Maintainability**: Less prone to SQL injection, easier refactoring
- **Developer experience**: Better IDE support and error messages
- **Custom types**: Superior enum handling for our 5 custom types
- **No production code yet**: Perfect time to migrate with minimal effort

**Migration Status**: See [`docs/database/sqlx-to-diesel-migration-plan.md`](../../database/sqlx-to-diesel-migration-plan.md)

```toml
[dependencies]
diesel = { version = "2.1", features = ["postgres", "uuid", "chrono", "numeric"] }
diesel_migrations = "2.1"
```

**Async Integration**:

```rust
// Use spawn_blocking for database operations in async handlers
use tokio::task;

async fn get_user(pool: &DbPool, id: Uuid) -> Result<User, Error> {
    let pool = pool.clone();
    task::spawn_blocking(move || {
        let mut conn = pool.get()?;
        users::table.find(id).first(&mut conn)
    })
    .await?
}
```

### Authentication: jsonwebtoken

**Choice**: jsonwebtoken crate

**Justification**:

- Industry standard JWT implementation
- Secure and well-tested
- Simple API
- Good documentation

```toml
[dependencies]
jsonwebtoken = "9.2"
```

### Password Hashing: argon2

**Choice**: argon2

**Justification**:

- Winner of Password Hashing Competition
- Resistant to GPU attacks
- Configurable memory hardness
- Industry recommended

```toml
[dependencies]
argon2 = "0.5"
```

### Serialization: serde

**Choice**: serde with serde_json

**Justification**:

- De facto standard in Rust
- Excellent performance
- Derive macros for easy use
- Strong typing

```toml
[dependencies]
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
```

### Validation: validator

**Choice**: validator crate

**Justification**:

- Derive-based validation
- Common validators (email, length, range)
- Custom validators support
- Works well with serde

```toml
[dependencies]
validator = { version = "0.16", features = ["derive"] }
```

### Error Handling: thiserror + anyhow

**Choice**: thiserror for library errors, anyhow for application errors

**Justification**:

- **thiserror**: Custom error types with derive macro
- **anyhow**: Context and error chaining
- Standard pattern in Rust ecosystem

```toml
[dependencies]
thiserror = "1.0"
anyhow = "1.0"
```

### Logging: tracing

**Choice**: tracing + tracing-subscriber

**Justification**:

- Structured logging
- Async-aware
- Excellent for debugging
- Industry standard

```toml
[dependencies]
tracing = "0.1"
tracing-subscriber = { version = "0.3", features = ["env-filter"] }
```

### Configuration: config

**Choice**: config crate

**Justification**:

- Multiple source support (env, files, etc.)
- Type-safe configuration
- Environment-specific configs

```toml
[dependencies]
config = "0.13"
```

### UUID Generation: uuid

**Choice**: uuid crate

**Justification**:

- Standard UUID implementation
- Multiple UUID versions
- Serde support

```toml
[dependencies]
uuid = { version = "1.6", features = ["serde", "v4"] }
```

### Date/Time: chrono

**Choice**: chrono

**Justification**:

- Comprehensive date/time handling
- Timezone support
- Diesel integration
- Serde support

```toml
[dependencies]
chrono = { version = "0.4", features = ["serde"] }
```

## Database

### Primary Database: PostgreSQL 16

**Choice**: PostgreSQL 16

**Justification**:

- **ACID compliance**: Critical for financial data
- **JSON support**: Flexible for transaction metadata
- **Complex queries**: Excellent for aggregations and analytics
- **Window functions**: Perfect for financial calculations
- **Mature**: Battle-tested, reliable
- **Indexing**: Advanced indexing for performance
- **Partitioning**: Can handle growing transaction volume
- **Full-text search**: For transaction search
- **CTEs**: Complex analytical queries

**Why Not MongoDB**:

- Financial data needs ACID guarantees
- Complex relationships (accounts, transactions, people)
- Need for complex aggregations and joins
- Schema validation important

**Why Not SQLite**:

- Limited concurrent writes
- No built-in replication
- Less suitable for production

**Docker Image**:

```yaml
postgres:16-alpine
```

### Cache Layer: Redis (Optional)

**Choice**: Redis 7

**Justification**:

- **Dashboard caching**: Cache expensive aggregations
- **Session storage**: Optional session management
- **Fast**: In-memory performance
- **Simple**: Easy to integrate
- **Optional**: Can start without it, add later

**When to Add**:

- Dashboard queries become slow
- Multiple concurrent users
- Complex aggregations needed frequently

**Docker Image**:

```yaml
redis:7-alpine
```

## Static File Serving

### Option 1: Rust Backend Only (Recommended for 1-2 Users)

**Choice**: Axum with tower-http static file serving

**Justification**:

- **Simpler deployment**: One less container
- **Sufficient performance**: For 1-2 users, Rust is fast enough
- **Easier development**: Single server to manage
- **Less complexity**: Fewer moving parts

**Implementation**:

```rust
use tower_http::services::ServeDir;

let app = Router::new()
    .nest_service("/", ServeDir::new("dist"))
    .nest("/api", api_routes());
```

### Option 2: Nginx (If Needed Later)

**Choice**: Nginx

**When to Use**:

- More than 5 concurrent users
- Need advanced caching
- Want rate limiting
- Need SSL termination separate from app

**Justification**:

- Industry standard
- Excellent static file performance
- Advanced features (caching, compression, rate limiting)
- Can add later without code changes

**Docker Image**:

```yaml
nginx:alpine
```

## Networking & Access

### Cloudflare Tunnel (cloudflared)

**Choice**: Cloudflare Tunnel for secure access

**Justification**:

- **No port forwarding**: No need to expose ports on your router
- **Zero-trust security**: Built-in authentication and access control
- **Automatic HTTPS**: Free SSL/TLS certificates
- **DDoS protection**: Cloudflare's network protects your origin
- **Easy setup**: Simple configuration with Docker
- **Free tier**: Sufficient for personal use (1-2 users)
- **No static IP needed**: Works with dynamic IPs
- **Access control**: Can restrict by email, IP, or other criteria

**How It Works**:

1. Cloudflared container runs alongside your app
2. Creates secure tunnel to Cloudflare's edge network
3. Your domain points to Cloudflare
4. Traffic routes through tunnel to your local Docker containers
5. No inbound ports needed on your firewall

**Configuration**:

```yaml
# docker-compose.yml
cloudflared:
  image: cloudflare/cloudflared:latest
  command: tunnel --no-autoupdate run
  environment:
    - TUNNEL_TOKEN=${CLOUDFLARE_TUNNEL_TOKEN}
  restart: unless-stopped
```

**Benefits for Master of Coin**:

- Access from anywhere securely
- No complex networking setup
- Professional HTTPS setup
- Can add authentication layer
- Works behind NAT/firewall
- Mobile access included

**Setup Steps**:

1. Create Cloudflare account (free)
2. Add your domain to Cloudflare
3. Create tunnel in Cloudflare dashboard
4. Get tunnel token
5. Configure tunnel to route to your app
6. Deploy with Docker Compose

**Alternative Considered**: Traditional port forwarding + Let's Encrypt

- Rejected: Less secure, requires static IP, manual cert renewal, exposes ports

**Alternative Considered**: Tailscale

- Considered: Good for VPN access, but Cloudflare Tunnel better for web apps

## Development Tools

### TypeScript

**Choice**: TypeScript 5+

**Justification**:

- Type safety for React components
- Better IDE support
- Catches errors at compile time
- Industry standard for React

### ESLint + Prettier

**Choice**: ESLint with TypeScript plugin + Prettier

**Justification**:

- Code quality enforcement
- Consistent formatting
- Catches common errors

### Docker & Docker Compose

**Choice**: Docker with Docker Compose

**Justification**:

- Consistent environments
- Easy deployment
- Isolated services
- Portable

## Summary of Key Decisions

| Category           | Technology                         | Primary Reason                                   |
| ------------------ | ---------------------------------- | ------------------------------------------------ |
| Frontend Framework | React 18                           | Requirement, modern patterns                     |
| UI Library         | Chakra UI                          | Composable, accessible, themeable                |
| Charts             | Recharts                           | React-native, lightweight                        |
| State Management   | React Query + Context              | Server/client state separation                   |
| Backend Framework  | Axum                               | Modern, type-safe, performant                    |
| Database           | PostgreSQL 16                      | ACID, complex queries, JSON                      |
| ORM/Query          | Diesel                             | Type-safe query builder, compile-time validation |
| Cache              | Redis (optional)                   | Dashboard performance                            |
| Static Files       | Axum (serves all)                  | Simplicity for 1-2 users                         |
| Deployment         | Docker Compose + Cloudflare Tunnel | Secure access, no port exposure                  |
| Networking         | Cloudflare Tunnel                  | Zero-trust access, HTTPS                         |

## Bundle Size Considerations

### Frontend (Estimated Production Build)

- React + React DOM: ~140 KB
- Chakra UI + Emotion: ~120-150 KB
- Recharts: ~100 KB
- TanStack Table: ~30 KB
- React Query: ~40 KB
- React Router: ~30 KB
- Other utilities: ~50 KB
- **Total**: ~510-540 KB (gzipped: ~160-180 KB)

This is excellent for a financial application with rich features. Chakra UI provides a lighter bundle than Ant Design while maintaining excellent functionality.

## Performance Targets

### Frontend

- First Contentful Paint: < 1.5s
- Time to Interactive: < 3s
- Lighthouse Score: > 90

### Backend

- API Response Time: < 100ms (p95)
- Database Query Time: < 50ms (p95)
- Concurrent Requests: 100+ (more than enough for 1-2 users)

### Database

- Transaction Insert: < 10ms
- Dashboard Query: < 200ms
- Search Query: < 100ms
