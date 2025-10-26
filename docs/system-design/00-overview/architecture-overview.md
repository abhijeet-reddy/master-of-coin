# Architecture Overview

## System Architecture

Master of Coin is a full-stack personal finance tracker designed for 1-2 users with a focus on detailed transaction tracking, split payments, and comprehensive financial analytics.

### High-Level Architecture

```mermaid
graph TB
    subgraph "Client Layer"
        UI[React Frontend]
        Charts[Chart Components]
        Forms[Form Components]
    end

    subgraph "API Layer"
        API[REST API Gateway]
        Auth[Authentication Middleware]
        Valid[Validation Layer]
    end

    subgraph "Business Logic Layer"
        TransSvc[Transaction Service]
        AcctSvc[Account Service]
        BudgetSvc[Budget Service]
        DebtSvc[Debt Tracking Service]
        AnalyticsSvc[Analytics Service]
    end

    subgraph "Data Layer"
        DB[(PostgreSQL Database)]
        Cache[Redis Cache]
    end

    UI --> API
    Charts --> API
    Forms --> API
    API --> Auth
    Auth --> Valid
    Valid --> TransSvc
    Valid --> AcctSvc
    Valid --> BudgetSvc
    Valid --> DebtSvc
    Valid --> AnalyticsSvc
    TransSvc --> DB
    AcctSvc --> DB
    BudgetSvc --> DB
    DebtSvc --> DB
    AnalyticsSvc --> DB
    AnalyticsSvc --> Cache
```

### Component Interactions

#### 1. Frontend → Backend Flow

```mermaid
sequenceDiagram
    participant User
    participant React
    participant API
    participant Service
    participant DB

    User->>React: Interact with UI
    React->>React: Validate Input (Hook)
    React->>API: HTTP Request (JWT)
    API->>API: Authenticate
    API->>API: Validate Request
    API->>Service: Process Business Logic
    Service->>DB: Query/Mutation
    DB-->>Service: Result
    Service-->>API: Response
    API-->>React: JSON Response
    React->>React: Update State (Hook)
    React-->>User: Display Result
```

#### 2. Transaction Creation with Split Payment

```mermaid
sequenceDiagram
    participant User
    participant UI
    participant TransAPI
    participant TransService
    participant DebtService
    participant DB

    User->>UI: Create Transaction with Splits
    UI->>TransAPI: POST /transactions
    TransAPI->>TransService: Create Transaction
    TransService->>DB: Insert Transaction
    TransService->>DebtService: Calculate Debt Splits
    DebtService->>DB: Update Debt Records
    DB-->>DebtService: Confirmation
    DebtService-->>TransService: Split Results
    TransService-->>TransAPI: Transaction Created
    TransAPI-->>UI: Success Response
    UI-->>User: Show Confirmation
```

### Data Flow Architecture

#### 1. Read Operations (Dashboard/Analytics)

```mermaid
graph LR
    A[User Request] --> B[React Component]
    B --> C[Custom Hook]
    C --> D[API Call]
    D --> E[Cache Check]
    E -->|Hit| F[Return Cached Data]
    E -->|Miss| G[Query Database]
    G --> H[Aggregate Data]
    H --> I[Cache Result]
    I --> F
    F --> C
    C --> B
    B --> J[Render Charts/Tables]
```

#### 2. Write Operations (Transaction Creation)

```mermaid
graph LR
    A[User Input] --> B[Form Component]
    B --> C[Validation Hook]
    C --> D[API Call]
    D --> E[Business Logic]
    E --> F[Transaction Validation]
    F --> G[Split Calculation]
    G --> H[Database Write]
    H --> I[Invalidate Cache]
    I --> J[Return Success]
    J --> K[Update UI State]
    K --> L[Refresh Dashboard]
```

### System Layers

#### 1. Presentation Layer (React Frontend)

- **Responsibility**: User interface, user interactions, client-side validation
- **Technology**: React with functional components and hooks
- **Key Patterns**:
  - Single responsibility hooks
  - Controlled components
  - Optimistic UI updates
  - Error boundaries

#### 2. API Layer (Rust Backend)

- **Responsibility**: Request routing, authentication, input validation
- **Technology**: Actix-web or Axum
- **Key Patterns**:
  - RESTful endpoints
  - JWT-based authentication
  - Request/response middleware
  - Error handling middleware

#### 3. Business Logic Layer (Rust Services)

- **Responsibility**: Core business rules, calculations, data transformations
- **Technology**: Rust modules with trait-based design
- **Key Patterns**:
  - Service layer pattern
  - Repository pattern
  - Domain-driven design
  - Result-based error handling

#### 4. Data Access Layer (Rust Repositories)

- **Responsibility**: Database queries, data persistence
- **Technology**: Diesel ORM
- **Key Patterns**:
  - Repository pattern
  - Type-safe query builder
  - Transaction management
  - Connection pooling with r2d2
  - Async/sync bridge with `spawn_blocking`

