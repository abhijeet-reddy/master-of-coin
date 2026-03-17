# Open Banking Integration — Requirements

**GitHub Issue**: N/A (user request)
**Date**: 2026-03-16
**Status**: Draft

## Summary

Integrate Open Banking data providers to connect bank accounts and automatically fetch transactions and balances. The architecture uses a **generic bank provider trait** (similar to the existing `SplitProvider` and `InvestmentProvider` patterns) so that TrueLayer is the first implementation, but other providers (Plaid, GoCardless, etc.) can be added in the future. Users will select a provider and link their bank accounts through the provider's OAuth flow. A background job fetches new transactions, which are presented in a review UI where the user can approve/reject before importing into Master of Coin.

Each Master of Coin account can be linked to one bank provider connection. Multiple bank accounts from different banks/providers can be connected simultaneously.

## User Stories

1. As a user, I can connect a bank account to my Master of Coin account via a bank provider (starting with TrueLayer) so that my transactions are fetched automatically.
2. As a user, I can trigger a "fetch transactions" job for a connected bank account and review the fetched transactions before importing them.
3. As a user, I can see the current balance of my connected bank account fetched from the provider.
4. As a user, I can disconnect a bank account from its provider if I no longer want automatic transaction fetching.
5. As a user, I can reconnect a bank account when the provider consent expires (re-authentication).
6. As a user, I can review fetched transactions and selectively approve which ones to import into my account.
7. As a user, I can see which bank provider is connected to each account.

## Acceptance Criteria

- [ ] Generic `BankProvider` trait defined with methods for auth, fetch transactions, fetch balance, and token refresh
- [ ] TrueLayer implementation of `BankProvider` trait
- [ ] User can initiate OAuth flow from the UI and connect a bank account via TrueLayer
- [ ] OAuth tokens (access_token, refresh_token) are securely stored (encrypted, like Splitwise credentials)
- [ ] A background job (`BANK_SYNC`) fetches transactions from the connected bank provider
- [ ] Fetched transactions are stored as a job result (JSONB) for user review, not auto-imported
- [ ] User can review fetched transactions in the UI and approve/reject individual items
- [ ] Approved transactions are created as regular transactions in the linked account
- [ ] Duplicate detection prevents re-importing already-imported transactions
- [ ] Account balance can be fetched and displayed
- [ ] User can disconnect a bank provider connection
- [ ] Token refresh is handled automatically when access_token expires
- [ ] Works with TrueLayer sandbox environment for testing
- [ ] Provider type is stored in the database so the system knows which provider implementation to use

## Scope

| Feature                                     | In Scope | Future |
| ------------------------------------------- | -------- | ------ |
| Generic BankProvider trait                  | ✅       |        |
| TrueLayer implementation                    | ✅       |        |
| OAuth connection flow                       | ✅       |        |
| Fetch transactions                          | ✅       |        |
| Fetch balances                              | ✅       |        |
| Review & approve transactions before import | ✅       |        |
| Duplicate detection                         | ✅       |        |
| Token refresh                               | ✅       |        |
| Disconnect bank connection                  | ✅       |        |
| Multiple bank connections                   | ✅       |        |
| Sandbox environment support                 | ✅       |        |
| Additional providers (Plaid, GoCardless)    |          | ✅     |
| Provider selection UI                       |          | ✅     |
| Scheduled automatic sync                    |          | ✅     |
| Fetch standing orders / direct debits       |          | ✅     |
| Fetch account identity (holder name, IBAN)  |          | ✅     |
| Auto-categorization of fetched transactions |          | ✅     |
| Production environment support              |          | ✅     |

## Out of Scope

- TrueLayer Payments API (we only use the Data API)
- Auto-categorization of imported transactions (user assigns categories manually)
- Automatic scheduled sync (can be added later using existing schedule infrastructure)
- Standing orders and direct debits fetching
- Production environment (sandbox first, production config is a simple env var change later)
- Other bank providers beyond TrueLayer (architecture supports them, but only TrueLayer is implemented now)

## Dependencies

- TrueLayer client_id and client_secret (user has these)
- TrueLayer sandbox environment access
- Existing background job infrastructure (worker binary, `background_jobs` table)
- Existing encrypted credential storage pattern (used by Splitwise/investment providers)
- Existing account model (accounts can be linked to bank provider connections)

## Open Questions

- None — requirements clarified with user
