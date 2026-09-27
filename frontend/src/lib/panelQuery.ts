import type { UseQueryResult } from '@tanstack/react-query';

/** The slice of a query a panel needs to pick skeleton, error, empty or content. */
export interface PanelQuery<T> {
  data: T | undefined;
  isPending: boolean;
  error: unknown;
  refetch: () => void;
}

type Datas<Q extends readonly UseQueryResult[]> = { [K in keyof Q]: NonNullable<Q[K]['data']> };

/**
 * Several queries as one: pending until all have data, failed if any failed,
 * and retry refetches only the ones that failed.
 */
export function combineQueries<Q extends readonly UseQueryResult[]>(
  ...queries: Q
): PanelQuery<Datas<Q>> {
  const failed = queries.filter((q) => q.isError);
  const ready = queries.every((q) => q.data !== undefined);
  return {
    data: ready ? (queries.map((q) => q.data) as unknown as Datas<Q>) : undefined,
    isPending: !ready && failed.length === 0,
    error: failed[0]?.error ?? null,
    refetch: () => failed.forEach((q) => void q.refetch()),
  };
}
