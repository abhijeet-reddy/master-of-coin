import { describe, expect, it } from 'vitest';
import {
  SplitProviderType,
  type Person,
  type SplitwiseFriend,
  type Transaction,
} from '@/api/types';
import {
  buildPersonCreate,
  buildPersonUpdate,
  personSchema,
} from '@/features/people/forms/personForm';
import {
  buildSettleRequest,
  settleDefaults,
  settleSchema,
} from '@/features/people/forms/settleForm';
import {
  DebtDirection,
  dayBefore,
  debtHistory,
  debtState,
  filterPeople,
  initials,
  peopleTotals,
  settleAccounts,
  settleCap,
  sortPeople,
  splitAmountFor,
} from '@/features/people/lib/peopleModel';
import {
  activeProviders,
  friendName,
  friendOptions,
  suggestFriend,
} from '@/features/people/lib/splitLink';

const person = (name: string, net: string, over: Partial<Person> = {}): Person => ({
  id: name.toLowerCase(),
  name,
  transaction_count: 1,
  debt_summary: { owes_me: '0', i_owe: '0', net },
  ...over,
});

const tx = (
  id: string,
  date: string,
  splits: { person_id: string; amount: string }[]
): Transaction => ({
  id,
  user_id: 'u',
  account_id: 'a',
  title: id,
  amount: '-10',
  date,
  splits: splits.map((s, i) => ({ id: `${id}-${i}`, ...s })),
  created_at: '',
  updated_at: '',
});

describe('debt state', () => {
  it('reads the direction from the signed net', () => {
    expect(debtState('12.5')).toEqual({ direction: DebtDirection.OwesMe, amount: 12.5, net: 12.5 });
    expect(debtState('-3')).toEqual({ direction: DebtDirection.IOwe, amount: 3, net: -3 });
    expect(debtState('0.004').direction).toBe(DebtDirection.Settled);
    expect(debtState(undefined).direction).toBe(DebtDirection.Settled);
  });

  it('totals each side and counts open balances', () => {
    const t = peopleTotals([
      person('A', '10'),
      person('B', '-4'),
      person('C', '0'),
      person('D', '2.5'),
    ]);
    expect(t).toEqual({ owedToMe: 12.5, iOwe: 4, net: 8.5, open: 3 });
  });

  it('sorts by the largest balance either way, then by name', () => {
    const list = [person('Bo', '5'), person('Al', '-9'), person('Cy', '0'), person('Di', '5')];
    expect(sortPeople(list, 'balance').map((p) => p.name)).toEqual(['Al', 'Bo', 'Di', 'Cy']);
    expect(sortPeople(list, 'name').map((p) => p.name)).toEqual(['Al', 'Bo', 'Cy', 'Di']);
  });

  it('filters by direction and searches name or email', () => {
    const list = [
      person('Alex', '5', { email: 'alex@x.io' }),
      person('Sam', '-1'),
      person('Kim', '0'),
    ];
    expect(filterPeople(list, 'owes-me', '').map((p) => p.name)).toEqual(['Alex']);
    expect(filterPeople(list, 'settled', '').map((p) => p.name)).toEqual(['Kim']);
    expect(filterPeople(list, 'all', 'X.IO').map((p) => p.name)).toEqual(['Alex']);
  });

  it('caps a settlement at the size of the debt', () => {
    expect(settleCap(-12.345)).toBe(12.35);
  });

  it('makes initials', () => {
    expect(initials('ada lovelace')).toBe('AL');
    expect(initials('Cher')).toBe('C');
    expect(initials('  ')).toBe('?');
  });

  it('keeps archived and inactive accounts out of the settle picker', () => {
    const accounts = [
      { id: '1', name: 'Zed', is_active: true, archived_at: null },
      { id: '2', name: 'Old', is_active: true, archived_at: '2026-01-01' },
      { id: '3', name: 'Off', is_active: false },
      { id: '4', name: 'Amex', is_active: true },
    ];
    expect(settleAccounts(accounts).map((a) => a.id)).toEqual(['4', '1']);
  });
});

