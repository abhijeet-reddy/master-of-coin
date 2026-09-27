import { describe, expect, it } from 'vitest';
import { JobStatus, JobType, SyncAction, type DriftedItem, type DriftReport } from '@/api/types';
import type { BankSyncReport, FetchedBankTransaction } from '@/api/types/bankProvider';
import { bankImportPreload, bankTitle, bankTxnToParsed } from '@/features/jobs/lib/bankImport';
import {
  buildSplitDiffs,
  compareTotals,
  hasSyncable,
  normalizeAmount,
  providerName,
} from '@/features/jobs/lib/driftModel';
import {
  durationMs,
  formatDuration,
  inputEntries,
  isJobActive,
  jobListParams,
  jobPath,
  jobStatus,
  jobSummaryText,
  jobTypeFromRoute,
  JOBS_PAGE_SIZE,
  pageOf,
  prettyJson,
  SyncOutcome,
  syncItemDetail,
  syncItemOutcome,
} from '@/features/jobs/lib/jobModel';
import {
  buildSyncItems,
  firstStep,
  initialWizard,
  selectionCounts,
  WizardStep,
  wizardReducer,
  type WizardState,
} from '@/features/jobs/lib/syncWizard';

const drifted = (id: string, ext: string): DriftedItem =>
  ({
    transaction_id: id,
    external_expense_id: ext,
    provider_type: 'splitwise',
    transaction_title: `Tx ${id}`,
    transaction_date: '2026-09-01',
    local_amount: '-12.5',
    external_cost: '12.50',
    local_splits: [{ person_name: 'Ann', external_user_id: 'u1', owed_share: '6.25' }],
    external_splits: [
      { external_user_id: 'u1', first_name: 'Ann', last_name: '', owed_share: '6.00' },
      { external_user_id: 'u2', first_name: 'Bo', last_name: 'Li', owed_share: '6.50' },
    ],
  }) as unknown as DriftedItem;

const report = (over: Partial<DriftReport> = {}): DriftReport =>
  ({
    drifted: [],
    missing_on_external: [],
    missing_on_local: [],
    ...over,
  }) as DriftReport;

