/**
 * Pure derivations behind the accounts pages. No React, no fetching: API
 * shapes in, what a panel renders out.
 */
import type { Account, InvestmentProvider, Transaction } from '@/api/types';
import type { BankBalanceResponse, BankProvider } from '@/api/types/bankProvider';
import type { PortfolioSyncReport } from '@/api/types/portfolioSync';
import { isBankType, isInvestmentType, TYPE_ORDER, typeMeta } from '@/lib/accountTypes';
import { toNumber } from '@/lib/format';
import { convert, type RateTable } from '@/lib/fx';

const num = (v: string | number | null | undefined) => {
  const n = toNumber(v);
  return Number.isFinite(n) ? n : 0;
};

/** Below this an amount is treated as zero (floating point dust). */
export const EPSILON = 0.005;
export const isZero = (n: number) => Math.abs(n) < EPSILON;

export const isArchived = (a: Pick<Account, 'archived_at'>) => !!a.archived_at;

/* ---------------------------------------------------------------- totals */

export interface Converted {
  /** In the base currency; null when no rate exists. */
  value: number | null;
  /** 1 unit of the account's currency in base; null for base-currency accounts or a missing rate. */
  rate: number | null;
}

export function convertBalance(
  a: Pick<Account, 'balance' | 'currency'>,
  base: string,
  rates: RateTable | null
): Converted {
  const cur = String(a.currency);
  if (cur === base) return { value: num(a.balance), rate: null };
  const one = convert(1, cur, base, rates);
  return { value: one === null ? null : num(a.balance) * one, rate: one };
}

export interface AccountGroup {
  type: string;
  label: string;
  tag: string;
  liability: boolean;
  accounts: Account[];
  /** Sum in base; accounts without a rate are left out and listed in `missing`. */
  total: number;
  missing: string[];
}

export interface AccountsOverview {
  groups: AccountGroup[];
  archived: Account[];
  assets: number;
  /** Negative (or zero). */
  liabilities: number;
  net: number;
  /** Every account counted in the totals, archived included (they still count in net worth). */
  count: number;
  currencies: string[];
  missing: string[];
}

const rank = (t: string) => {
  const i = TYPE_ORDER.indexOf(t as (typeof TYPE_ORDER)[number]);
  return i === -1 ? TYPE_ORDER.length : i;
};

/**
 * Active accounts grouped by type (assets first, then liabilities, in a fixed
 * order); archived ones apart. Totals include archived accounts, because the
 * server still counts them in net worth.
 */
export function accountsOverview(
  accounts: readonly Account[],
  base: string,
  rates: RateTable | null
): AccountsOverview {
  const active = accounts.filter((a) => !isArchived(a));
  const archived = accounts.filter(isArchived).sort((a, b) => a.name.localeCompare(b.name));
  const byType = new Map<string, Account[]>();
  for (const a of active) byType.set(a.account_type, [...(byType.get(a.account_type) ?? []), a]);

  const missing = new Set<string>();
  const sum = (list: readonly Account[]) => {
    let total = 0;
    const miss = new Set<string>();
    for (const a of list) {
      const v = convertBalance(a, base, rates).value;
      if (v === null) miss.add(String(a.currency));
      else total += v;
    }
    miss.forEach((c) => missing.add(c));
    return { total, missing: [...miss] };
  };

  const groups: AccountGroup[] = [...byType.entries()]
    .map(([type, list]) => {
      const meta = typeMeta(type);
      const { total, missing: miss } = sum(list);
      return {
        type,
        label: meta.label,
        tag: meta.tag,
        liability: meta.liability,
        accounts: [...list].sort((a, b) => a.name.localeCompare(b.name)),
        total,
        missing: miss,
      };
    })
    .sort((a, b) => Number(a.liability) - Number(b.liability) || rank(a.type) - rank(b.type));

  let assets = 0;
  let liabilities = 0;
  for (const a of accounts) {
    const v = convertBalance(a, base, rates).value;
    if (v === null) {
      missing.add(String(a.currency));
      continue;
    }
    if (v >= 0) assets += v;
    else liabilities += v;
  }

  return {
    groups,
    archived,
    assets,
    liabilities,
    net: assets + liabilities,
    count: accounts.length,
    currencies: [...new Set(accounts.map((a) => String(a.currency)))].sort(),
    missing: [...missing].sort(),
  };
}

export interface ExposureRow {
  type: string;
  label: string;
  tag: string;
  liability: boolean;
  total: number;
  /** Share of total assets (or of total liabilities for liability types), 0..100. */
  share: number;
  /** Bar length relative to the largest |total|, 0..1. */
  width: number;
}

export function exposure(
  o: Pick<AccountsOverview, 'groups' | 'assets' | 'liabilities'>
): ExposureRow[] {
  const max = Math.max(0, ...o.groups.map((g) => Math.abs(g.total)));
  return o.groups.map((g) => {
    const pool = g.liability ? Math.abs(o.liabilities) : o.assets;
    return {
      type: g.type,
      label: g.label,
      tag: g.tag,
      liability: g.liability,
      total: g.total,
      share: pool > 0 ? (Math.abs(g.total) / pool) * 100 : 0,
      width: max > 0 ? Math.abs(g.total) / max : 0,
    };
  });
}

/* ---------------------------------------------------------------- providers */

export enum ProviderKind {
  None = 'none',
  Bank = 'bank',
  Investment = 'investment',
}

export enum SyncAction {
  Bank = 'Sync bank',
  Portfolio = 'Sync portfolio',
}

export interface ProviderState {
  kind: ProviderKind;
  /** Provider record id (for sync, balance, disconnect). */
  id: string | null;
  name: string | null;
  lastSyncAt: string | null;
  /** Bank only: a TrueLayer account has been picked. Brokerages are always linked. */
  linked: boolean;
  /** The sync button, or null when this account cannot sync right now. */
  sync: SyncAction | null;
  /** Whether a provider could be connected (right account type, nothing connected yet). */
  connectable: boolean;
}

