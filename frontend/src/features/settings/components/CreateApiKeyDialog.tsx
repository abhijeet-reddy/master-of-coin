import { Check, Copy } from 'lucide-react';
import { useId, useState } from 'react';
import { Controller } from 'react-hook-form';
import { Button, ButtonVariant, Dialog, toast } from '@/ui';
import { CreateStep, useCreateApiKey } from '../hooks/useApiKeyForms';
import { CREATE_EXPIRY } from '../lib/apiKeyModel';
import { KeyDetailsFields } from './KeyDetailsFields';
import { Notice } from './Notice';
import { ScopeGrid } from './ScopeGrid';
import styles from './Settings.module.css';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const DESCRIPTION: Record<CreateStep, string> = {
  [CreateStep.Details]: 'Step 1 of 2: name the key and choose when it expires.',
  [CreateStep.Scopes]: 'Step 2 of 2: choose what the key can read and change.',
  [CreateStep.Created]: 'Copy the key now. It is shown only once.',
};

/** Create a key in two steps, then show it once with a copy button. */
export function CreateApiKeyDialog({ open, onOpenChange }: Props) {
  const formId = useId();
  const f = useCreateApiKey();
  const close = (o: boolean) => {
    if (f.saving) return;
    onOpenChange(o);
    if (!o) f.reset();
  };
  const errors = f.form.formState.errors;
  return (
    <Dialog
      open={open}
      onOpenChange={close}
      title={f.step === CreateStep.Created ? 'API key created' : 'Create API key'}
      description={DESCRIPTION[f.step]}
      footer={<Footer f={f} formId={formId} close={() => close(false)} />}
    >
      {f.step === CreateStep.Created && f.created ? (
        <CreatedKey secret={f.created.key} />
      ) : (
        <form id={formId} className={styles.form} noValidate onSubmit={(e) => void f.submit(e)}>
          {f.step === CreateStep.Details ? (
            <KeyDetailsFields form={f.form} choices={CREATE_EXPIRY} />
          ) : (
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
          )}
          {errors.root?.message ? <Notice>{errors.root.message}</Notice> : null}
        </form>
      )}
    </Dialog>
  );
}

function Footer({
  f,
  formId,
  close,
}: {
  f: ReturnType<typeof useCreateApiKey>;
  formId: string;
  close: () => void;
}) {
  if (f.step === CreateStep.Created) {
    return (
      <Button variant={ButtonVariant.Primary} onClick={close}>
        Done
      </Button>
    );
  }
  if (f.step === CreateStep.Details) {
    return (
      <>
        <Button onClick={close}>Cancel</Button>
        <Button variant={ButtonVariant.Primary} onClick={() => void f.next()}>
          Next
        </Button>
      </>
    );
  }
  return (
    <>
      <Button onClick={f.back} disabled={f.saving}>
        Back
      </Button>
      <Button type="submit" form={formId} variant={ButtonVariant.Primary} loading={f.saving}>
        Create key
      </Button>
    </>
  );
}

function CreatedKey({ secret }: { secret: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(secret);
      setCopied(true);
    } catch {
      toast.error("Couldn't copy the key", { description: 'Select it and copy it by hand.' });
    }
  };
  return (
    <div className={styles.form}>
      <div className={styles.secret}>
        <code aria-label="New API key">{secret}</code>
        <Button
          icon={copied ? <Check aria-hidden /> : <Copy aria-hidden />}
          onClick={() => void copy()}
        >
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>
      <p className={styles.warn}>
        Store it somewhere safe. Once this dialog closes the key cannot be shown again; if it is
        lost, revoke it and create a new one.
      </p>
    </div>
  );
}
