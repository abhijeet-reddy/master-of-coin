import { useEffect, useState } from 'react';
import { toApiError } from '@/api/client';
import type { Transaction } from '@/api/types';
import { DateStyle } from '@/lib/format';
import { usePreferences } from '@/lib/preferences';
import {
  Badge,
  Button,
  ButtonVariant,
  Combobox,
  Dialog,
  Field,
  Input,
  Money,
  SignDisplay,
  Skeleton,
  Switch,
  Tone,
} from '@/ui';
import { buildConvertRequest, impliedRate, legGapPercent } from '../../forms/transferForm';
import { useConvertToTransfer } from '../../hooks/useTxMutations';
import { useAccounts, useConvertCandidates } from '../../hooks/useTxQueries';
import { accountOptions } from '../../lib/options';
import { AlertKind } from '../alertKind';
import { FormAlert } from '../FormAlert';
import styles from './Dialogs.module.css';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tx: Transaction;
}

/** Two amounts are the same when they agree to the cent. */
const EXACT = 0.005;

function useDebounced(value: string, delay: number) {
  const [out, setOut] = useState(value);
  useEffect(() => {
    const t = window.setTimeout(() => setOut(value), delay);
    return () => window.clearTimeout(t);
  }, [value, delay]);
  return out;
}

/**
 * Turn one transaction into a transfer: link an existing transaction on the other
 * account as the second leg, or create a new one.
 */
