import { useMemo } from 'react';
import { useCurrencyConverter } from './useCurrencyConverter';
import { DEFAULT_CURRENCY } from '@/constants';
import type { CurrencyCode } from '@/types';

interface Account {
  currency: CurrencyCode;
  balance: number;
}

/**
 * Hook to convert account balances to default currency
 * Automatically extracts unique currencies from accounts and fetches rates
 *
 * @param accounts - Array of accounts with currency and balance information
 * @returns Conversion function and loading state
 */
export const useAccountCurrencyConverter = <T extends Account>(accounts: T[]) => {
  // Extract unique currencies from accounts
  const fromCurrencies = useMemo(
    () => Array.from(new Set(accounts.map((a) => a.currency))),
    [accounts]
  );

  // Fetch exchange rates for all currencies used in accounts
  const { convert, isLoading, error, hasRates } = useCurrencyConverter(
    DEFAULT_CURRENCY,
    fromCurrencies
  );

  /**
   * Convert an account balance to default currency
   * @param balance - Account balance
   * @param currency - Source currency
   * @returns Converted balance in default currency
   */
  const convertBalance = (balance: number, currency: CurrencyCode): number => {
    return convert(balance, currency);
  };

  return {
    convertBalance,
    convert,
    isLoading,
    error,
    hasRates,
    toCurrency: DEFAULT_CURRENCY,
  };
};
