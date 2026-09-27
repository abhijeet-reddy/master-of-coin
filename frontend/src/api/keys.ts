/**
 * Query key factory. Every query key in the app comes from here so
 * invalidation is consistent: `invalidateQueries({ queryKey: keys.accounts.all })`
 * refreshes every accounts query.
 */
import type { QueryParams } from './types';
import type { ListJobsParams } from './jobs';

export const keys = {
  me: ['auth', 'me'] as const,
  version: ['version'] as const,
  preferences: ['preferences'] as const,
  dashboard: ['dashboard'] as const,
  accounts: {
    all: ['accounts'] as const,
    /** Active and archived; the accounts page. */
    withArchived: ['accounts', 'with-archived'] as const,
    detail: (id: string) => ['accounts', id] as const,
  },
  transactions: {
    all: ['transactions'] as const,
    list: (filters: QueryParams) => ['transactions', filters] as const,
    detail: (id: string) => ['transactions', id] as const,
    trash: ['transactions', 'trash'] as const,
  },
  budgets: {
    all: ['budgets'] as const,
    list: (params?: { active?: boolean }) => ['budgets', params ?? {}] as const,
    detail: (id: string) => ['budgets', id] as const,
    ranges: (id: string) => ['budgets', id, 'ranges'] as const,
  },
  categories: {
    all: ['categories'] as const,
    detail: (id: string) => ['categories', id] as const,
  },
  people: {
    all: ['people'] as const,
    detail: (id: string) => ['people', id] as const,
    splitConfig: (id: string) => ['people', id, 'split-config'] as const,
  },
  jobs: {
    all: ['jobs'] as const,
    list: (params?: ListJobsParams) => ['jobs', params ?? {}] as const,
    detail: (id: string) => ['jobs', 'detail', id] as const,
  },
  schedules: {
    all: ['schedules'] as const,
    detail: (id: string) => ['schedules', id] as const,
  },
  analytics: {
    all: ['analytics'] as const,
    monthly: (months: number) => ['analytics', 'monthly', months] as const,
    netWorth: (params: object) => ['analytics', 'net-worth', params] as const,
    spendingTrend: (params: object) => ['analytics', 'spending-trend', params] as const,
  },
  exchangeRates: (base: string) => ['exchangeRates', base] as const,
  apiKeys: ['api-keys'] as const,
  integrations: ['integrations'] as const,
  bankProviders: ['bank-providers'] as const,
  investmentProviders: ['investment-providers'] as const,
  splitSyncStatus: (splitId: string) => ['splits', splitId, 'sync-status'] as const,
} as const;