export const PROVIDER_NAMES = { bank: 'TrueLayer', investment: 'Trading 212' } as const;

/**
 * What is connected to an account. "Sync bank" only for bank-type accounts with
 * a linked bank account; "Sync portfolio" only for investment accounts with a
 * brokerage. Archived accounts never sync (the server refuses).
 */
export function providerState(
  account: Pick<Account, 'id' | 'account_type' | 'archived_at'>,
  banks: readonly Pick<
    BankProvider,
    'id' | 'account_id' | 'is_active' | 'last_sync_at' | 'external_account_id'
  >[],
  investments: readonly Pick<InvestmentProvider, 'id' | 'account_id' | 'is_active'>[]
): ProviderState {
  const archived = isArchived(account);
  if (isInvestmentType(account.account_type)) {
    const p = investments.find((i) => i.account_id === account.id && i.is_active);
    if (p) {
      return {
        kind: ProviderKind.Investment,
        id: p.id,
        name: PROVIDER_NAMES.investment,
        lastSyncAt: null,
        linked: true,
        sync: archived ? null : SyncAction.Portfolio,
        connectable: false,
      };
    }
  } else if (isBankType(account.account_type)) {
    const p = banks.find((b) => b.account_id === account.id && b.is_active);
    if (p) {
      const linked = !!p.external_account_id;
      return {
        kind: ProviderKind.Bank,
        id: p.id,
        name: PROVIDER_NAMES.bank,
        lastSyncAt: p.last_sync_at,
        linked,
        sync: archived || !linked ? null : SyncAction.Bank,
        connectable: false,
      };
    }
  }
  return {
    kind: ProviderKind.None,
    id: null,
    name: null,
    lastSyncAt: null,
    linked: false,
    sync: null,
    connectable:
      !archived && (isBankType(account.account_type) || isInvestmentType(account.account_type)),
  };
}

/* ---------------------------------------------------------------- archive */

/** Archiving a non-zero balance keeps it in net worth; the confirm says so. */
export const archiveNeedsWarning = (a: Pick<Account, 'balance'>) => !isZero(num(a.balance));

/* ---------------------------------------------------------------- history */

export interface HistoryPoint {
  /** Local `YYYY-MM-DD`. */
  day: string;
  balance: number;
}

export interface BalanceHistory {
  points: HistoryPoint[];
  /** False when the server had more rows than we loaded, so the start is trimmed. */
  complete: boolean;
  change: number;
}

const pad = (n: number) => String(n).padStart(2, '0');
const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/**
 * End-of-day balances, walking back from today's balance: the balance at the
 * end of day D is today's minus everything dated after D. `txs` must be every
 * transaction on the account since `start` (or the newest ones when
 * `truncated`, in which case the series starts at the oldest one loaded).
 */
export function balanceHistory(
  currentBalance: number | string,
  txs: readonly Pick<Transaction, 'date' | 'amount'>[],
  start: Date,
  now: Date = new Date(),
  truncated = false
): BalanceHistory {
  const dated = txs
    .map((t) => ({ at: new Date(t.date), amount: num(t.amount) }))
    .filter((t) => !Number.isNaN(t.at.getTime()));
  let from = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  if (truncated && dated.length) {
    const oldest = dated.reduce((m, t) => (t.at < m ? t.at : m), dated[0].at);
    const d = new Date(oldest.getFullYear(), oldest.getMonth(), oldest.getDate());
    if (d > from) from = d;
  }
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const days: Date[] = [];
  for (let d = new Date(from); d <= today; d.setDate(d.getDate() + 1)) days.push(new Date(d));

  // Newest first; peel off transactions as the cursor walks back past them.
  const sorted = [...dated].sort((a, b) => b.at.getTime() - a.at.getTime());
  let balance = num(currentBalance);
  let i = 0;
  const points: HistoryPoint[] = [];
  for (let k = days.length - 1; k >= 0; k--) {
    const endOfDay = new Date(days[k]);
    endOfDay.setDate(endOfDay.getDate() + 1);
    while (i < sorted.length && sorted[i].at >= endOfDay) {
      balance -= sorted[i].amount;
      i++;
    }
    points.push({ day: dayKey(days[k]), balance });
  }
  points.reverse();
  const change = points.length > 1 ? points[points.length - 1].balance - points[0].balance : 0;
  return { points, complete: !truncated, change };
}

/* ---------------------------------------------------------------- drift */

export interface Drift {
  ledger: number;
  external: number;
  /** external minus ledger: what an adjustment would add. */
  difference: number;
  inSync: boolean;
}

/** Ledger against what the bank says. The bank reports in the account's currency. */
export function bankDrift(
  ledger: number | string,
  bank: Pick<BankBalanceResponse, 'current'>
): Drift {
  const l = num(ledger);
  const e = num(bank.current);
  const difference = e - l;
  return { ledger: l, external: e, difference, inSync: isZero(difference) };
}

export interface PortfolioDrift extends Drift {
  status: string;
  error: string | null;
}

/** This account's line in a portfolio sync report: ledger before, broker value, adjustment booked. */
export function portfolioDrift(
  report: PortfolioSyncReport | undefined,
  accountId: string
): PortfolioDrift | null {
  const r = report?.synced_accounts.find((s) => s.account_id === accountId);
  if (!r) return null;
  const ledger = num(r.previous_balance);
  const external = num(r.new_value);
  const difference = num(r.adjustment_amount);
  return {
    ledger,
    external,
    difference,
    inSync: isZero(difference),
    status: r.status,
    error: r.error ?? null,
  };
}
