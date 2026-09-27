/** The sync wizard state machine: 4 steps of picks from a drift report, then the POST /sync items. */
import { SyncAction, type DriftReport, type SyncItem } from '@/api/types';

export enum WizardStep {
  Drifted = 0,
  MissingExternal = 1,
  MissingLocal = 2,
  Review = 3,
}

export const WIZARD_STEPS = [
  { step: WizardStep.Drifted, label: 'Drifted' },
  { step: WizardStep.MissingExternal, label: 'Missing on provider' },
  { step: WizardStep.MissingLocal, label: 'Missing locally' },
  { step: WizardStep.Review, label: 'Review' },
] as const;

export interface DriftedPick {
  action: SyncAction;
  externalExpenseId: string;
  providerType?: string;
}

export interface WizardState {
  step: WizardStep;
  /** transaction id to its push or pull choice */
  drifted: ReadonlyMap<string, DriftedPick>;
  /** transaction ids to push */
  missingExternal: ReadonlySet<string>;
  /** external expense ids to pull */
  missingLocal: ReadonlySet<string>;
}

export type WizardAction =
  | { type: 'next' }
  | { type: 'back' }
  | { type: 'goto'; step: WizardStep }
  | { type: 'pickDrifted'; id: string; pick: DriftedPick }
  | { type: 'clearDrifted'; id: string }
  | { type: 'allDrifted'; report: DriftReport; on: boolean }
  | { type: 'toggleExternal'; id: string; on: boolean }
  | { type: 'allExternal'; ids: readonly string[]; on: boolean }
  | { type: 'toggleLocal'; id: string; on: boolean }
  | { type: 'allLocal'; ids: readonly string[]; on: boolean }
  | { type: 'reset' };

export const initialWizard = (): WizardState => ({
  step: WizardStep.Drifted,
  drifted: new Map(),
  missingExternal: new Set(),
  missingLocal: new Set(),
});

const clamp = (n: number): WizardStep =>
  Math.max(WizardStep.Drifted, Math.min(WizardStep.Review, n)) as WizardStep;

function toggled(set: ReadonlySet<string>, ids: readonly string[], on: boolean): Set<string> {
  const next = new Set(set);
  for (const id of ids) {
    if (on) next.add(id);
    else next.delete(id);
  }
  return next;
}

export function wizardReducer(s: WizardState, a: WizardAction): WizardState {
  switch (a.type) {
    case 'next':
      return { ...s, step: clamp(s.step + 1) };
    case 'back':
      return { ...s, step: clamp(s.step - 1) };
    case 'goto':
      return { ...s, step: clamp(a.step) };
    case 'pickDrifted': {
      const next = new Map(s.drifted);
      next.set(a.id, a.pick);
      return { ...s, drifted: next };
    }
    case 'clearDrifted': {
      const next = new Map(s.drifted);
      next.delete(a.id);
      return { ...s, drifted: next };
    }
    case 'allDrifted': {
      if (!a.on) return { ...s, drifted: new Map() };
      // Select all defaults to pull, keeping any choice already made.
      const next = new Map(s.drifted);
      for (const d of a.report.drifted) {
        if (next.has(d.transaction_id)) continue;
        next.set(d.transaction_id, {
          action: SyncAction.PULL,
          externalExpenseId: d.external_expense_id,
          providerType: d.provider_type,
        });
      }
      return { ...s, drifted: next };
    }
    case 'toggleExternal':
      return { ...s, missingExternal: toggled(s.missingExternal, [a.id], a.on) };
    case 'allExternal':
      return { ...s, missingExternal: toggled(s.missingExternal, a.ids, a.on) };
    case 'toggleLocal':
      return { ...s, missingLocal: toggled(s.missingLocal, [a.id], a.on) };
    case 'allLocal':
      return { ...s, missingLocal: toggled(s.missingLocal, a.ids, a.on) };
    case 'reset':
      return initialWizard();
  }
}

/** Steps with nothing in them are shown but can be skipped straight past. */
export function stepCount(report: DriftReport, step: WizardStep): number {
  switch (step) {
    case WizardStep.Drifted:
      return report.drifted.length;
    case WizardStep.MissingExternal:
      return report.missing_on_external.length;
    case WizardStep.MissingLocal:
      return report.missing_on_local.length;
    case WizardStep.Review:
      return 0;
  }
}

/** The first step that has items, so the wizard does not open on an empty list. */
export function firstStep(report: DriftReport): WizardStep {
  const hit = [WizardStep.Drifted, WizardStep.MissingExternal, WizardStep.MissingLocal].find(
    (s) => stepCount(report, s) > 0
  );
  return hit ?? WizardStep.Review;
}

/** Drifted items carry both ids; missing-on-provider always pushes; missing-locally always pulls. */
export function buildSyncItems(s: WizardState, report: DriftReport): SyncItem[] {
  const items: SyncItem[] = [];
  for (const [transactionId, pick] of s.drifted) {
    items.push({
      action: pick.action,
      transaction_id: transactionId,
      external_expense_id: pick.externalExpenseId,
      ...(pick.providerType ? { provider_type: pick.providerType } : {}),
    });
  }
  for (const transactionId of s.missingExternal) {
    items.push({ action: SyncAction.PUSH, transaction_id: transactionId });
  }
  for (const externalId of s.missingLocal) {
    const providerType = report.missing_on_local.find(
      (m) => m.external_expense_id === externalId
    )?.provider_type;
    items.push({
      action: SyncAction.PULL,
      external_expense_id: externalId,
      ...(providerType ? { provider_type: providerType } : {}),
    });
  }
  return items;
}

export function selectionCounts(s: WizardState): { total: number; push: number; pull: number } {
  let push = s.missingExternal.size;
  let pull = s.missingLocal.size;
  for (const p of s.drifted.values()) {
    if (p.action === SyncAction.PUSH) push++;
    else pull++;
  }
  return { total: push + pull, push, pull };
}
