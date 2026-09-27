import { useId } from 'react';
import { Button, ButtonVariant, Dialog, Field, Input } from '@/ui';
import { useSplitProForm } from '../hooks/useIntegrations';
import { Notice } from './Notice';
import styles from './Settings.module.css';

/** Connect SplitPro by the email of your SplitPro account. */
export function SplitProDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const formId = useId();
  const f = useSplitProForm(() => onOpenChange(false));
  const { register, formState } = f.form;
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !f.saving && onOpenChange(o)}
      title="Connect SplitPro"
      description="The server already knows where SplitPro runs; it only needs to know which account is yours."
      footer={
        <>
          <Button onClick={() => onOpenChange(false)} disabled={f.saving}>
            Cancel
          </Button>
          <Button type="submit" form={formId} variant={ButtonVariant.Primary} loading={f.saving}>
            Connect
          </Button>
        </>
      }
    >
      <form id={formId} className={styles.form} noValidate onSubmit={(e) => void f.submit(e)}>
        <Field label="SplitPro email" required error={formState.errors.email?.message}>
          <Input type="email" autoComplete="email" {...register('email')} />
        </Field>
        {formState.errors.root?.message ? <Notice>{formState.errors.root.message}</Notice> : null}
      </form>
    </Dialog>
  );
}
