import { useMemo } from 'react';
import { useCurrencyConverter } from './useCurrencyConverter';
import { DEFAULT_CURRENCY } from '@/constants';
import type { CurrencyCode } from '@/types';

interface Transaction {
  account: {
    currency: CurrencyCode;
  };
  amount: string;
}

/**
 * Hook to convert transaction amounts to default currency
 * Automatically extracts unique currencies from transactions and fetches rates
 *
 * @param transactions - Array of transactions with account currency information
 * @returns Conversion function and loading state
 */
export const useTransactionCurrencyConverter = <T extends Transaction>(transactions: T[]) => {
  // Extract unique currencies from transactions
  const fromCurrencies = useMemo(
    () => Array.from(new Set(transactions.map((t) => t.account.currency))),
    [transactions]
  );

  // Fetch exchange rates for all currencies used in transactions
  const { convert, isLoading, error, hasRates } = useCurrencyConverter(
    DEFAULT_CURRENCY,
    fromCurrencies
  );

  /**
   * Convert a transaction amount to default currency
   * @param amount - Transaction amount (can be string or number)
   * @param currency - Source currency
   * @returns Converted amount in default currency
   */
  const convertAmount = (amount: string | number, currency: CurrencyCode): number => {
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    return convert(numAmount, currency);
  };

  return {
    convertAmount,
    convert,
    isLoading,
    error,
    hasRates,
    toCurrency: DEFAULT_CURRENCY,
  };
};
