import { Plus } from 'lucide-react';
import { useState } from 'react';
import type { ApiKey } from '@/api/types/apiKey';
import {
  Button,
  ButtonVariant,
  ConfirmDialog,
  ControlSize,
  EmptyState,
  Panel,
  PanelState,
  Skeleton,
} from '@/ui';
import { useRevokeApiKey } from '../hooks/useApiKeyForms';
import { useApiKeys } from '../hooks/useSettingsQueries';
import { sortKeys } from '../lib/apiKeyModel';
import { ApiKeyRow } from './ApiKeyRow';
import { CreateApiKeyDialog } from './CreateApiKeyDialog';
import { EditApiKeyDialog } from './EditApiKeyDialog';
import styles from './Settings.module.css';

enum KeyDialog {
  Create = 'create',
  Edit = 'edit',
  Revoke = 'revoke',
}

type Open =
  | { kind: KeyDialog.Create }
  | { kind: KeyDialog.Edit | KeyDialog.Revoke; key: ApiKey }
  | null;

/** Keys for scripts and automations, each scoped to what it may read and change. */
export function ApiKeysTab() {
  const query = useApiKeys();
  const revoke = useRevokeApiKey();
  const [open, setOpen] = useState<Open>(null);
  const create = (
    <Button
      size={ControlSize.Sm}
      variant={ButtonVariant.Primary}
      icon={<Plus aria-hidden />}
      onClick={() => setOpen({ kind: KeyDialog.Create })}
    >
      Create API key
    </Button>
  );
  const close = () => setOpen(null);
  return (
    <div className={styles.tabBody}>
      <Panel title="API keys" flush actions={query.data?.length ? create : null}>
        <PanelState
          query={query}
          skeleton={
            <div className={styles.row}>
              <Skeleton lines={4} height={12} />
            </div>
          }
          empty={(list) =>
            list.length === 0 ? (
              <EmptyState
                compact
                title="No API keys"
                description="Create a key to let a script or automation use this account, limited to the resources you choose."
                action={create}
              />
            ) : null
          }
        >
          {(list) => (
            <ul className={styles.list}>
              {sortKeys(list).map((k) => (
                <ApiKeyRow
                  key={k.id}
                  apiKey={k}
                  onEdit={(key) => setOpen({ kind: KeyDialog.Edit, key })}
                  onRevoke={(key) => setOpen({ kind: KeyDialog.Revoke, key })}
                />
              ))}
            </ul>
          )}
        </PanelState>
      </Panel>
      <CreateApiKeyDialog
        open={open?.kind === KeyDialog.Create}
        onOpenChange={(o) => !o && close()}
      />
      {open?.kind === KeyDialog.Edit ? (
        <EditApiKeyDialog
          key={open.key.id}
          apiKey={open.key}
          open
          onOpenChange={(o) => !o && close()}
        />
      ) : null}
      <ConfirmDialog
        open={open?.kind === KeyDialog.Revoke}
        onOpenChange={(o) => !o && close()}
        title="Revoke API key"
        confirmLabel="Revoke key"
        onConfirm={async () => {
          if (open?.kind === KeyDialog.Revoke) await revoke.mutateAsync(open.key);
        }}
      >
        {open?.kind === KeyDialog.Revoke ? `"${open.key.name}"` : 'This key'} stops working
        immediately. Anything using it will be refused. This cannot be undone.
      </ConfirmDialog>
    </div>
  );
}
