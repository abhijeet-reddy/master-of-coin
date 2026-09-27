import { describe, expect, it } from 'vitest';
import { AccountType, type Account } from '@/api/types';
import { SELECTABLE_TYPES } from '@/lib/accountTypes';
import {
  accountSchema,
  accountDefaults,
  buildConnectRequest,
  buildCreateRequest,
  buildUpdateRequest,
  BrokerEnv,
} from '@/features/accounts/forms/accountForm';
import {
  accountsOverview,
  archiveNeedsWarning,
  balanceHistory,
  bankDrift,
  convertBalance,
  exposure,
  portfolioDrift,
  providerState,
  ProviderKind,
  SyncAction,
} from '@/features/accounts/lib/accountsModel';
import { bankReturnPath, BankReturn, readBankReturn } from '@/features/accounts/lib/bankConnect';
import { accountFlows } from '@/features/transactions/lib/ledger';

const acct = (
  id: string,
  type: AccountType,
  balance: number,
  extra: Partial<Account> = {}
): Account => ({
  id,
  name: id,
  account_type: type,
  currency: 'EUR' as Account['currency'],
  balance,
  is_active: true,
  ...extra,
});
const rates = { base: 'EUR', rates: { GBP: 0.85, USD: 1.1 } };

describe('account types', () => {
  it('offers the user-creatable types, no LOAN or DEBT', () => {
    expect(SELECTABLE_TYPES).toEqual([
      AccountType.CHECKING,
      AccountType.SAVINGS,
      AccountType.CREDIT_CARD,
      AccountType.INVESTMENT,
      AccountType.CASH,
      AccountType.GIFT_CARD,
    ]);
    expect(SELECTABLE_TYPES).not.toContain(AccountType.LOAN);
    expect(SELECTABLE_TYPES).not.toContain(AccountType.DEBT);
  });
});

describe('accountsOverview', () => {
  const list = [
    acct('b', AccountType.CHECKING, 100),
    acct('a', AccountType.CHECKING, 50),
    acct('cc', AccountType.CREDIT_CARD, -40),
    acct('uk', AccountType.SAVINGS, 85, { currency: 'GBP' as Account['currency'] }),
    acct('old', AccountType.SAVINGS, 10, { archived_at: '2026-01-01T00:00:00Z' }),
  ];

  it('groups active accounts, assets before liabilities, names sorted', () => {
    const o = accountsOverview(list, 'EUR', rates);
    expect(o.groups.map((g) => g.type)).toEqual([
      AccountType.CHECKING,
      AccountType.SAVINGS,
      AccountType.CREDIT_CARD,
    ]);
    expect(o.groups[0].accounts.map((a) => a.id)).toEqual(['a', 'b']);
    expect(o.groups[1].total).toBeCloseTo(100);
    expect(o.archived.map((a) => a.id)).toEqual(['old']);
  });

  it('counts archived accounts in the totals', () => {
    const o = accountsOverview(list, 'EUR', rates);
    expect(o.assets).toBeCloseTo(260);
    expect(o.liabilities).toBeCloseTo(-40);
    expect(o.net).toBeCloseTo(220);
    expect(o.count).toBe(5);
    expect(o.currencies).toEqual(['EUR', 'GBP']);
  });

  it('leaves out and lists currencies without a rate', () => {
    const o = accountsOverview(list, 'EUR', null);
    expect(o.missing).toEqual(['GBP']);
    expect(o.assets).toBeCloseTo(160);
  });

  it('exposure shares are of assets, or of liabilities for liability types', () => {
    const rows = exposure(accountsOverview(list, 'EUR', rates));
    const chk = rows.find((r) => r.type === AccountType.CHECKING);
    const cc = rows.find((r) => r.type === AccountType.CREDIT_CARD);
    expect(chk?.share).toBeCloseTo((150 / 260) * 100);
    expect(cc?.share).toBeCloseTo(100);
    expect(chk?.width).toBe(1);
  });

  it('convertBalance gives the rate for foreign accounts only', () => {
    const uk = acct('uk', AccountType.SAVINGS, 85, { currency: 'GBP' as Account['currency'] });
    expect(convertBalance(uk, 'EUR', rates)).toEqual({ value: 100, rate: 1 / 0.85 });
    expect(convertBalance(acct('e', AccountType.CASH, 5), 'EUR', rates)).toEqual({
      value: 5,
      rate: null,
    });
    expect(convertBalance(uk, 'EUR', null).value).toBeNull();
  });
});

