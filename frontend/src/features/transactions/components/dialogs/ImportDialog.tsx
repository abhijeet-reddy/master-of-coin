import { CheckCircle2, FileUp } from 'lucide-react';
import { useState, type DragEvent } from 'react';
import { toApiError } from '@/api/client';
import { usePreferences } from '@/lib/preferences';
import {
  Badge,
  Button,
  ButtonVariant,
  Checkbox,
  Combobox,
  cx,
  Dialog,
  Field,
  Money,
  SignDisplay,
  Tone,
} from '@/ui';
import {
  IMPORT_STEPS,
  ImportStep,
  useImport,
  type ImportApi,
  type ImportPreload,
} from '../../hooks/useImport';
import { useAccounts } from '../../hooks/useTxQueries';
import { rowProblem } from '../../lib/importModel';
import { accountOptions, spendingAccounts } from '../../lib/options';
import { AlertKind } from '../alertKind';
import { FormAlert } from '../FormAlert';
import styles from './Dialogs.module.css';

export interface ImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId?: string;
  /**
   * Rows from elsewhere (a bank sync). Skips the upload step; the metadata is kept per row, so
   * editing a row does not drop it. Mount a fresh dialog per preload.
   */
  preload?: ImportPreload;
  title?: string;
  description?: string;
}

/** CSV import in three steps: pick an account and file, review and edit rows, done. */
export function ImportDialog({
  open,
  onOpenChange,
  accountId,
  preload,
  title = 'Import transactions',
  description = 'Upload a CSV statement from your bank, check the rows, then import.',
}: ImportDialogProps) {
  const imp = useImport(accountId ?? '', preload);
  const busy = imp.parse.isPending || imp.commit.isPending;
  const step = imp.state.step;
  const steps = preload ? IMPORT_STEPS.filter((s) => s.step !== ImportStep.Upload) : IMPORT_STEPS;
  const stepIndex = steps.findIndex((s) => s.step === step);
  const [file, setFile] = useState<File | null>(null);

  const footer =
    step === ImportStep.Upload ? (
      <>
        <Button onClick={() => onOpenChange(false)} disabled={busy}>
          Cancel
        </Button>
        <Button
          variant={ButtonVariant.Primary}
          disabled={!file || !imp.state.accountId}
          loading={imp.parse.isPending}
          onClick={() => file && imp.parse.mutate({ file, accountId: imp.state.accountId })}
        >
          Review rows
        </Button>
      </>
    ) : step === ImportStep.Preview ? (
      <>
        {preload ? (
          <Button onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
        ) : (
          <Button onClick={imp.back} disabled={busy}>
            Back
          </Button>
        )}
        <Button
          variant={ButtonVariant.Primary}
          disabled={imp.summary.total === 0 || imp.summary.invalid > 0}
          loading={imp.commit.isPending}
          onClick={() => imp.commit.mutate()}
        >
          Import {imp.summary.total} {imp.summary.total === 1 ? 'row' : 'rows'}
        </Button>
      </>
    ) : (
      <>
        {preload ? null : (
          <Button
            onClick={() => {
              setFile(null);
              imp.reset(imp.state.accountId);
            }}
          >
            Import another
          </Button>
        )}
        <Button variant={ButtonVariant.Primary} onClick={() => onOpenChange(false)}>
          Done
        </Button>
      </>
    );

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !busy && onOpenChange(o)}
      title={title}
      description={description}
      wide={step === ImportStep.Preview}
      footer={footer}
    >
      <ol className={styles.steps} aria-label="Import steps">
        {steps.map((s, i) => (
          <li
            key={s.step}
            className={cx(
              styles.step,
              i === stepIndex && styles.stepOn,
              i < stepIndex && styles.stepDone
            )}
            aria-current={i === stepIndex ? 'step' : undefined}
          >
            <b>{String(i + 1).padStart(2, '0')}</b> {s.label}
          </li>
        ))}
      </ol>
      {step === ImportStep.Upload ? <UploadStep imp={imp} file={file} onFile={setFile} /> : null}
      {step === ImportStep.Preview ? <PreviewStep imp={imp} /> : null}
      {step === ImportStep.Done ? <DoneStep imp={imp} /> : null}
    </Dialog>
  );
}

function UploadStep({
  imp,
  file,
  onFile,
}: {
  imp: ImportApi;
  file: File | null;
  onFile: (f: File | null) => void;
}) {
  const accounts = useAccounts();
  const [over, setOver] = useState(false);
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    const f = e.dataTransfer.files[0];
    if (f) onFile(f);
  };
  return (
    <div className={styles.form}>
      <Field label="Account" required hint="Rows are imported into this account.">
        <Combobox
          value={imp.state.accountId || null}
          onChange={(v) => imp.setAccount(v ?? '')}
          options={accountOptions(spendingAccounts(accounts.data))}
          placeholder="Pick an account"
          searchPlaceholder="Search accounts"
        />
      </Field>
      <label
        className={cx(styles.drop, over && styles.dropActive)}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
      >
        <FileUp aria-hidden />
        {file ? (
          <span className={styles.fileName}>{file.name}</span>
        ) : (
          <span>Drop a CSV file here, or choose one</span>
        )}
        <span className={styles.hint}>CSV only, up to 5 MB</span>
        <input
          type="file"
          accept=".csv,text/csv"
          aria-label="CSV file"
          className="sr-only"
          onChange={(e) => onFile(e.target.files?.[0] ?? null)}
        />
      </label>
      {imp.parse.isError ? <FormAlert>{toApiError(imp.parse.error).message}</FormAlert> : null}
    </div>
  );
}

