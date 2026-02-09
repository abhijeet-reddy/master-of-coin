import { VStack, Text, Button, Icon, Box } from '@chakra-ui/react';
import { FiCheckCircle } from 'react-icons/fi';

interface ImportConfirmationStepProps {
  summary: { created: number; failed: number };
  onClose: () => void;
}

export const ImportConfirmationStep = ({ summary, onClose }: ImportConfirmationStepProps) => {
  return (
    <VStack gap={6} align="center" py={8}>
      {/* Success Icon */}
      <Icon as={FiCheckCircle} boxSize={16} color="green.500" />

      {/* Success Message */}
      <VStack gap={2} textAlign="center">
        <Text
          fontSize="2xl"
          fontWeight="bold"
          color={summary.failed > 0 ? 'yellow.600' : 'green.600'}
        >
          {summary.failed > 0 ? 'Import Completed with Issues' : 'Import Successful!'}
        </Text>
        <Text fontSize="lg" color="gray.600">
          {summary.created} transaction{summary.created !== 1 ? 's' : ''} created successfully
        </Text>
        {summary.failed > 0 && (
          <Text fontSize="md" color="red.600" fontWeight="medium">
            {summary.failed} transaction{summary.failed !== 1 ? 's' : ''} failed (likely duplicates
            or validation errors)
          </Text>
        )}
      </VStack>

      {/* Summary Box */}
      <Box w="full" p={4} bg="green.50" borderRadius="md" borderWidth={1} borderColor="green.200">
        <VStack gap={2} align="stretch">
          <Text fontSize="sm" fontWeight="medium" color="green.800">
            Import Summary
          </Text>
          <Text fontSize="sm" color="gray.700">
            ✓ Successfully created: {summary.created}
          </Text>
          {summary.failed > 0 && (
            <Text fontSize="sm" color="red.600">
              ✗ Failed: {summary.failed}
            </Text>
          )}
        </VStack>
      </Box>

      {/* Done Button */}
      <Button colorScheme="green" size="lg" onClick={onClose} w="full">
        Done
      </Button>
    </VStack>
  );
};
