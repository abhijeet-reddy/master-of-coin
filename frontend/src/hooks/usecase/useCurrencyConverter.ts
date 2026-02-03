import { useQueries } from '@tanstack/react-query';
import { fetchExchangeRates } from '@/services/exchangeRateService';
import { DEFAULT_CURRENCY } from '@/constants';
import type { CurrencyCode } from '@/types';
import { useMemo, useCallback } from 'react';

/**
 * Hook to convert amounts from any currency to a target currency
 * Fetches exchange rates with each source currency as base for accurate direct conversion
 *
 * @param toCurrency - Target currency for all conversions (defaults to DEFAULT_CURRENCY)
 * @param fromCurrencies - Array of source currencies to fetch rates for
 */
export const useCurrencyConverter = (
  toCurrency: CurrencyCode = DEFAULT_CURRENCY,
  fromCurrencies: CurrencyCode[] = []
) => {
  // Fetch exchange rates for each source currency
  const queries = useQueries({
    queries: fromCurrencies.map((fromCurrency) => ({
      queryKey: ['exchangeRates', fromCurrency],
      queryFn: () => fetchExchangeRates(fromCurrency),
      staleTime: 1000 * 60 * 60 * 24, // 1 day
      gcTime: 1000 * 60 * 60 * 24 * 2, // 2 days
      refetchOnWindowFocus: false,
      retry: 3,
      enabled: fromCurrency !== toCurrency, // Don't fetch if same currency
    })),
  });

  // Build a map of exchange rates: fromCurrency -> rate to toCurrency
  const ratesMap = useMemo(() => {
    const map = new Map<CurrencyCode, number>();

    fromCurrencies.forEach((fromCurrency, index) => {
      if (fromCurrency === toCurrency) {
        map.set(fromCurrency, 1); // Same currency, rate is 1
        return;
      }

      const queryData = queries[index]?.data;
      if (queryData?.conversion_rates) {
        const rate = queryData.conversion_rates[toCurrency];
        if (rate) {
          map.set(fromCurrency, rate);
        }
      }
    });

    return map;
  }, [queries, fromCurrencies, toCurrency]);

  /**
   * Convert amount from source currency to target currency
   * Uses direct conversion rate fetched with source currency as base
   *
   * @param amount - Amount to convert
   * @param fromCurrency - Source currency
   * @returns Converted amount in target currency
   */
  const convert = useCallback(
    (amount: number, fromCurrency: CurrencyCode): number => {
      // If already in target currency, return as is
      if (fromCurrency === toCurrency) {
        return amount;
      }

      // Get the direct conversion rate
      const rate = ratesMap.get(fromCurrency);
      if (!rate) {
        throw new Error(
          `Exchange rate not available for ${fromCurrency} to ${toCurrency}. ` +
            `Make sure to include ${fromCurrency} in the fromCurrencies array.`
        );
      }

      // Direct conversion using rate from API
      return amount * rate;
    },
    [ratesMap, toCurrency]
  );

  return {
    convert,
    toCurrency,
    isLoading: queries.some((q) => q.isLoading),
    error: queries.find((q) => q.error)?.error as Error | null,
    hasRates: ratesMap.size > 0,
  };
};
