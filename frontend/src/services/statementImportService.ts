/** Statement import API service */

import api from './api';
import type { ParseResponse, BulkCreateRequest, BulkCreateResponse } from '@/types';

/**
 * Parse CSV file and return transactions for preview
 * @param file - CSV file to parse
 * @param accountId - Target account ID
 * @returns Parsed transactions with duplicate detection
 */
export const parseCSV = async (file: File, accountId: string): Promise<ParseResponse> => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('account_id', accountId);

  const response = await api.post<ParseResponse>('/transactions/import/parse', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });

  return response.data;
};

/**
 * Bulk create transactions
 * @param request - Bulk create request with account_id and transactions
 * @returns Created/failed counts and transaction responses
 */
export const bulkCreateTransactions = async (
  request: BulkCreateRequest
): Promise<BulkCreateResponse> => {
  const response = await api.post<BulkCreateResponse>('/transactions/bulk-create', request);
  return response.data;
};
