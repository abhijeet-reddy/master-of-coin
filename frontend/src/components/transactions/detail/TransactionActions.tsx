import { Button, HStack } from '@chakra-ui/react';
import { FiEdit2, FiTrash2 } from 'react-icons/fi';

interface TransactionActionsProps {
  onEdit: () => void;
  onDelete: () => void;
  isDeleting: boolean;
}

export const TransactionActions = ({ onEdit, onDelete, isDeleting }: TransactionActionsProps) => {
  return (
    <HStack gap={2}>
      <Button variant="outline" colorScheme="blue" onClick={onEdit}>
        <HStack gap={2}>
          <FiEdit2 />
          <span>Edit</span>
        </HStack>
      </Button>
      <Button variant="outline" colorScheme="red" onClick={onDelete} disabled={isDeleting}>
        <HStack gap={2}>
          <FiTrash2 />
          <span>Delete</span>
        </HStack>
      </Button>
    </HStack>
  );
};
