/** Which category dialog is open, shared by the grid, the cards and the detail page. */
import { createContext, useContext } from 'react';
import type { Category } from '@/api/types';

export enum CategoryDialog {
  Form = 'form',
  Delete = 'delete',
}

export interface CategoryDialogState {
  kind: CategoryDialog;
  open: boolean;
  category?: Category;
  onDone?: () => void;
  seq: number;
}

export interface CategoryDialogsApi {
  openCreate: () => void;
  openEdit: (category: Category) => void;
  confirmDelete: (category: Category, onDeleted?: () => void) => void;
}

export const CategoryDialogsContext = createContext<CategoryDialogsApi | null>(null);

export function useCategoryDialogs(): CategoryDialogsApi {
  const ctx = useContext(CategoryDialogsContext);
  if (!ctx) throw new Error('useCategoryDialogs needs a <CategoryDialogsProvider>');
  return ctx;
}
