# Bank Sync: Edit Before Import

## Source

User request — bank sync import should allow editing transaction details before importing, using the same preview/edit table as the CSV statement import.

## Problem Statement

Currently, the bank sync import flow only allows selecting/deselecting transactions and then importing them directly. The backend auto-generates the title (from description/merchant), sets `category_id: None`, and creates notes from merchant name. Users cannot edit any transaction details before import.

The CSV statement import flow already has an inline editing table (`TransactionPreviewStep`) that lets users edit title, amount, date, and category before importing. The bank sync import should offer the same experience.

## Requirements

### Functional

- [ ] After selecting bank transactions and clicking "Import", show an editable preview table (same pattern as CSV import)
- [ ] Each transaction row should allow inline editing of: title, amount, date, and category
- [ ] Users should be able to select/deselect transactions in the preview step
- [ ] Users should be able to go back to the selection step
- [ ] The import button should send the edited data to the backend via `POST /transactions/bulk-create`
- [ ] The `bulk-create` endpoint should accept optional bank sync metadata to create `bank_sync_records` alongside transactions

### Non-Functional

- [ ] Reuse existing `TransactionPreviewStep` component from the CSV import flow
- [ ] Maintain backward compatibility with the existing `bulk-create` API (CSV import unchanged)

## Scope

### In Scope

- Adding a preview/edit step to the bank sync import flow (both `BankSyncReportView` and `BankSyncReview`)
- Extending the `bulk-create` endpoint to optionally create bank sync records
- Adding `account_id` to `BankSyncReport` so the frontend can call `bulk-create`
- Converting `FetchedBankTransaction` data to `ParsedTransaction` format for the preview step
- Removing the deprecated `POST /bank-providers/sync/:job_id/import` endpoint and related code

### Out of Scope

- Changing the CSV import flow
- Adding new fields to the bank sync fetch (e.g., fetching categories from the bank)
- Duplicate detection for bank sync (already handled by `already_imported` flag)

## Acceptance Criteria

- [ ] Bank sync job detail page shows editable preview table after clicking "Import"
- [ ] Users can edit title, amount, date, and category for each transaction before importing
- [ ] Edited values are sent to the backend and used when creating transactions
- [ ] Bank sync records are created alongside transactions (future syncs detect them as already imported)
- [ ] Existing CSV import flow (without bank_sync_metadata) still works unchanged
- [ ] Deprecated bank sync import endpoint and related code are removed
