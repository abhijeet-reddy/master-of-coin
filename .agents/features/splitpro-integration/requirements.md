# SplitPro Integration — Requirements

**Date**: 2026-03-01
**Status**: Approved

## Summary

Enable Master of Coin to interact with a self-hosted SplitPro instance as a split provider, similar to the existing Splitwise integration. This implements the `SplitProvider` trait for SplitPro using tRPC HTTP calls with a long-lived NextAuth session for authentication.

SplitPro is an open-source Splitwise alternative that uses NextJS + tRPC + Prisma + PostgreSQL. Since it has no REST API, we interact with it by making raw HTTP calls to its tRPC endpoints, authenticating via a manually-created NextAuth database session.

## User Stories

1. As a user, I can configure SplitPro as a split provider by providing my SplitPro instance URL and session token
2. As a user, I can sync transaction splits to SplitPro, creating expenses with correct participants and amounts
3. As a user, I can update synced expenses on SplitPro when I modify splits in Master of Coin
4. As a user, I can delete synced expenses from SplitPro when I remove splits
5. As a user, I can fetch my expenses from SplitPro for reconciliation
6. As a user, I can map Master of Coin people to SplitPro user IDs for split syncing

## Acceptance Criteria

- [ ] `SplitProProvider` struct implements the `SplitProvider` trait
- [ ] Can create expenses on SplitPro via tRPC HTTP calls
- [ ] Can update existing expenses on SplitPro
- [ ] Can delete expenses from SplitPro
- [ ] Can fetch expenses from SplitPro (by friend, by date range)
- [ ] Can fetch a single expense by ID
- [ ] Can validate that credentials (session token) are still valid
- [ ] SuperJSON encoding/decoding works correctly for BigInt values
- [ ] Provider is registered in `SplitSyncService` alongside Splitwise
- [ ] Frontend allows configuring SplitPro as a provider with URL + session token
- [ ] Integration tests cover the SplitPro provider

## Scope

| Feature                                     | In Scope | Future |
| ------------------------------------------- | -------- | ------ |
| SplitProProvider implementing SplitProvider | ✅       |        |
| SuperJSON encoding/decoding in Rust         | ✅       |        |
| tRPC HTTP client for SplitPro               | ✅       |        |
| Session-based authentication                | ✅       |        |
| Create/Update/Delete expenses               | ✅       |        |
| Fetch expenses (list + by ID)               | ✅       |        |
| Credential validation                       | ✅       |        |
| Frontend provider configuration UI          | ✅       |        |
| SplitPro group support                      |          | ✅     |
| Automatic session renewal                   |          | ✅     |
| Two-way sync (SplitPro → Master of Coin)    |          | ✅     |

## Out of Scope

- Automatic creation of SplitPro sessions (user must manually create one)
- SplitPro group management (creating/joining groups)
- OAuth/OIDC integration with SplitPro's auth providers
- Two-way sync from SplitPro back to Master of Coin

## Dependencies

- Self-hosted SplitPro instance accessible from Master of Coin's network
- A valid SplitPro user account with a manually-created long-lived session in the `Session` table
- Existing `SplitProvider` trait and `SplitSyncService` infrastructure

## Open Questions

- None (all resolved during architecture discussion)
