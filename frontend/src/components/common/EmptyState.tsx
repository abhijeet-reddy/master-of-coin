import { Box, VStack, Text, Button } from '@chakra-ui/react';
import type { ReactNode } from 'react';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export const EmptyState = ({
  icon,
  title,
  description,
  actionLabel,
  onAction,
}: EmptyStateProps) => {
  return (
    <Box display="flex" alignItems="center" justifyContent="center" py={12} px={4}>
      <VStack gap={4} maxW="md" textAlign="center">
        {icon && (
          <Box fontSize="4xl" color="gray.400">
            {icon}
          </Box>
        )}
        <VStack gap={2}>
          <Text fontSize="lg" fontWeight="semibold" color="fg">
            {title}
          </Text>
          {description && (
            <Text fontSize="sm" color="fg.muted">
              {description}
            </Text>
          )}
        </VStack>
        {actionLabel && onAction && (
          <Button colorScheme="brand" onClick={onAction} mt={2}>
            {actionLabel}
          </Button>
        )}
      </VStack>
    </Box>
  );
};
