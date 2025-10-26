# Authentication & Security

## Authentication Strategy

### JWT-Based Authentication

```rust
pub struct Claims {
    pub sub: Uuid,        // user_id
    pub username: String,
    pub exp: i64,         // Expiration timestamp
    pub iat: i64,         // Issued at timestamp
}
```

### Login Flow

1. User submits username + password
2. Backend validates credentials
3. Generate JWT with 7-day expiration
4. Return token to client
5. Client stores token in memory (not localStorage for security)
6. Client includes token in all API requests

### Password Security

- Hash with Argon2id (winner of Password Hashing Competition)
- Salt automatically generated per password
- Memory-hard algorithm (resistant to GPU attacks)

```rust
use argon2::{Argon2, PasswordHash, PasswordHasher, PasswordVerifier};

pub fn hash_password(password: &str) -> Result<String> {
    let salt = SaltString::generate(&mut OsRng);
    let argon2 = Argon2::default();
    let hash = argon2.hash_password(password.as_bytes(), &salt)?;
    Ok(hash.to_string())
}

pub fn verify_password(password: &str, hash: &str) -> Result<bool> {
    let parsed_hash = PasswordHash::new(hash)?;
    Ok(Argon2::default()
        .verify_password(password.as_bytes(), &parsed_hash)
        .is_ok())
}
```

## Security Measures

### 1. HTTPS Only

- Enforced via Cloudflare Tunnel
- All traffic encrypted end-to-end
- Free SSL/TLS certificates

### 2. SQL Injection Prevention

- Diesel's type-safe query builder prevents SQL injection
- Compile-time query validation
- No raw SQL string concatenation
- Parameterized queries enforced by design

### 3. XSS Protection

- React escapes output by default
- Sanitize user input
- Content Security Policy headers

### 4. CSRF Protection

- JWT in Authorization header (not cookies)
- SameSite cookie attribute if using cookies
- Origin validation

### 5. Input Validation

- Backend validation with validator crate
- Frontend validation for UX
- Never trust client input

### 6. Authorization

- User can only access their own data
- All queries filtered by user_id
- Resource ownership checked

```rust
use crate::schema::transactions::dsl::*;
use diesel::prelude::*;
use tokio::task;

// Example: Ensure user owns the resource
pub async fn get_transaction(
    pool: &DbPool,
    user_id: Uuid,
    transaction_id: Uuid,
) -> Result<Transaction> {
    let pool = pool.clone();
    task::spawn_blocking(move || {
        let mut conn = pool.get()?;

        transactions
            .filter(id.eq(transaction_id))
            .filter(user_id.eq(user_id))
            .first::<Transaction>(&mut conn)
            .optional()?
            .ok_or(ApiError::NotFound("Transaction not found".into()))
    })
    .await?
}
```

## Security Headers

```rust
use tower_http::set_header::SetResponseHeaderLayer;

let app = Router::new()
    .layer(SetResponseHeaderLayer::overriding(
        header::X_CONTENT_TYPE_OPTIONS,
        HeaderValue::from_static("nosniff"),
    ))
    .layer(SetResponseHeaderLayer::overriding(
        header::X_FRAME_OPTIONS,
        HeaderValue::from_static("DENY"),
    ))
    .layer(SetResponseHeaderLayer::overriding(
        header::STRICT_TRANSPORT_SECURITY,
        HeaderValue::from_static("max-age=31536000; includeSubDomains"),
    ));
```

## Data Privacy

### User Data Isolation

- All queries scoped to user_id
- No cross-user data access
- Soft deletes for audit trail (optional)

### GDPR Compliance

- User can export all their data
- User can delete their account (CASCADE delete)
- Clear data retention policy

## Summary

- ✅ JWT authentication
- ✅ Argon2 password hashing
- ✅ HTTPS only via Cloudflare
- ✅ SQL injection prevention
- ✅ XSS protection
- ✅ Input validation
- ✅ Authorization checks
- ✅ Security headers
- ✅ Data isolation
