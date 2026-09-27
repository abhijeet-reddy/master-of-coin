import { useId } from 'react';
import type { Person } from '@/api/types';
import { Button, ButtonVariant, Dialog, Field, Input, Textarea } from '@/ui';
import { usePersonForm } from '../hooks/usePersonForm';
import { Notice } from './Notice';
import styles from './People.module.css';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  person?: Person;
}

/** Add or edit a person: name and optional contact details. */
export function PersonFormDialog({ open, onOpenChange, person }: Props) {
  const formId = useId();
  const f = usePersonForm(person, () => onOpenChange(false));
  const { register, formState } = f.form;
  const errors = formState.errors;
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !f.saving && onOpenChange(o)}
      title={f.creating ? 'Add person' : 'Edit person'}
      description={f.creating ? 'Someone you share expenses with.' : undefined}
      footer={
        <>
          <Button onClick={() => onOpenChange(false)} disabled={f.saving}>
            Cancel
          </Button>
          <Button type="submit" form={formId} variant={ButtonVariant.Primary} loading={f.saving}>
            {f.creating ? 'Add person' : 'Save changes'}
          </Button>
        </>
      }
    >
      <form id={formId} className={styles.form} onSubmit={(e) => void f.submit(e)} noValidate>
        <Field label="Name" required error={errors.name?.message}>
          <Input autoComplete="off" placeholder="e.g. Alex" {...register('name')} />
        </Field>
        <div className={styles.two}>
          <Field label="Email" error={errors.email?.message}>
            <Input type="email" autoComplete="off" {...register('email')} />
          </Field>
          <Field label="Phone" error={errors.phone?.message}>
            <Input type="tel" autoComplete="off" {...register('phone')} />
          </Field>
        </div>
        <Field label="Notes" error={errors.notes?.message}>
          <Textarea className={styles.textarea} {...register('notes')} />
        </Field>
        {errors.root?.message ? <Notice>{errors.root.message}</Notice> : null}
      </form>
    </Dialog>
  );
}
