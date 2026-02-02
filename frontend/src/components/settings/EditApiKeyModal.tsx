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
import { Button, HStack, Input, VStack } from '@chakra-ui/react';
import { Field } from '@/components/ui/field';
import { ScopeSelector } from './ScopeSelector';
import { ErrorAlert } from '@/components/common';
import { useUpdateApiKey } from '@/hooks/api/apiKeys';
import { useApiKeyForm } from '@/hooks';
import { API_KEY_EXPIRATION_OPTIONS } from '@/constants';
import type { ApiKey } from '@/models/apiKey';

interface EditApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  apiKey: ApiKey | null;
}

export const EditApiKeyModal = ({ isOpen, onClose, apiKey }: EditApiKeyModalProps) => {
  const { formData, updateField, reset } = useApiKeyForm(apiKey, isOpen);
  const updateMutation = useUpdateApiKey();

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleUpdate = () => {
    if (!apiKey) return;

    updateMutation.mutate(
      {
        id: apiKey.id,
        data: {
          name: formData.name.trim(),
          scopes: formData.scopes,
          expires_in_days: formData.expiresInDays,
        },
      },
      {
        onSuccess: () => {
          handleClose();
        },
      }
    );
  };

  return (
    <DialogRoot open={isOpen} onOpenChange={(e) => !e.open && handleClose()} size="lg">
      <DialogBackdrop />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit API Key</DialogTitle>
          <DialogCloseTrigger />
        </DialogHeader>

        <DialogBody>
          <VStack align="stretch" gap={4}>
            {/* Error Alert */}
            {updateMutation.isError && updateMutation.error && (
              <ErrorAlert error={updateMutation.error} />
            )}

            {/* Name Input */}
            <Field label="API Key Name" required>
              <Input
                value={formData.name}
                onChange={(e) => updateField('name', e.target.value)}
                placeholder="e.g., Mobile App Key"
              />
            </Field>

            {/* Expiration Dropdown */}
            <Field label="Update Expiration">
              <select
                value={formData.expiresInDays === null ? 'never' : formData.expiresInDays}
                onChange={(e) =>
                  updateField(
                    'expiresInDays',
                    e.target.value === 'never' ? null : Number(e.target.value)
                  )
                }
                style={{
                  width: '100%',
                  padding: '8px',
                  borderRadius: '6px',
                  border: '1px solid #E2E8F0',
                }}
              >
                {API_KEY_EXPIRATION_OPTIONS.map((option) => (
                  <option key={option.label} value={option.value === null ? 'never' : option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>

            {/* Scopes */}
            <ScopeSelector
              value={formData.scopes}
              onChange={(scopes) => updateField('scopes', scopes)}
            />
          </VStack>
        </DialogBody>

        <DialogFooter>
          <HStack gap={2}>
            <Button variant="outline" onClick={handleClose} disabled={updateMutation.isPending}>
              Cancel
            </Button>
            <Button
              colorScheme="blue"
              onClick={handleUpdate}
              loading={updateMutation.isPending}
              disabled={!formData.name.trim()}
            >
              Update
            </Button>
          </HStack>
        </DialogFooter>
      </DialogContent>
    </DialogRoot>
  );
};
