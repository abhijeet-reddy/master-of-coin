import { useEffect } from 'react';

/**
 * Set document title
 * CONSTRAINT: Uses exactly 1 useEffect
 *
 * @param title - Page title
 * @param suffix - Optional suffix (default: "Master of Coin")
 */
export default function useDocumentTitle(title: string, suffix = 'Master of Coin') {
  useEffect(() => {
    const fullTitle = title ? `${title} | ${suffix}` : suffix;
    document.title = fullTitle;

    return () => {
      document.title = suffix;
    };
  }, [title, suffix]);
}
