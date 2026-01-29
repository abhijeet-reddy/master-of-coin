import { SimpleGrid } from '@chakra-ui/react';
import { EmptyState, LoadingSpinner } from '@/components/common';
import { CategoryCard } from './CategoryCard';
import type { Category } from '@/types';

interface CategoryListProps {
  categories: Category[];
  isLoading: boolean;
  onEdit: (category: Category) => void;
  onDelete: (category: Category) => void;
}

export const CategoryList = ({ categories, isLoading, onEdit, onDelete }: CategoryListProps) => {
  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (categories.length === 0) {
    return (
      <EmptyState
        title="No categories yet"
        description="Create your first category to organize your transactions"
      />
    );
  }

  return (
    <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} gap={4}>
      {categories.map((category) => (
        <CategoryCard key={category.id} category={category} onEdit={onEdit} onDelete={onDelete} />
      ))}
    </SimpleGrid>
  );
};
