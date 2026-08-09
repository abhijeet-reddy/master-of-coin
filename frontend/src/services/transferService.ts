import apiClient from '@/lib/axios';
import type {
  ConvertCandidatesResponse,
  ConvertToTransferRequest,
  CreateTransferRequest,
  Transaction,
  TransferResponse,
} from '@/types';

// Display caps for the convert candidate picker. Suggestions are a short
// shortlist; search allows a longer scan. Kept in step with the picker UI,
// which shows "Showing 5 of N" only when the total exceeds these.
const SUGGESTION_LIMIT = 5;
const SEARCH_LIMIT = 20;
const DAY_MS = 24 * 60 * 60 * 1000;

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
 * leg when converting a transaction of `referenceAmount` dated `referenceDate`.
 *
 * Expressed as explicit parameters on the shared transactions list endpoint
 * rather than a dedicated route:
 * - `sign` is the OPPOSITE sign to the reference (a debit's counterpart is a
 *   credit and vice versa), computed here from `referenceAmount`.
 * - `closest_to` is the reference's absolute amount, so results are ranked by
 *   closeness to it (server orders in SQL, before the cap).
 * - `exclude_id`, `in_transfer=false`, `has_splits=false`, `is_deleted=false`
 *   apply the exclusions.
 * - Without `search`: a plus/minus one day window around the reference date
 *   (suggestions). With `search`: the whole account, no window.
 *
 * The true match count comes back in the `X-Total-Count` header, so the caller
 * can show "Showing 5 of 12" even though the list itself is capped.
 */
export async function getConvertCandidates(
  referenceId: string,
  referenceAmount: string,
  referenceDate: string,
  accountId: string,
  search?: string
): Promise<ConvertCandidatesResponse> {
  const isSearch = !!search;
  const refAmount = Number(referenceAmount);
  // The counterpart has the opposite sign to the transaction being converted.
  const oppositeSign = refAmount < 0 ? 'positive' : 'negative';
  const params: Record<string, string | number | boolean> = {
    account_id: accountId,
    exclude_id: referenceId,
    sign: oppositeSign,
    closest_to: Math.abs(refAmount),
    in_transfer: false,
    has_splits: false,
    is_deleted: false,
    limit: isSearch ? SEARCH_LIMIT : SUGGESTION_LIMIT,
  };
  if (isSearch) {
    params.search = search;
  } else {
    // Suggestions: plus/minus one day around the reference date.
    const ref = new Date(referenceDate).getTime();
    params.start_date = new Date(ref - DAY_MS).toISOString();
    params.end_date = new Date(ref + DAY_MS).toISOString();
  }

  const response = await apiClient.get<Transaction[]>('/transactions', { params });
  const headerTotal = Number(response.headers['x-total-count']);
  const candidates = response.data.map((t) => ({
    id: t.id,
    title: t.title,
    amount: t.amount,
    date: t.date,
  }));
  return {
    candidates,
    total: Number.isFinite(headerTotal) ? headerTotal : candidates.length,
  };
}