describe('jobModel', () => {
  it('maps route segments both ways', () => {
    expect(jobTypeFromRoute('bank-sync')).toBe(JobType.BANK_SYNC);
    expect(jobTypeFromRoute('sync')).toBe(JobType.BULK_SYNC);
    expect(jobTypeFromRoute('nope')).toBeNull();
    expect(jobPath({ id: 'j1', job_type: JobType.DRIFT_DETECTION })).toBe(
      '/jobs/drift-detection/j1'
    );
  });

  it('labels statuses and knows which are active', () => {
    expect(jobStatus(JobStatus.PENDING).label).toBe('Queued');
    expect(jobStatus('WEIRD').label).toBe('WEIRD');
    expect(isJobActive(JobStatus.RUNNING)).toBe(true);
    expect(isJobActive(JobStatus.FAILED)).toBe(false);
  });

  it('measures and formats durations', () => {
    expect(durationMs('2026-01-01T00:00:00Z', '2026-01-01T00:00:04.2Z')).toBe(4200);
    expect(durationMs('2026-01-01T00:00:05Z', '2026-01-01T00:00:00Z')).toBeNull();
    expect(durationMs(null, '2026-01-01T00:00:00Z')).toBeNull();
    expect(formatDuration(null)).toBe('--');
    expect(formatDuration(850)).toBe('850ms');
    expect(formatDuration(4200)).toBe('4.2s');
    expect(formatDuration(185_000)).toBe('3m 5s');
    expect(formatDuration(7_440_000)).toBe('2h 4m');
  });

  it('summarises a job in one line', () => {
    const base = { status: JobStatus.COMPLETED, error: null };
    expect(
      jobSummaryText({
        ...base,
        job_type: JobType.DRIFT_DETECTION,
        summary: { synced: 3, drifted: 1 },
      })
    ).toBe('3 synced, 1 drifted');
    expect(
      jobSummaryText({ ...base, job_type: JobType.BULK_SYNC, summary: { succeeded: 4, total: 5 } })
    ).toBe('4/5 ok');
    expect(
      jobSummaryText({
        ...base,
        job_type: JobType.BANK_SYNC,
        summary: { total_fetched: 9, new_transactions: 2 },
      })
    ).toBe('9 fetched, 2 new');
    expect(
      jobSummaryText({
        ...base,
        job_type: JobType.BANK_SYNC,
        summary: null,
        status: JobStatus.RUNNING,
      })
    ).toBe('In progress');
    const long = 'x'.repeat(80);
    const text = jobSummaryText({
      ...base,
      job_type: JobType.BANK_SYNC,
      error: long,
      summary: null,
    });
    expect(text.startsWith('Error: ')).toBe(true);
    expect(text.endsWith('...')).toBe(true);
    expect(text.length).toBeLessThan(80);
  });

  it('pages with one extra row', () => {
    expect(jobListParams(1)).toEqual({ limit: JOBS_PAGE_SIZE + 1, offset: 0 });
    expect(jobListParams(3, JobType.BANK_SYNC)).toEqual({
      job_type: JobType.BANK_SYNC,
      limit: JOBS_PAGE_SIZE + 1,
      offset: 2 * JOBS_PAGE_SIZE,
    });
    expect(jobListParams(0).offset).toBe(0);
    const rows = Array.from({ length: JOBS_PAGE_SIZE + 1 }, (_, i) => i);
    expect(pageOf(rows)).toEqual({ rows: rows.slice(0, JOBS_PAGE_SIZE), hasNext: true });
    expect(pageOf([1, 2]).hasNext).toBe(false);
  });

  it('pretty prints and lists input', () => {
    expect(prettyJson(null)).toBe('');
    expect(prettyJson({ a: 1 })).toBe('{\n  "a": 1\n}');
    expect(inputEntries({ schedule_id: 's', lookback_days: 7, some_key: 1 })).toEqual([
      { key: 'lookback_days', label: 'Lookback days', value: 7 },
      { key: 'schedule_id', label: 'Schedule', value: 's' },
      { key: 'some_key', label: 'Some key', value: 1 },
    ]);
    // The server's JSON map comes back alphabetical; ranges still read From then To.
    expect(
      inputEntries({ end_date: 'e', schedule_id: 's', start_date: 'b' }).map((e) => e.label)
    ).toEqual(['From', 'To', 'Schedule']);
    expect(inputEntries(null)).toEqual([]);
  });

  it('describes sync item outcomes', () => {
    expect(syncItemDetail({ detail: { sync_status: 'created', external_expense_id: '42' } })).toBe(
      'Created on the provider (#42)'
    );
    expect(syncItemDetail({ error: 'boom' })).toBe('boom');
    expect(syncItemOutcome({ status: 'success', detail: { status: 'already_linked' } })).toBe(
      SyncOutcome.Skipped
    );
    expect(syncItemOutcome({ status: 'success', detail: { status: 'pushed' } })).toBe(
      SyncOutcome.Done
    );
    expect(syncItemOutcome({ status: 'failed' })).toBe(SyncOutcome.Failed);
  });
});

describe('driftModel', () => {
  it('compares amounts ignoring sign and precision', () => {
    expect(normalizeAmount('-12.5')).toBe('12.50');
    expect(compareTotals(drifted('t1', 'e1')).isDifferent).toBe(false);
  });

  it('pairs splits by external user and appends provider-only people', () => {
    const diffs = buildSplitDiffs(drifted('t1', 'e1'));
    expect(diffs).toEqual([
      { name: 'Ann', localOwed: '6.25', externalOwed: '6.00', isDifferent: true },
      { name: 'Bo Li', externalOwed: '6.50', isDifferent: true },
    ]);
  });

  it('knows whether anything can be synced and names providers', () => {
    expect(hasSyncable(report())).toBe(false);
    expect(hasSyncable(report({ drifted: [drifted('t', 'e')] }))).toBe(true);
    expect(providerName('SPLITPRO')).toBe('SplitPro');
    expect(providerName(undefined)).toBe('the provider');
  });
});

