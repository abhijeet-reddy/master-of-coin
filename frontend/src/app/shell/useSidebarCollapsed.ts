import { useCallback, useState } from 'react';

const KEY = 'moc-nav-collapsed';

function read(): boolean {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

/** Desktop sidebar collapse, remembered across visits. */
export function useSidebarCollapsed() {
  const [collapsed, setCollapsed] = useState(read);
  const toggle = useCallback(() => {
    setCollapsed((c) => {
      const next = !c;
      try {
        localStorage.setItem(KEY, next ? '1' : '0');
      } catch {
        // storage unavailable: keep it for this visit only
      }
      return next;
    });
  }, []);
  return { collapsed, toggle };
}
