import { Box, Spinner, VStack, Text } from '@chakra-ui/react';

interface LoadingSpinnerProps {
  message?: string;
  fullPage?: boolean;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
}

export const LoadingSpinner = ({
  message = 'Loading...',
  fullPage = false,
  size = 'xl',
}: LoadingSpinnerProps) => {
  const content = (
    <VStack gap={4}>
      <Spinner size={size} color="brand.500" borderWidth="3px" />
      {message && (
        <Text fontSize="sm" color="gray.600">
          {message}
        </Text>
      )}
    </VStack>
  );

  if (fullPage) {
    return (
      <Box
        position="fixed"
        top={0}
        left={0}
        right={0}
        bottom={0}
        display="flex"
        alignItems="center"
        justifyContent="center"
        bg="white"
        zIndex={9999}
      >
        {content}
      </Box>
    );
  }

  return (
    <Box display="flex" alignItems="center" justifyContent="center" py={8}>
      {content}
    </Box>
  );
};
