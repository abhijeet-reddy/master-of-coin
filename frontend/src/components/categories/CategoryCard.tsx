import { Box, Card, HStack, VStack, Text, IconButton } from '@chakra-ui/react';
import { LuPencil, LuTrash2 } from 'react-icons/lu';
import type { Category } from '@/types';

interface CategoryCardProps {
  category: Category;
  onClick?: () => void;
  onEdit: (category: Category) => void;
  onDelete: (category: Category) => void;
}

export const CategoryCard = ({ category, onClick, onEdit, onDelete }: CategoryCardProps) => {
  return (
    <Card.Root
      cursor={onClick ? 'pointer' : undefined}
      onClick={onClick}
      _hover={onClick ? { shadow: 'md', borderColor: 'blue.200' } : undefined}
      transition="all 0.2s"
    >
      <Card.Body>
        <HStack justify="space-between" align="start">
          <HStack gap={3} flex={1} align="stretch">
            <Box
              width="4px"
              borderRadius="full"
              bg={category.color}
              alignSelf="stretch"
              flexShrink={0}
            />
            <Text fontSize="2xl">{category.icon}</Text>

            <VStack align="start" gap={1} flex={1} justify="center">
              <Text fontWeight="semibold" fontSize="lg">
                {category.name}
              </Text>
            </VStack>
          </HStack>

          {/* Action Buttons */}
          <HStack gap={1}>
            <IconButton
              aria-label="Edit category"
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onEdit(category);
              }}
            >
              <LuPencil />
            </IconButton>
            <IconButton
              aria-label="Delete category"
              variant="ghost"
              colorPalette="red"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(category);
              }}
            >
              <LuTrash2 />
            </IconButton>
          </HStack>
        </HStack>
      </Card.Body>
    </Card.Root>
  );
};
