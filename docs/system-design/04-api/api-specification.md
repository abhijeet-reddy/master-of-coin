# API Specification

## Base URL

```
https://your-domain.com/api/v1
```

## Authentication

All protected endpoints require JWT token in Authorization header:
```
Authorization: Bearer <jwt_token>
```

## Response Format

### Success Response
```json
{
  "data": { /* response data */ },
  "meta": {
    "timestamp": "2024-01-15T10:30:00Z"
  }
}
```

### Error Response
```json
{
  "error": "validation_error",
  "message": "Invalid input data",
  "details": {
    "field": "amount",
    "reason": "Amount must be greater than zero"
  }
}
```

## Endpoints

### Authentication

#### Register
```http
POST /auth/register
Content-Type: application/json

{
  "username": "johndoe",
  "email": "john@example.com",
  "password": "SecurePass123!",
  "name": "John Doe"
}

Response: 201 Created
{
  "data": {
    "user": {
      "id": "uuid",
      "username": "johndoe",
      "email": "john@example.com",
      "name": "John Doe"
    },
    "token": "jwt_token"
  }
}
```

#### Login
```http
POST /auth/login
Content-Type: application/json

{
  "username": "johndoe",
  "password": "SecurePass123!"
}

Response: 200 OK
{
  "data": {
    "user": { /* user object */ },
    "token": "jwt_token",
    "expires_at": "2024-01-22T10:30:00Z"
  }
}
```

### Dashboard

#### Get Dashboard Summary
```http
GET /dashboard
Authorization: Bearer <token>

Response: 200 OK
{
  "data": {
    "net_worth": {
      "total_assets": "125450.00",
      "total_liabilities": "2340.00",
      "net_worth": "123110.00",
      "change_from_last_year": "3000.00",
      "change_percentage_yoy": 2.5
    },
    "accounts": [
      {
        "id": "uuid",
        "name": "Checking",
        "type": "CHECKING",
        "balance": "12450.50",
        "currency": "USD"
      }
    ],
    "budgets": [
      {
        "id": "uuid",
        "name": "Food Budget",
        "spent": "450.00",
        "limit": "600.00",
        "percentage": 75.0,
        "status": "WARNING"
      }
    ],
    "recent_transactions": [ /* last 10 transactions */ ],
    "spending_trend": [ /* 6 months data */ ],
    "category_breakdown": [ /* current month */ ]
  }
}
```

### Transactions

#### List Transactions
```http
GET /transactions?month=2024-01&category=uuid&account=uuid&limit=50&offset=0
Authorization: Bearer <token>

Response: 200 OK
{
  "data": {
    "transactions": [
      {
        "id": "uuid",
        "title": "Grocery Store",
        "amount": "-85.50",
        "date": "2024-01-15T14:30:00Z",
        "account": {
          "id": "uuid",
          "name": "Checking",
          "type": "CHECKING"
        },
        "category": {
          "id": "uuid",
          "name": "Food",
          "icon": "🍔"
        },
        "splits": [
          {
            "person_id": "uuid",
            "person_name": "John",
            "amount": "25.50"
          }
        ],
        "notes": null
      }
    ],
    "pagination": {
      "total": 1250,
      "limit": 50,
      "offset": 0,
      "has_more": true
    }
  }
}
```

#### Create Transaction
```http
POST /transactions
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "Dinner with friends",
  "amount": "-120.00",
  "date": "2024-01-15T19:30:00Z",
  "account_id": "uuid",
  "category_id": "uuid",
  "notes": "Great evening",
  "splits": [
    {
      "person_id": "uuid",
      "amount": "40.00"
    },
    {
      "person_id": "uuid2",
      "amount": "40.00"
    }
  ]
}

Response: 201 Created
{
  "data": {
    "id": "uuid",
    "title": "Dinner with friends",
    "amount": "-120.00",
    "user_share": "-40.00",
    /* full transaction object */
  }
}
```

#### Update Transaction
```http
PUT /transactions/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "Updated title",
  "amount": "-130.00",
  /* other fields */
}

Response: 200 OK
{
  "data": { /* updated transaction */ }
}
```

#### Delete Transaction
```http
DELETE /transactions/:id
Authorization: Bearer <token>

Response: 204 No Content
```

### Accounts

#### List Accounts
```http
GET /accounts
Authorization: Bearer <token>

Response: 200 OK
{
  "data": [
    {
      "id": "uuid",
      "name": "Checking Account",
      "type": "CHECKING",
      "currency": "USD",
      "balance": "12450.50",
      "transaction_count": 1250,
      "created_at": "2024-01-01T00:00:00Z"
    }
  ]
}
```

#### Create Account
```http
POST /accounts
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Savings Account",
  "type": "SAVINGS",
  "currency": "USD",
  "notes": "Emergency fund"
}

Response: 201 Created
```

### Budgets

