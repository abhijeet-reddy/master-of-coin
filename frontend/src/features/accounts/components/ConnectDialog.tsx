import { useId, useState } from 'react';
import { Controller } from 'react-hook-form';
import type { Account } from '@/api/types';
import { typeMeta } from '@/lib/accountTypes';
import { Button, ButtonVariant, Dialog, EmptyState, Field, Input, Select, Skeleton } from '@/ui';
import { ENV_OPTIONS } from '../forms/accountForm';
import {
  useAllAccounts,
  useBankProviders,
  useInvestmentProviders,
} from '../hooks/useAccountQueries';
import { useConnectForm } from '../hooks/useConnectForm';
import { PROVIDER_NAMES, ProviderKind, providerState } from '../lib/accountsModel';
import { isBankType } from '@/lib/accountTypes';
import { Notice } from './Notice';
import { NoticeKind } from './noticeKind';
import styles from './Accounts.module.css';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Preselected; without one the dialog asks which account. */
  account?: Account;
}

/** Accounts that can take a provider right now: bank or investment type, active, nothing connected. */
function useConnectable() {
  const accounts = useAllAccounts();
  const banks = useBankProviders();
  const investments = useInvestmentProviders();
  const ready = !!accounts.data && !!banks.data && !!investments.data;
  const list = ready
    ? accounts.data.filter((a) => providerState(a, banks.data, investments.data).connectable)
    : [];
  return { list, ready, error: accounts.error ?? banks.error ?? investments.error };
}

/** Connect TrueLayer (bank accounts) or Trading 212 (investment accounts). */
export function ConnectDialog({ open, onOpenChange, account }: Props) {
  const formId = useId();
  const connectable = useConnectable();
  const [pickedId, setPickedId] = useState<string | null>(account?.id ?? null);
  const picked = account ?? connectable.list.find((a) => a.id === pickedId);
  const c = useConnectForm(picked, () => onOpenChange(false));
  const kind = !picked
    ? ProviderKind.None
    : isBankType(picked.account_type)
      ? ProviderKind.Bank
      : ProviderKind.Investment;
  const errors = c.form.formState.errors;

  const footer = (
    <>
      <Button onClick={() => onOpenChange(false)} disabled={c.pending}>
        Cancel
      </Button>
      {kind === ProviderKind.Bank ? (
        <Button variant={ButtonVariant.Primary} loading={c.pending} onClick={c.connectBank}>
          Continue to {PROVIDER_NAMES.bank}
        </Button>
      ) : null}
      {kind === ProviderKind.Investment ? (
        <Button type="submit" form={formId} variant={ButtonVariant.Primary} loading={c.pending}>
          Connect {PROVIDER_NAMES.investment}
        </Button>
      ) : null}
    </>
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !c.pending && onOpenChange(o)}
      title={picked ? `Connect ${picked.name}` : 'Connect provider'}
      description="Sync balances and transactions from your bank or brokerage."
      footer={footer}
    >
      <div className={styles.form}>
        {!account ? (
          <Field label="Account" required>
            {connectable.ready ? (
              <Select
                value={pickedId ?? undefined}
                onValueChange={setPickedId}
                placeholder={
                  connectable.list.length ? 'Pick an account' : 'No account can be connected'
                }
                disabled={!connectable.list.length}
                options={connectable.list.map((a) => ({
                  value: a.id,
                  label: `${a.name} (${typeMeta(a.account_type).label})`,
                }))}
              />
            ) : (
              <Skeleton height={36} />
            )}
          </Field>
        ) : null}
        {!account && connectable.ready && !connectable.list.length ? (
          <EmptyState
            compact
            title="Nothing to connect"
            description="Banks connect to checking, savings and credit card accounts; Trading 212 to investment accounts. Every one of those is connected already."
          />
        ) : null}
        {kind === ProviderKind.Bank ? (
          <Notice kind={NoticeKind.Info}>
            You will sign in with your bank on {PROVIDER_NAMES.bank}, then come back here to pick
            which bank account feeds {picked?.name}.
          </Notice>
        ) : null}
        {kind === ProviderKind.Investment ? (
          <form
            id={formId}
            className={styles.form}
            onSubmit={(e) => void c.submitBroker(e)}
            noValidate
          >
            <p className={styles.hint}>
              Create an API key in Trading 212 under Settings, API. Read access to the portfolio is
              enough.
            </p>
            <div className={styles.two}>
              <Field label="API key" required error={errors.api_key?.message}>
                <Input type="password" autoComplete="off" {...c.form.register('api_key')} />
              </Field>
              <Field label="API secret" required error={errors.api_secret?.message}>
                <Input type="password" autoComplete="off" {...c.form.register('api_secret')} />
              </Field>
            </div>
            <Field label="Environment" required>
              <Controller
                control={c.form.control}
                name="environment"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    options={ENV_OPTIONS}
                  />
                )}
              />
            </Field>
            {errors.root?.message ? <Notice>{errors.root.message}</Notice> : null}
          </form>
        ) : null}
        {connectable.error && !account ? (
          <Notice>Couldn&apos;t load your accounts. Close and try again.</Notice>
        ) : null}
      </div>
    </Dialog>
  );
}
