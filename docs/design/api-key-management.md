# API Key Management System Design

## Overview

This document outlines the design for implementing API key management in the Master of Coin finance tracker application. Users will be able to create API keys from the UI with scoped permissions and use them to make API calls in their own applications.

## Requirements

### Functional Requirements

1. Users can create multiple API keys with custom names
2. Each API key has configurable permission scopes (read/write access to specific resources)
3. API keys have configurable expiration dates (30/60/90 days or never)
4. API keys are shown only once upon creation (security best practice)
5. Users can list, view (metadata only), and revoke their API keys
6. API keys can be used as Bearer tokens in API requests
7. Solution should be extensible for future rate limiting

### Non-Functional Requirements

1. API keys must be securely hashed in the database
2. Only the hash is stored; the plain key is never retrievable
3. Authentication middleware must support both JWT tokens and API keys
4. Performance impact should be minimal
5. Audit logs are not required initially

---

## 1. Database Schema Design

### New Table: `api_keys`

```sql
-- Create enum for API key status
CREATE TYPE api_key_status AS ENUM ('active', 'revoked', 'expired');

CREATE TABLE api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    key_hash VARCHAR(255) NOT NULL UNIQUE,
    key_prefix VARCHAR(20) NOT NULL,  -- First 12 chars for identification (e.g., "moc_k7Hj9pL2")
    scopes JSONB NOT NULL DEFAULT '{}',
    status api_key_status NOT NULL DEFAULT 'active',
    expires_at TIMESTAMPTZ,  -- NULL means never expires
    last_used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT api_keys_user_id_name_unique UNIQUE(user_id, name)
);

CREATE INDEX idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX idx_api_keys_key_hash ON api_keys(key_hash);
```

**Status Enum Values:**

- `active`: Key is valid and can be used for authentication
- `revoked`: Key has been manually revoked by the user
- `expired`: Key has passed its expiration date (can be set by background job)

**Benefits of Status Enum:**

1. **Clearer intent**: Status is explicit rather than inferred from NULL values
2. **Extensibility**: Easy to add new statuses in the future (e.g., `suspended`, `rate_limited`)
3. **Better queries**: Can filter by specific status without NULL checks
4. **Simpler logic**: Single field to check instead of multiple conditions
5. **Database constraints**: Enum enforces valid values at DB level

**Index Usage Explanation:**

1. **`idx_api_keys_user_id`**: Used when listing a user's API keys

   ```sql
   SELECT * FROM api_keys WHERE user_id = $1
   ```

   This index also helps with queries filtering by user_id and status:

   ```sql
   SELECT * FROM api_keys
   WHERE user_id = $1 AND status = 'active'
   ORDER BY created_at DESC
   ```

2. **`idx_api_keys_key_hash`**: Used during API key authentication
   ```sql
   SELECT * FROM api_keys WHERE key_hash = $1
   ```
   This is the critical index for authentication performance as it's queried on every API request using an API key.

### Scopes Structure (JSONB)

```json
{
  "transactions": ["read", "write"],
  "accounts": ["read"],
  "budgets": ["read", "write"],
  "categories": ["read"],
  "people": ["read", "write"]
}
```

**Scope Definitions:**

- `read`: GET operations
- `write`: POST, PUT, DELETE operations

---

## 2. API Key Generation & Hashing Strategy

### Key Format

```
moc_<random_32_chars>
```

- Prefix: `moc_` (Master of Coin)
- Length: 36 characters total (4 prefix + 32 random)
- Character set: alphanumeric (a-z, A-Z, 0-9)
- Example: `moc_k7Hj9pL2mN4qR8sT1vW3xY5zA6bC`

### Generation Process

1. Generate 32 cryptographically secure random characters
2. Prepend with `moc_` prefix
3. Hash the full key using Argon2 (same as passwords)
4. Store hash in database
5. Store first 12 characters as `key_prefix` for user identification
6. Return plain key to user (only shown once)

### Hashing

- Use Argon2id (same algorithm as user passwords)
- Store hash in `key_hash` column
- Never store plain key in database

### Verification

