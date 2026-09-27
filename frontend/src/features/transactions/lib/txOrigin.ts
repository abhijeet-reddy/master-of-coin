/**
 * Where a transaction was opened from, so its full page can crumb back there
 * (Accounts / Revolut / the transaction). Carried in router state; anything
 * that does not look like a crumb list is ignored.
 */
import { createContext, useContext } from 'react';
import type { Crumb } from '@/app/shell/routeMeta';

export const TxOriginContext = createContext<Crumb[] | null>(null);

/** The crumbs of the page hosting this ledger, or null on the plain transactions page. */
export const useTxOrigin = () => useContext(TxOriginContext);

export const DEFAULT_ORIGIN: Crumb[] = [{ label: 'Transactions', to: '/transactions' }];

const MAX_CRUMBS = 4;

/** Crumbs from `location.state.origin`, validated; the transactions page otherwise. */
export function readOrigin(state: unknown): Crumb[] {
  const raw = (state as { origin?: unknown } | null)?.origin;
  if (!Array.isArray(raw) || !raw.length || raw.length > MAX_CRUMBS) return DEFAULT_ORIGIN;
  const ok = raw.every(
    (c) =>
      !!c &&
      typeof (c as Crumb).label === 'string' &&
      (c as Crumb).label.length > 0 &&
      typeof (c as Crumb).to === 'string' &&
      (c as Crumb).to!.startsWith('/') &&
      !(c as Crumb).to!.startsWith('//')
  );
  return ok ? (raw as Crumb[]).map((c) => ({ label: c.label, to: c.to })) : DEFAULT_ORIGIN;
}

/** Where to go after deleting the transaction: the page it was opened from. */
export const originHome = (origin: Crumb[]) => origin[origin.length - 1]?.to ?? '/transactions';
