import { useMemo } from 'react';
import { useExchangeRates } from '@/hooks/api/useExchangeRates';
import { convertCurrency } from '@/utils/currency/conversion';
import { DEFAULT_CURRENCY } from '@/constants';
import type { CurrencyCode } from '@/types';

/**
 * Hook to convert amounts to default currency
 * Returns a conversion function and loading/error states
 * Throws an error if exchange rates are not available
 */
export const useCurrencyConverter = () => {
  const { data: exchangeData, isLoading, error } = useExchangeRates();

  const convertToDefault = useMemo(() => {
    return (amount: number, fromCurrency: CurrencyCode): number => {
      // If already in default currency, return as is
      if (fromCurrency === DEFAULT_CURRENCY) {
        return amount;
      }

      // Throw error if no exchange rates available
      if (!exchangeData?.conversion_rates) {
        throw new Error('Exchange rates not available. Please check your internet connection.');
      }

      return convertCurrency(
        amount,
        fromCurrency,
        DEFAULT_CURRENCY,
        exchangeData.conversion_rates,
        DEFAULT_CURRENCY
      );
    };
  }, [exchangeData]);

  return {
    convertToDefault,
    isLoading,
    error,
    hasRates: !!exchangeData?.conversion_rates,
  };
};