1. Extract key from `Authorization: Bearer moc_...` header
2. Hash the provided key
3. Query database for matching hash with `status = 'active'`
4. If found, check if expired at runtime (if `expires_at < NOW()`, treat as expired)
5. Check scopes for the requested operation

---

## 3. Permission/Scope System

### Scope Model

```rust
// backend/src/models/api_key.rs

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiKeyScopes {
    pub transactions: Vec<ScopePermission>,
    pub accounts: Vec<ScopePermission>,
    pub budgets: Vec<ScopePermission>,
    pub categories: Vec<ScopePermission>,
    pub people: Vec<ScopePermission>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum ScopePermission {
    Read,
    Write,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ResourceType {
    Transactions,
    Accounts,
    Budgets,
    Categories,
    People,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum OperationType {
    Read,   // GET
    Write,  // POST, PUT, DELETE
}
```

### Scope Validation Logic

```rust
impl ApiKeyScopes {
    pub fn has_permission(&self, resource: ResourceType, operation: OperationType) -> bool {
        let permissions = match resource {
            ResourceType::Transactions => &self.transactions,
            ResourceType::Accounts => &self.accounts,
            ResourceType::Budgets => &self.budgets,
            ResourceType::Categories => &self.categories,
            ResourceType::People => &self.people,
        };

        match operation {
            OperationType::Read => permissions.contains(&ScopePermission::Read),
            OperationType::Write => permissions.contains(&ScopePermission::Write),
        }
    }
}
```

### Default Scopes

When creating an API key, users must explicitly select scopes. No default "all access" scope.

---

## 4. Backend API Endpoints

### API Key Management Endpoints

```
POST   /api/v1/api-keys              - Create new API key
GET    /api/v1/api-keys              - List user's API keys
GET    /api/v1/api-keys/:id          - Get API key details (no key value)
DELETE /api/v1/api-keys/:id          - Revoke API key (sets status to 'revoked')
PATCH  /api/v1/api-keys/:id          - Update API key (name, expiration, scopes)
```

### Request/Response DTOs

#### Create API Key Request

```json
{
  "name": "My Integration",
  "scopes": {
    "transactions": ["read", "write"],
    "accounts": ["read"],
    "budgets": ["read"],
    "categories": [],
    "people": []
  },
  "expires_in_days": 90 // or null for never
}
```

#### Create API Key Response (only shown once)

```json
{
  "id": "uuid",
  "name": "My Integration",
  "key": "moc_k7Hj9pL2mN4qR8sT1vW3xY5zA6bC", // Only in creation response
  "key_prefix": "moc_k7Hj9pL2",
  "scopes": {
    /* ... */
  },
  "expires_at": "2026-04-30T00:00:00Z",
  "created_at": "2026-01-31T19:00:00Z"
}
```

#### List API Keys Response

```json
{
  "api_keys": [
    {
      "id": "uuid",
      "name": "My Integration",
      "key_prefix": "moc_k7Hj9pL2",
      "scopes": {
        /* ... */
      },
      "expires_at": "2026-04-30T00:00:00Z",
      "last_used_at": "2026-01-31T18:00:00Z",
      "created_at": "2026-01-31T19:00:00Z",
      "status": "active"
    }
  ]
}
```

---

## 5. Authentication Middleware Modifications

### Current Flow

```
Request → Extract JWT → Verify JWT → Fetch User → Add to Extensions → Continue
```

### New Flow

```
Request → Check Authorization Header
    ├─ JWT Token (Bearer jwt_...)
    │   └─ Verify JWT → Fetch User → Add User + Auth Context → Continue
    │
    └─ API Key (Bearer moc_...)
        └─ Verify API Key → Fetch User → Add User + Auth Context + Scopes → Continue
```

### Authentication Context

