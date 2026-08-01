import { Button, HStack } from '@chakra-ui/react';
import { FiEdit2, FiRepeat, FiTrash2 } from 'react-icons/fi';
import { HiOutlineDocumentDuplicate } from 'react-icons/hi';

interface TransactionActionsProps {
  onEdit: () => void;
  onDelete: () => void;
  onDuplicate?: () => void;
  onConvertToTransfer?: () => void;
  isDeleting: boolean;
}

export const TransactionActions = ({
  onEdit,
  onDelete,
  onDuplicate,
  onConvertToTransfer,
  isDeleting,
}: TransactionActionsProps) => {
  return (
    <HStack gap={2}>
      <Button variant="outline" colorScheme="blue" onClick={onEdit}>
        <HStack gap={2}>
          <FiEdit2 />
          <span>Edit</span>
        </HStack>
      </Button>
      {onDuplicate && (
        <Button variant="outline" colorScheme="teal" onClick={onDuplicate}>
          <HStack gap={2}>
            <HiOutlineDocumentDuplicate />
            <span>Duplicate</span>
          </HStack>
        </Button>
      )}
      {onConvertToTransfer && (
        <Button variant="outline" colorScheme="purple" onClick={onConvertToTransfer}>
          <HStack gap={2}>
            <FiRepeat />
            <span>Convert to transfer</span>
          </HStack>
        </Button>
      )}
      <Button variant="outline" colorScheme="red" onClick={onDelete} disabled={isDeleting}>
        <HStack gap={2}>
          <FiTrash2 />
          <span>Delete</span>
        </HStack>
      </Button>
    </HStack>
  );
};
