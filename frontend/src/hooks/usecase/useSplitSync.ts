import { useState } from 'react';
import { useSyncTransactionSplit, useResolveSplitMismatch } from '@/hooks/api';
import { toaster } from '@/components/ui/toaster';
import type { SplitSyncResult } from '@/types';

/**
 * Manages the split sync workflow for a transaction.
 *
 * Sync flow:
 * 1. If already linked to an external expense → fetch it and compare splits
 *    - If splits match → "synced" (already in sync)
 *    - If splits differ → "mismatch" (opens modal)
 * 2. If not linked → search provider for matching expenses (same amount, ±3 days)
 *    - If exact match found → "linked" (auto-links)
 *    - If amount matches but splits differ → "mismatch" (opens modal)
 *    - If no match → "created" (creates new expense)
 * 3. Mismatch resolution:
 *    - Push: overwrite provider with local splits
 *    - Pull: update local splits from provider data
 */
export default function useSplitSync(transactionId: string) {
  const [mismatchResult, setMismatchResult] = useState<SplitSyncResult | null>(null);

  const syncMutation = useSyncTransactionSplit();
  const resolveMutation = useResolveSplitMismatch();

  const handleSync = () => {
    syncMutation.mutate(transactionId, {
      onSuccess: (result: SplitSyncResult) => {
        if (result.status === 'synced') {
          toaster.create({
            title: 'In Sync',
            description: 'Transaction is already in sync with split provider',
            type: 'info',
          });
        } else if (result.status === 'linked') {
          toaster.create({
            title: 'Synced',
            description: 'Existing expense found and linked',
            type: 'success',
          });
        } else if (result.status === 'created') {
          toaster.create({
            title: 'Created',
            description: 'New expense created on split provider',
            type: 'success',
          });
        } else if (result.status === 'mismatch') {
          setMismatchResult(result);
        }
      },
      onError: (error: Error) => {
        toaster.create({
          title: 'Sync failed',
          description: error.message || 'Failed to sync with split provider',
          type: 'error',
        });
      },
    });
  };

  const handleResolve = (action: 'push' | 'pull') => {
    if (!mismatchResult?.external_expense_id) return;

    resolveMutation.mutate(
      {
        transactionId,
        request: {
          external_expense_id: mismatchResult.external_expense_id,
          action,
        },
      },
      {
        onSuccess: () => {
          setMismatchResult(null);
          toaster.create({
            title: action === 'push' ? 'Pushed' : 'Pulled',
            description:
              action === 'push'
                ? 'Local splits pushed to split provider'
                : 'Local splits updated from split provider',
            type: 'success',
          });
        },
        onError: (error: Error) => {
          toaster.create({
            title: 'Resolution failed',
            description: error.message || 'Failed to resolve mismatch',
            type: 'error',
          });
        },
      }
    );
  };

  const closeMismatchModal = () => setMismatchResult(null);

  return {
    handleSync,
    handleResolve,
    closeMismatchModal,
    mismatchResult,
    isSyncing: syncMutation.isPending,
    isResolving: resolveMutation.isPending,
  };
}