#### List Budgets
```http
GET /budgets?active=true
Authorization: Bearer <token>

Response: 200 OK
{
  "data": [
    {
      "id": "uuid",
      "name": "Food Budget",
      "filters": {
        "category_id": "uuid",
        "account_ids": ["*"]
      },
      "active_range": {
        "limit_amount": "600.00",
        "period": "MONTHLY",
        "start_date": "2024-01-01",
        "end_date": "2024-12-31"
      },
      "current_spending": "450.00",
      "percentage": 75.0,
      "status": "WARNING"
    }
  ]
}
```

#### Create Budget
```http
POST /budgets
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Food Budget",
  "filters": {
    "category_id": "uuid",
    "account_ids": ["*"],
    "min_amount": null,
    "max_amount": null
  },
  "ranges": [
    {
      "limit_amount": "600.00",
      "period": "MONTHLY",
      "start_date": "2024-01-01",
      "end_date": "2024-12-31"
    }
  ]
}

Response: 201 Created
```

#### Add Budget Range
```http
POST /budgets/:id/ranges
Authorization: Bearer <token>
Content-Type: application/json

{
  "limit_amount": "700.00",
  "period": "MONTHLY",
  "start_date": "2025-01-01",
  "end_date": "2025-12-31"
}

Response: 201 Created
```

### People

#### List People with Debts
```http
GET /people
Authorization: Bearer <token>

Response: 200 OK
{
  "data": [
    {
      "id": "uuid",
      "name": "John Smith",
      "email": "john@example.com",
      "debt_summary": {
        "owes_me": "125.50",
        "i_owe": "0.00",
        "net": "125.50"
      },
      "transaction_count": 5
    }
  ]
}
```

#### Get Person Debts Detail
```http
GET /people/:id/debts
Authorization: Bearer <token>

Response: 200 OK
{
  "data": {
    "person": { /* person object */ },
    "debt_summary": {
      "owes_me": "125.50",
      "i_owe": "0.00",
      "net": "125.50"
    },
    "transactions": [
      {
        "id": "uuid",
        "title": "Dinner split",
        "total_amount": "-120.00",
        "split_amount": "40.00",
        "date": "2024-01-15T19:30:00Z"
      }
    ]
  }
}
```

#### Settle Debt
```http
POST /people/:id/settle
Authorization: Bearer <token>
Content-Type: application/json

{
  "account_id": "uuid",
  "notes": "Settled via bank transfer"
}

Response: 201 Created
{
  "data": {
    "settlement_transaction": { /* transaction object */ },
    "new_balance": "0.00"
  }
}
```

### Categories

#### List Categories
```http
GET /categories
Authorization: Bearer <token>

Response: 200 OK
{
  "data": [
    {
      "id": "uuid",
      "name": "Food & Dining",
      "icon": "🍔",
      "color": "#FF6B6B",
      "parent_category_id": null,
      "transaction_count": 45
    }
  ]
}
```

#### Create Category
```http
POST /categories
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Groceries",
  "icon": "🛒",
  "color": "#4ECDC4",
  "parent_category_id": "food_category_uuid"
}

Response: 201 Created
```

## Query Parameters

### Common Filters

| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| `month` | string | Filter by month | `2024-01` |
| `start_date` | string | Start date (ISO) | `2024-01-01` |
| `end_date` | string | End date (ISO) | `2024-01-31` |
| `category` | uuid | Filter by category | `uuid` |
| `account` | uuid | Filter by account | `uuid` |
| `limit` | integer | Page size (max 100) | `50` |
| `offset` | integer | Pagination offset | `0` |
| `sort` | string | Sort field | `date` |
| `order` | string | Sort order | `desc` |

### Transaction Filters

| Parameter | Type | Description |
|-----------|------|-------------|
| `min_amount` | decimal | Minimum amount |
| `max_amount` | decimal | Maximum amount |
| `type` | string | `income` or `expense` |
| `has_splits` | boolean | Has split payments |
| `person_id` | uuid | Involved person |

## HTTP Status Codes

| Code | Meaning | Usage |
|------|---------|-------|
| 200 | OK | Successful GET/PUT |
| 201 | Created | Successful POST |
| 204 | No Content | Successful DELETE |
| 400 | Bad Request | Validation error |
| 401 | Unauthorized | Missing/invalid token |
| 403 | Forbidden | No permission |
| 404 | Not Found | Resource not found |
| 409 | Conflict | Duplicate resource |
| 422 | Unprocessable Entity | Business logic error |
| 500 | Internal Server Error | Server error |

## Rate Limiting

- 100 requests per minute per user
- 429 Too Many Requests if exceeded
- Rate limit headers included in response

## Pagination

All list endpoints support pagination:
```json
{
  "data": [ /* items */ ],
  "pagination": {
    "total": 1250,
    "limit": 50,
    "offset": 0,
    "has_more": true
  }
}
```

## Decimal Formatting

All monetary amounts returned as strings with 2 decimal places:
- `"125.50"` not `125.5`
- `"100.00"` not `100`
- Prevents floating-point issues in JavaScript
