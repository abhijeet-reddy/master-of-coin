# Investment Portfolio Sync — Requirements

**GitHub Issue**: [#50 - Investment Portfolio Sync Job](https://github.com/abhijeet-reddy/master-of-coin/issues/50)
**Date**: 2026-03-14
**Status**: Draft

## Summary

Create a new background job that periodically syncs the current market value of investment stock positions (excluding uninvested cash) for each investment account. The system will connect to brokerage APIs (starting with Trading 212) to fetch the total stock value, then create an adjustment transaction to reconcile the account balance in Master of Coin. This keeps investment account balances up-to-date with current market prices without requiring manual updates.

The architecture follows a pluggable provider pattern (similar to the existing split provider system) so additional brokerage integrations can be added in the future.

## User Stories

1. As a user, I can connect my Trading 212 account to an investment account in Master of Coin by providing my API key and API secret.
2. As a user, I can trigger a portfolio sync job manually to update my investment account balance.
3. As a user, I can schedule periodic portfolio syncs (e.g., daily) via the existing schedules system.
4. As a user, I can see the sync job status and results on the Jobs page.
5. As a user, when a sync completes, my investment account balance is automatically updated to reflect the current stock value from Trading 212.
6. As a user, I can see the history of portfolio value changes through the adjustment transactions created by the sync.

## Acceptance Criteria

- [ ] New `PORTFOLIO_SYNC` job type added to the `job_type` PostgreSQL enum
- [ ] New `investment_provider_type` PostgreSQL enum with `TRADING_212` as initial value
- [ ] New `investment_providers` table stores encrypted brokerage credentials per investment account
- [ ] `InvestmentProvider` trait defined with `get_portfolio_value()` method, extensible for future providers
- [ ] Trading 212 provider implementation that fetches total stock value (positions only, excluding uninvested cash) using `authWithSecretKey` Basic Auth
- [ ] Portfolio sync service that: fetches current stock value, compares with current balance, creates adjustment transaction if different
- [ ] API endpoints: connect provider to account, disconnect provider, trigger manual sync, get sync status
- [ ] Worker binary updated to dispatch `PORTFOLIO_SYNC` jobs
- [ ] Schedule system supports `PORTFOLIO_SYNC` job type
- [ ] Credentials (API key + API secret) are encrypted at rest (using existing encryption utilities)
- [ ] Error handling with retry logic for transient API failures
- [ ] Integration tests for the sync service and API endpoints

## Scope

| Feature                                             | In Scope | Future |
| --------------------------------------------------- | -------- | ------ |
| Trading 212 provider (stock value only, no cash)    | ✅       |        |
| Investment provider trait (pluggable)               | ✅       |        |
| `investment_provider_type` PostgreSQL enum          | ✅       |        |
| Background job + schedule support                   | ✅       |        |
| API endpoints for connect/disconnect/sync           | ✅       |        |
| Adjustment transactions for balance updates         | ✅       |        |
| Encrypted credential storage (api_key + api_secret) | ✅       |        |
| Per-stock/holding tracking                          |          | ✅     |
| Additional providers (Interactive Brokers)          |          | ✅     |
| Frontend UI for provider management                 |          | ✅     |
| Historical portfolio value charting                 |          | ✅     |

## Out of Scope

- Individual stock/holding tracking (only total stock value)
- Frontend UI changes (backend-only for now)
- Trading/order placement via the API
- Support for CFD or other non-Invest account types on Trading 212
- Multi-currency position tracking (Trading 212 returns values in primary account currency)
- Uninvested cash tracking (only stock position values)

## Dependencies

- Existing background job system (worker binary, `background_jobs` table, schedules)
- Existing encryption utilities (`utils::encryption`)
- Existing `AccountType::Investment` enum variant
- Trading 212 API key and API secret (user must generate from Trading 212 app)

## Open Questions

- Should the adjustment transaction have a specific category (e.g., "Portfolio Adjustment") or remain uncategorized?
- What should the minimum sync frequency be? (Trading 212 has rate limits)
- Should we store the previous portfolio value snapshot for comparison/history beyond what transactions provide?
