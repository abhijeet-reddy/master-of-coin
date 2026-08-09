import { useQuery } from '@tanstack/react-query';
import { getConvertCandidates } from '@/services/transferService';

/**
 * Fetch existing transactions on `accountId` that could be linked as the other
 * leg when converting `transactionId` into a transfer.
 *
 * Without `search`, returns suggestions (opposite sign, within a day of the
 * original, closest amount first). With `search`, searches the whole account by
 * title or notes. Disabled until both ids are present.
 *
 * @returns React Query result of transfer link candidates
 */
export default function useConvertCandidates(
  transactionId: string,
  transactionAmount: string,
  transactionDate: string,
  accountId: string,
  search?: string
) {
  const trimmed = search?.trim();

  return useQuery({
    queryKey: ['convert-candidates', transactionId, accountId, trimmed ?? ''],
    queryFn: () =>
      getConvertCandidates(
        transactionId,
        transactionAmount,
        transactionDate,
        accountId,
        trimmed || undefined
      ),
    enabled: !!transactionId && !!accountId,
  });
}
