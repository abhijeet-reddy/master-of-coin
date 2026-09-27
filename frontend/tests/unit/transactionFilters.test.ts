import { describe, expect, it } from 'vitest';
import { parseSearch, serializeSearch } from '@/lib/urlState';
import {
  activeChips,
  activeFilterCount,
  amountParams,
  clearedFilters,
  filterSchema,
  monthsAgo,
  PAGE_SIZE,
  rangeImpliesOut,
  resolveMonth,
  shiftMonth,
  toListParams,
  UNCATEGORISED,
  type TxFilters,
} from '@/features/transactions/lib/filters';

const parse = (qs: string) => parseSearch(filterSchema, new URLSearchParams(qs));
const now = new Date(2026, 8, 27, 12, 0);
const names = {
  account: (id: string) => ({ a1: 'Revolut', a2: 'Monzo' })[id],
  category: (id: string) => ({ c1: 'Groceries' })[id],
  person: (id: string) => ({ p1: 'Sam' })[id],
  date: (iso: string) => iso,
};

describe('filter URL schema', () => {
  it('defaults every filter when the URL is empty', () => {
    const f = parse('');
    expect(f).toMatchObject({
      q: '',
      month: '',
      account: [],
      category: [],
      dir: 'all',
      paid: 'all',
      page: 1,
    });
    expect(f.splits).toBe(false);
    expect(activeFilterCount(f)).toBe(0);
  });

  it('reads every filter from the URL', () => {
    const f = parse(
      'q=tesco&month=2026-08&account=a1,a2&category=c1&person=p1&from=2026-08-01&to=2026-08-15&min=5&max=50&dir=out&splits=1&transfer=1&paid=only&page=3'
    );
    expect(f).toMatchObject({
      q: 'tesco',
      month: '2026-08',
      account: ['a1', 'a2'],
      category: ['c1'],
      person: 'p1',
      from: '2026-08-01',
      to: '2026-08-15',
      min: 5,
      max: 50,
      dir: 'out',
      splits: true,
      transfer: true,
      paid: 'only',
      page: 3,
    });
  });

  it('falls back on junk instead of throwing', () => {
    const f = parse('dir=sideways&paid=maybe&page=x&from=25-09-2026');
    expect(f.dir).toBe('all');
    expect(f.paid).toBe('all');
    expect(f.page).toBe(1);
    expect(f.from).toBeUndefined();
  });

  it('keeps defaults out of the URL and round trips the rest', () => {
    const f = { ...parse(''), q: 'rent', dir: 'in' as const, account: ['a1'] };
    const qs = serializeSearch(filterSchema, f, new URLSearchParams());
    expect(qs.get('page')).toBeNull();
    expect(qs.get('paid')).toBeNull();
    expect(parse(qs.toString())).toEqual(f);
  });

  it('clearing resets filters but not the month', () => {
    const f: TxFilters = { ...parse('q=x&month=2026-07&dir=out&page=4'), ...clearedFilters() };
    expect(f.month).toBe('2026-07');
    expect(f.page).toBe(1);
    expect(activeFilterCount(f)).toBe(0);
  });
});

describe('months', () => {
  it('resolves blank or bad months to the current one', () => {
    expect(resolveMonth('', now)).toBe('2026-09');
    expect(resolveMonth('2026-13', now)).toBe('2026-09');
    expect(resolveMonth('2025-12', now)).toBe('2025-12');
  });
  it('shifts across year boundaries', () => {
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftMonth('2025-12', 1)).toBe('2026-01');
  });
  it('counts months back from now', () => {
    expect(monthsAgo('2026-09', now)).toBe(0);
    expect(monthsAgo('2025-09', now)).toBe(12);
  });
});

describe('amountParams', () => {
  it('maps money in directly', () => {
    expect(amountParams({ dir: 'in', min: 10, max: 20 })).toEqual({
      sign: 'positive',
      min_amount: 10,
      max_amount: 20,
    });
  });
  it('flips and swaps bounds for money out', () => {
    expect(amountParams({ dir: 'out', min: 10, max: 20 })).toEqual({
      sign: 'negative',
      min_amount: -20,
      max_amount: -10,
    });
  });
  it('treats a range with direction All as money out, and says so', () => {
    expect(amountParams({ dir: 'all', min: 10, max: undefined })).toEqual({
      sign: 'negative',
      min_amount: undefined,
      max_amount: -10,
    });
    expect(rangeImpliesOut({ dir: 'all', min: 10, max: undefined })).toBe(true);
    expect(rangeImpliesOut({ dir: 'out', min: 10, max: undefined })).toBe(false);
  });
  it('sends nothing without a direction or range', () => {
    expect(amountParams({ dir: 'all', min: undefined, max: undefined })).toEqual({});
  });
  it('uses the size of negative input', () => {
    expect(amountParams({ dir: 'in', min: -5, max: undefined }).min_amount).toBe(5);
  });
});

describe('toListParams', () => {
  it('builds the server query and pages by PAGE_SIZE', () => {
    const p = toListParams(
      parse(
        'q=%20tesco%20&account=a1,a2&category=uncategorised&person=p1&splits=1&paid=exclude&page=3'
      ),
      now
    );
    expect(p).toMatchObject({
      search: 'tesco',
      account_id: 'a1,a2',
      category_id: UNCATEGORISED,
      person_id: 'p1',
      has_splits: true,
      paid_by_others: 'exclude',
      limit: PAGE_SIZE,
      offset: 2 * PAGE_SIZE,
    });
    expect(p.start_date).toBeDefined();
    expect(p.end_date).toBeDefined();
  });
  it('leaves unset keys out entirely', () => {
    const p = toListParams(parse(''), now);
    expect(Object.keys(p).sort()).toEqual(['end_date', 'limit', 'offset', 'start_date']);
  });
  it('caps the search length', () => {
    expect(toListParams(parse(`q=${'a'.repeat(150)}`), now).search).toHaveLength(100);
  });
});

describe('activeChips', () => {
  it('names each filter and resets to page 1 when removed', () => {
    const f = parse(
      'q=tesco&account=a1,a2&category=uncategorised&person=p1&dir=in&transfer=1&paid=only&page=2'
    );
    const chips = activeChips(f, names);
    expect(chips.map((c) => c.label)).toEqual([
      'Search: tesco',
      'Account: Revolut',
      'Account: Monzo',
      'Category: Uncategorised',
      'Person: Sam',
      'Money in',
      'In a transfer',
      'Paid by others only',
    ]);
    expect(chips[1].clear).toEqual({ account: ['a2'], page: 1 });
    expect(activeFilterCount(f)).toBe(8);
  });
  it('labels unknown ids rather than hiding them', () => {
    expect(activeChips(parse('account=zz'), names)[0].label).toBe('Account: Unknown');
  });
});
