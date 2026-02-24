import apiClient from '@/lib/axios';
import type { CreateTransferRequest, TransferResponse } from '@/types';

/**
 * Create a transfer between two accounts
 */
export async function createTransfer(data: CreateTransferRequest): Promise<TransferResponse> {
  const response = await apiClient.post<TransferResponse>('/transfers', data);
  return response.data;
}