describe('syncWizard', () => {
  const r = report({
    drifted: [drifted('t1', 'e1'), drifted('t2', 'e2')],
    missing_on_external: [{ transaction_id: 't3' }] as DriftReport['missing_on_external'],
    missing_on_local: [
      { external_expense_id: 'e9', provider_type: 'splitpro' },
    ] as DriftReport['missing_on_local'],
  });

  it('opens on the first step with items', () => {
    expect(firstStep(r)).toBe(WizardStep.Drifted);
    expect(firstStep(report({ missing_on_local: r.missing_on_local }))).toBe(
      WizardStep.MissingLocal
    );
    expect(firstStep(report())).toBe(WizardStep.Review);
  });

  it('moves between steps within bounds', () => {
    let s: WizardState = initialWizard();
    s = wizardReducer(s, { type: 'back' });
    expect(s.step).toBe(WizardStep.Drifted);
    for (let i = 0; i < 5; i++) s = wizardReducer(s, { type: 'next' });
    expect(s.step).toBe(WizardStep.Review);
  });

  it('select all defaults to pull and keeps choices already made', () => {
    let s = wizardReducer(initialWizard(), {
      type: 'pickDrifted',
      id: 't1',
      pick: { action: SyncAction.PUSH, externalExpenseId: 'e1' },
    });
    s = wizardReducer(s, { type: 'allDrifted', report: r, on: true });
    expect(s.drifted.get('t1')?.action).toBe(SyncAction.PUSH);
    expect(s.drifted.get('t2')?.action).toBe(SyncAction.PULL);
    expect(wizardReducer(s, { type: 'allDrifted', report: r, on: false }).drifted.size).toBe(0);
  });

  it('builds the sync items and counts them', () => {
    let s = wizardReducer(initialWizard(), {
      type: 'pickDrifted',
      id: 't1',
      pick: { action: SyncAction.PUSH, externalExpenseId: 'e1', providerType: 'splitwise' },
    });
    s = wizardReducer(s, { type: 'toggleExternal', id: 't3', on: true });
    s = wizardReducer(s, { type: 'allLocal', ids: ['e9'], on: true });
    expect(buildSyncItems(s, r)).toEqual([
      {
        action: SyncAction.PUSH,
        transaction_id: 't1',
        external_expense_id: 'e1',
        provider_type: 'splitwise',
      },
      { action: SyncAction.PUSH, transaction_id: 't3' },
      { action: SyncAction.PULL, external_expense_id: 'e9', provider_type: 'splitpro' },
    ]);
    expect(selectionCounts(s)).toEqual({ total: 3, push: 2, pull: 1 });
    expect(wizardReducer(s, { type: 'reset' })).toEqual(initialWizard());
  });
});

describe('bankImport', () => {
  const txn = (id: string, over: Partial<FetchedBankTransaction> = {}): FetchedBankTransaction =>
    ({
      external_id: id,
      description: 'CARD PAYMENT',
      merchant_name: 'Tesco',
      amount: '-4.5',
      date: '2026-09-02',
      already_imported: false,
      ...over,
    }) as FetchedBankTransaction;

  it('titles like the backend', () => {
    expect(bankTitle({ description: 'CARD PAYMENT', merchant_name: 'Tesco' })).toBe(
      'Tesco - CARD PAYMENT'
    );
    expect(bankTitle({ description: 'Tesco Extra', merchant_name: 'Tesco' })).toBe('Tesco Extra');
    expect(bankTitle({ description: 'ATM', merchant_name: null })).toBe('ATM');
  });

  it('maps a bank row to an import row', () => {
    expect(bankTxnToParsed(txn('x1'))).toMatchObject({
      temp_id: 'x1',
      title: 'Tesco - CARD PAYMENT',
      amount: '-4.50',
      date: '2026-09-02',
      is_valid: true,
    });
  });

  it('keeps only new rows, with metadata parallel to them', () => {
    const rep = {
      account_id: 'a1',
      bank_provider_id: 'b1',
      transactions: [txn('x1'), txn('x2', { already_imported: true }), txn('x3')],
    } as unknown as BankSyncReport;
    const pre = bankImportPreload(rep);
    expect(pre?.rows.map((r) => r.temp_id)).toEqual(['x1', 'x3']);
    expect(pre?.metadata).toEqual({
      bank_provider_id: 'b1',
      external_transaction_ids: ['x1', 'x3'],
    });
    expect(pre?.accountId).toBe('a1');
    expect(
      bankImportPreload({ ...rep, transactions: [txn('x2', { already_imported: true })] })
    ).toBeNull();
  });
});
