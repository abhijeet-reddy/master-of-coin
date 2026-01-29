import { Card, HStack, VStack, Text, IconButton, Badge } from '@chakra-ui/react';
import { LuPencil, LuTrash2 } from 'react-icons/lu';
import type { Category } from '@/types';

interface CategoryCardProps {
  category: Category;
  onEdit: (category: Category) => void;
  onDelete: (category: Category) => void;
}

export const CategoryCard = ({ category, onEdit, onDelete }: CategoryCardProps) => {
  return (
    <Card.Root>
      <Card.Body>
        <HStack justify="space-between" align="start">
          <HStack gap={3} flex={1}>
            {/* Category Icon */}
            <Text fontSize="2xl">{category.icon}</Text>

            {/* Category Details */}
            <VStack align="start" gap={1} flex={1}>
              <Text fontWeight="semibold" fontSize="lg">
                {category.name}
              </Text>
              <HStack gap={2}>
                <Badge colorPalette="gray" size="sm" style={{ backgroundColor: category.color }}>
                  {category.color}
                </Badge>
                <Text fontSize="sm" color="fg.muted">
                  {category.transaction_count} transaction
                  {category.transaction_count !== 1 ? 's' : ''}
                </Text>
              </HStack>
            </VStack>
          </HStack>

          {/* Action Buttons */}
          <HStack gap={1}>
            <IconButton
              aria-label="Edit category"
              variant="ghost"
              size="sm"
              onClick={() => onEdit(category)}
            >
              <LuPencil />
            </IconButton>
            <IconButton
              aria-label="Delete category"
              variant="ghost"
              colorPalette="red"
              size="sm"
              onClick={() => onDelete(category)}
            >
              <LuTrash2 />
            </IconButton>
          </HStack>
        </HStack>
      </Card.Body>
    </Card.Root>
  );
};
