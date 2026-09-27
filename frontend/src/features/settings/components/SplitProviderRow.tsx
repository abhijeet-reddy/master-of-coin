import { useState } from 'react';
import { SplitProviderType, type SplitProvider } from '@/api/types';
import { usePreferences } from '@/lib/preferences';
import { Badge, Button, ButtonVariant, ConfirmDialog, ControlSize, Tone } from '@/ui';
import { useDisconnectSplit } from '../hooks/useIntegrations';
import styles from './Settings.module.css';

const INFO: Record<SplitProviderType, { name: string; blurb: string }> = {
  [SplitProviderType.SPLITWISE]: {
    name: 'Splitwise',
    blurb: 'Sync split expenses to Splitwise. Connecting signs you in on splitwise.com.',
  },
  [SplitProviderType.SPLITPRO]: {
    name: 'SplitPro',
    blurb: 'Sync split expenses to the SplitPro instance this server is set up with.',
  },
};

interface Props {
  type: SplitProviderType;
  provider: SplitProvider | undefined;
  onConnect: () => void;
  connecting?: boolean;
}

/** One split provider: its state, and connect or disconnect. */
export function SplitProviderRow({ type, provider, onConnect, connecting }: Props) {
  const { fmt } = usePreferences();
  const [confirm, setConfirm] = useState(false);
  const disconnect = useDisconnectSplit();
  const info = INFO[type];
  const connected = !!provider?.is_active;
  return (
    <li className={styles.row}>
      <div className={styles.rowMain}>
        <span className={styles.rowTitle}>
          <span>{info.name}</span>
          <Badge tone={connected ? Tone.Pos : Tone.Neutral}>
            {connected ? 'Connected' : 'Not connected'}
          </Badge>
        </span>
        <span className={styles.rowSub}>
          {connected && provider ? `Connected since ${fmt.date(provider.created_at)}` : info.blurb}
        </span>
      </div>
      <div className={styles.rowActions}>
        {connected ? (
          <Button
            size={ControlSize.Sm}
            variant={ButtonVariant.Danger}
            onClick={() => setConfirm(true)}
          >
            Disconnect
          </Button>
        ) : (
          <Button
            size={ControlSize.Sm}
            variant={ButtonVariant.Primary}
            onClick={onConnect}
            loading={connecting}
            aria-label={`Connect ${info.name}`}
          >
            Connect
          </Button>
        )}
      </div>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={`Disconnect ${info.name}`}
        confirmLabel="Disconnect"
        onConfirm={() => provider && disconnect.mutateAsync(provider)}
      >
        People linked to {info.name} lose their link, and sync records for it are deleted. Your
        transactions stay as they are.
      </ConfirmDialog>
    </li>
  );
}
