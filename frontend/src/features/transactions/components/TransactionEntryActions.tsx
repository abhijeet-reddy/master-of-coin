import { PageActions } from '@/app/shell/PageActions';
import { TxDialogsProvider } from './dialogs/TxDialogsProvider';
import { EntryButtons } from './EntryButtons';

/** Page-header entry points for pages outside the ledger (the dashboard). Brings its own dialog host. */
export function TransactionEntryActions({ accountId }: { accountId?: string }) {
  return (
    <TxDialogsProvider>
      <PageActions>
        <EntryButtons accountId={accountId} />
      </PageActions>
    </TxDialogsProvider>
  );
}
