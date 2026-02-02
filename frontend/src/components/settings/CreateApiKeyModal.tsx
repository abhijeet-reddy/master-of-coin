import { useState } from 'react';
import {
  DialogRoot,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
  DialogBackdrop,
  DialogCloseTrigger,
} from '@chakra-ui/react';
import { Button, HStack, Input, VStack, Text } from '@chakra-ui/react';
import { Field } from '@/components/ui/field';
import { ScopeSelector } from './ScopeSelector';
import { ApiKeyCreatedModal } from './ApiKeyCreatedModal';
import { ErrorAlert } from '@/components/common';
import { useCreateApiKey } from '@/hooks/api/apiKeys';
import { API_KEY_EXPIRATION_OPTIONS } from '@/constants';
import type { ApiKeyScopes } from '@/models/apiKey';

interface CreateApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CreateApiKeyModal = ({ isOpen, onClose }: CreateApiKeyModalProps) => {
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [expiresInDays, setExpiresInDays] = useState<number | null>(30);
  const [scopes, setScopes] = useState<ApiKeyScopes>({
    transactions: [],
    accounts: [],
    budgets: [],
    categories: [],
    people: [],
  });
  const [createdKey, setCreatedKey] = useState<string | null>(null);

  const createMutation = useCreateApiKey();

  const handleClose = () => {
    setStep(1);
    setName('');
    setExpiresInDays(30);
    setScopes({
      transactions: [],
      accounts: [],
      budgets: [],
      categories: [],
      people: [],
    });
    setCreatedKey(null);
    onClose();
  };

  const handleNext = () => {
    if (step === 1 && name.trim()) {
      setStep(2);
    }
  };

  const handleBack = () => {
    setStep(1);
  };

  const handleCreate = () => {
    createMutation.mutate(
      {
        name: name.trim(),
        scopes,
        expires_in_days: expiresInDays,
      },
      {
        onSuccess: (data) => {
          setCreatedKey(data.key);
        },
      }
    );
  };

  return (
    <>
      <DialogRoot
        open={isOpen && !createdKey}
        onOpenChange={(e) => !e.open && handleClose()}
        size="lg"
      >
        <DialogBackdrop />
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create API Key - Step {step} of 2</DialogTitle>
            <DialogCloseTrigger />
          </DialogHeader>

          <DialogBody>
            <VStack align="stretch" gap={4}>
              {/* Error Alert */}
              {createMutation.isError && createMutation.error && (
                <ErrorAlert error={createMutation.error} />
              )}

              {step === 1 && (
                <>
                  {/* Name Input */}
                  <Field label="API Key Name" required>
                    <Input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g., Mobile App Key"
                    />
                  </Field>

                  {/* Expiration Dropdown */}
                  <Field label="Expiration" required>
                    <select
                      value={expiresInDays === null ? 'never' : expiresInDays}
                      onChange={(e) =>
                        setExpiresInDays(e.target.value === 'never' ? null : Number(e.target.value))
                      }
                      style={{
                        width: '100%',
                        padding: '8px',
                        borderRadius: '6px',
                        border: '1px solid #E2E8F0',
                      }}
                    >
                      {API_KEY_EXPIRATION_OPTIONS.map((option) => (
                        <option
                          key={option.label}
                          value={option.value === null ? 'never' : option.value}
                        >
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                </>
              )}

              {step === 2 && (
                <>
                  <Text fontSize="sm" color="fg.muted">
                    Select the permissions for this API key. You can modify these later.
                  </Text>
                  <ScopeSelector value={scopes} onChange={setScopes} />
                </>
              )}
            </VStack>
          </DialogBody>

          <DialogFooter>
            <HStack gap={2}>
              {step === 1 ? (
                <>
                  <Button variant="outline" onClick={handleClose}>
                    Cancel
                  </Button>
                  <Button colorScheme="blue" onClick={handleNext} disabled={!name.trim()}>
                    Next
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="outline"
                    onClick={handleBack}
                    disabled={createMutation.isPending}
                  >
                    Back
                  </Button>
                  <Button
                    colorScheme="blue"
                    onClick={handleCreate}
                    loading={createMutation.isPending}
                  >
                    Create Key
                  </Button>
                </>
              )}
            </HStack>
          </DialogFooter>
        </DialogContent>
      </DialogRoot>

      {/* Show created key modal */}
      {createdKey && (
        <ApiKeyCreatedModal
          isOpen={true}
          onClose={handleClose}
          apiKey={createdKey}
          keyName={name}
        />
      )}
    </>
  );
};
