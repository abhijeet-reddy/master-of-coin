# API Patterns

## Error Handling

### Error Response Structure
```json
{
  "error": "validation_error",
  "message": "Invalid input data",
  "details": {
    "field": "amount",
    "reason": "Must be greater than zero"
  }
}
```

### HTTP Status Codes
- 200: Success (GET, PUT)
- 201: Created (POST)
- 204: No Content (DELETE)
- 400: Bad Request (validation)
- 401: Unauthorized (auth)
- 404: Not Found
- 422: Business logic error
- 500: Server error

## Pagination

```json
{
  "data": [],
  "pagination": {
    "total": 1250,
    "limit": 50,
    "offset": 0,
    "has_more": true
  }
}
```

## Filtering

Query parameters:
- `month=2024-01` - Filter by month
- `category=uuid` - Filter by category
- `account=uuid` - Filter by account
- `min_amount=10` - Minimum amount
- `max_amount=1000` - Maximum amount

## Sorting

- `sort=date&order=desc` - Sort by date descending
- `sort=amount&order=asc` - Sort by amount ascending

## Decimal Formatting

All monetary amounts returned as strings with at most 2 decimal places:
- `"125.5"` ✅ (no trailing zeros)
- `"100"` ✅ (no unnecessary decimals)
- `"125.50"` ❌ (remove trailing zero)
- `"100.00"` ❌ (remove unnecessary decimals)
- Never more than 2 decimal places
