/**
 * Typed URL search-param state.
 *
 *   const schema = z.object({ q: u.string(), page: u.number(1), tab: u.enum(['a', 'b'], 'a') });
 *   const [state, setState, { reset }] = useUrlState(schema);
 *
 * - Every field needs a fallback (use the `u.*` helpers), so a missing or
 *   malformed param never throws: it falls back to its default.
 * - Values equal to their default are left out of the URL, so links stay short.
 * - Params not in the schema (e.g. `?tx=<id>` for a drawer) are preserved.
 * - Updates `replace` history by default; pass `{ history: 'push' }` for
 *   changes the Back button should undo (tabs, opening a drawer).
 *
 * Define the schema at module level so its identity is stable.
 */
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { z } from 'zod';

const blankToUndefined = (v: unknown) => (v === '' || v === null ? undefined : v);
const first = (v: unknown) => (Array.isArray(v) ? (v as unknown[])[0] : v);

/** Field helpers with URL-friendly parsing and a built-in fallback. */
export const u = {
  string: (fallback = '') => z.preprocess(first, z.string()).catch(fallback),
  optionalString: () =>
    z.preprocess((v) => blankToUndefined(first(v)), z.string().optional()).catch(undefined),
  number: (fallback: number) =>
    z
      .preprocess((v) => {
        const s = blankToUndefined(first(v));
        return s === undefined ? undefined : Number(s);
      }, z.number().finite())
      .catch(fallback),
  optionalNumber: () =>
    z
      .preprocess((v) => {
        const s = blankToUndefined(first(v));
        return s === undefined ? undefined : Number(s);
      }, z.number().finite().optional())
      .catch(undefined),
  boolean: (fallback = false) =>
    z
      .preprocess((v) => {
        const s = first(v);
        if (s === 'true' || s === '1') return true;
        if (s === 'false' || s === '0') return false;
        return s;
      }, z.boolean())
      .catch(fallback),
  enum: <const T extends readonly [string, ...string[]]>(values: T, fallback: T[number]) =>
    z.preprocess(first, z.enum(values)).catch(fallback),
  /** Comma-separated (`?account=a,b`) or repeated (`?account=a&account=b`). */
  array: () =>
    z
      .preprocess((v) => {
        if (v === undefined) return [];
        const parts = (Array.isArray(v) ? v : [v]).flatMap((x) => String(x).split(','));
        return parts.map((p) => p.trim()).filter(Boolean);
      }, z.array(z.string()))
      .catch([]),
  /** `YYYY-MM-DD`, or undefined. */
  date: () =>
    z
      .preprocess(
        (v) => blankToUndefined(first(v)),
        z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional()
      )
      .catch(undefined),
};

type AnyObjectSchema = z.ZodObject<z.ZodRawShape>;

function rawValue(params: URLSearchParams, key: string): string | string[] | undefined {
  const all = params.getAll(key);
  if (all.length === 0) return undefined;
  return all.length === 1 ? all[0] : all;
}

/** Parse search params with the schema, field by field, never throwing. */
export function parseSearch<S extends AnyObjectSchema>(
  schema: S,
  params: URLSearchParams
): z.infer<S> {
  const out: Record<string, unknown> = {};
  for (const [key, field] of Object.entries(schema.shape)) {
    const res = (field as z.ZodType).safeParse(rawValue(params, key));
    out[key] = res.success ? res.data : undefined;
  }
  return out as z.infer<S>;
}

function same(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) && Array.isArray(b))
    return a.length === b.length && a.every((x, i) => x === b[i]);
  return a === b;
}

/** Write `value` into a copy of `base`, dropping defaults and keeping foreign params. */
export function serializeSearch<S extends AnyObjectSchema>(
  schema: S,
  value: Partial<z.infer<S>>,
  base: URLSearchParams = new URLSearchParams()
): URLSearchParams {
  const defaults = parseSearch(schema, new URLSearchParams()) as Record<string, unknown>;
  const next = new URLSearchParams(base);
  const v = value as Record<string, unknown>;
  for (const key of Object.keys(schema.shape)) {
    next.delete(key);
    const val = v[key];
    if (val === undefined || val === null || val === '' || same(val, defaults[key])) continue;
    if (Array.isArray(val)) {
      if (val.length) next.set(key, val.join(','));
    } else {
      next.set(
        key,
        typeof val === 'object' ? JSON.stringify(val) : String(val as string | number | boolean)
      );
    }
  }
  return next;
}

export type UrlStatePatch<T> = Partial<T> | ((prev: T) => Partial<T>);
export interface UrlStateOptions {
  history?: 'replace' | 'push';
}

export function useUrlState<S extends AnyObjectSchema>(
  schema: S,
  options: UrlStateOptions = {}
): [
  z.infer<S>,
  (patch: UrlStatePatch<z.infer<S>>, opts?: UrlStateOptions) => void,
  { reset: (opts?: UrlStateOptions) => void },
] {
  const [params, setParams] = useSearchParams();
  const defaultHistory = options.history ?? 'replace';

  const state = useMemo(() => parseSearch(schema, params), [schema, params]);

  // React Router hands the updater the params of the last render, and the
  // navigation it starts renders in a transition. Two quick writes (a double
  // click on "previous month") would both start from the same stale params, so
  // keep the last write until the router catches up.
  const pending = useRef<URLSearchParams | null>(null);
  useEffect(() => {
    pending.current = null;
  }, [params]);

  const set = useCallback(
    (patch: UrlStatePatch<z.infer<S>>, opts?: UrlStateOptions) => {
      setParams(
        (stale) => {
          const prev = pending.current ?? stale;
          const current = parseSearch(schema, prev);
          const p = typeof patch === 'function' ? patch(current) : patch;
          const next = serializeSearch(schema, { ...current, ...p }, prev);
          pending.current = next;
          return next;
        },
        { replace: (opts?.history ?? defaultHistory) === 'replace' }
      );
    },
    [schema, setParams, defaultHistory]
  );

  const reset = useCallback(
    (opts?: UrlStateOptions) => {
      setParams(
        (stale) => {
          const next = serializeSearch(schema, {}, pending.current ?? stale);
          pending.current = next;
          return next;
        },
        {
          replace: (opts?.history ?? defaultHistory) === 'replace',
        }
      );
    },
    [schema, setParams, defaultHistory]
  );

  return [state, set, { reset }];
}
