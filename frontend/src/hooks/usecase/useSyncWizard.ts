import { useCallback, useMemo, useReducer } from 'react';
import { SyncAction } from '@/types';
import type { DriftedSelection, SyncItem } from '@/types';

/** Wizard steps: 1=Drifted, 2=MissingExternal, 3=MissingLocal, 4=Review */
type WizardStep = 1 | 2 | 3 | 4;

interface WizardState {
  step: WizardStep;
  /** Drifted items: transaction_id → action + external expense ID */
  selectedDrifted: Map<string, DriftedSelection>;
  /** Missing on external: transaction IDs to push */
  selectedMissingExternal: Set<string>;
  /** Missing on local: external expense IDs to pull */
  selectedMissingLocal: Set<string>;
}

type WizardAction =
  | { type: 'NEXT_STEP' }
  | { type: 'PREV_STEP' }
  | { type: 'SKIP_STEP' }
  | { type: 'TOGGLE_DRIFTED'; id: string; action: SyncAction; externalExpenseId: string }
  | { type: 'TOGGLE_MISSING_EXTERNAL'; id: string }
  | { type: 'TOGGLE_MISSING_LOCAL'; id: string }
  | {
      type: 'SELECT_ALL_DRIFTED';
      entries: Array<{ id: string; externalExpenseId: string }>;
      action: SyncAction;
    }
  | { type: 'SELECT_ALL_MISSING_EXTERNAL'; ids: string[] }
  | { type: 'SELECT_ALL_MISSING_LOCAL'; ids: string[] }
  | { type: 'RESET' };

function clampStep(step: number): WizardStep {
  return Math.max(1, Math.min(4, step)) as WizardStep;
}

function wizardReducer(state: WizardState, action: WizardAction): WizardState {
  switch (action.type) {
    case 'NEXT_STEP':
      return { ...state, step: clampStep(state.step + 1) };

    case 'PREV_STEP':
      return { ...state, step: clampStep(state.step - 1) };

    case 'SKIP_STEP':
      return { ...state, step: clampStep(state.step + 1) };

    case 'TOGGLE_DRIFTED': {
      const next = new Map(state.selectedDrifted);
      const existing = next.get(action.id);
      if (existing && existing.action === action.action) {
        next.delete(action.id);
      } else {
        next.set(action.id, {
          action: action.action,
          externalExpenseId: action.externalExpenseId,
        });
      }
      return { ...state, selectedDrifted: next };
    }

    case 'TOGGLE_MISSING_EXTERNAL': {
      const next = new Set(state.selectedMissingExternal);
      if (next.has(action.id)) {
        next.delete(action.id);
      } else {
        next.add(action.id);
      }
      return { ...state, selectedMissingExternal: next };
    }

    case 'TOGGLE_MISSING_LOCAL': {
      const next = new Set(state.selectedMissingLocal);
      if (next.has(action.id)) {
        next.delete(action.id);
      } else {
        next.add(action.id);
      }
      return { ...state, selectedMissingLocal: next };
    }

    case 'SELECT_ALL_DRIFTED': {
      const next = new Map(state.selectedDrifted);
      for (const entry of action.entries) {
        next.set(entry.id, {
          action: action.action,
          externalExpenseId: entry.externalExpenseId,
        });
      }
      return { ...state, selectedDrifted: next };
    }

    case 'SELECT_ALL_MISSING_EXTERNAL': {
      const next = new Set(state.selectedMissingExternal);
      for (const id of action.ids) {
        next.add(id);
      }
      return { ...state, selectedMissingExternal: next };
    }

    case 'SELECT_ALL_MISSING_LOCAL': {
      const next = new Set(state.selectedMissingLocal);
      for (const id of action.ids) {
        next.add(id);
      }
      return { ...state, selectedMissingLocal: next };
    }

    case 'RESET':
      return createInitialState();

    default:
      return state;
  }
}

function createInitialState(): WizardState {
  return {
    step: 1,
    selectedDrifted: new Map(),
    selectedMissingExternal: new Set(),
    selectedMissingLocal: new Set(),
  };
}

/**
 * Manages sync wizard state: current step, selections per step,
 * push/pull toggles for drifted items, and builds SyncItem array.
 */
export default function useSyncWizard() {
  const [state, dispatch] = useReducer(wizardReducer, undefined, createInitialState);

  const nextStep = useCallback(() => dispatch({ type: 'NEXT_STEP' }), []);
  const prevStep = useCallback(() => dispatch({ type: 'PREV_STEP' }), []);
  const skipStep = useCallback(() => dispatch({ type: 'SKIP_STEP' }), []);
  const reset = useCallback(() => dispatch({ type: 'RESET' }), []);

  const toggleDriftedItem = useCallback(
    (id: string, action: SyncAction, externalExpenseId: string) => {
      dispatch({ type: 'TOGGLE_DRIFTED', id, action, externalExpenseId });
    },
    []
  );

  const toggleMissingExternal = useCallback((id: string) => {
    dispatch({ type: 'TOGGLE_MISSING_EXTERNAL', id });
  }, []);

  const toggleMissingLocal = useCallback((id: string) => {
    dispatch({ type: 'TOGGLE_MISSING_LOCAL', id });
  }, []);

  const selectAllDrifted = useCallback(
    (entries: Array<{ id: string; externalExpenseId: string }>, action: SyncAction) => {
      dispatch({ type: 'SELECT_ALL_DRIFTED', entries, action });
    },
    []
  );

  const selectAllMissingExternal = useCallback((ids: string[]) => {
    dispatch({ type: 'SELECT_ALL_MISSING_EXTERNAL', ids });
  }, []);

  const selectAllMissingLocal = useCallback((ids: string[]) => {
    dispatch({ type: 'SELECT_ALL_MISSING_LOCAL', ids });
  }, []);

  /** Total count of all selected items across all steps */
  const totalSelected = useMemo(
    () =>
      state.selectedDrifted.size +
      state.selectedMissingExternal.size +
      state.selectedMissingLocal.size,
    [state.selectedDrifted, state.selectedMissingExternal, state.selectedMissingLocal]
  );

  /** Build SyncItem array from all selections */
  const buildSyncItems = useCallback((): SyncItem[] => {
    const items: SyncItem[] = [];

    // Drifted items: user-selected push or pull per item
    // Both transaction_id and external_expense_id are always sent for drifted items
    for (const [transactionId, selection] of state.selectedDrifted) {
      items.push({
        action: selection.action,
        transaction_id: transactionId,
        external_expense_id: selection.externalExpenseId,
      });
    }

    // Missing on external: always push with transaction_id
    for (const transactionId of state.selectedMissingExternal) {
      items.push({
        action: SyncAction.PUSH,
        transaction_id: transactionId,
      });
    }

    // Missing on local: always pull with external_expense_id
    for (const externalExpenseId of state.selectedMissingLocal) {
      items.push({
        action: SyncAction.PULL,
        external_expense_id: externalExpenseId,
      });
    }

    return items;
  }, [state.selectedDrifted, state.selectedMissingExternal, state.selectedMissingLocal]);

  return {
    step: state.step,
    selectedDrifted: state.selectedDrifted,
    selectedMissingExternal: state.selectedMissingExternal,
    selectedMissingLocal: state.selectedMissingLocal,
    totalSelected,
    nextStep,
    prevStep,
    skipStep,
    reset,
    toggleDriftedItem,
    toggleMissingExternal,
    toggleMissingLocal,
    selectAllDrifted,
    selectAllMissingExternal,
    selectAllMissingLocal,
    buildSyncItems,
  };
}
