import type { Account } from '@/api/types';
import { toNumber } from '@/lib/format';
import { usePreferences } from '@/lib/preferences';
import { ConfirmDialog } from '@/ui';
import { useArchiveAccount, useDeleteAccount } from '../hooks/useAccountMutations';
import { archiveNeedsWarning, isArchived } from '../lib/accountsModel';
import { Notice } from './Notice';
import { NoticeKind } from './noticeKind';
import styles from './Accounts.module.css';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account: Account;
}

/** Archive (or unarchive). A non-zero balance gets a warning: it still counts toward net worth. */
export function ArchiveAccountDialog({ open, onOpenChange, account }: Props) {
  const { fmt } = usePreferences();
  const archive = useArchiveAccount();
  const archiving = !isArchived(account);
  const warn = archiving && archiveNeedsWarning(account);
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={archiving ? `Archive ${account.name}?` : `Unarchive ${account.name}?`}
      confirmLabel={archiving ? 'Archive account' : 'Unarchive account'}
      destructive={false}
      onConfirm={() => archive.mutateAsync({ account, archive: archiving })}
    >
      <div className={styles.confirm}>
        {archiving ? (
          <p>
            It leaves the account pickers and the list, and it can no longer sync. Its transactions
            stay, and you can unarchive it at any time.
          </p>
        ) : (
          <p>It comes back to the account pickers and the list, and it can sync again.</p>
        )}
        {warn ? (
          <Notice kind={NoticeKind.Warn}>
            The balance is {fmt.money(toNumber(account.balance), String(account.currency))}.
            Archived accounts still count toward net worth; move or settle the balance first if you
            want it gone.
          </Notice>
        ) : null}
      </div>
    </ConfirmDialog>
  );
}

/** Delete for good. The server refuses when the account has transactions; the error says so inline. */
export function DeleteAccountDialog({
  open,
  onOpenChange,
  account,
  onDeleted,
}: Props & { onDeleted?: () => void }) {
  const del = useDeleteAccount();
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Delete ${account.name}?`}
      confirmLabel="Delete account"
      onConfirm={async () => {
        await del.mutateAsync(account);
        onDeleted?.();
      }}
    >
      <p className={styles.confirmText}>
        This cannot be undone. Only accounts with no transactions can be deleted; archive it instead
        to keep its history.
      </p>
    </ConfirmDialog>
  );
}
