import { useEffect, useRef, useState } from 'react';

/**
 * A text input's local draft, committed after a pause. When the committed value
 * changes from outside (a chip removed, filters cleared, back button) the draft
 * follows it.
 */
export function useDebouncedDraft(value: string, commit: (next: string) => void, delay = 300) {
  const [draft, setDraft] = useState(value);
  const committed = useRef(value);
  const commitRef = useRef(commit);
  commitRef.current = commit;

  useEffect(() => {
    if (value !== committed.current) {
      committed.current = value;
      setDraft(value);
    }
  }, [value]);

  useEffect(() => {
    if (draft === committed.current) return;
    const t = window.setTimeout(() => {
      committed.current = draft;
      commitRef.current(draft);
    }, delay);
    return () => window.clearTimeout(t);
  }, [draft, delay]);

  return [draft, setDraft] as const;
}