describe('providerState', () => {
  const bank = {
    id: 'p1',
    account_id: 'chk',
    is_active: true,
    last_sync_at: null,
    external_account_id: 'ext',
  };
  const broker = { id: 'p2', account_id: 'inv', is_active: true };

  it('bank sync only for a linked bank-type account', () => {
    const s = providerState(acct('chk', AccountType.CHECKING, 0), [bank], []);
    expect(s.kind).toBe(ProviderKind.Bank);
    expect(s.sync).toBe(SyncAction.Bank);
    expect(s.sync).toBe('Sync bank');
    const unlinked = providerState(
      acct('chk', AccountType.CHECKING, 0),
      [{ ...bank, external_account_id: null }],
      []
    );
    expect(unlinked.linked).toBe(false);
    expect(unlinked.sync).toBeNull();
  });

  it('portfolio sync only for investment accounts', () => {
    expect(providerState(acct('inv', AccountType.INVESTMENT, 0), [], [broker]).sync).toBe(
      'Sync portfolio'
    );
    // A bank record on an investment account does not count.
    const odd = providerState(
      acct('inv', AccountType.INVESTMENT, 0),
      [{ ...bank, account_id: 'inv' }],
      []
    );
    expect(odd.kind).toBe(ProviderKind.None);
  });

  it('archived accounts never sync or connect', () => {
    const archived = { archived_at: '2026-01-01T00:00:00Z' };
    expect(
      providerState(acct('inv', AccountType.INVESTMENT, 0, archived), [], [broker]).sync
    ).toBeNull();
    expect(providerState(acct('x', AccountType.CHECKING, 0, archived), [], []).connectable).toBe(
      false
    );
  });

  it('only bank and investment types are connectable', () => {
    expect(providerState(acct('x', AccountType.SAVINGS, 0), [], []).connectable).toBe(true);
    expect(providerState(acct('x', AccountType.CASH, 0), [], []).connectable).toBe(false);
    expect(providerState(acct('x', AccountType.DEBT, 0), [], []).connectable).toBe(false);
  });
});

describe('archiveNeedsWarning', () => {
  it('warns for any non-zero balance', () => {
    expect(archiveNeedsWarning({ balance: 0 })).toBe(false);
    expect(archiveNeedsWarning({ balance: 0.001 })).toBe(false);
    expect(archiveNeedsWarning({ balance: -12 })).toBe(true);
    expect(archiveNeedsWarning({ balance: 3.5 })).toBe(true);
  });
});

describe('balanceHistory', () => {
  const now = new Date(2026, 8, 10, 12);
  const start = new Date(2026, 8, 7);

  it('walks back from the current balance, one point per day', () => {
    const txs = [
      { date: new Date(2026, 8, 9, 10).toISOString(), amount: '-20' },
      { date: new Date(2026, 8, 8, 9).toISOString(), amount: '50' },
    ];
    const h = balanceHistory(130, txs, start, now);
    expect(h.points).toEqual([
      { day: '2026-09-07', balance: 100 },
      { day: '2026-09-08', balance: 150 },
      { day: '2026-09-09', balance: 130 },
      { day: '2026-09-10', balance: 130 },
    ]);
    expect(h.change).toBe(30);
    expect(h.complete).toBe(true);
  });

  it('starts at the oldest loaded day when truncated', () => {
    const txs = [{ date: new Date(2026, 8, 9, 10).toISOString(), amount: '5' }];
    const h = balanceHistory(10, txs, start, now, true);
    expect(h.points[0].day).toBe('2026-09-09');
    expect(h.complete).toBe(false);
  });
});

