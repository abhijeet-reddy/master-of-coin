import { useState } from 'react';
import { Box, Button } from '@chakra-ui/react';
import { PageHeader, ConfirmDialog, ErrorAlert } from '@/components/common';
import { CategoryList, CategoryFormModal } from '@/components/categories';
import { useDocumentTitle } from '@/hooks';
import useCategories from '@/hooks/api/useCategories';
import useDeleteCategory from '@/hooks/api/useDeleteCategory';
import type { Category } from '@/types';

export const Categories = () => {
  useDocumentTitle('Categories');

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<Category | undefined>(undefined);
  const [deleteDialog, setDeleteDialog] = useState<{ isOpen: boolean; category: Category | null }>({
    isOpen: false,
    category: null,
  });

  const { data: categories = [], isLoading, error } = useCategories();
  const deleteMutation = useDeleteCategory();

  // Query error state
  if (error) {
    return (
      <Box>
        <PageHeader title="Categories" />
        <ErrorAlert title="Failed to load categories" error={error} />
      </Box>
    );
  }

  return (
    <Box>
      {/* Delete Error Alert */}
      {deleteMutation.isError && deleteMutation.error && (
        <ErrorAlert title="Failed to delete category" error={deleteMutation.error} />
      )}

      <PageHeader
        title="Categories"
        subtitle="Organize your transactions with custom categories"
        actions={
          <Button
            colorScheme="blue"
            onClick={() => {
              setSelectedCategory(undefined);
              setIsFormOpen(true);
            }}
          >
            Add Category
          </Button>
        }
      />

      {/* Category List */}
      <CategoryList
        categories={categories}
        isLoading={isLoading}
        onEdit={(category) => {
          setSelectedCategory(category);
          setIsFormOpen(true);
        }}
        onDelete={(category) => {
          setDeleteDialog({ isOpen: true, category });
        }}
      />

      {/* Category Form Modal */}
      <CategoryFormModal
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setSelectedCategory(undefined);
        }}
        category={selectedCategory}
        onSuccess={() => {
          setIsFormOpen(false);
          setSelectedCategory(undefined);
        }}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={deleteDialog.isOpen}
        onClose={() => setDeleteDialog({ isOpen: false, category: null })}
        onConfirm={() => {
          if (deleteDialog.category) {
            deleteMutation.mutate(deleteDialog.category.id, {
              onSuccess: () => {
                setDeleteDialog({ isOpen: false, category: null });
              },
            });
          }
        }}
        title="Delete Category"
        message={`Are you sure you want to delete "${deleteDialog.category?.name}"? This action cannot be undone.`}
        confirmText="Delete"
        colorScheme="red"
        isLoading={deleteMutation.isPending}
      />
    </Box>
  );
};