```rust
// backend/src/auth/context.rs

#[derive(Debug, Clone)]
pub enum AuthContext {
    Jwt {
        user: User,
    },
    ApiKey {
        user: User,
        api_key_id: Uuid,
        scopes: ApiKeyScopes,
    },
}

impl AuthContext {
    pub fn user(&self) -> &User {
        match self {
            AuthContext::Jwt { user } => user,
            AuthContext::ApiKey { user, .. } => user,
        }
    }

    pub fn has_permission(&self, resource: ResourceType, operation: OperationType) -> bool {
        match self {
            AuthContext::Jwt { .. } => true,  // JWT has full access
            AuthContext::ApiKey { scopes, .. } => scopes.has_permission(resource, operation),
        }
    }
}
```

### Middleware Implementation

```rust
// backend/src/middleware/auth.rs (modified)

pub async fn require_auth(
    State(pool): State<DbPool>,
    mut req: Request<Body>,
    next: Next,
) -> Result<Response, StatusCode> {
    let auth_header = extract_auth_header(&req)?;

    let auth_context = if auth_header.starts_with("Bearer moc_") {
        // API Key authentication
        authenticate_with_api_key(&pool, auth_header).await?
    } else {
        // JWT authentication (existing logic)
        authenticate_with_jwt(&pool, auth_header).await?
    };

    req.extensions_mut().insert(auth_context);
    Ok(next.run(req).await)
}

// New middleware for scope checking
pub async fn require_scope(
    resource: ResourceType,
    operation: OperationType,
) -> impl Fn(Request<Body>, Next) -> Future<Output = Result<Response, StatusCode>> {
    move |req: Request<Body>, next: Next| async move {
        let auth_context = req.extensions().get::<AuthContext>()
            .ok_or(StatusCode::UNAUTHORIZED)?;

        if !auth_context.has_permission(resource, operation) {
            return Ok((
                StatusCode::FORBIDDEN,
                Json(json!({"error": "Insufficient permissions"})),
            ).into_response());
        }

        Ok(next.run(req).await)
    }
}
```

### Route Protection

```rust
// Example: Protect transaction routes with scope checking
.route(
    "/transactions",
    get(handlers::transactions::list)
        .layer(middleware::from_fn(require_scope(
            ResourceType::Transactions,
            OperationType::Read,
        )))
        .post(handlers::transactions::create)
        .layer(middleware::from_fn(require_scope(
            ResourceType::Transactions,
            OperationType::Write,
        )))
)
```

---

## 6. Frontend UI Components

### New Pages/Components

#### 1. API Keys Settings Page (`/settings/api-keys`)

**Layout:**

