import { Button, HStack, IconButton, Menu, Portal } from '@chakra-ui/react';
import { FiEdit2, FiMoreVertical, FiRepeat, FiTrash2 } from 'react-icons/fi';
import { HiOutlineDocumentDuplicate } from 'react-icons/hi';

interface TransactionActionsProps {
  onEdit: () => void;
  onDelete: () => void;
  onDuplicate?: () => void;
  onConvertToTransfer?: () => void;
  isDeleting: boolean;
}

/**
 * Transaction detail toolbar.
 *
 * Layout: a single Edit button plus a kebab (three-dot) overflow menu holding
 * the remaining actions. Keeping only two elements here means the breadcrumb
 * always has room and can never be crushed at narrow widths.
 *
 * Menu order: Convert to transfer (newest, most deliberate) → Duplicate →
 * Delete last, visually separated and styled destructive so it isn't one
 * mis-click from the others. `onDuplicate` / `onConvertToTransfer` are optional:
 * the caller omits them when the action doesn't apply (e.g. convert-to-transfer
 * is not offered for transactions with splits or that are already transfers),
 * so those items simply don't render.
 */
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

      <Menu.Root>
        <Menu.Trigger asChild>
          <IconButton aria-label="More actions" variant="outline">
            <FiMoreVertical />
          </IconButton>
        </Menu.Trigger>
        <Portal>
          <Menu.Positioner>
            <Menu.Content>
              {onConvertToTransfer && (
                <Menu.Item value="convert-to-transfer" onClick={onConvertToTransfer}>
                  <HStack gap={2}>
                    <FiRepeat />
                    <span>Convert to transfer</span>
                  </HStack>
                </Menu.Item>
              )}
              {onDuplicate && (
                <Menu.Item value="duplicate" onClick={onDuplicate}>
                  <HStack gap={2}>
                    <HiOutlineDocumentDuplicate />
                    <span>Duplicate</span>
                  </HStack>
                </Menu.Item>
              )}
              <Menu.Separator />
              <Menu.Item
                value="delete"
                color="red.500"
                disabled={isDeleting}
                onClick={onDelete}
              >
                <HStack gap={2}>
                  <FiTrash2 />
                  <span>Delete</span>
                </HStack>
              </Menu.Item>
            </Menu.Content>
          </Menu.Positioner>
        </Portal>
      </Menu.Root>
    </HStack>
  );
};
