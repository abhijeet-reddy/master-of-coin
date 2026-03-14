# Exchange Rate Test Mocking & Service Singleton — Requirements

**GitHub Issue**: N/A (internal improvement)
**Date**: 2026-03-14
**Status**: Complete

## Summary

The `ExchangeRateService` is instantiated fresh on every request (in handlers and services), which means its in-memory cache is never actually shared. In production, this causes unnecessary API calls to exchangerate-api.com. In tests, this is even worse — every test run makes real HTTP calls to the external API, rapidly consuming the monthly API quota.

This feature addresses two related problems:

1. **Test API quota exhaustion**: Integration tests make real API calls to exchangerate-api.com, burning through the monthly quota.
2. **Broken caching in production**: The `ExchangeRateService` cache is per-instance (created via `new()` each time), so the 24-hour cache is never actually effective.

## User Stories

1. As a developer, I can run integration tests without consuming exchange rate API quota, so that the API key isn't exhausted by CI/CD or local test runs.
2. As a developer, I can control exchange rate values in tests, so that currency conversion tests produce deterministic, predictable results instead of relying on ±10% tolerance ranges.
3. As a user, I benefit from the exchange rate cache actually working in production, so that the app makes at most 1 API call per base currency per 24 hours instead of 1 per request.

## Acceptance Criteria

- [ ] Integration tests do NOT make any real HTTP calls to exchangerate-api.com
- [ ] Tests use fixed/mock exchange rates that produce deterministic results
- [ ] The `ExchangeRateService` is a shared singleton in `AppState` (or equivalent), so the cache is actually reused across requests in production
- [ ] Existing test assertions continue to pass (with tighter tolerances where mock rates are used)
- [ ] The `EXCHANGE_RATE_API_KEY` environment variable is NOT required to run tests
- [ ] Production behavior remains unchanged (real API calls with 24-hour caching)

## Scope

| Feature                                            | In Scope | Future |
| -------------------------------------------------- | -------- | ------ |
| Mock/stub exchange rates for integration tests     | ✅       |        |
| Share ExchangeRateService as singleton in AppState | ✅       |        |
| Make tests deterministic (exact values, no ±10%)   | ✅       |        |
| Remove need for API key in test environment        | ✅       |        |
| Database-backed exchange rate caching              |          | ✅     |
| User-configurable primary currency                 |          | ✅     |
| Multiple exchange rate API provider support        |          | ✅     |

## Out of Scope

- Persisting exchange rates to the database (future enhancement)
- Allowing users to set their own primary currency (separate feature)
- Supporting alternative exchange rate API providers
- Frontend changes (this is purely a backend refactor)

## Dependencies

- No external dependencies required
- This is a refactor of existing code with no new database tables or API endpoints

## Open Questions

- Should we use a trait-based approach (define an `ExchangeRateProvider` trait) or a simpler configuration-based approach (pass mock rates via constructor)?
- Should the mock rates be hardcoded in test helpers or loaded from a fixture file?
