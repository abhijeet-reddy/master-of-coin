import { useState } from 'react';

export interface PaginationState {
  page: number;
  pageSize: number;
}

/**
 * Manage pagination state
 * CONSTRAINT: Uses exactly 1 useState
 *
 * @param initialPage - Initial page number (default: 1)
 * @param initialPageSize - Initial page size (default: 10)
 * @returns Pagination state and control functions
 */
export default function usePagination(initialPage = 1, initialPageSize = 10) {
  const [pagination, setPagination] = useState<PaginationState>({
    page: initialPage,
    pageSize: initialPageSize,
  });

  const setPage = (page: number) => {
    setPagination((prev) => ({ ...prev, page }));
  };

  const setPageSize = (pageSize: number) => {
    setPagination((prev) => ({ ...prev, pageSize, page: 1 }));
  };

  const nextPage = () => {
    setPagination((prev) => ({ ...prev, page: prev.page + 1 }));
  };

  const prevPage = () => {
    setPagination((prev) => ({ ...prev, page: Math.max(1, prev.page - 1) }));
  };

  const reset = () => {
    setPagination({ page: initialPage, pageSize: initialPageSize });
  };

  return {
    ...pagination,
    setPage,
    setPageSize,
    nextPage,
    prevPage,
    reset,
  };
}
