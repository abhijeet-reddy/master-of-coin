/**
 * Currency conversion utilities
 */

import type { CurrencyCode } from '@/types';

/**
 * Convert an amount from one currency to another using exchange rates
 * @param amount - The amount to convert
 * @param fromCurrency - The source currency code
 * @param toCurrency - The target currency code
 * @param rates - Exchange rates object (conversion_rates from base currency)
 * @param baseCurrency - The base currency of the rates object
 * @returns The converted amount
 */
export const convertCurrency = (
  amount: number,
  fromCurrency: CurrencyCode,
  toCurrency: CurrencyCode,
  rates: Record<string, number>,
  baseCurrency: CurrencyCode
): number => {
  if (fromCurrency === toCurrency) {
    return amount;
  }

  // If converting from base currency, direct conversion
  if (fromCurrency === baseCurrency) {
    return amount * rates[toCurrency];
  }

  // If converting to base currency, inverse conversion
  if (toCurrency === baseCurrency) {
    return amount / rates[fromCurrency];
  }

  // Otherwise, convert through the base currency
  // First convert to base currency, then to target
  const amountInBase = amount / rates[fromCurrency];
  const convertedAmount = amountInBase * rates[toCurrency];

  return convertedAmount;
};
