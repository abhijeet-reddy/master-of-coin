import {
  DialogRoot,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogCloseTrigger,
  DialogBackdrop,
} from '@chakra-ui/react';
import { Box, HStack, Text } from '@chakra-ui/react';
import type { Account } from '@/types';
import { FileUploadStep } from './FileUploadStep';
import { TransactionPreviewStep } from './TransactionPreviewStep';
import { ImportConfirmationStep } from './ImportConfirmationStep';
import { useImportStatement } from '@/hooks/usecase/useImportStatement';

interface ImportStatementModalProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: Account[];
}

const STEPS = ['upload', 'preview', 'confirmation'] as const;
const STEP_LABELS = { upload: 'Upload', preview: 'Preview', confirmation: 'Confirm' };

export const ImportStatementModal = ({ isOpen, onClose, accounts }: ImportStatementModalProps) => {
  const {
    currentStep,
    isProcessing,
    selectedAccountId,
    parsedTransactions,
    importSummary,
    handleFileUpload,
    handleImport,
    handleBack,
    resetState,
  } = useImportStatement();

  const handleClose = () => {
    resetState();
    onClose();
  };

  const currentStepIndex = STEPS.indexOf(currentStep);

  return (
    <DialogRoot open={isOpen} onOpenChange={(e) => !e.open && handleClose()} size="xl">
      <DialogBackdrop />
      <DialogContent
        css={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 9999,
          maxHeight: '90vh',
          overflow: 'auto',
        }}
      >
        <DialogHeader>
          <DialogTitle>Import Statement</DialogTitle>
          <DialogCloseTrigger />
        </DialogHeader>

        <DialogBody>
          {/* Progress Indicator */}
          <HStack justify="center" mb={6} gap={4}>
            {STEPS.map((step, index) => {
              const isActive = step === currentStep;
              const isCompleted = index < currentStepIndex;

              return (
                <HStack key={step} gap={2}>
                  <Box
                    w={8}
                    h={8}
                    borderRadius="full"
                    bg={isActive ? 'blue.500' : isCompleted ? 'green.500' : 'gray.300'}
                    color="white"
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                    fontWeight="bold"
                  >
                    {index + 1}
                  </Box>
                  <Text
                    fontSize="sm"
                    fontWeight={isActive ? 'bold' : 'normal'}
                    color={isActive ? 'blue.600' : 'gray.600'}
                  >
                    {STEP_LABELS[step]}
                  </Text>
                </HStack>
              );
            })}
          </HStack>

          {/* Step Content */}
          {currentStep === 'upload' && (
            <FileUploadStep
              accounts={accounts}
              onUpload={handleFileUpload}
              isProcessing={isProcessing}
            />
          )}

          {currentStep === 'preview' && (
            <TransactionPreviewStep
              transactions={parsedTransactions}
              accountId={selectedAccountId}
              onImport={handleImport}
              onBack={handleBack}
              isProcessing={isProcessing}
            />
          )}

          {currentStep === 'confirmation' && importSummary && (
            <ImportConfirmationStep summary={importSummary} onClose={handleClose} />
          )}
        </DialogBody>
      </DialogContent>
    </DialogRoot>
  );
};
