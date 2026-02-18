import { useMemo } from 'react';
import { useTransaction, useAccounts, useCategories, usePeople } from '@/hooks/api';
import { DEBT_ACCOUNT_INFO } from '@/constants/defaults';
import type { EnrichedTransaction, Person } from '@/types';

interface TransactionDetailResult {
  transaction: EnrichedTransaction | null;
  people: Person[];
  isLoading: boolean;
  error: Error | null;
}

/**
 * Fetches a single transaction by ID and enriches it with account, category, and people data.
 * Combines useTransaction + useAccounts + useCategories + usePeople into one usecase hook.
 */
export default function useTransactionDetail(id: string): TransactionDetailResult {
  const { data: rawTransaction, isLoading: txLoading, error: txError } = useTransaction(id);
  const { data: accounts, isLoading: accLoading } = useAccounts();
  const { data: categories, isLoading: catLoading } = useCategories();
  const { data: people, isLoading: pplLoading } = usePeople();

  const isLoading = txLoading || accLoading || catLoading || pplLoading;
  const error = txError;

  const transaction = useMemo<EnrichedTransaction | null>(() => {
    if (!rawTransaction || !accounts || !categories) return null;

    const accountMap = new Map(accounts.map((a) => [a.id, a]));
    const categoryMap = new Map(categories.map((c) => [c.id, c]));

    const account = accountMap.get(rawTransaction.account_id);

    const category = rawTransaction.category_id
      ? categoryMap.get(rawTransaction.category_id)
      : undefined;

    return {
      id: rawTransaction.id,
      title: rawTransaction.title,
      amount: rawTransaction.amount,
      date: rawTransaction.date,
      account: account
        ? {
            id: account.id,
            name: account.name,
            type: account.account_type,
            currency: account.currency,
          }
        : {
            id: rawTransaction.account_id,
            ...DEBT_ACCOUNT_INFO,
          },
      category: category
        ? { id: category.id, name: category.name, icon: category.icon }
        : undefined,
      notes: rawTransaction.notes,
      splits: rawTransaction.splits,
      user_share: rawTransaction.user_share,
      debt_metadata: rawTransaction.debt_metadata,
      created_at: rawTransaction.created_at,
      updated_at: rawTransaction.updated_at,
    };
  }, [rawTransaction, accounts, categories]);

  return { transaction, people: people ?? [], isLoading, error };
}