#### 5. Data Storage Layer

- **Responsibility**: Data persistence, integrity, performance
- **Technology**: PostgreSQL with Redis cache
- **Key Patterns**:
  - Normalized schema
  - Indexed queries
  - ACID transactions
  - Cache-aside pattern

### Cross-Cutting Concerns

#### Authentication & Authorization

```mermaid
graph TB
    A[Login Request] --> B[Validate Credentials]
    B --> C[Generate JWT]
    C --> D[Return Token]
    D --> E[Store in Memory]
    E --> F[Include in API Requests]
    F --> G[Verify JWT]
    G --> H[Extract User ID]
    H --> I[Authorize Request]
```

#### Error Handling Strategy

- **Frontend**: Error boundaries, toast notifications, form validation errors
- **Backend**: Result types, custom error enums, structured error responses
- **Database**: Transaction rollbacks, constraint violations, connection errors

#### Logging & Monitoring

- **Frontend**: Console errors, user action tracking
- **Backend**: Structured logging (tracing crate), request/response logging
- **Database**: Query performance logs, slow query analysis

### Scalability Considerations

#### Current Scale (1-2 Users)

- Single Docker container deployment
- Shared PostgreSQL instance
- Minimal caching requirements
- Simple backup strategy

#### Future Scale (If Needed)

- Horizontal scaling with load balancer
- Read replicas for analytics queries
- Enhanced caching layer
- CDN for static assets
- Database partitioning by date

### Security Architecture

```mermaid
graph TB
    A[HTTPS Only] --> B[JWT Authentication]
    B --> C[Input Validation]
    C --> D[SQL Injection Prevention]
    D --> E[XSS Protection]
    E --> F[CSRF Protection]
    F --> G[Rate Limiting]
    G --> H[Secure Headers]
```

### Performance Optimization

#### Frontend

- Code splitting by route
- Lazy loading components
- Memoization of expensive calculations
- Virtual scrolling for large lists
- Debounced search inputs

#### Backend

- Connection pooling
- Query optimization with indexes
- Batch operations where possible
- Caching frequently accessed data
- Async/await for I/O operations

#### Database

- Proper indexing strategy
- Materialized views for complex aggregations
- Partitioning for transaction history
- Regular VACUUM and ANALYZE

### Deployment Architecture

```mermaid
graph TB
    subgraph "Internet"
        User[User Browser]
        CF[Cloudflare Edge]
    end

    subgraph "Docker Host Local Network"
        subgraph "Cloudflare Tunnel"
            Tunnel[cloudflared]
        end
        subgraph "Backend Container"
            API[Rust API Server]
            Static[Static Files]
        end
        subgraph "Database Container"
            DB[PostgreSQL]
        end
        subgraph "Cache Container Optional"
            Cache[Redis]
        end
    end

    User -->|HTTPS| CF
    CF -->|Secure Tunnel| Tunnel
    Tunnel --> API
    Tunnel --> Static
    API --> DB
    API --> Cache

    Compose[Docker Compose] -.-> Tunnel
    Compose -.-> API
    Compose -.-> DB
    Compose -.-> Cache
```

**Key Points**:

- No exposed ports on local network
- Cloudflare Tunnel provides secure access
- Rust backend serves both API and static files
- All traffic encrypted end-to-end
- No need for port forwarding or static IP

### Key Architectural Decisions

1. **Monolithic Backend**: Single Rust application for simplicity given small user base
2. **PostgreSQL**: Chosen for ACID compliance, complex queries, and JSON support
3. **REST API**: Simpler than GraphQL for this use case, easier to cache
4. **JWT Authentication**: Stateless, scalable, works well with SPA
5. **Docker Deployment**: Consistent environments, easy deployment, portable
6. **Redis Cache**: Optional but recommended for dashboard performance
7. **Functional React**: Modern patterns, better performance, easier testing

### Development Workflow

```mermaid
graph LR
    A[Local Development] --> B[Git Commit]
    B --> C[Docker Build]
    C --> D[Run Tests]
    D --> E[Deploy to Host]
    E --> F[Health Check]
    F --> G[Production]
```

### API Communication Pattern

All communication between frontend and backend follows this pattern:

- **Request**: JSON payload with JWT in Authorization header
- **Response**: JSON with consistent structure (data/error fields)
- **Error Handling**: HTTP status codes + detailed error messages
- **Versioning**: URL-based versioning (/api/v1/)

### State Management Strategy

#### Frontend State Categories

1. **Server State**: Cached API responses (React Query)
2. **UI State**: Form inputs, modal visibility (local useState)
3. **User State**: Authentication, preferences (Context API)
4. **Route State**: URL parameters, navigation (React Router)

#### Backend State Management

- Stateless API design
- Database as single source of truth
- Redis for session/cache data
- No in-memory state (for horizontal scaling)
