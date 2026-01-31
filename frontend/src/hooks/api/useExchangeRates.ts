import { useQuery } from '@tanstack/react-query';
import { fetchExchangeRates } from '@/services/exchangeRateService';
import { DEFAULT_CURRENCY } from '@/constants';
import type { CurrencyCode } from '@/types';

/**
 * Hook to fetch exchange rates for the default currency
 * Rates are cached for 1 day and refetched in the background
 */
export const useExchangeRates = (baseCurrency: CurrencyCode = DEFAULT_CURRENCY) => {
  return useQuery({
    queryKey: ['exchangeRates', baseCurrency],
    queryFn: () => fetchExchangeRates(baseCurrency),
    staleTime: 1000 * 60 * 60 * 24, // 1 day
    gcTime: 1000 * 60 * 60 * 24 * 2, // 2 days (formerly cacheTime)
    refetchOnWindowFocus: false,
    retry: 3,
  });
};
