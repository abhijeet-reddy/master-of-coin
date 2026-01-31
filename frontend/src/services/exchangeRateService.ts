/**
 * Exchange Rate Service
 * Fetches currency exchange rates from exchangerate-api.com
 *
 * API Documentation: https://www.exchangerate-api.com/docs/standard-requests
 */

import { CurrencyCode } from '@/types';

const API_KEY = import.meta.env.VITE_EXCHANGE_RATE_API_KEY as string;
const BASE_URL = `https://v6.exchangerate-api.com/v6/${API_KEY}/latest`;

export interface ExchangeRateResponse {
  result: string;
  base_code?: string;
  conversion_rates?: Record<string, number>;
  'error-type'?: string;
}

/**
 * Fetch exchange rates for a base currency
 * @param baseCurrency - The base currency code (default: EUR)
 * @returns Exchange rate data
 */
export const fetchExchangeRates = async (
  baseCurrency: CurrencyCode = CurrencyCode.EUR
): Promise<ExchangeRateResponse> => {
  try {
    const response = await fetch(`${BASE_URL}/${baseCurrency}`);

    if (!response.ok) {
      throw new Error(`Failed to fetch exchange rates: ${response.statusText}`);
    }

    const data = (await response.json()) as ExchangeRateResponse;

    if (data.result === 'error') {
      throw new Error(`Exchange rate API error: ${data['error-type']}`);
    }

    return data;
  } catch (error) {
    console.error('Error fetching exchange rates:', error);
    throw error;
  }
};
