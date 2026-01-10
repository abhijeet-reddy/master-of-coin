import { useState, useMemo } from 'react';

export interface Split {
  person_id: string;
  person_name?: string;
  amount: string;
}

/**
 * Calculate split amounts and remaining balance
 * CONSTRAINT: Uses exactly 1 useState
 *
 * @param totalAmount - Total transaction amount
 * @param initialSplits - Initial splits array
 * @returns Splits state and calculated remaining amount
 */
export default function useSplitCalculator(totalAmount: string, initialSplits: Split[] = []) {
  const [splits, setSplits] = useState<Split[]>(initialSplits);

  const remaining = useMemo(() => {
    const total = parseFloat(totalAmount) || 0;
    const splitTotal = splits.reduce((sum, split) => {
      return sum + (parseFloat(split.amount) || 0);
    }, 0);
    return (total - splitTotal).toFixed(2);
  }, [totalAmount, splits]);

  const addSplit = (split: Split) => {
    setSplits((prev) => [...prev, split]);
  };

  const updateSplit = (index: number, split: Split) => {
    setSplits((prev) => prev.map((s, i) => (i === index ? split : s)));
  };

  const removeSplit = (index: number) => {
    setSplits((prev) => prev.filter((_, i) => i !== index));
  };

  return {
    splits,
    setSplits,
    remaining,
    addSplit,
    updateSplit,
    removeSplit,
  };
}
