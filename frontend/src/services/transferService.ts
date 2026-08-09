import apiClient from '@/lib/axios';
import type {
  ConvertCandidatesResponse,
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

/**
 * List existing transactions on `accountId` that could be linked as the other
 * leg when converting `transactionId`. Without `search`, returns suggestions
 * (opposite sign, within a day, closest amount first). With `search`, searches
 * the whole account by title or notes.
 */
export async function getConvertCandidates(
  transactionId: string,
  accountId: string,
  search?: string
): Promise<ConvertCandidatesResponse> {
  const response = await apiClient.get<ConvertCandidatesResponse>(
    `/transactions/${transactionId}/convert-candidates`,
    { params: { account_id: accountId, ...(search ? { search } : {}) } }
  );
  return response.data;
}
