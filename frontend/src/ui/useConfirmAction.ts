import { useState } from 'react';

/** Runs an async confirm; exposes pending state and the error message, never throws. */
export function useConfirmAction(onConfirm: () => unknown, onDone: () => void) {
  const [state, setState] = useState<{ pending: boolean; error: string | null }>({
    pending: false,
    error: null,
  });

  const run = async () => {
    setState({ pending: true, error: null });
    try {
      await onConfirm();
      setState({ pending: false, error: null });
      onDone();
    } catch (err) {
      setState({
        pending: false,
        error: err instanceof Error ? err.message : 'That did not work.',
      });
    }
  };

  const reset = () => setState({ pending: false, error: null });
  return { ...state, run, reset };
}