export function ConvertDialog({ open, onOpenChange, tx }: Props) {
  const { fmt } = usePreferences();
  const accounts = useAccounts();
  const convert = useConvertToTransfer();
  const [accountId, setAccountId] = useState('');
  const [candidateId, setCandidateId] = useState<string | null>(null);
  const [createNew, setCreateNew] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [search, setSearch] = useState('');
  const [different, setDifferent] = useState(false);
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);
  const q = useDebounced(search, 400);
  const candidatesQuery = useConvertCandidates(tx, accountId, q);

  const own = accounts.data?.find((a) => a.id === tx.account_id);
  const counterpart = accounts.data?.find((a) => a.id === accountId);
  const ownCur = own ? String(own.currency) : undefined;
  const cpCur = counterpart ? String(counterpart.currency) : undefined;
  const cross = !!counterpart && !!own && cpCur !== ownCur;
  const originalAbs = Math.abs(Number(tx.amount));
  const credit = Number(tx.amount) > 0;
  const candidates = candidatesQuery.data?.candidates ?? [];
  const total = candidatesQuery.data?.total ?? 0;
  const searching = q.trim().length > 0;
  const linking = !createNew && !!candidateId;
  const nothingToLink = !candidatesQuery.isLoading && candidates.length === 0 && !searching;
  const canSubmit = !!accountId && (createNew || linking || nothingToLink);
  const showAmount = (createNew || nothingToLink) && (cross || different);
  const gap = !cross && different ? legGapPercent(String(originalAbs), amount) : null;
  const rate = cross ? impliedRate(String(originalAbs), amount) : null;

  const pickAccount = (id: string) => {
    setAccountId(id);
    setCandidateId(null);
    setCreateNew(false);
    setShowSearch(false);
    setSearch('');
    setDifferent(false);
    setAmount('');
  };

  const submit = async () => {
    setError(null);
    try {
      await convert.mutateAsync({
        id: tx.id,
        req: buildConvertRequest({
          accountId,
          candidateId,
          createNew: createNew || nothingToLink,
          cross,
          counterpartAmount: amount,
          different,
        }),
      });
      onOpenChange(false);
    } catch (err) {
      setError(toApiError(err).message);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !convert.isPending && onOpenChange(o)}
      title="Convert to transfer"
      description={
        credit
          ? 'This credit will be recorded as money transferred from the account you pick.'
          : 'This debit will be recorded as money transferred to the account you pick.'
      }
      footer={
        <>
          <Button onClick={() => onOpenChange(false)} disabled={convert.isPending}>
            Cancel
          </Button>
          <Button
            variant={ButtonVariant.Primary}
            onClick={() => void submit()}
            disabled={!canSubmit}
            loading={convert.isPending}
          >
            {linking ? 'Link transactions' : 'Convert'}
          </Button>
        </>
      }
    >
      <div className={styles.form}>
        <Field label={credit ? 'From account' : 'To account'} required>
          <Combobox
            value={accountId || null}
            onChange={(v) => pickAccount(v ?? '')}
            options={accountOptions(accounts.data, {
              excludeDebt: true,
              excludeIds: [tx.account_id],
            })}
            placeholder="Pick an account"
            searchPlaceholder="Search accounts"
          />
        </Field>

        {counterpart && !createNew ? (
          <div className={styles.section}>
            <div className={styles.sectionHead}>
              <p className={styles.kicker}>[ Link an existing transaction ]</p>
            </div>
            {showSearch ? (
              <Field
                label="Search this account"
                hint="Title or notes. Finds transactions outside the suggested window."
              >
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search existing transactions"
                  autoFocus
                />
              </Field>
            ) : (
              <button type="button" className={styles.linkBtn} onClick={() => setShowSearch(true)}>
                Search this account instead
              </button>
            )}

            {candidatesQuery.isError ? (
              <FormAlert>{toApiError(candidatesQuery.error).message}</FormAlert>
            ) : candidatesQuery.isLoading ? (
              <Skeleton lines={3} />
            ) : candidates.length > 0 ? (
              <>
                <p className={styles.hint}>
                  {total > candidates.length
                    ? searching
                      ? `Showing ${candidates.length} of ${total} results. Narrow your search.`
                      : `Showing ${candidates.length} of ${total} matches.`
                    : searching
                      ? 'Matching transactions on this account.'
                      : 'Suggested transactions to link.'}
                </p>
                <div
                  className={styles.candidates}
                  role="radiogroup"
                  aria-label="Transaction to link"
                >
                  {candidates.map((c) => {
                    const abs = Math.abs(Number(c.amount));
                    const diff = Math.abs(abs - originalAbs);
                    return (
                      <label key={c.id} className={styles.candidate}>
                        <input
                          type="radio"
                          name="candidate"
                          checked={candidateId === c.id}
                          onChange={() => setCandidateId(c.id)}
                        />
                        <span>
                          {c.title || 'Untitled'}
                          <span className={styles.candMeta}>
                            {fmt.date(c.date, DateStyle.Medium)}
                          </span>
                        </span>
                        <span className={styles.candAmt}>
                          <Money amount={c.amount} currency={cpCur} sign={SignDisplay.Always} />
                          {diff < EXACT ? (
                            <Badge tone={Tone.Pos}>Exact match</Badge>
                          ) : (
                            <Badge tone={Tone.Warn}>
                              {fmt.money(diff, cpCur)} {abs < originalAbs ? 'less' : 'more'}
                            </Badge>
                          )}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </>
            ) : (
              <p className={styles.hint}>
                {searching
                  ? 'No matching transactions on this account.'
                  : 'No existing transactions to link. A new one will be created.'}
              </p>
            )}
            {candidates.length > 0 || searching ? (
              <button
                type="button"
                className={styles.linkBtn}
                onClick={() => {
                  setCreateNew(true);
                  setCandidateId(null);
                }}
              >
                Create a new transaction instead
              </button>
            ) : null}
          </div>
        ) : null}

        {counterpart && (createNew || nothingToLink) ? (
          <div className={styles.section}>
            <div className={styles.sectionHead}>
              <p className={styles.kicker}>[ New counterpart transaction ]</p>
              {createNew ? (
                <button
                  type="button"
                  className={styles.linkBtn}
                  onClick={() => setCreateNew(false)}
                >
                  Link an existing one instead
                </button>
              ) : null}
            </div>
            {cross ? (
              <FormAlert kind={AlertKind.Info}>
                The accounts use different currencies. Enter the amount on {counterpart.name}, or
                leave it blank to use the current rate.
              </FormAlert>
            ) : (
              <Switch
                checked={different}
                onCheckedChange={setDifferent}
                label="Different amount on the other account"
                description="If it differs from this transaction (e.g. a discount or fee)."
              />
            )}
            {showAmount ? (
              <Field
                label={`Amount on ${counterpart.name}`}
                hint={rate ? `1 ${ownCur} = ${rate.toFixed(4)} ${cpCur}` : undefined}
              >
                <Input
                  numeric
                  inputMode="decimal"
                  leading={cpCur}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                />
              </Field>
            ) : null}
            {gap ? (
              <FormAlert kind={AlertKind.Warn}>
                The amounts differ by {gap}%. Check that is right before converting.
              </FormAlert>
            ) : null}
          </div>
        ) : null}

        {error ? <FormAlert>{error}</FormAlert> : null}
      </div>
    </Dialog>
  );
}