function PreviewStep({ imp }: { imp: ImportApi }) {
  const { prefs } = usePreferences();
  const accounts = useAccounts();
  const account = accounts.data?.find((a) => a.id === imp.state.accountId);
  const currency = account ? String(account.currency) : prefs.default_currency;
  const s = imp.summary;
  const all = imp.rows.length > 0 && imp.rows.every((r) => imp.state.selected.has(r.temp_id));
  const some = imp.rows.some((r) => imp.state.selected.has(r.temp_id));
  const dupes = imp.rows.filter((r) => r.is_potential_duplicate).length;

  return (
    <div className={styles.form}>
      <dl className={styles.summary} aria-label="Selected rows">
        <div>
          <dt>Rows</dt>
          <dd>
            {s.total} of {imp.rows.length}
          </dd>
        </div>
        <div>
          <dt>Money in</dt>
          <dd>
            <Money amount={s.income} currency={currency} sign={SignDisplay.Never} />
          </dd>
        </div>
        <div>
          <dt>Money out</dt>
          <dd>
            <Money amount={s.expenses} currency={currency} sign={SignDisplay.Never} />
          </dd>
        </div>
        <div>
          <dt>Duplicates</dt>
          <dd>{s.duplicates}</dd>
        </div>
      </dl>
      {dupes > 0 ? (
        <FormAlert kind={AlertKind.Warn}>
          {dupes} {dupes === 1 ? 'row looks' : 'rows look'} like a transaction you already have.
          They start unticked.
        </FormAlert>
      ) : null}
      {s.invalid > 0 ? (
        <FormAlert>
          {s.invalid} selected {s.invalid === 1 ? 'row has' : 'rows have'} a problem. Fix or untick
          them to import.
        </FormAlert>
      ) : null}
      <div className={styles.tableWrap}>
        <table className={styles.preview}>
          <thead>
            <tr>
              <th scope="col">
                <Checkbox
                  aria-label="Select all rows"
                  checked={all ? true : some ? 'indeterminate' : false}
                  onCheckedChange={(v) => imp.toggleAll(v === true)}
                />
              </th>
              <th scope="col">Date</th>
              <th scope="col">Title</th>
              <th scope="col" className={styles.num}>
                Amount
              </th>
              <th scope="col">Status</th>
            </tr>
          </thead>
          <tbody>
            {imp.rows.map((r, i) => {
              const on = imp.state.selected.has(r.temp_id);
              const problem =
                rowProblem(r) ??
                (r.is_valid ? null : (r.validation_errors?.join(', ') ?? 'Invalid row'));
              const n = i + 1;
              return (
                <tr
                  key={r.temp_id}
                  className={cx(!on && styles.rowOff, on && problem && styles.rowBad)}
                >
                  <td>
                    <Checkbox
                      aria-label={`Import row ${n}`}
                      checked={on}
                      onCheckedChange={(v) => imp.toggle(r.temp_id, v === true)}
                    />
                  </td>
                  <td>
                    <input
                      type="date"
                      aria-label={`Date, row ${n}`}
                      value={r.date.slice(0, 10)}
                      onChange={(e) => imp.edit(r.temp_id, { date: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      aria-label={`Title, row ${n}`}
                      value={r.title}
                      aria-invalid={!r.title.trim() || undefined}
                      onChange={(e) => imp.edit(r.temp_id, { title: e.target.value })}
                    />
                    {on && problem ? <span className={styles.problem}>{problem}</span> : null}
                  </td>
                  <td className={styles.num}>
                    <input
                      aria-label={`Amount, row ${n}`}
                      inputMode="decimal"
                      value={r.amount}
                      className={styles.num}
                      aria-invalid={!Number.isFinite(Number(r.amount)) || undefined}
                      onChange={(e) => imp.edit(r.temp_id, { amount: e.target.value })}
                    />
                  </td>
                  <td>
                    <span className={styles.badges}>
                      {Number(r.amount) > 0 ? (
                        <Badge tone={Tone.Pos}>In</Badge>
                      ) : (
                        <Badge>Out</Badge>
                      )}
                      {r.is_potential_duplicate ? (
                        <Badge tone={Tone.Warn}>
                          Duplicate
                          {r.duplicate_match
                            ? ` ${r.duplicate_match.confidence.toLowerCase()}`
                            : ''}
                        </Badge>
                      ) : null}
                      {r.original_currency ? <Badge>{r.original_currency}</Badge> : null}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {imp.commit.isError ? <FormAlert>{toApiError(imp.commit.error).message}</FormAlert> : null}
    </div>
  );
}

function DoneStep({ imp }: { imp: ImportApi }) {
  const r = imp.state.result;
  if (!r) return null;
  return (
    <div className={styles.form}>
      <FormAlert kind={r.failed ? AlertKind.Warn : AlertKind.Info}>
        {r.created} {r.created === 1 ? 'transaction' : 'transactions'} imported
        {r.failed ? `, ${r.failed} failed.` : '.'}
      </FormAlert>
      {r.errors?.length ? (
        <ul className={styles.hint}>
          {r.errors.map((e) => (
            <li key={e.index}>
              Row {e.index + 1}: {e.error}
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.hint}>
          <CheckCircle2 aria-hidden size={14} /> Everything went through. The ledger is up to date.
        </p>
      )}
    </div>
  );
}