```
┌─────────────────────────────────────────────────────────┐
│ API Keys                                    [+ New Key] │
├─────────────────────────────────────────────────────────┤
│                                                          │
│ ┌────────────────────────────────────────────────────┐ │
│ │ My Integration                    moc_k7Hj9pL2...  │ │
│ │ Created: Jan 31, 2026            Last used: 2h ago │ │
│ │ Expires: Apr 30, 2026                              │ │
│ │ Scopes: Transactions (R/W), Accounts (R)           │ │
│ │                                    [Edit] [Revoke] │ │
│ └────────────────────────────────────────────────────┘ │
│                                                          │
│ ┌────────────────────────────────────────────────────┐ │
│ │ Analytics Tool                    moc_pQ8rS3tU...  │ │
│ │ Created: Jan 15, 2026            Last used: Never  │ │
│ │ Expires: Never                                     │ │
│ │ Scopes: Transactions (R), Budgets (R)              │ │
│ │                                    [Edit] [Revoke] │ │
│ └────────────────────────────────────────────────────┘ │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

#### 2. Create API Key Modal

**Step 1: Basic Info**

```
┌─────────────────────────────────────────┐
│ Create API Key                    [×]   │
├─────────────────────────────────────────┤
│                                          │
│ Name *                                   │
│ ┌────────────────────────────────────┐  │
│ │ My Integration                     │  │
│ └────────────────────────────────────┘  │
│                                          │
│ Expiration                               │
│ ┌────────────────────────────────────┐  │
│ │ ▼ 90 days                          │  │
│ └────────────────────────────────────┘  │
│   Options: 30 days, 60 days, 90 days,   │
│            Never                         │
│                                          │
│                    [Cancel] [Next →]    │
└─────────────────────────────────────────┘
```

**Step 2: Permissions**

```
┌─────────────────────────────────────────┐
│ Create API Key                    [×]   │
├─────────────────────────────────────────┤
│                                          │
│ Select Permissions                       │
│                                          │
│ ┌────────────────────────────────────┐  │
│ │ ☑ Transactions                     │  │
│ │   ☑ Read   ☑ Write                 │  │
│ │                                    │  │
│ │ ☑ Accounts                         │  │
│ │   ☑ Read   ☐ Write                 │  │
│ │                                    │  │
│ │ ☐ Budgets                          │  │
│ │   ☐ Read   ☐ Write                 │  │
│ │                                    │  │
│ │ ☐ Categories                       │  │
│ │   ☐ Read   ☐ Write                 │  │
│ │                                    │  │
│ │ ☐ People                           │  │
│ │   ☐ Read   ☐ Write                 │  │
│ └────────────────────────────────────┘  │
│                                          │
│              [← Back] [Create Key]      │
└─────────────────────────────────────────┘
```

**Step 3: Key Created (Show Once)**

```
┌─────────────────────────────────────────┐
│ API Key Created                   [×]   │
├─────────────────────────────────────────┤
│                                          │
│ ⚠️  Save this key now!                   │
│ You won't be able to see it again.      │
│                                          │
│ ┌────────────────────────────────────┐  │
│ │ moc_k7Hj9pL2mN4qR8sT1vW3xY5zA6bC │  │
│ │                          [Copy 📋] │  │
│ └────────────────────────────────────┘  │
│                                          │
│ Usage Example:                           │
│ ┌────────────────────────────────────┐  │
│ │ curl -H "Authorization: Bearer \   │  │
│ │   moc_k7Hj..." \                   │  │
│ │   https://api.example.com/api/v1/  │  │
│ │   transactions                     │  │
│ └────────────────────────────────────┘  │
│                                          │
│                         [Done]          │
└─────────────────────────────────────────┘
```

#### 3. Component Structure

```
frontend/src/
├── pages/
│   └── settings/
│       └── ApiKeys.tsx                    # Main API keys page
├── components/
│   └── settings/
│       ├── ApiKeyList.tsx                 # List of API keys
│       ├── ApiKeyCard.tsx                 # Individual key card
│       ├── CreateApiKeyModal.tsx          # Multi-step creation modal
│       ├── ApiKeyCreatedModal.tsx         # Show key once modal
│       ├── EditApiKeyModal.tsx            # Edit name/expiration/scopes
│       ├── RevokeApiKeyDialog.tsx         # Confirmation dialog
│       └── ScopeSelector.tsx              # Permission checkboxes
├── hooks/
│   └── api/
│       ├── useApiKeys.ts                  # List API keys
│       ├── useCreateApiKey.ts             # Create API key
│       ├── useUpdateApiKey.ts             # Update API key
│       └── useRevokeApiKey.ts             # Revoke API key
└── services/
    └── apiKeyService.ts                   # API key service functions
