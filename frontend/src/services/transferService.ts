import apiClient from '@/lib/axios';
import type {
  ConvertToTransferRequest,
  CreateTransferRequest,
  TransferResponse,
} from '@/types';

/**
 * Create a transfer between two accounts
 */
export async function createTransfer(data: CreateTransferRequest): Promise<TransferResponse> {
  const response = await apiClient.post<TransferResponse>('/transfers', data);
  return response.data;
}

/**
 * Convert an existing transaction into a transfer by linking it with a new
 * opposite leg on the chosen counterpart account.
 */
export async function convertToTransfer(
  transactionId: string,
  data: ConvertToTransferRequest
): Promise<TransferResponse> {
  const response = await apiClient.post<TransferResponse>(
    `/transactions/${transactionId}/convert-to-transfer`,
    data
  );
  return response.data;
}
