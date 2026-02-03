/**
 * Exchange Rate Service
 * Fetches currency exchange rates from the backend API
 */

import api from './api';
import { CurrencyCode } from '@/types';

export interface ExchangeRateResponse {
  result: string;
  base_code?: string;
  conversion_rates?: Record<string, number>;
  'error-type'?: string;
}

/**
 * Fetch exchange rates for a base currency from the backend API
 * @param baseCurrency - The base currency code (default: EUR)
 * @returns Exchange rate data
 */
export const fetchExchangeRates = async (
  baseCurrency: CurrencyCode = CurrencyCode.EUR
): Promise<ExchangeRateResponse> => {
  try {
    const response = await api.get<ExchangeRateResponse>('/exchange-rates', {
      params: {
        base: baseCurrency,
      },
    });

    if (response.data.result === 'error') {
      throw new Error(`Exchange rate API error: ${response.data['error-type']}`);
    }

    // Convert string rates to numbers for compatibility
    const conversion_rates: Record<string, number> = {};
    if (response.data.conversion_rates) {
      Object.entries(response.data.conversion_rates).forEach(([key, value]) => {
        conversion_rates[key] = typeof value === 'string' ? parseFloat(value) : value;
      });
    }

    return {
      ...response.data,
      conversion_rates,
    };
  } catch (error) {
    console.error('Error fetching exchange rates:', error);
    throw error;
  }
};