```

---

## 7. Security Considerations

### Key Security

1. **Never log API keys** - Treat like passwords
2. **Hash with Argon2** - Same security as user passwords
3. **Show once** - Plain key only visible on creation
4. **Secure transmission** - HTTPS only
5. **Key rotation** - Users can create new keys and revoke old ones

### Scope Security

1. **Principle of least privilege** - No default "all access"
2. **Explicit scopes** - Users must select each permission
3. **Scope validation** - Check on every request
4. **Immutable scopes** - Can't be changed after creation (must create new key)

### Expiration & Revocation

1. **Configurable expiration** - Encourage time-limited keys
2. **Status-based** - Use `status` enum ('active', 'revoked', 'expired')
3. **Immediate effect** - Status change takes effect immediately
4. **Runtime expiration check** - Check `expires_at` during authentication
5. **Background job** - Optional periodic job to update expired keys' status

### Rate Limiting (Future)

1. **Per-key limits** - Track usage per API key
2. **Configurable** - Different limits per key
3. **Headers** - Return rate limit info in response headers
4. **Storage** - Use Redis for distributed rate limiting

### Audit Trail (Future)

1. **Last used tracking** - Update `last_used_at` on each request
2. **Usage logs** - Optional detailed logging per key
3. **Anomaly detection** - Alert on unusual patterns

---

## 8. Implementation Plan

### Phase 1: Database & Models (Backend)

**Files to create/modify:**

1. `backend/migrations/YYYY-MM-DD-HHMMSS_create_api_keys_table.sql`
2. `backend/src/models/api_key.rs` (new)
3. `backend/src/schema.rs` (update with diesel)
4. `backend/src/models/mod.rs` (export api_key)

### Phase 2: API Key Generation & Hashing (Backend)

**Files to create/modify:**

1. `backend/src/auth/api_key.rs` (new)
   - `generate_api_key()` - Generate random key
   - `hash_api_key()` - Hash with Argon2
   - `verify_api_key()` - Verify hash
2. `backend/src/auth/mod.rs` (export api_key)

### Phase 3: Repository Layer (Backend)

**Files to create/modify:**

1. `backend/src/repositories/api_key.rs` (new)
   - `create()` - Create new API key
   - `find_by_hash()` - Find by key hash
   - `find_by_user_id()` - List user's keys
   - `find_by_id()` - Get single key
   - `update()` - Update key metadata
   - `revoke()` - Soft delete key
   - `update_last_used()` - Update last_used_at
2. `backend/src/repositories/mod.rs` (export api_key)

### Phase 4: Service Layer (Backend)

**Files to create/modify:**

1. `backend/src/services/api_key_service.rs` (new)
   - `create_api_key()` - Business logic for creation
   - `list_api_keys()` - List with computed fields
   - `get_api_key()` - Get single key details
   - `update_api_key()` - Update key
   - `revoke_api_key()` - Revoke key
   - `verify_and_get_context()` - Verify key and return auth context
2. `backend/src/services/mod.rs` (export api_key_service)

### Phase 5: Authentication Context (Backend)

**Files to create/modify:**

1. `backend/src/auth/context.rs` (new)
   - `AuthContext` enum
   - `has_permission()` method
   - Helper methods
2. `backend/src/auth/mod.rs` (export context)

### Phase 6: Middleware Updates (Backend)

**Files to modify:**

1. `backend/src/middleware/auth.rs`
   - Modify `require_auth()` to support API keys
   - Add `authenticate_with_api_key()`
   - Add `authenticate_with_jwt()`
   - Add `require_scope()` middleware
2. Update handler signatures to use `AuthContext` instead of `User`

### Phase 7: API Handlers (Backend)

**Files to create/modify:**

1. `backend/src/handlers/api_keys.rs` (new)
   - `create()` - POST /api/v1/api-keys
   - `list()` - GET /api/v1/api-keys
   - `get()` - GET /api/v1/api-keys/:id
   - `update()` - PATCH /api/v1/api-keys/:id
   - `revoke()` - DELETE /api/v1/api-keys/:id
2. `backend/src/handlers/mod.rs` (export api_keys)

### Phase 8: Routes (Backend)

**Files to modify:**

1. `backend/src/api/routes.rs`
   - Add API key routes to protected routes
   - Apply scope middleware to existing routes

### Phase 9: Frontend Services (Frontend)

**Files to create:**

1. `frontend/src/services/apiKeyService.ts`
   - `createApiKey()`
   - `listApiKeys()`
   - `getApiKey()`
   - `updateApiKey()`
   - `revokeApiKey()`

### Phase 10: Frontend Hooks (Frontend)

**Files to create:**

1. `frontend/src/hooks/api/useApiKeys.ts`
2. `frontend/src/hooks/api/useCreateApiKey.ts`
3. `frontend/src/hooks/api/useUpdateApiKey.ts`
4. `frontend/src/hooks/api/useRevokeApiKey.ts`

### Phase 11: Frontend Components (Frontend)

**Files to create:**

1. `frontend/src/components/settings/ApiKeyList.tsx`
2. `frontend/src/components/settings/ApiKeyCard.tsx`
3. `frontend/src/components/settings/CreateApiKeyModal.tsx`
4. `frontend/src/components/settings/ApiKeyCreatedModal.tsx`
5. `frontend/src/components/settings/EditApiKeyModal.tsx`
6. `frontend/src/components/settings/RevokeApiKeyDialog.tsx`
7. `frontend/src/components/settings/ScopeSelector.tsx`
8. `frontend/src/components/settings/index.ts` (exports)

### Phase 12: Frontend Pages (Frontend)

**Files to create/modify:**

1. `frontend/src/pages/settings/ApiKeys.tsx` (new)
2. `frontend/src/pages/Settings.tsx` (add navigation to API keys)
3. `frontend/src/routes/index.tsx` (add route)

### Phase 13: Testing & Documentation

**Files to create:**

1. `docs/api/api-keys.md` - API documentation
2. `docs/user-guide/api-keys.md` - User guide
3. Backend tests for each layer
4. Frontend component tests

---

## 9. API Usage Examples

### Creating an API Key (UI)

1. Navigate to Settings → API Keys
2. Click "New Key"
3. Enter name: "My Integration"
4. Select expiration: "90 days"
5. Select scopes: Transactions (Read/Write), Accounts (Read)
6. Click "Create Key"
7. Copy the key: `moc_k7Hj9pL2mN4qR8sT1vW3xY5zA6bC`
8. Store securely (shown only once)

### Using API Key in External Application

**JavaScript/Node.js:**

```javascript
const API_KEY = "moc_k7Hj9pL2mN4qR8sT1vW3xY5zA6bC";
const BASE_URL = "https://your-domain.com/api/v1";

