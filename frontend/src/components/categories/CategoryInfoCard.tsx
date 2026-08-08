import { Box, Card, HStack, IconButton, Text, VStack } from '@chakra-ui/react';
import { LuPencil, LuTrash2 } from 'react-icons/lu';
import type { Category } from '@/types';

interface CategoryInfoCardProps {
  category: Category;
  onEdit: () => void;
  onDelete: () => void;
}

export const CategoryInfoCard = ({ category, onEdit, onDelete }: CategoryInfoCardProps) => {
  return (
    <Card.Root variant="elevated" mb={6}>
      <Card.Body p={6}>
        <VStack align="stretch" gap={4}>
          {/* Header with icon, name, and actions */}
          <HStack justify="space-between" align="flex-start">
            <HStack gap={4}>
              <Box p={3} borderRadius="lg" bg="gray.50" fontSize="2xl">
                {category.icon}
              </Box>
              <VStack align="start" gap={1}>
                <Text fontSize="xl" fontWeight="bold">
                  {category.name}
                </Text>
                <Box w={4} h={4} borderRadius="full" bg={category.color} />
              </VStack>
            </HStack>
            <HStack gap={1}>
              <IconButton aria-label="Edit category" size="sm" variant="ghost" onClick={onEdit}>
                <LuPencil />
              </IconButton>
              <IconButton
                aria-label="Delete category"
                size="sm"
                variant="ghost"
                colorPalette="red"
                onClick={onDelete}
              >
                <LuTrash2 />
              </IconButton>
            </HStack>
          </HStack>
        </VStack>
      </Card.Body>
    </Card.Root>
  );
};
