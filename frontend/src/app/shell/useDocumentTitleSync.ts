import { useEffect } from 'react';

/** "{page} | Master of Coin", as v1 did. */
export function useDocumentTitleSync(title: string) {
  useEffect(() => {
    document.title =
      title && title !== 'Master of Coin' ? `${title} | Master of Coin` : 'Master of Coin';
  }, [title]);
}
