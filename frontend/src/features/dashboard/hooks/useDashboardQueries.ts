/**
 * Every query the dashboard reads. Keys are shared with the status strip and
 * the rest of the app, so a panel and the strip never fetch the same thing twice.
 */
import { useQuery } from '@tanstack/react-query';
import { getAccounts } from '@/api/accounts';
import { getMonthlyTotals, getNetWorthHistory, HistoryInterval } from '@/api/analytics';
import { listBankProviders } from '@/api/bankProviders';
import { getCategories } from '@/api/categories';
import { getDashboardSummary } from '@/api/dashboard';
import { fetchExchangeRates } from '@/api/exchangeRates';
import { listProviders } from '@/api/investmentProviders';
import { keys } from '@/api/keys';
import type { CurrencyCode } from '@/api/types';

const MINUTE = 60_000;
const HISTORY_PARAMS = { interval: HistoryInterval.Month };
export const MONTHS = 12;

export const useSummary = () =>
  useQuery({ queryKey: keys.dashboard, queryFn: getDashboardSummary, staleTime: MINUTE });

export const useNetWorthHistory = () =>
  useQuery({
    queryKey: keys.analytics.netWorth(HISTORY_PARAMS),
    queryFn: () => getNetWorthHistory(HISTORY_PARAMS),
    staleTime: 5 * MINUTE,
  });

export const useMonthlyTotals = () =>
  useQuery({
    queryKey: keys.analytics.monthly(MONTHS),
    queryFn: () => getMonthlyTotals(MONTHS),
    staleTime: 5 * MINUTE,
  });

export const useAccountList = () => useQuery({ queryKey: keys.accounts.all, queryFn: getAccounts });

export const useCategoryList = () =>
  useQuery({ queryKey: keys.categories.all, queryFn: getCategories, staleTime: 5 * MINUTE });

export const useBankProviders = () =>
  useQuery({ queryKey: keys.bankProviders, queryFn: listBankProviders });

export const useInvestmentProviders = () =>
  useQuery({ queryKey: keys.investmentProviders, queryFn: listProviders });

export const useRates = (base: string, enabled: boolean) =>
  useQuery({
    queryKey: keys.exchangeRates(base),
    queryFn: () => fetchExchangeRates(base as CurrencyCode),
    staleTime: 60 * MINUTE,
    enabled,
  });
