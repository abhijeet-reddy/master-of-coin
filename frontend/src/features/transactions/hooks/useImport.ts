/** Import state machine: upload, preview (edit and pick rows), done. */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useReducer } from 'react';
import { keys } from '@/api/keys';
import { bulkCreateTransactions, parseCSV } from '@/api/statementImport';
import type { BankSyncMetadata, BulkCreateResponse, ParsedTransaction } from '@/api/types';
import { toast } from '@/ui';
import {
  applyEdits,
  buildBulkRequest,
  defaultSelection,
  importSummary,
  type RowEdit,
  type RowEdits,
} from '../lib/importModel';
import { invalidateAfterWrite } from './useTxMutations';

export enum ImportStep {
  Upload = 'upload',
  Preview = 'preview',
  Done = 'done',
}

export const IMPORT_STEPS = [
  { step: ImportStep.Upload, label: 'Upload' },
  { step: ImportStep.Preview, label: 'Review' },
  { step: ImportStep.Done, label: 'Done' },
] as const;

interface State {
  step: ImportStep;
  accountId: string;
  rows: ParsedTransaction[];
  edits: RowEdits;
  selected: ReadonlySet<string>;
  metadata?: BankSyncMetadata;
  result: BulkCreateResponse['data'] | null;
}

type Action =
  | { type: 'account'; accountId: string }
  | { type: 'load'; rows: ParsedTransaction[]; accountId: string; metadata?: BankSyncMetadata }
  | { type: 'edit'; id: string; patch: RowEdit }
  | { type: 'toggle'; id: string; on: boolean }
  | { type: 'toggleAll'; on: boolean }
  | { type: 'done'; result: BulkCreateResponse['data'] }
  | { type: 'back' }
  | { type: 'reset'; accountId?: string };

const initial = (accountId = ''): State => ({
  step: ImportStep.Upload,
  accountId,
  rows: [],
  edits: {},
  selected: new Set(),
  result: null,
});

function reducer(s: State, a: Action): State {
  switch (a.type) {
    case 'account':
      return { ...s, accountId: a.accountId };
    case 'load':
      return {
        ...initial(a.accountId),
        step: ImportStep.Preview,
        rows: a.rows,
        selected: defaultSelection(a.rows),
        metadata: a.metadata,
      };
    case 'edit':
      return { ...s, edits: { ...s.edits, [a.id]: { ...s.edits[a.id], ...a.patch } } };
    case 'toggle': {
      const next = new Set(s.selected);
      if (a.on) next.add(a.id);
      else next.delete(a.id);
      return { ...s, selected: next };
    }
    case 'toggleAll':
      return { ...s, selected: a.on ? new Set(s.rows.map((r) => r.temp_id)) : new Set() };
    case 'done':
      return { ...s, step: ImportStep.Done, result: a.result };
    case 'back':
      return { ...initial(s.accountId) };
    case 'reset':
      return initial(a.accountId ?? '');
  }
}

/** Rows handed in by another feature (a bank sync), skipping the upload step. */
export interface ImportPreload {
  rows: ParsedTransaction[];
  accountId: string;
  metadata?: BankSyncMetadata;
}

const start = ({ accountId, preload }: { accountId: string; preload?: ImportPreload }): State =>
  preload ? reducer(initial(), { type: 'load', ...preload }) : initial(accountId);

export function useImport(defaultAccountId = '', preload?: ImportPreload) {
  const qc = useQueryClient();
  const [state, dispatch] = useReducer(reducer, { accountId: defaultAccountId, preload }, start);

  const parse = useMutation({
    mutationFn: async ({ file, accountId }: { file: File; accountId: string }) => {
      const res = await parseCSV(file, accountId);
      if (!res.success || !res.data)
        throw new Error(res.errors?.join(', ') || 'The file could not be read.');
      return res.data;
    },
    onSuccess: (data, { accountId }) =>
      dispatch({ type: 'load', rows: data.transactions, accountId }),
  });

  const commit = useMutation({
    mutationFn: async () => {
      const res = await bulkCreateTransactions(
        buildBulkRequest(state.accountId, state.rows, state.edits, state.selected, state.metadata)
      );
      if (!res.success || !res.data) throw new Error('The import did not complete.');
      return res.data;
    },
    onSuccess: (data) => {
      dispatch({ type: 'done', result: data });
      invalidateAfterWrite(qc);
      if (state.metadata) {
        void qc.invalidateQueries({ queryKey: keys.bankProviders });
        // The bank sync report re-checks which rows are imported.
        void qc.invalidateQueries({ queryKey: keys.jobs.all });
      }
      toast.success('Import complete', {
        description: `${data.created} imported, ${data.failed} failed.`,
      });
    },
  });

  const view = useMemo(() => applyEdits(state.rows, state.edits), [state.rows, state.edits]);
  const summary = useMemo(() => importSummary(view, state.selected), [view, state.selected]);

  const reset = useCallback(
    (accountId?: string) => {
      parse.reset();
      commit.reset();
      dispatch({ type: 'reset', accountId });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  return {
    state,
    rows: view,
    summary,
    parse,
    commit,
    setAccount: (accountId: string) => dispatch({ type: 'account', accountId }),
    load: (rows: ParsedTransaction[], accountId: string, metadata?: BankSyncMetadata) =>
      dispatch({ type: 'load', rows, accountId, metadata }),
    edit: (id: string, patch: RowEdit) => dispatch({ type: 'edit', id, patch }),
    toggle: (id: string, on: boolean) => dispatch({ type: 'toggle', id, on }),
    toggleAll: (on: boolean) => dispatch({ type: 'toggleAll', on }),
    back: () => {
      parse.reset();
      dispatch({ type: 'back' });
    },
    reset,
  };
}

export type ImportApi = ReturnType<typeof useImport>;