async function getTransactions() {
  const response = await fetch(`${BASE_URL}/transactions`, {
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
    },
  });
  return response.json();
}
```

**Python:**

```python
import requests

API_KEY = 'moc_k7Hj9pL2mN4qR8sT1vW3xY5zA6bC'
BASE_URL = 'https://your-domain.com/api/v1'

def get_transactions():
    headers = {
        'Authorization': f'Bearer {API_KEY}',
        'Content-Type': 'application/json'
    }
    response = requests.get(f'{BASE_URL}/transactions', headers=headers)
    return response.json()
```

**cURL:**

```bash
curl -H "Authorization: Bearer moc_k7Hj9pL2mN4qR8sT1vW3xY5zA6bC" \
     https://your-domain.com/api/v1/transactions
```

---

## 10. Future Enhancements

### Rate Limiting

- Per-key rate limits
- Configurable limits per scope
- Redis-based distributed rate limiting
- Rate limit headers in responses

### Audit Logging

- Detailed request logs per key
- IP address tracking
- Geographic location tracking
- Anomaly detection

### Advanced Scopes

- Fine-grained permissions (e.g., read only specific categories)
- Time-based restrictions (e.g., only during business hours)
- IP whitelisting per key

### Key Management

- Key rotation reminders
- Automatic expiration notifications
- Usage analytics dashboard
- Bulk operations (revoke multiple keys)

### Webhooks

- API keys for webhook verification
- Webhook event subscriptions

---

## 11. Migration Strategy

### For Existing Users

1. No impact - API keys are optional
2. JWT tokens continue to work as before
3. Users opt-in to create API keys

### Database Migration

1. Run migration to create `api_keys` table
2. No data migration needed (new feature)
3. Backward compatible

### Deployment

1. Deploy backend changes first
2. Deploy frontend changes second
3. No downtime required
4. Feature flag optional for gradual rollout

---

## Summary

This design provides a comprehensive, secure, and extensible API key management system that:

✅ Allows users to create multiple API keys with custom names  
✅ Supports scoped permissions for fine-grained access control  
✅ Implements secure key generation and hashing  
✅ Shows keys only once (security best practice)  
✅ Supports configurable expiration  
✅ Provides clean UI for key management  
✅ Maintains backward compatibility with JWT authentication  
✅ Is extensible for future rate limiting and audit logging

The implementation follows the existing project patterns and integrates seamlessly with the current authentication system.
