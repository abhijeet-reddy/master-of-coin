import { createContext, useContext, useEffect, useMemo } from 'react';
import { useMatches } from 'react-router-dom';

export interface Crumb {
  label: string;
  to?: string;
}

/** Put on a route's `handle`; the shell reads the deepest one for the title. */
export interface RouteHandle {
  title?: string;
  /** Parent crumb for detail routes, e.g. { label: 'Accounts', to: '/accounts' }. */
  crumb?: Crumb;
}

export interface PageMetaOverride {
  title?: string;
  crumbs?: Crumb[];
}

export interface PageMetaState {
  override: PageMetaOverride | null;
  setOverride: (o: PageMetaOverride | null) => void;
}

export const PageMetaContext = createContext<PageMetaState | null>(null);

/** Title and crumbs for the current route: a page override wins over the route handle. */
export function usePageMeta(): { title: string; crumbs: Crumb[] } {
  const matches = useMatches();
  const ctx = useContext(PageMetaContext);
  return useMemo(() => {
    const handles = matches
      .map((m) => m.handle as RouteHandle | undefined)
      .filter(Boolean) as RouteHandle[];
    const deepest = [...handles].reverse().find((h) => h.title);
    const routeCrumbs = handles.flatMap((h) => (h.crumb ? [h.crumb] : []));
    const o = ctx?.override;
    return {
      title: o?.title ?? deepest?.title ?? 'Master of Coin',
      crumbs: o?.crumbs ?? routeCrumbs,
    };
  }, [matches, ctx?.override]);
}

/**
 * Let a page replace the shell title and crumbs (detail pages use the record's
 * name). Cleared when the page unmounts.
 */
export function useSetPageMeta(title: string | undefined, crumbs: Crumb[] | undefined): boolean {
  const ctx = useContext(PageMetaContext);
  const setOverride = ctx?.setOverride;
  const key = JSON.stringify([title, crumbs]);
  useEffect(() => {
    if (!setOverride) return;
    const [t, c] = JSON.parse(key) as [string | undefined, Crumb[] | undefined];
    setOverride({ title: t, crumbs: c });
    return () => setOverride(null);
  }, [setOverride, key]);
  return ctx !== null;
}

export function useInShell(): boolean {
  return useContext(PageMetaContext) !== null;
}

/** Where page actions render (the right of the page title). */
export const PageActionsContext = createContext<{
  target: HTMLElement | null;
  setTarget: (el: HTMLElement | null) => void;
} | null>(null);
