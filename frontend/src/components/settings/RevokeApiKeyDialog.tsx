import {
  DialogRoot,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
  DialogBackdrop,
} from '@chakra-ui/react';
import { Button, HStack, Text } from '@chakra-ui/react';
import { useRevokeApiKey } from '@/hooks/api/apiKeys';
import type { ApiKey } from '@/models/apiKey';

interface RevokeApiKeyDialogProps {
  isOpen: boolean;
  onClose: () => void;
  apiKey: ApiKey | null;
}

export const RevokeApiKeyDialog = ({ isOpen, onClose, apiKey }: RevokeApiKeyDialogProps) => {
  const revokeMutation = useRevokeApiKey();

  const handleRevoke = () => {
    if (!apiKey) return;

    revokeMutation.mutate(apiKey.id, {
      onSuccess: () => {
        onClose();
      },
    });
  };

  return (
    <DialogRoot open={isOpen} onOpenChange={(e) => !e.open && onClose()} size="md">
      <DialogBackdrop />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Revoke API Key</DialogTitle>
        </DialogHeader>

        <DialogBody>
          <Text>
            Are you sure you want to revoke the API key <strong>"{apiKey?.name}"</strong>? This
            action cannot be undone and any applications using this key will lose access
            immediately.
          </Text>
        </DialogBody>

        <DialogFooter>
          <HStack gap={2}>
            <Button variant="outline" onClick={onClose} disabled={revokeMutation.isPending}>
              Cancel
            </Button>
            <Button colorScheme="red" onClick={handleRevoke} loading={revokeMutation.isPending}>
              Revoke Key
            </Button>
          </HStack>
        </DialogFooter>
      </DialogContent>
    </DialogRoot>
  );
};
