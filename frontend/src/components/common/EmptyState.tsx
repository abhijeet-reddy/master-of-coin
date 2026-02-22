import { Button, EmptyState as ChakraEmptyState, VStack } from '@chakra-ui/react';
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
    <ChakraEmptyState.Root>
      <ChakraEmptyState.Content>
        {icon && <ChakraEmptyState.Indicator>{icon}</ChakraEmptyState.Indicator>}
        {description ? (
          <VStack textAlign="center">
            <ChakraEmptyState.Title>{title}</ChakraEmptyState.Title>
            <ChakraEmptyState.Description>{description}</ChakraEmptyState.Description>
          </VStack>
        ) : (
          <ChakraEmptyState.Title>{title}</ChakraEmptyState.Title>
        )}
        {actionLabel && onAction && (
          <Button colorPalette="blue" onClick={onAction} mt={2}>
            {actionLabel}
          </Button>
        )}
      </ChakraEmptyState.Content>
    </ChakraEmptyState.Root>
  );
};