describe('debt history', () => {
  it('sums the person’s splits on a transaction', () => {
    const t = tx('t', '2026-09-01T12:00:00', [
      { person_id: 'p', amount: '5' },
      { person_id: 'q', amount: '7' },
      { person_id: 'p', amount: '1.5' },
    ]);
    expect(splitAmountFor(t, 'p')).toBe(6.5);
    expect(splitAmountFor({ splits: undefined }, 'p')).toBe(0);
  });

  it('walks back from the current net so the line ends at it', () => {
    const txs = [
      tx('a', '2026-09-01T12:00:00', [{ person_id: 'p', amount: '30' }]),
      tx('b', '2026-09-03T12:00:00', [{ person_id: 'p', amount: '-10' }]),
      tx('c', '2026-09-03T15:00:00', [{ person_id: 'p', amount: '5' }]),
      tx('x', '2026-09-02T12:00:00', [{ person_id: 'q', amount: '99' }]),
    ];
    const h = debtHistory(txs, 'p', 25);
    expect(h.changes.map((c) => [c.tx.id, c.change, c.balance])).toEqual([
      ['c', 5, 25],
      ['b', -10, 20],
      ['a', 30, 30],
    ]);
    expect(h.opening).toBe(0);
    expect(h.points).toEqual([
      { day: '2026-08-31', balance: 0 },
      { day: '2026-09-01', balance: 30 },
      { day: '2026-09-03', balance: 25 },
    ]);
  });

  it('starts from a non-zero opening when older rows were not loaded', () => {
    const h = debtHistory(
      [tx('a', '2026-09-01T12:00:00', [{ person_id: 'p', amount: '-5' }])],
      'p',
      15
    );
    expect(h.opening).toBe(20);
  });

  it('dayBefore crosses month and year ends', () => {
    expect(dayBefore('2026-03-01')).toBe('2026-02-28');
    expect(dayBefore('2027-01-01')).toBe('2026-12-31');
  });

  it('is empty with no shared transactions', () => {
    expect(debtHistory([], 'p', 0)).toEqual({ points: [], changes: [], opening: 0 });
  });
});

describe('person form', () => {
  const base = { name: 'Alex', email: '', phone: '', notes: '' };

  it('requires a name and a valid email when given', () => {
    expect(personSchema.safeParse({ ...base, name: ' ' }).success).toBe(false);
    expect(personSchema.safeParse({ ...base, email: 'nope' }).success).toBe(false);
    expect(personSchema.safeParse({ ...base, email: 'a@b.co' }).success).toBe(true);
    expect(personSchema.safeParse({ ...base, phone: '1'.repeat(21) }).success).toBe(false);
  });

  it('create leaves out empty fields', () => {
    expect(buildPersonCreate({ ...base, name: ' Alex ', phone: ' 123 ' })).toEqual({
      name: 'Alex',
      phone: '123',
    });
  });

  it('update sends only changes, a cleared field as null', () => {
    const before = person('Alex', '0', { email: 'a@b.co', phone: '1', notes: null });
    expect(buildPersonUpdate({ name: 'Alex', email: '', phone: '1', notes: 'hi' }, before)).toEqual(
      {
        email: null,
        notes: 'hi',
      }
    );
    expect(
      buildPersonUpdate({ name: 'Al', email: 'a@b.co', phone: '1', notes: '' }, before)
    ).toEqual({
      name: 'Al',
    });
  });
});

describe('settle form', () => {
  const s = settleSchema(40);
  const ok = (amount: string) => s.safeParse({ amount, account_id: 'a' }).success;

  it('accepts up to the debt, with at most 2 decimals', () => {
    expect(ok('40')).toBe(true);
    expect(ok('39.99')).toBe(true);
    expect(ok('40.01')).toBe(false);
    expect(ok('0')).toBe(false);
    expect(ok('1.234')).toBe(false);
    expect(ok('')).toBe(false);
    expect(s.safeParse({ amount: '5', account_id: '' }).success).toBe(false);
  });

  it('defaults to the full debt and sends a number', () => {
    expect(settleDefaults(12.5, 'acc')).toEqual({ amount: '12.50', account_id: 'acc' });
    expect(settleDefaults(0).amount).toBe('');
    expect(buildSettleRequest({ amount: ' 12.50 ', account_id: 'acc' })).toEqual({
      amount: 12.5,
      account_id: 'acc',
    });
  });
});

describe('split provider link', () => {
  const friends: SplitwiseFriend[] = [
    { id: 2, first_name: 'Sam', last_name: 'Lee', email: 'sam@x.io', full_name: 'Sam Lee' },
    { id: 1, first_name: 'Alex', last_name: '', email: '', full_name: '' },
  ];

  it('offers active providers only', () => {
    const p = (id: string, is_active: boolean) => ({
      id,
      user_id: 'u',
      provider_type: SplitProviderType.SPLITWISE,
      is_active,
      created_at: '',
      updated_at: '',
    });
    expect(activeProviders([p('a', true), p('b', false)]).map((x) => x.id)).toEqual(['a']);
  });

  it('names and sorts friends', () => {
    expect(friendName(friends[1])).toBe('Alex');
    expect(friendOptions(friends)).toEqual([
      { value: '1', label: 'Alex', hint: undefined },
      { value: '2', label: 'Sam Lee', hint: 'sam@x.io' },
    ]);
  });

  it('suggests a friend by email, then by a unique name', () => {
    expect(suggestFriend(friends, { name: 'Other', email: 'SAM@x.io' })).toBe('2');
    expect(suggestFriend(friends, { name: 'alex' })).toBe('1');
    expect(suggestFriend(friends, { name: 'nobody' })).toBeNull();
  });
});
