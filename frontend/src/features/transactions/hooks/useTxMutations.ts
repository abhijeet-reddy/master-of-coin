/**
 * Transaction writes. Deletes are soft and come with an Undo toast that
 * restores through POST /transactions/:id/restore.
 */
import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { toApiError } from '@/api/client';
import { keys } from '@/api/keys';
import { resolveSplitMismatch, syncTransactionSplit } from '@/api/splitSync';
import {
  bulkDeleteTransactions,
  createDebtTransaction,
  createTransaction,
  deleteTransaction,
  restoreTransaction,
  updateDebtExpenseDetails,
  updateTransaction,
} from '@/api/transactions';
import { convertToTransfer, createTransfer } from '@/api/transfers';
import type {
  ConvertToTransferRequest,
  CreateTransferRequest,
  SplitSyncResult,
  Transaction,
} from '@/api/types';
import { toast } from '@/ui';
import type { TxSubmitPlan } from '../forms/transactionForm';

/** Everything a transaction write can change: lists, balances, debts, budgets, charts. */
export function invalidateAfterWrite(qc: QueryClient) {
  for (const key of [
    keys.transactions.all,
    keys.accounts.all,
    keys.dashboard,
    keys.analytics.all,
    keys.people.all,
    keys.budgets.all,
  ]) {
    void qc.invalidateQueries({ queryKey: key });
  }
}

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`;

export function useRestore() {
  const qc = useQueryClient();
  return useCallback(
    async (ids: readonly string[]) => {
      const results = await Promise.allSettled(ids.map((id) => restoreTransaction(id)));
      invalidateAfterWrite(qc);
      const failed = results.filter((r) => r.status === 'rejected').length;
      if (failed)
        toast.error(`${plural(failed, 'transaction')} could not be restored`, {
          description: 'Find them in Trash.',
        });
      else
        toast.success(
          ids.length === 1
            ? 'Transaction restored'
            : `${plural(ids.length, 'transaction')} restored`
        );
    },
    [qc]
  );
}

/** Delete one; resolves once deleted so a ConfirmDialog can wait on it and show the error inline. */
export function useDeleteTransaction() {
  const qc = useQueryClient();
  const restore = useRestore();
  return useMutation({
    mutationFn: (tx: Pick<Transaction, 'id' | 'title'>) => deleteTransaction(tx.id),
    onSuccess: (_d, tx) => {
      invalidateAfterWrite(qc);
      toast.success('Transaction deleted', {
        description: `${tx.title} moved to Trash.`,
        action: { label: 'Undo', onClick: () => void restore([tx.id]) },
      });
    },
  });
}

export function useBulkDelete() {
  const qc = useQueryClient();
  const restore = useRestore();
  return useMutation({
    mutationFn: (ids: string[]) => bulkDeleteTransactions(ids),
    onSuccess: (res, ids) => {
      invalidateAfterWrite(qc);
      const failed = new Set(res.failed.map((f) => f.id));
      const done = ids.filter((id) => !failed.has(id));
      if (done.length) {
        toast.success(`${plural(done.length, 'transaction')} deleted`, {
          description: 'Moved to Trash.',
          action: { label: 'Undo', onClick: () => void restore(done) },
        });
      }
      if (failed.size) {
        toast.error(`${plural(failed.size, 'transaction')} could not be deleted`, {
          description: res.failed[0]?.error,
        });
      }
    },
  });
}

/** Runs a planned create / debt create / update (metadata first, then the core fields). */
export function useSaveTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (plan: TxSubmitPlan): Promise<Transaction> => {
      if (plan.kind === 'create') return createTransaction(plan.body);
      if (plan.kind === 'createDebt') return createDebtTransaction(plan.body);
      if (plan.metadata) await updateDebtExpenseDetails(plan.id, plan.metadata);
      return updateTransaction(plan.id, plan.body);
    },
    onSuccess: (tx, plan) => {
      invalidateAfterWrite(qc);
      toast.success(plan.kind === 'update' ? 'Transaction updated' : 'Transaction added', {
        description: tx.title,
      });
    },
  });
}

export function useCreateTransfer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (req: CreateTransferRequest) => createTransfer(req),
    onSuccess: () => {
      invalidateAfterWrite(qc);
      toast.success('Transfer created', { description: 'Both accounts are updated.' });
    },
  });
}

export function useConvertToTransfer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, req }: { id: string; req: ConvertToTransferRequest }) =>
      convertToTransfer(id, req),
    onSuccess: (_r, { req }) => {
      invalidateAfterWrite(qc);
      toast.success('Converted to transfer', {
        description: req.counterpart_transaction_id
          ? 'The two transactions are now linked as a transfer.'
          : 'The transaction is now linked as a transfer.',
      });
    },
  });
}

export type MismatchResult = Extract<SplitSyncResult, { status: 'mismatch' }>;

/** Sync a split with the provider; a mismatch is handed back for the user to resolve. */
export function useSplitSync(onMismatch: (m: MismatchResult) => void) {
  const qc = useQueryClient();
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['splits'] });
    invalidateAfterWrite(qc);
  };
  const sync = useMutation({
    mutationFn: (txId: string) => syncTransactionSplit(txId),
    onSuccess: (res) => {
      if (res.status === 'mismatch') return onMismatch(res);
      refresh();
      if (res.status === 'synced') toast.info('Already in sync');
      else if (res.status === 'linked')
        toast.success('Synced', { description: 'Existing expense found and linked.' });
      else toast.success('Synced', { description: 'New expense created on the split provider.' });
    },
    onError: (e) => toast.error('Sync failed', { description: toApiError(e).message }),
  });
  const resolve = useMutation({
    mutationFn: ({
      txId,
      expenseId,
      action,
    }: {
      txId: string;
      expenseId: string;
      action: 'push' | 'pull';
    }) => resolveSplitMismatch(txId, { external_expense_id: expenseId, action }),
    onSuccess: (_r, { action }) => {
      refresh();
      toast.success(action === 'push' ? 'Pushed' : 'Pulled', {
        description:
          action === 'push'
            ? 'Local splits pushed to the split provider.'
            : 'Local splits updated from the split provider.',
      });
    },
  });
  return { sync, resolve };
}
