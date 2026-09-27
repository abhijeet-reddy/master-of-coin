import { TriangleAlert } from 'lucide-react';
import { useReducer, type Dispatch, type ReactNode } from 'react';
import { toApiError } from '@/api/client';
import { SyncAction, type DriftedItem, type DriftReport } from '@/api/types';
import { usePreferences } from '@/lib/preferences';
import { Button, ButtonVariant, Checkbox, cx, Dialog, Money, SignDisplay } from '@/ui';
import { useStartBulkSync } from '../hooks/useJobQueries';
import { providerName } from '../lib/driftModel';
import {
  buildSyncItems,
  firstStep,
  initialWizard,
  selectionCounts,
  stepCount,
  WIZARD_STEPS,
  WizardStep,
  wizardReducer,
  type WizardAction,
  type WizardState,
} from '../lib/syncWizard';
import { DriftDetails } from './DriftReportPanel';
import styles from './Jobs.module.css';

export interface SyncWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  report: DriftReport;
}

/** Four steps: choose drifted items, items to push, items to pull, then review and start the sync. */
export function SyncWizard({ open, onOpenChange, report }: SyncWizardProps) {
  const [state, dispatch] = useReducer(wizardReducer, report, (r) => ({
    ...initialWizard(),
    step: firstStep(r),
  }));
  const start = useStartBulkSync();
  const counts = selectionCounts(state);
  const step = state.step;
  const empty = step !== WizardStep.Review && stepCount(report, step) === 0;

  const submit = () =>
    start.mutate(buildSyncItems(state, report), { onSuccess: () => onOpenChange(false) });

  const footer = (
    <>
      <Button
        onClick={() =>
          step === WizardStep.Drifted ? onOpenChange(false) : dispatch({ type: 'back' })
        }
        disabled={start.isPending}
      >
        {step === WizardStep.Drifted ? 'Cancel' : 'Back'}
      </Button>
      {step === WizardStep.Review ? (
        <Button
          variant={ButtonVariant.Primary}
          disabled={counts.total === 0}
          loading={start.isPending}
          onClick={submit}
        >
          Start sync of {counts.total}
        </Button>
      ) : (
        <Button variant={ButtonVariant.Primary} onClick={() => dispatch({ type: 'next' })}>
          {empty ? 'Skip' : 'Next'}
        </Button>
      )}
    </>
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !start.isPending && onOpenChange(o)}
      title="Sync with provider"
      description="Pick what to push to the provider and what to pull from it."
      footer={footer}
      wide
    >
      <div className={styles.wizBody}>
        <ol className={styles.steps} aria-label="Sync steps">
          {WIZARD_STEPS.map((s, i) => (
            <li
              key={s.step}
              className={cx(
                styles.step,
                s.step === step && styles.stepOn,
                s.step < step && styles.stepDone
              )}
              aria-current={s.step === step ? 'step' : undefined}
            >
              <b>{i + 1}</b>
              <span>{s.label}</span>
            </li>
          ))}
        </ol>
        {step === WizardStep.Drifted ? (
          <DriftedStep report={report} state={state} dispatch={dispatch} />
        ) : step === WizardStep.MissingExternal ? (
          <MissingExternalStep report={report} state={state} dispatch={dispatch} />
        ) : step === WizardStep.MissingLocal ? (
          <MissingLocalStep report={report} state={state} dispatch={dispatch} />
        ) : (
          <ReviewStep report={report} state={state} />
        )}
        {start.isError ? (
          <p className={styles.error} role="alert">
            <TriangleAlert aria-hidden />
            <span>Could not start the sync: {toApiError(start.error).message}</span>
          </p>
        ) : null}
      </div>
    </Dialog>
  );
}

interface StepProps {
  report: DriftReport;
  state: WizardState;
  dispatch: Dispatch<WizardAction>;
}

const allState = (picked: number, total: number) =>
  picked === 0 ? false : picked === total ? true : ('indeterminate' as const);

