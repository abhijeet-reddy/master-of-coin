import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { ProviderLink } from '@/features/dashboard/lib/dashboardModel';
import { usePreferences } from '@/lib/preferences';
import { Button, ButtonVariant, ConfirmDialog, ControlSize } from '@/ui';
import { useDisconnectLink } from '../hooks/useIntegrations';
import styles from './Settings.module.css';

/** A bank or brokerage link on one account. */
export function ProviderLinkRow({ link }: { link: ProviderLink }) {
  const { fmt } = usePreferences();
  const [confirm, setConfirm] = useState(false);
  const disconnect = useDisconnectLink();
  return (
    <li className={styles.row}>
      <div className={styles.rowMain}>
        <span className={styles.rowTitle}>
          <span>{link.providerName}</span>
          <Link to={`/accounts/${link.accountId}`} className={styles.link}>
            {link.accountName}
          </Link>
        </span>
        <span className={styles.rowSub}>
          {link.lastSyncAt ? `Last synced ${fmt.relative(link.lastSyncAt)}` : 'Not synced yet'}
        </span>
      </div>
      <div className={styles.rowActions}>
        <Button
          size={ControlSize.Sm}
          variant={ButtonVariant.Danger}
          onClick={() => setConfirm(true)}
          aria-label={`Disconnect ${link.providerName} from ${link.accountName}`}
        >
          Disconnect
        </Button>
      </div>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={`Disconnect ${link.providerName}`}
        confirmLabel="Disconnect"
        onConfirm={() => disconnect.mutateAsync(link)}
      >
        {link.accountName} stops syncing from {link.providerName}. Transactions already imported
        stay. You can connect again from the account page.
      </ConfirmDialog>
    </li>
  );
}
