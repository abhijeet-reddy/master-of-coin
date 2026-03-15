import { Badge, Card, HStack, Table, Text, VStack } from '@chakra-ui/react';
import { formatCurrency } from '@/utils/formatters';
import { CurrencyCode } from '@/types';
import type { PortfolioSyncReport } from '@/types';

interface PortfolioSyncReportViewProps {
  report: PortfolioSyncReport;
}

/** Format adjustment amount with sign and color */
const getAdjustmentColor = (amount: string): string => {
  const value = parseFloat(amount);
  if (value > 0) return 'green.500';
  if (value < 0) return 'red.500';
  return 'fg.muted';
};

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'synced':
      return (
        <Badge colorPalette="green" size="sm">
          Synced
        </Badge>
      );
    case 'no_change':
      return (
        <Badge colorPalette="gray" size="sm">
          No Change
        </Badge>
      );
    case 'failed':
      return (
        <Badge colorPalette="red" size="sm">
          Failed
        </Badge>
      );
    default:
      return <Badge size="sm">{status}</Badge>;
  }
};

/**
 * Displays portfolio sync report results in a table format.
 * Shows each synced account with previous balance, new value, adjustment, and status.
 */
export const PortfolioSyncReportView = ({ report }: PortfolioSyncReportViewProps) => {
  return (
    <VStack gap={4} alignItems="stretch">
      {/* Summary */}
      <Card.Root variant="elevated">
        <Card.Body p={4}>
          <HStack gap={6}>
            <VStack alignItems="flex-start" gap={0}>
              <Text fontSize="xs" color="fg.muted" fontWeight="medium">
                Total Synced
              </Text>
              <Text fontSize="lg" fontWeight="semibold" color="green.600">
                {report.total_synced}
              </Text>
            </VStack>
            <VStack alignItems="flex-start" gap={0}>
              <Text fontSize="xs" color="fg.muted" fontWeight="medium">
                Total Failed
              </Text>
              <Text
                fontSize="lg"
                fontWeight="semibold"
                color={report.total_failed > 0 ? 'red.600' : 'fg.muted'}
              >
                {report.total_failed}
              </Text>
            </VStack>
          </HStack>
        </Card.Body>
      </Card.Root>

      {/* Account Results Table */}
      {report.synced_accounts.length > 0 && (
        <Card.Root variant="elevated">
          <Card.Body p={0}>
            <Table.Root size="sm">
              <Table.Header>
                <Table.Row>
                  <Table.ColumnHeader>Account</Table.ColumnHeader>
                  <Table.ColumnHeader>Previous Balance</Table.ColumnHeader>
                  <Table.ColumnHeader>New Value</Table.ColumnHeader>
                  <Table.ColumnHeader>Adjustment</Table.ColumnHeader>
                  <Table.ColumnHeader>Status</Table.ColumnHeader>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {report.synced_accounts.map((result) => (
                  <Table.Row key={result.account_id}>
                    <Table.Cell>
                      <Text fontSize="sm" fontWeight="medium">
                        {result.account_name}
                      </Text>
                    </Table.Cell>
                    <Table.Cell>
                      <Text fontSize="sm">
                        {formatCurrency(parseFloat(result.previous_balance), CurrencyCode.EUR)}
                      </Text>
                    </Table.Cell>
                    <Table.Cell>
                      <Text fontSize="sm">
                        {formatCurrency(parseFloat(result.new_value), CurrencyCode.EUR)}
                      </Text>
                    </Table.Cell>
                    <Table.Cell>
                      <Text
                        fontSize="sm"
                        fontWeight="medium"
                        color={getAdjustmentColor(result.adjustment_amount)}
                      >
                        {parseFloat(result.adjustment_amount) > 0 ? '+' : ''}
                        {formatCurrency(parseFloat(result.adjustment_amount), CurrencyCode.EUR)}
                      </Text>
                    </Table.Cell>
                    <Table.Cell>{getStatusBadge(result.status)}</Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Root>
          </Card.Body>
        </Card.Root>
      )}
    </VStack>
  );
};
