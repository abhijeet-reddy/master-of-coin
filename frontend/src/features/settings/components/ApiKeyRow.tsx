import { Pencil } from 'lucide-react';
import { ApiKeyStatus, type ApiKey } from '@/api/types/apiKey';
import { usePreferences } from '@/lib/preferences';
import { Badge, Button, ButtonVariant, ControlSize, IconButton } from '@/ui';
import { normalizeScopes, scopeSummary, STATUS_LABEL, STATUS_TONE } from '../lib/apiKeyModel';
import styles from './Settings.module.css';

interface Props {
  apiKey: ApiKey;
  onEdit: (k: ApiKey) => void;
  onRevoke: (k: ApiKey) => void;
}

/** One key: name, status, prefix, scopes and dates, with edit and revoke while active. */
export function ApiKeyRow({ apiKey: k, onEdit, onRevoke }: Props) {
  const { fmt } = usePreferences();
  const active = k.status === ApiKeyStatus.Active;
  const expiry = k.expires_at
    ? `${k.status === ApiKeyStatus.Expired ? 'Expired' : 'Expires'} ${fmt.date(k.expires_at)}`
    : 'Never expires';
  const used = k.last_used_at ? `Last used ${fmt.relative(k.last_used_at)}` : 'Never used';
  return (
    <li className={styles.row}>
      <div className={styles.rowMain}>
        <span className={styles.rowTitle}>
          <span>{k.name}</span>
          <Badge tone={STATUS_TONE[k.status]}>{STATUS_LABEL[k.status]}</Badge>
        </span>
        <span className={styles.rowSub}>
          {k.key_prefix}... / {scopeSummary(normalizeScopes(k.scopes))}
        </span>
        <span className={styles.rowSub}>
          Created {fmt.date(k.created_at)} / {expiry} / {used}
        </span>
      </div>
      {active ? (
        <div className={styles.rowActions}>
          <IconButton
            label={`Edit ${k.name}`}
            icon={<Pencil aria-hidden />}
            onClick={() => onEdit(k)}
          />
          <Button
            size={ControlSize.Sm}
            variant={ButtonVariant.Danger}
            aria-label={`Revoke ${k.name}`}
            onClick={() => onRevoke(k)}
          >
            Revoke
          </Button>
        </div>
      ) : null}
    </li>
  );
}
