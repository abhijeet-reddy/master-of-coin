import { useState } from 'react';
import { useStartBankSync, useBankSyncJob } from '@/hooks/api/useBankProviders';
import { toaster } from '@/components/ui/toaster';
import type { FetchedBankTransaction } from '@/types/bankProvider';

/**
 * Manages the bank sync lifecycle: start sync → poll for results → review.
 *
 * Import is now handled by useBankImportPreview hook in the component.
 *
 * @param bankProviderId - The bank provider ID to sync
 * @returns Sync state and action handlers
 */
export default function useBankSync(bankProviderId: string) {
  const [jobId, setJobId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const startSyncMutation = useStartBankSync();
  const { data: syncJob, isLoading: isLoadingJob } = useBankSyncJob(jobId);

  const isCompleted = syncJob?.status === 'COMPLETED';
  const isFailed = syncJob?.status === 'FAILED';
  const isRunning = syncJob?.status === 'PENDING' || syncJob?.status === 'RUNNING';
  const report = syncJob?.result ?? null;

  // Get new (not already imported) transactions
  const newTransactions =
    report?.transactions.filter((t: FetchedBankTransaction) => !t.already_imported) ?? [];

  const handleStartSync = (fromDate?: string, toDate?: string) => {
    startSyncMutation.mutate(
      {
        id: bankProviderId,
        request: { from_date: fromDate, to_date: toDate },
      },
      {
        onSuccess: (response) => {
          setJobId(response.job_id);
          setSelectedIds(new Set());
          toaster.create({
            title: 'Sync Started',
            description: 'Fetching transactions from your bank...',
            type: 'info',
          });
        },
        onError: (error) => {
          const message = error instanceof Error ? error.message : 'Could not start bank sync.';
          toaster.create({
            title: 'Sync Failed',
            description: message,
            type: 'error',
          });
        },
      }
    );
  };

  const toggleTransaction = (externalId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(externalId)) {
        next.delete(externalId);
      } else {
        next.add(externalId);
      }
      return next;
    });
  };

  const selectAllNew = () => {
    setSelectedIds(new Set(newTransactions.map((t: FetchedBankTransaction) => t.external_id)));
  };

  const deselectAll = () => {
    setSelectedIds(new Set());
  };

  return {
    jobId,
    syncJob,
    report,
    isStarting: startSyncMutation.isPending,
    isRunning,
    isLoadingJob,
    isCompleted,
    isFailed,
    newTransactions,
    selectedIds,
    handleStartSync,
    toggleTransaction,
    selectAllNew,
    deselectAll,
  };
}
