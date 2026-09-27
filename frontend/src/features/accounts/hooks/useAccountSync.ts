import type { Account } from '@/api/types';
import { SyncAction, type ProviderState } from '../lib/accountsModel';
import { useSyncBank, useSyncPortfolio } from './useAccountMutations';

/** The one sync action an account offers ("Sync bank" or "Sync portfolio"), or none. */
export function useAccountSync(account: Account, provider: ProviderState) {
  const bank = useSyncBank(account, provider.id);
  const portfolio = useSyncPortfolio(account);
  if (provider.sync === SyncAction.Bank) {
    return { label: SyncAction.Bank, run: () => bank.mutate(), pending: bank.isPending };
  }
  if (provider.sync === SyncAction.Portfolio) {
    return { label: SyncAction.Portfolio, run: portfolio.start, pending: portfolio.syncing };
  }
  return null;
}
