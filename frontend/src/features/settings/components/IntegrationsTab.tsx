import { useState } from 'react';
import { Link } from 'react-router-dom';
import { SplitProviderType, type SplitProvider } from '@/api/types';
import {
  Button,
  ButtonVariant,
  ControlSize,
  EmptyState,
  Panel,
  PanelState,
  Skeleton,
  buttonClass,
} from '@/ui';
import { useConnectSplitwise } from '../hooks/useIntegrations';
import { useProviderLinks, useSplitProviders } from '../hooks/useSettingsQueries';
import { DriftDialog } from './DriftDialog';
import { ProviderLinkRow } from './ProviderLinkRow';
import { SplitProDialog } from './SplitProDialog';
import { SplitProviderRow } from './SplitProviderRow';
import styles from './Settings.module.css';

const rows = (
  <div className={styles.row}>
    <Skeleton lines={3} height={12} />
  </div>
);

/** Split providers, drift detection, and bank or brokerage links. */
export function IntegrationsTab() {
  return (
    <div className={styles.tabBody}>
      <SplitPanel />
      <LinksPanel />
    </div>
  );
}

enum SplitDialog {
  None,
  SplitPro,
  Drift,
}

function SplitPanel() {
  const query = useSplitProviders();
  const splitwise = useConnectSplitwise();
  const [dialog, setDialog] = useState(SplitDialog.None);
  const find = (list: SplitProvider[], t: SplitProviderType) =>
    list.find((p) => p.provider_type === t && p.is_active);
  const anyConnected = !!query.data?.some((p) => p.is_active);
  return (
    <Panel
      title="Split expenses"
      flush
      actions={
        <Button
          size={ControlSize.Sm}
          variant={ButtonVariant.Ghost}
          disabled={!anyConnected}
          title={anyConnected ? undefined : 'Connect a split provider first'}
          onClick={() => setDialog(SplitDialog.Drift)}
        >
          Check for drift
        </Button>
      }
    >
      <PanelState query={query} skeleton={rows}>
        {(list) => (
          <ul className={`${styles.list} moc-stagger`}>
            <SplitProviderRow
              type={SplitProviderType.SPLITWISE}
              provider={find(list, SplitProviderType.SPLITWISE)}
              onConnect={() => splitwise.mutate()}
              connecting={splitwise.isPending}
            />
            <SplitProviderRow
              type={SplitProviderType.SPLITPRO}
              provider={find(list, SplitProviderType.SPLITPRO)}
              onConnect={() => setDialog(SplitDialog.SplitPro)}
            />
          </ul>
        )}
      </PanelState>
      <SplitProDialog
        open={dialog === SplitDialog.SplitPro}
        onOpenChange={(o) => setDialog(o ? SplitDialog.SplitPro : SplitDialog.None)}
      />
      <DriftDialog
        open={dialog === SplitDialog.Drift}
        onOpenChange={(o) => setDialog(o ? SplitDialog.Drift : SplitDialog.None)}
      />
    </Panel>
  );
}

function LinksPanel() {
  const query = useProviderLinks();
  return (
    <Panel
      title="Bank and brokerage"
      flush
      actions={query.data ? <span className={styles.meta}>{query.data.length} linked</span> : null}
    >
      <PanelState
        query={query}
        skeleton={rows}
        empty={(links) =>
          links.length === 0 ? (
            <EmptyState
              compact
              title="No bank or brokerage links"
              description="Connect a bank through TrueLayer, or Trading 212, from an account's page."
              action={
                <Link
                  to="/accounts"
                  className={buttonClass(ButtonVariant.Secondary, ControlSize.Sm)}
                >
                  Go to accounts
                </Link>
              }
            />
          ) : null
        }
      >
        {(links) => (
          <ul className={`${styles.list} moc-stagger`}>
            {links.map((l) => (
              <ProviderLinkRow key={`${l.kind}-${l.id}`} link={l} />
            ))}
          </ul>
        )}
      </PanelState>
    </Panel>
  );
}
