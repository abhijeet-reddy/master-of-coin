import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { z } from 'zod';
import { parseSearch, serializeSearch, u, useUrlState } from '@/lib/urlState';

const schema = z.object({
  q: u.string(),
  page: u.number(1),
  tab: u.enum(['list', 'grid'], 'list'),
  account: u.array(),
  from: u.date(),
  archived: u.boolean(),
});

describe('parseSearch', () => {
  it('fills defaults for missing params', () => {
    expect(parseSearch(schema, new URLSearchParams())).toEqual({
      q: '',
      page: 1,
      tab: 'list',
      account: [],
      from: undefined,
      archived: false,
    });
  });
  it('falls back on malformed values instead of throwing', () => {
    const s = parseSearch(
      schema,
      new URLSearchParams('page=abc&tab=table&from=25-09-2026&archived=maybe')
    );
    expect(s.page).toBe(1);
    expect(s.tab).toBe('list');
    expect(s.from).toBeUndefined();
    expect(s.archived).toBe(false);
  });
  it('reads comma-separated and repeated arrays', () => {
    expect(parseSearch(schema, new URLSearchParams('account=a,b')).account).toEqual(['a', 'b']);
    expect(parseSearch(schema, new URLSearchParams('account=a&account=b')).account).toEqual([
      'a',
      'b',
    ]);
  });
});

describe('serializeSearch', () => {
  it('drops defaults and keeps foreign params', () => {
    const out = serializeSearch(
      schema,
      { q: 'rent', page: 1, account: ['a', 'b'] },
      new URLSearchParams('tx=42')
    );
    expect(out.get('q')).toBe('rent');
    expect(out.has('page')).toBe(false);
    expect(out.get('account')).toBe('a,b');
    expect(out.get('tx')).toBe('42');
  });
});

function setup(initial: string) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[initial]}>{children}</MemoryRouter>
  );
  return renderHook(
    () => {
      const [state, set, { reset }] = useUrlState(schema);
      const location = useLocation();
      return { state, set, reset, search: location.search };
    },
    { wrapper }
  );
}

describe('useUrlState', () => {
  it('reads state from the URL', () => {
    const { result } = setup('/t?q=coffee&page=3');
    expect(result.current.state.q).toBe('coffee');
    expect(result.current.state.page).toBe(3);
  });
  it('merges patches, drops defaults, and keeps unrelated params', () => {
    const { result } = setup('/t?page=3&tx=9');
    act(() => result.current.set({ q: 'rent' }));
    expect(result.current.state).toMatchObject({ q: 'rent', page: 3 });
    act(() => result.current.set((prev) => ({ page: prev.page - 2 })));
    const params = new URLSearchParams(result.current.search);
    expect(params.has('page')).toBe(false);
    expect(params.get('q')).toBe('rent');
    expect(params.get('tx')).toBe('9');
  });
  it('resets to defaults', () => {
    const { result } = setup('/t?q=x&tab=grid&tx=1');
    act(() => result.current.reset());
    expect(result.current.state.tab).toBe('list');
    expect(result.current.search).toBe('?tx=1');
  });
});