function StepBar({
  intro,
  picked,
  total,
  onAll,
}: {
  intro: string;
  picked: number;
  total: number;
  onAll: (on: boolean) => void;
}) {
  return (
    <div className={styles.wizBar}>
      <span className={styles.intro}>{intro}</span>
      {total > 0 ? (
        <Checkbox
          checked={allState(picked, total)}
          onCheckedChange={(on) => onAll(on)}
          label={`Select all (${picked}/${total})`}
        />
      ) : null}
    </div>
  );
}

function StepEmpty({ children }: { children: ReactNode }) {
  return <p className={styles.empty}>{children}</p>;
}

function DriftedStep({ report, state, dispatch }: StepProps) {
  const items = report.drifted;
  return (
    <>
      <StepBar
        intro="These differ between here and the provider. Choose which side wins."
        picked={state.drifted.size}
        total={items.length}
        onAll={(on) => dispatch({ type: 'allDrifted', report, on })}
      />
      {items.length === 0 ? (
        <StepEmpty>Nothing drifted. Skip to the next step.</StepEmpty>
      ) : (
        <ul className={styles.wizList} aria-label="Drifted items">
          {items.map((d) => (
            <DriftedChoice key={d.transaction_id} item={d} state={state} dispatch={dispatch} />
          ))}
        </ul>
      )}
    </>
  );
}

function DriftedChoice({
  item,
  state,
  dispatch,
}: {
  item: DriftedItem;
  state: WizardState;
  dispatch: Dispatch<WizardAction>;
}) {
  const { fmt } = usePreferences();
  const pick = state.drifted.get(item.transaction_id);
  const where = providerName(item.provider_type);
  const choose = (action: SyncAction) =>
    dispatch({
      type: 'pickDrifted',
      id: item.transaction_id,
      pick: {
        action,
        externalExpenseId: item.external_expense_id,
        providerType: item.provider_type,
      },
    });
  return (
    <li className={styles.wizItem} data-on={!!pick}>
      <Checkbox
        checked={!!pick}
        aria-label={`Sync ${item.transaction_title}`}
        onCheckedChange={(on) =>
          on ? choose(SyncAction.PULL) : dispatch({ type: 'clearDrifted', id: item.transaction_id })
        }
      />
      <div className={styles.main}>
        <p className={styles.itemTitle}>{item.transaction_title}</p>
        <span className={styles.meta}>
          <span>{fmt.date(item.transaction_date)}</span>
          <span>#{item.external_expense_id}</span>
        </span>
      </div>
      <span
        className={styles.choice}
        role="group"
        aria-label={`Direction for ${item.transaction_title}`}
      >
        <button
          type="button"
          aria-pressed={pick?.action === SyncAction.PULL}
          onClick={() => choose(SyncAction.PULL)}
          title={`Keep the ${where} version`}
        >
          Pull
        </button>
        <button
          type="button"
          aria-pressed={pick?.action === SyncAction.PUSH}
          onClick={() => choose(SyncAction.PUSH)}
          title={`Send this version to ${where}`}
        >
          Push
        </button>
      </span>
      <DriftDetails item={item} />
    </li>
  );
}

