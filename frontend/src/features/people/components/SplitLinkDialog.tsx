import { useEffect, useId, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { toApiError } from '@/api/client';
import type { Person } from '@/api/types';
import { Button, ButtonVariant, Combobox, Dialog, ErrorState, Field, Select, Skeleton } from '@/ui';
import { useLinkSplit } from '../hooks/usePeopleMutations';
import { useProviderFriends, useSplitConfig, useSplitProviders } from '../hooks/usePeopleQueries';
import { activeProviders, friendOptions, providerLabel, suggestFriend } from '../lib/splitLink';
import { Notice } from './Notice';
import styles from './People.module.css';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  person: Person;
}

/** Link a person to a friend on a connected Splitwise or SplitPro account, so splits sync. */
export function SplitLinkDialog({ open, onOpenChange, person }: Props) {
  const formId = useId();
  const providersQ = useSplitProviders();
  const configQ = useSplitConfig(person.id);
  const providers = useMemo(() => activeProviders(providersQ.data ?? []), [providersQ.data]);
  const current = configQ.data ?? null;
  const [providerId, setProviderId] = useState('');
  const [friendId, setFriendId] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const link = useLinkSplit(person);

  // Start on the linked provider, else the only one there is.
  useEffect(() => {
    if (providerId || configQ.isPending) return;
    const start = current?.split_provider_id ?? providers[0]?.id;
    if (start) setProviderId(start);
  }, [providerId, current, providers, configQ.isPending]);

  const friendsQ = useProviderFriends(providerId);
  const options = useMemo(() => friendOptions(friendsQ.data ?? []), [friendsQ.data]);

  useEffect(() => {
    if (touched || !friendsQ.data) return;
    const linked =
      current && current.split_provider_id === providerId ? current.external_user_id : null;
    setFriendId(linked ?? suggestFriend(friendsQ.data, person));
  }, [friendsQ.data, current, providerId, person, touched]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!providerId || !friendId) {
      setError('Choose a provider and a friend');
      return;
    }
    setError(null);
    try {
      await link.mutateAsync({ split_provider_id: providerId, external_user_id: friendId });
      onOpenChange(false);
    } catch (err) {
      setError(toApiError(err).message);
    }
  };

  const loading = providersQ.isPending || configQ.isPending;
  const none = providersQ.data !== undefined && providers.length === 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !link.isPending && onOpenChange(o)}
      title={current ? 'Change split provider link' : 'Link split provider'}
      description={`Splits with ${person.name} sync to the friend you pick.`}
      footer={
        <>
          <Button onClick={() => onOpenChange(false)} disabled={link.isPending}>
            Cancel
          </Button>
          <Button
            type="submit"
            form={formId}
            variant={ButtonVariant.Primary}
            loading={link.isPending}
            disabled={none || loading}
          >
            {current ? 'Save link' : 'Link'}
          </Button>
        </>
      }
    >
      <form id={formId} className={styles.form} onSubmit={(e) => void submit(e)} noValidate>
        {providersQ.error || configQ.error ? (
          <ErrorState
            compact
            error={providersQ.error ?? configQ.error}
            title="Could not load split providers"
            onRetry={() => {
              void providersQ.refetch();
              void configQ.refetch();
            }}
          />
        ) : loading ? (
          <Skeleton lines={2} />
        ) : none ? (
          <p className={styles.confirmText}>
            No Splitwise or SplitPro account is connected.{' '}
            <Link to="/settings?tab=split">Connect one in Settings</Link>.
          </p>
        ) : (
          <>
            <Field label="Provider" required>
              <Select
                value={providerId || undefined}
                onValueChange={(v) => {
                  setProviderId(v);
                  setTouched(false);
                  setFriendId(null);
                }}
                options={providers.map((p) => ({
                  value: p.id,
                  label: providerLabel(p.provider_type),
                }))}
              />
            </Field>
            <Field
              label="Friend"
              required
              hint={friendsQ.data ? `${options.length} friends` : undefined}
            >
              {friendsQ.error ? (
                <ErrorState
                  compact
                  error={friendsQ.error}
                  title="Could not load friends"
                  onRetry={() => void friendsQ.refetch()}
                />
              ) : !friendsQ.data ? (
                <Skeleton height={36} />
              ) : (
                <Combobox
                  value={friendId}
                  onChange={(v) => {
                    setTouched(true);
                    setFriendId(v);
                  }}
                  options={options}
                  placeholder="Choose a friend"
                  searchPlaceholder="Search friends"
                  emptyText="No friends match"
                />
              )}
            </Field>
          </>
        )}
        {error ? <Notice>{error}</Notice> : null}
      </form>
    </Dialog>
  );
}
