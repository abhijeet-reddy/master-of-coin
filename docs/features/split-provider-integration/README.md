# Split Provider Integration

**GitHub Issue**: [#34 - Sync transactions to Splitwise, SplitPro when a split is added](https://github.com/abhijeet-reddy/master-of-coin/issues/34)

This feature enables Master of Coin to sync transaction splits to external split-tracking platforms (Splitwise, SplitPro, and future providers).

## Documentation

- [Design Document](./design.md) - Complete technical design and architecture
- [Implementation Checklist](./implementation-checklist.md) - Detailed step-by-step implementation tasks

## Quick Links

- **Splitwise API Docs**: https://dev.splitwise.com/
- **Splitwise OAuth Setup**: https://secure.splitwise.com/oauth_clients
- **SplitPro GitHub**: https://github.com/oss-apps/split-pro

## Overview

### What This Feature Does

1. **Configure Integration**: Users connect their Splitwise account via OAuth2 in Settings
2. **Link People**: Users map each Person in Master of Coin to their Splitwise friend
3. **Auto-Sync Splits**: When a transaction split is created, it automatically creates an expense on Splitwise
4. **Track Status**: Users can see sync status (synced/pending/failed) for each split
5. **Handle Updates**: Changes to splits update the corresponding Splitwise expense

### Key Design Decisions

- **Generic Provider Pattern**: Trait-based architecture allows adding new providers
- **One Expense Per Transaction**: Multiple splits create one expense with multiple users on Splitwise
- **One-Way Sync (MVP)**: Master of Coin → Splitwise (bi-directional sync is future work)
- **Per-User OAuth**: Each Master of Coin user connects their own Splitwise account
- **Encrypted Credentials**: OAuth tokens stored encrypted with AES-256-GCM

## Database Schema

### New Tables

1. **`split_providers`** - User-level provider configurations (OAuth tokens)
2. **`person_split_configs`** - Maps each Person to their external platform identity
3. **`split_sync_records`** - Tracks sync state for each split

See [design.md](./design.md#3-database-changes) for complete schema.

## Implementation Status

See [implementation-checklist.md](./implementation-checklist.md) for detailed progress tracking.

## Future Enhancements

- Bi-directional sync (poll Splitwise for changes)
- SplitPro provider implementation (when API available)
- Bulk historical sync
- Webhook support
- Splitwise groups support