function MissingExternalStep({ report, state, dispatch }: StepProps) {
  const { fmt } = usePreferences();
  const items = report.missing_on_external;
  return (
    <>
      <StepBar
        intro="Split here but not on the provider. Checked items are pushed."
        picked={state.missingExternal.size}
        total={items.length}
        onAll={(on) =>
          dispatch({ type: 'allExternal', ids: items.map((m) => m.transaction_id), on })
        }
      />
      {items.length === 0 ? (
        <StepEmpty>Every split transaction is already on the provider.</StepEmpty>
      ) : (
        <ul className={styles.wizList} aria-label="Missing on provider">
          {items.map((m) => {
            const on = state.missingExternal.has(m.transaction_id);
            return (
              <li key={m.transaction_id} className={styles.wizItem} data-on={on}>
                <Checkbox
                  checked={on}
                  aria-label={`Push ${m.transaction_title}`}
                  onCheckedChange={(v) =>
                    dispatch({ type: 'toggleExternal', id: m.transaction_id, on: v })
                  }
                />
                <div className={styles.main}>
                  <p className={styles.itemTitle}>{m.transaction_title}</p>
                  <span className={styles.meta}>
                    <span>{fmt.date(m.transaction_date)}</span>
                    {m.splits.length ? (
                      <span>With {m.splits.map((s) => s.person_name).join(', ')}</span>
                    ) : null}
                  </span>
                </div>
                <span className={styles.dur}>{Math.abs(parseFloat(m.amount) || 0).toFixed(2)}</span>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

function MissingLocalStep({ report, state, dispatch }: StepProps) {
  const { fmt } = usePreferences();
  const items = report.missing_on_local;
  return (
    <>
      <StepBar
        intro="On the provider but not here. Checked items are pulled in as transactions."
        picked={state.missingLocal.size}
        total={items.length}
        onAll={(on) =>
          dispatch({ type: 'allLocal', ids: items.map((m) => m.external_expense_id), on })
        }
      />
      {items.length === 0 ? (
        <StepEmpty>Every provider expense is already here.</StepEmpty>
      ) : (
        <ul className={styles.wizList} aria-label="Missing locally">
          {items.map((m) => {
            const on = state.missingLocal.has(m.external_expense_id);
            const unmapped = m.unmapped_users ?? [];
            return (
              <li key={m.external_expense_id} className={styles.wizItem} data-on={on}>
                <Checkbox
                  checked={on}
                  aria-label={`Pull ${m.description}`}
                  onCheckedChange={(v) =>
                    dispatch({ type: 'toggleLocal', id: m.external_expense_id, on: v })
                  }
                />
                <div className={styles.main}>
                  <p className={styles.itemTitle}>{m.description}</p>
                  <span className={styles.meta}>
                    <span>{fmt.date(m.date)}</span>
                    {m.provider_type ? <span>{providerName(m.provider_type)}</span> : null}
                  </span>
                </div>
                <Money amount={m.cost} currency={m.currency_code} sign={SignDisplay.Never} />
                {unmapped.length ? (
                  <p className={cx(styles.warnNote, styles.diffs)}>
                    <TriangleAlert aria-hidden />
                    <span>
                      Not linked to a person here:{' '}
                      {unmapped.map((u) => `${u.first_name} ${u.last_name}`.trim()).join(', ')}.
                      Their share is left out.
                    </span>
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

function ReviewStep({ report, state }: { report: DriftReport; state: WizardState }) {
  const counts = selectionCounts(state);
  const title = new Map<string, string>([
    ...report.drifted.map((d) => [d.transaction_id, d.transaction_title] as const),
    ...report.missing_on_external.map((m) => [m.transaction_id, m.transaction_title] as const),
  ]);
  const push: string[] = [];
  const pull: string[] = [];
  for (const [id, p] of state.drifted) {
    (p.action === SyncAction.PUSH ? push : pull).push(title.get(id) ?? id);
  }
  for (const id of state.missingExternal) push.push(title.get(id) ?? id);
  for (const id of state.missingLocal) {
    pull.push(report.missing_on_local.find((m) => m.external_expense_id === id)?.description ?? id);
  }
  if (counts.total === 0) {
    return <StepEmpty>Nothing selected. Go back and pick at least one item.</StepEmpty>;
  }
  return (
    <>
      <span className={styles.intro}>
        {counts.total} {counts.total === 1 ? 'item' : 'items'}: {counts.push} to push, {counts.pull}{' '}
        to pull. The sync runs in the background.
      </span>
      <div className={styles.reviewCols}>
        <ReviewCol title={`Push (${push.length})`} items={push} />
        <ReviewCol title={`Pull (${pull.length})`} items={pull} />
      </div>
    </>
  );
}

function ReviewCol({ title, items }: { title: string; items: string[] }) {
  return (
    <section className={styles.reviewCol}>
      <h3>{title}</h3>
      {items.length === 0 ? (
        <p className={styles.empty}>None</p>
      ) : (
        <ul>
          {items.map((t, i) => (
            <li key={`${t}-${i}`}>{t}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
