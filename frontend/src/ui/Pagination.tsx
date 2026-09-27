import { ChevronLeft, ChevronRight } from 'lucide-react';
import { usePreferences } from '@/lib/preferences';
import { IconButton } from './Button';
import { ButtonVariant, ControlSize } from './types';
import styles from './Pagination.module.css';

export interface PaginationProps {
  /** 1-based. */
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}

function pageCount(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(total / Math.max(1, pageSize)));
}

/** "Showing 51 to 100 of 1,204" plus previous and next. */
export function Pagination({ page, pageSize, total, onPageChange }: PaginationProps) {
  const { fmt } = usePreferences();
  const pages = pageCount(total, pageSize);
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <nav className={styles.bar} aria-label="Pagination">
      <span aria-live="polite">
        {total === 0
          ? 'No results'
          : `Showing ${fmt.number(from)} to ${fmt.number(to)} of ${fmt.number(total)}`}
      </span>
      <span className={styles.pages}>
        <IconButton
          label="Previous page"
          icon={<ChevronLeft />}
          variant={ButtonVariant.Secondary}
          size={ControlSize.Sm}
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        />
        <span className={styles.current}>
          Page {page} of {pages}
        </span>
        <IconButton
          label="Next page"
          icon={<ChevronRight />}
          variant={ButtonVariant.Secondary}
          size={ControlSize.Sm}
          disabled={page >= pages}
          onClick={() => onPageChange(page + 1)}
        />
      </span>
    </nav>
  );
}
