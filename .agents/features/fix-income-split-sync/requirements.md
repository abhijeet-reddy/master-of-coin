# Fix Income Split Sync — Requirements

**Date**: 2026-04-12
**Status**: Draft

## Summary

When syncing an income transaction (positive amount on a regular account) that has splits with a person, the split sync service incorrectly assumes the current user is the payer on Splitwise. This causes a false split mismatch when the corresponding Splitwise expense has the friend as the payer.

**Example:** Ly pays me EUR 87.05. Locally this is recorded as income (+87.05) with a split to Ly (-87.05). On Splitwise, "Ly N. paid Abhijeet R. EUR 87.05" — Ly is the payer. But our sync builds the Splitwise comparison as if I paid, producing inverted owed_shares and a false mismatch.

## How Transaction Types Work

There are 3 core transaction types that involve splits. Each has different sign conventions and a different Splitwise payer:

### The 3 Transaction Types with Splits

| #   | Scenario                                 | Account | Tx Amount         | Split Amount          | Split Sign Meaning     | Who Pays on Splitwise |
| --- | ---------------------------------------- | ------- | ----------------- | --------------------- | ---------------------- | --------------------- |
| 1   | **Expense I paid**, split with others    | Regular | Negative (-100)   | **Positive** (+60)    | They owe me            | **Me**                |
| 2   | **Income I received**, split with others | Regular | Positive (+87.05) | **Negative** (-87.05) | They contributed to it | **Friend**            |
| 3   | **Expense paid by someone else**         | DEBT    | Negative (-60)    | **Negative** (-60)    | I owe them             | **Friend**            |

### How Each Maps to Splitwise

**Scenario 1 — Expense I paid (e.g. I pay EUR 100 dinner, Ly owes EUR 60):**

| User | paid_share | owed_share | Meaning                                |
| ---- | ---------- | ---------- | -------------------------------------- |
| Me   | 100.00     | 40.00      | I paid the full amount, my share is 40 |
| Ly   | 0.00       | 60.00      | Ly paid nothing, owes 60               |

✅ **Sync works correctly** — `build_expense_users()` treats me as payer.

**Scenario 2 — Income I received (e.g. Ly pays me EUR 87.05):**

| User | paid_share | owed_share | Meaning                                                         |
| ---- | ---------- | ---------- | --------------------------------------------------------------- |
| Ly   | 87.05      | 0.00       | Ly paid the amount                                              |
| Me   | 0.00       | 87.05      | I received it (Splitwise models this as me "owing" the payment) |

⚠️ **Sync is BROKEN** — `build_expense_users()` treats me as payer, producing:

| User | paid_share | owed_share | WRONG          |
| ---- | ---------- | ---------- | -------------- |
| Me   | 87.05      | 0.00       | ← Should be Ly |
| Ly   | 0.00       | 87.05      | ← Should be Me |

This causes a false mismatch even though both sides agree on the same payment.

**Scenario 3 — Expense paid by someone else (e.g. Ly pays EUR 100 dinner, I owe EUR 60):**

| User | paid_share | owed_share | Meaning                   |
| ---- | ---------- | ---------- | ------------------------- |
| Ly   | 100.00     | 40.00      | Ly paid, Ly's share is 40 |
| Me   | 0.00       | 60.00      | I paid nothing, I owe 60  |

✅ **Sync works correctly** — `build_debt_expense_users()` treats friend as payer.

### The Problem

Scenarios 2 and 3 both have the **friend as the Splitwise payer**, but the sync only handles this correctly for Scenario 3 (DEBT accounts). For Scenario 2 (income on regular accounts), it incorrectly uses the same logic as Scenario 1 (expense), treating the current user as the payer.

## Root Cause

In [`split_sync_service.rs`](../../backend/src/services/split_sync_service.rs), the `sync_transaction()` method uses `build_expense_users()` for all transactions on regular accounts. This function always treats the current user as the Splitwise payer. For income transactions where someone else paid me, the payer should be the friend, not me.

The system already has correct logic for this in `build_debt_expense_users()` (used for DEBT account transactions), but it's never applied to income transactions on regular accounts.

## User Stories

1. As a user, when I sync an income transaction that has a split with a person, the sync should correctly identify the friend as the payer on Splitwise
2. As a user, when Splitwise shows "Ly paid me EUR 87.05" and my local transaction matches, I should see "synced" — not a false mismatch
3. As a user, when I create a new income split and sync it to Splitwise, it should be created with the friend as the payer

## Acceptance Criteria

- [ ] Income transactions (positive amount) on regular accounts with splits sync correctly — friend is treated as the Splitwise payer
- [ ] `build_expense_users()` or a new builder correctly handles income splits: friend has `paid_share > 0`, current user has `owed_share = amount`
- [ ] `compare_splits()` correctly matches income transactions against Splitwise expenses where the friend is the payer
- [ ] Local shares in the mismatch response are built with the correct perspective for income transactions
- [ ] Expense transactions (negative amount) on regular accounts continue to work as before — no regression
- [ ] DEBT account transactions continue to work as before — no regression

## Scope

| Feature                                         | In Scope | Future |
| ----------------------------------------------- | -------- | ------ |
| Fix sync for income + split on regular accounts | ✅       |        |
| Fix mismatch comparison for income transactions | ✅       |        |
| Fix local shares display for income mismatches  | ✅       |        |
| Splitwise `payment` flag support                |          | ✅     |
| New transaction types or flags                  |          | ✅     |

## Out of Scope

- Adding a `is_settlement` or `transaction_type` field — income transactions are just income transactions, no special type needed
- Splitwise payment API flag — this is a separate enhancement
- Changes to how splits are stored locally — the local sign convention is correct

## Dependencies

- Existing split sync infrastructure in `split_sync_service.rs`
- Splitwise provider in `split_provider/splitwise.rs`
