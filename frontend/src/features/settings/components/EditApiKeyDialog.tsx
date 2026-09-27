import { useId } from 'react';
import { Controller } from 'react-hook-form';
import type { ApiKey } from '@/api/types/apiKey';
import { usePreferences } from '@/lib/preferences';
import { Button, ButtonVariant, Dialog } from '@/ui';
import { useEditApiKey } from '../hooks/useApiKeyForms';
import { EDIT_EXPIRY } from '../lib/apiKeyModel';
import { KeyDetailsFields } from './KeyDetailsFields';
import { Notice } from './Notice';
import { ScopeGrid } from './ScopeGrid';
import styles from './Settings.module.css';

interface Props {
  apiKey: ApiKey;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Rename, re-scope, or set a new expiry. The expiry only moves when a new one is picked. */
export function EditApiKeyDialog({ apiKey, open, onOpenChange }: Props) {
  const formId = useId();
  const { fmt } = usePreferences();
  const f = useEditApiKey(apiKey, () => onOpenChange(false));
  const errors = f.form.formState.errors;
  const current = apiKey.expires_at
    ? `Currently expires ${fmt.date(apiKey.expires_at)}`
    : 'Currently never expires';
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !f.saving && onOpenChange(o)}
      title="Edit API key"
      description={`${apiKey.key_prefix}...`}
      footer={
        <>
          <Button onClick={() => onOpenChange(false)} disabled={f.saving}>
            Cancel
          </Button>
          <Button type="submit" form={formId} variant={ButtonVariant.Primary} loading={f.saving}>
            Save changes
          </Button>
        </>
      }
    >
      <form id={formId} className={styles.form} noValidate onSubmit={(e) => void f.submit(e)}>
        <KeyDetailsFields
          form={f.form}
          choices={EDIT_EXPIRY}
          hint={`${current}. A new choice counts from today.`}
        />
        <Controller
          control={f.form.control}
          name="scopes"
          render={({ field }) => (
            <ScopeGrid
              value={field.value}
              onChange={field.onChange}
              error={errors.scopes?.message}
            />
          )}
        />
        {errors.root?.message ? <Notice>{errors.root.message}</Notice> : null}
      </form>
    </Dialog>
  );
}
