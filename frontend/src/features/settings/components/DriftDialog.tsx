import { useId } from 'react';
import { Controller } from 'react-hook-form';
import { Button, ButtonVariant, DatePicker, Dialog, Field } from '@/ui';
import { useDriftForm } from '../hooks/useIntegrations';
import { Notice } from './Notice';
import styles from './Settings.module.css';

/** Pick a window of dates; the job compares local splits with the provider across it. */
export function DriftDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const formId = useId();
  const f = useDriftForm();
  const { control, formState } = f.form;
  const errors = formState.errors;
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !f.saving && onOpenChange(o)}
      title="Check for drift"
      description="Compares your split transactions with the split provider and lists what differs. Nothing is changed."
      footer={
        <>
          <Button onClick={() => onOpenChange(false)} disabled={f.saving}>
            Cancel
          </Button>
          <Button type="submit" form={formId} variant={ButtonVariant.Primary} loading={f.saving}>
            Start check
          </Button>
        </>
      }
    >
      <form id={formId} className={styles.form} noValidate onSubmit={(e) => void f.submit(e)}>
        <div className={styles.two}>
          <Field label="From" required error={errors.start_date?.message}>
            <Controller
              control={control}
              name="start_date"
              render={({ field }) => (
                <DatePicker
                  required
                  value={field.value || null}
                  onChange={(v) => field.onChange(v ?? '')}
                />
              )}
            />
          </Field>
          <Field label="To" required error={errors.end_date?.message}>
            <Controller
              control={control}
              name="end_date"
              render={({ field }) => (
                <DatePicker
                  required
                  value={field.value || null}
                  onChange={(v) => field.onChange(v ?? '')}
                />
              )}
            />
          </Field>
        </div>
        {errors.root?.message ? <Notice>{errors.root.message}</Notice> : null}
      </form>
    </Dialog>
  );
}
