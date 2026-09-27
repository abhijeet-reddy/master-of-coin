import type { Category } from '@/api/types';
import { ConfirmDialog } from '@/ui';
import { useDeleteCategory } from '../hooks/useCategoryMutations';
import styles from './Categories.module.css';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: Category;
  onDeleted?: () => void;
}

export function DeleteCategoryDialog({ open, onOpenChange, category, onDeleted }: Props) {
  const del = useDeleteCategory();
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Delete ${category.name}?`}
      confirmLabel="Delete category"
      onConfirm={async () => {
        await del.mutateAsync(category);
        onDeleted?.();
      }}
    >
      <p className={styles.confirmText}>
        Its transactions stay and become uncategorised. A budget on this category stops matching
        anything.
      </p>
    </ConfirmDialog>
  );
}
