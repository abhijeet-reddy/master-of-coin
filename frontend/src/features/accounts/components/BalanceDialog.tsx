import { useId, useState } from 'react';
import { toApiError } from '@/api/client';
import type { Account } from '@/api/types';
import { toNumber } from '@/lib/format';
import { Button, ButtonVariant, Dialog, Field, Input } from '@/ui';
import { useSetBalance } from '../hooks/useAccountMutations';
import styles from './Accounts.module.css';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account: Account;
}

/** Investment accounts: set today's value. The server books the difference as an adjustment. */
export function BalanceDialog({ open, onOpenChange, account }: Props) {
  const formId = useId();
  const set = useSetBalance(account);
  const [value, setValue] = useState(String(toNumber(account.balance)));
  const n = Number(value);
  const invalid = value.trim() === '' || !Number.isFinite(n);
  const error = set.error ? toApiError(set.error).message : null;
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !set.isPending && onOpenChange(o)}
      title="Update value"
      description={`Today's value of ${account.name}. The difference is booked as an adjustment.`}
      footer={
        <>
          <Button onClick={() => onOpenChange(false)} disabled={set.isPending}>
            Cancel
          </Button>
          <Button
            type="submit"
            form={formId}
            variant={ButtonVariant.Primary}
            loading={set.isPending}
            disabled={invalid}
          >
            Update value
          </Button>
        </>
      }
    >
      <form
        id={formId}
        className={styles.form}
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (!invalid) set.mutate(n, { onSuccess: () => onOpenChange(false) });
        }}
      >
        <Field
          label="Current value"
          required
          error={error ?? (invalid && value !== '' ? 'Enter a number' : null)}
        >
          <Input
            numeric
            inputMode="decimal"
            leading={String(account.currency)}
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        </Field>
      </form>
    </Dialog>
  );
}
