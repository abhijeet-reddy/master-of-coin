import { Box, Button, HStack, Text } from '@chakra-ui/react';
import { FiRotateCcw, FiTrash2 } from 'react-icons/fi';

interface DeletedTransactionBannerProps {
  /** ISO timestamp when the transaction was soft-deleted. */
  deletedAt: string;
  /** ISO timestamp when it will be permanently removed (computed by the API). */
  permanentDeleteAt?: string;
  onRestore: () => void;
  isRestoring: boolean;
}

const fmt = (iso?: string) => {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
};

/**
 * Banner shown above a soft-deleted transaction's detail card. Explains the
 * deleted state and its permanent-removal date (using the real timestamps, not
 * a hardcoded retention window), with both dates in bold, and offers a green
 * Restore action (matching the Trash page's Restore convention). Kept to a
 * single row: the sentence on the left, Restore on the right.
 */
export const DeletedTransactionBanner = ({
  deletedAt,
  permanentDeleteAt,
  onRestore,
  isRestoring,
}: DeletedTransactionBannerProps) => {
  const deleted = fmt(deletedAt);
  const purge = fmt(permanentDeleteAt);

  return (
    <Box
      borderWidth="1px"
      borderColor="red.300"
      bg="red.50"
      _dark={{ bg: 'red.950', borderColor: 'red.700' }}
      borderRadius="md"
      px={4}
      py={3}
      mb={4}
    >
      <HStack justify="space-between" align="center" gap={4}>
        <HStack gap={2} color="red.700" _dark={{ color: 'red.200' }} flexWrap="wrap">
          <FiTrash2 style={{ flexShrink: 0 }} />
          <Text fontSize="sm" as="span">
            Deleted on{' '}
            <Text as="span" fontWeight="bold">
              {deleted}
            </Text>
            {purge && (
              <>
                , will be purged on{' '}
                <Text as="span" fontWeight="bold">
                  {purge}
                </Text>
              </>
            )}
          </Text>
        </HStack>
        <Button
          size="sm"
          variant="outline"
          colorPalette="green"
          onClick={onRestore}
          loading={isRestoring}
          flexShrink={0}
        >
          <HStack gap={2}>
            <FiRotateCcw />
            <span>Restore</span>
          </HStack>
        </Button>
      </HStack>
    </Box>
  );
};
