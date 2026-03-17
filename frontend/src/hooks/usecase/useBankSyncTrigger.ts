import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStartBankSync, useBankSyncJob } from '@/hooks/api/useBankProviders';
import { useBankProviderConnection } from '@/hooks/usecase';
import { toaster } from '@/components/ui/toaster';

/**
 * Manages bank sync job lifecycle for a specific account.
 * Handles triggering sync, polling for status, and navigating to job detail.
 *
 * @param accountId - The Master of Coin account ID
 * @returns Sync state and action handlers
 */
export default function useBankSyncTrigger(accountId: string) {
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const navigate = useNavigate();

  const { provider, isConnected, hasLinkedAccount } = useBankProviderConnection(accountId);
  const startMutation = useStartBankSync();
  const { data: syncJob } = useBankSyncJob(activeJobId);

  const isSyncing =
    startMutation.isPending || syncJob?.status === 'PENDING' || syncJob?.status === 'RUNNING';

  const canSync = isConnected && hasLinkedAccount && !!provider;

  const handleSync = () => {
    if (!provider) return;
    startMutation.mutate(
      { id: provider.id },
      {
        onSuccess: (response) => {
          setActiveJobId(response.job_id);
          // Navigate to job detail page
          void navigate(`/jobs/bank-sync/${response.job_id}`);
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

  return {
    syncJob,
    isSyncing,
    canSync,
    handleSync,
  };
}
