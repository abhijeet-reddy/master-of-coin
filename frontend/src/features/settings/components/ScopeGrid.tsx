import type { ApiKeyScopes } from '@/api/types/apiKey';
import { ScopePermission } from '@/api/types/apiKey';
import { Checkbox } from '@/ui';
import { RESOURCES, toggleScope } from '../lib/apiKeyModel';
import styles from './Settings.module.css';

interface Props {
  value: ApiKeyScopes;
  onChange: (next: ApiKeyScopes) => void;
  error?: string;
}

/** Read and write per resource. Write does not include read; tick both for full access. */
export function ScopeGrid({ value, onChange, error }: Props) {
  return (
    <div className={styles.form}>
      <table className={styles.scopes}>
        <caption className="sr-only">Permissions for this key</caption>
        <thead>
          <tr>
            <th scope="col">Resource</th>
            <th scope="col" className={styles.check}>
              Read
            </th>
            <th scope="col" className={styles.check}>
              Write
            </th>
          </tr>
        </thead>
        <tbody>
          {RESOURCES.map((r) => (
            <tr key={r.key}>
              <th scope="row">{r.label}</th>
              {[ScopePermission.Read, ScopePermission.Write].map((p) => (
                <td key={p} className={styles.check}>
                  <Checkbox
                    aria-label={`${r.label} ${p}`}
                    checked={value[r.key].includes(p)}
                    onCheckedChange={(on) => onChange(toggleScope(value, r.key, p, on))}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {error ? (
        <p className={styles.fieldError} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