describe('drift', () => {
  it('bank drift is bank minus ledger', () => {
    expect(bankDrift(100, { current: '97.5' })).toEqual({
      ledger: 100,
      external: 97.5,
      difference: -2.5,
      inSync: false,
    });
    expect(bankDrift('10', { current: '10.001' }).inSync).toBe(true);
  });

  it('portfolio drift reads this account line', () => {
    const report = {
      total_synced: 1,
      total_failed: 0,
      synced_accounts: [
        {
          account_id: 'inv',
          account_name: 'ISA',
          provider_type: 'TRADING_212',
          previous_balance: '1000',
          new_value: '1050',
          adjustment_amount: '50',
          status: 'synced',
        },
      ],
    } as Parameters<typeof portfolioDrift>[0];
    expect(portfolioDrift(report, 'inv')).toMatchObject({
      ledger: 1000,
      external: 1050,
      difference: 50,
      inSync: false,
    });
    expect(portfolioDrift(report, 'other')).toBeNull();
  });
});

describe('account form', () => {
  const base = accountDefaults(undefined, 'EUR');

  it('defaults to checking in the user currency', () => {
    expect(base).toMatchObject({
      account_type: AccountType.CHECKING,
      currency: 'EUR',
      connect: false,
    });
    expect(accountDefaults(undefined, 'EUR', AccountType.SAVINGS).account_type).toBe(
      AccountType.SAVINGS
    );
  });

  it('rejects LOAN and a bad opening balance', () => {
    expect(accountSchema.safeParse({ ...base, name: 'x', account_type: 'LOAN' }).success).toBe(
      false
    );
    expect(accountSchema.safeParse({ ...base, name: 'x', initial_balance: 'abc' }).success).toBe(
      false
    );
    expect(accountSchema.safeParse({ ...base, name: ' ' }).success).toBe(false);
    expect(accountSchema.safeParse({ ...base, name: 'x', initial_balance: '-12.5' }).success).toBe(
      true
    );
  });

  it('needs broker keys only when connecting an investment account', () => {
    const inv = { ...base, name: 'ISA', account_type: AccountType.INVESTMENT, connect: true };
    expect(accountSchema.safeParse(inv).success).toBe(false);
    expect(accountSchema.safeParse({ ...inv, api_key: 'k', api_secret: 's' }).success).toBe(true);
    expect(accountSchema.safeParse({ ...inv, account_type: AccountType.CASH }).success).toBe(true);
  });

  it('builds create, update and connect requests', () => {
    const v = { ...base, name: ' Main ', initial_balance: '0', notes: '' };
    expect(buildCreateRequest(v)).toEqual({
      name: 'Main',
      account_type: AccountType.CHECKING,
      currency: 'EUR',
    });
    expect(buildCreateRequest({ ...v, initial_balance: '25', notes: 'n' })).toMatchObject({
      initial_balance: 25,
      notes: 'n',
    });

    const before = acct('a', AccountType.CHECKING, 0, { name: 'Main', notes: 'old' });
    expect(buildUpdateRequest({ ...v, notes: 'old' }, before)).toEqual({});
    expect(buildUpdateRequest({ ...v, notes: '' }, before)).toEqual({ notes: '' });

    expect(buildConnectRequest(v, 'id')).toBeNull();
    const inv = {
      ...v,
      account_type: AccountType.INVESTMENT,
      connect: true,
      api_key: 'k',
      api_secret: 's',
      environment: BrokerEnv.Demo,
    };
    expect(buildConnectRequest(inv, 'id')).toMatchObject({
      account_id: 'id',
      api_key: 'k',
      environment: 'demo',
    });
  });
});

describe('bank connect return', () => {
  it('reads the callback outcome', () => {
    expect(readBankReturn('?bank_connected=true').kind).toBe(BankReturn.Connected);
    expect(readBankReturn('?bank_error=denied')).toEqual({
      kind: BankReturn.Failed,
      message: 'denied',
    });
    expect(readBankReturn('?tab=x').kind).toBe(BankReturn.None);
    expect(bankReturnPath('a1')).toBe('/accounts/a1');
    expect(bankReturnPath(null)).toBe('/accounts');
  });
});

describe('accountFlows', () => {
  it('splits money in and out', () => {
    expect(accountFlows([{ amount: '10' }, { amount: -4 }, { amount: '-1.5' }])).toEqual({
      in: 10,
      out: -5.5,
      net: 4.5,
      count: 3,
    });
  });
});
