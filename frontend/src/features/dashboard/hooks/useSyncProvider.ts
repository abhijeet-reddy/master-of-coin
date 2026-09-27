import { useMutation, useQueryClient } from '@tanstack/react-query';
import { startSync } from '@/api/bankProviders';
import { startPortfolioSync } from '@/api/investmentProviders';
import { keys } from '@/api/keys';
import { toast } from '@/ui';
import { ProviderKind, type ProviderLink } from '../lib/dashboardModel';

/** Queue a sync for one provider link; the worker picks it up and the jobs list shows progress. */
export function useSyncProvider(link: ProviderLink) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      link.kind === ProviderKind.Bank
        ? startSync(link.id, {})
        : startPortfolioSync({ account_id: link.accountId }),
    onSuccess: () => {
      toast.success('Sync started', {
        description: `${link.accountName} is syncing in the background.`,
      });
      void qc.invalidateQueries({ queryKey: keys.jobs.all });
      void qc.invalidateQueries({
        queryKey: link.kind === ProviderKind.Bank ? keys.bankProviders : keys.investmentProviders,
      });
    },
    onError: (error) => {
      toast.error(`Couldn't sync ${link.accountName}`, {
        description: error instanceof Error ? error.message : undefined,
      });
    },
  });
}
