import { Box, Button, VStack, Text, HStack, Icon, Alert } from '@chakra-ui/react';
import { FiUpload, FiFile } from 'react-icons/fi';
import type { Account } from '@/types';
import { Field } from '@/components/ui/field';
import { MAX_FILE_SIZE } from '@/constants/statementImport';
import { useFileUpload } from '@/hooks/usecase/useFileUpload';
import { formatFileSize } from '@/utils/fileValidation';

interface FileUploadStepProps {
  accounts: Account[];
  onUpload: (file: File, accountId: string) => void;
  isProcessing: boolean;
}

export const FileUploadStep = ({ accounts, onUpload, isProcessing }: FileUploadStepProps) => {
  const {
    selectedFile,
    selectedAccountId,
    error,
    handleFileChange,
    handleAccountChange,
    canSubmit,
  } = useFileUpload();

  const handleSubmit = () => {
    if (selectedFile && selectedAccountId) {
      onUpload(selectedFile, selectedAccountId);
    }
  };

  return (
    <VStack gap={6} align="stretch">
      {/* Account Selection */}
      <Field label="Select Account" required>
        <select
          value={selectedAccountId}
          onChange={(e) => handleAccountChange(e.target.value)}
          disabled={isProcessing}
          style={{
            width: '100%',
            padding: '8px',
            borderRadius: '6px',
            border: '1px solid #E2E8F0',
          }}
        >
          <option value="">Choose an account</option>
          {accounts
            .filter((account) => account.is_active)
            .map((account) => (
              <option key={account.id} value={account.id}>
                {account.name} ({account.currency})
              </option>
            ))}
        </select>
      </Field>

      {/* File Upload */}
      <Field label="Upload CSV File" required>
        <Box
          borderWidth={2}
          borderStyle="dashed"
          borderColor="gray.300"
          borderRadius="md"
          p={8}
          textAlign="center"
          bg="gray.50"
          _hover={{ bg: 'gray.100' }}
          cursor="pointer"
          position="relative"
        >
          <input
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            disabled={isProcessing}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              opacity: 0,
              cursor: 'pointer',
            }}
          />
          <VStack gap={2}>
            <Icon as={FiUpload} boxSize={8} color="gray.400" />
            <Text fontWeight="medium">Click to upload or drag and drop</Text>
            <Text fontSize="sm" color="gray.500">
              CSV files only (max {MAX_FILE_SIZE / (1024 * 1024)}MB)
            </Text>
          </VStack>
        </Box>

        {selectedFile && (
          <HStack mt={3} p={3} bg="blue.50" borderRadius="md">
            <Icon as={FiFile} color="blue.500" />
            <Box flex={1}>
              <Text fontSize="sm" fontWeight="medium">
                {selectedFile.name}
              </Text>
              <Text fontSize="xs" color="gray.600">
                {formatFileSize(selectedFile.size)}
              </Text>
            </Box>
          </HStack>
        )}
      </Field>

      {/* Expected Format Info */}
      <Alert.Root status="info">
        <Alert.Indicator />
        <Box>
          <Alert.Title>Expected CSV Format</Alert.Title>
          <Alert.Description>
            <Text fontSize="sm">
              <code>id,time,merchant,type,amount,card</code>
            </Text>
            <Text fontSize="xs" color="gray.600" mt={1}>
              First row should contain headers
            </Text>
          </Alert.Description>
        </Box>
      </Alert.Root>

      {/* Error Message */}
      {error && (
        <Alert.Root status="error">
          <Alert.Indicator />
          <Alert.Description>{error}</Alert.Description>
        </Alert.Root>
      )}

      {/* Submit Button */}
      <Button
        colorScheme="blue"
        size="lg"
        onClick={handleSubmit}
        disabled={!canSubmit || isProcessing}
        loading={isProcessing}
        loadingText="Parsing CSV..."
      >
        Parse CSV
      </Button>
    </VStack>
  );
};
