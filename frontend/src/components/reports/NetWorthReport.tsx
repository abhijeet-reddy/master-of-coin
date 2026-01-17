import { Card, Grid, GridItem, HStack, Stat, Text, VStack } from '@chakra-ui/react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { formatCurrency, formatAccountType } from '@/utils/formatters';
import type { Account } from '@/types';
import { useMemo } from 'react';

interface NetWorthReportProps {
  accounts: Account[];
}

export const NetWorthReport = ({ accounts }: NetWorthReportProps) => {
  const metrics = useMemo(() => {
    const assets = accounts
      .filter(
        (a) =>
          a.account_type === 'CHECKING' ||
          a.account_type === 'SAVINGS' ||
          a.account_type === 'INVESTMENT' ||
          a.account_type === 'CASH'
      )
      .reduce((sum, a) => sum + a.balance, 0);

    const liabilities = accounts
      .filter((a) => a.account_type === 'CREDIT_CARD' || a.account_type === 'LOAN')
      .reduce((sum, a) => sum + Math.abs(a.balance), 0);

    const netWorth = assets - liabilities;

    return { assets, liabilities, netWorth };
  }, [accounts]);

  const accountsByType = useMemo(() => {
    const typeMap = new Map<string, number>();

    accounts.forEach((account) => {
      const current = typeMap.get(account.account_type) || 0;
      typeMap.set(account.account_type, current + account.balance);
    });

    return Array.from(typeMap.entries()).map(([type, balance]) => ({
      type: formatAccountType(type),
      balance: Math.abs(balance),
    }));
  }, [accounts]);

  const assetLiabilityData = [
    { name: 'Assets', value: metrics.assets },
    { name: 'Liabilities', value: metrics.liabilities },
  ];

  return (
    <VStack gap={6} alignItems="stretch">
      {/* Summary Stats */}
      <Grid templateColumns={{ base: '1fr', md: 'repeat(3, 1fr)' }} gap={4}>
        <GridItem>
          <Card.Root>
            <Card.Body>
              <Stat.Root>
                <Stat.Label color="gray.600">Total Assets</Stat.Label>
                <Stat.ValueText fontSize="2xl" fontWeight="bold" color="green.500">
                  {formatCurrency(metrics.assets)}
                </Stat.ValueText>
              </Stat.Root>
            </Card.Body>
          </Card.Root>
        </GridItem>

        <GridItem>
          <Card.Root>
            <Card.Body>
              <Stat.Root>
                <Stat.Label color="gray.600">Total Liabilities</Stat.Label>
                <Stat.ValueText fontSize="2xl" fontWeight="bold" color="red.500">
                  {formatCurrency(metrics.liabilities)}
                </Stat.ValueText>
              </Stat.Root>
            </Card.Body>
          </Card.Root>
        </GridItem>

        <GridItem>
          <Card.Root bg="linear-gradient(135deg, #667eea 0%, #764ba2 100%)" color="white">
            <Card.Body>
              <Stat.Root>
                <Stat.Label opacity={0.9}>Net Worth</Stat.Label>
                <Stat.ValueText fontSize="2xl" fontWeight="bold">
                  {formatCurrency(metrics.netWorth)}
                </Stat.ValueText>
              </Stat.Root>
            </Card.Body>
          </Card.Root>
        </GridItem>
      </Grid>

      {/* Assets vs Liabilities Chart */}
      <Card.Root>
        <Card.Header>
          <Card.Title>Assets vs Liabilities</Card.Title>
        </Card.Header>
        <Card.Body>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={assetLiabilityData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip formatter={(value: number) => formatCurrency(value)} />
              <Bar dataKey="value" fill="#3182CE" />
            </BarChart>
          </ResponsiveContainer>
        </Card.Body>
      </Card.Root>

      {/* Account Breakdown by Type */}
      <Card.Root>
        <Card.Header>
          <Card.Title>Account Balances by Type</Card.Title>
        </Card.Header>
        <Card.Body>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={accountsByType} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis dataKey="type" type="category" width={120} />
              <Tooltip formatter={(value: number) => formatCurrency(value)} />
              <Bar dataKey="balance" fill="#38A169" />
            </BarChart>
          </ResponsiveContainer>
        </Card.Body>
      </Card.Root>

      {/* Account Details */}
      <Card.Root>
        <Card.Header>
          <Card.Title>Account Details</Card.Title>
        </Card.Header>
        <Card.Body>
          <VStack gap={3} alignItems="stretch">
            {accounts.map((account, index) => (
              <HStack
                key={index}
                justifyContent="space-between"
                p={3}
                borderRadius="md"
                bg="gray.50"
                _hover={{ bg: 'gray.100' }}
              >
                <VStack alignItems="flex-start" gap={1}>
                  <Text fontSize="sm" fontWeight="medium">
                    {account.name}
                  </Text>
                  <Text fontSize="xs" color="gray.600">
                    {formatAccountType(account.account_type)}
                  </Text>
                </VStack>
                <Text
                  fontSize="sm"
                  fontWeight="bold"
                  color={account.balance >= 0 ? 'green.600' : 'red.600'}
                >
                  {formatCurrency(account.balance)}
                </Text>
              </HStack>
            ))}
          </VStack>
        </Card.Body>
      </Card.Root>

      {/* Growth Analysis Placeholder */}
      <Card.Root>
        <Card.Header>
          <Card.Title>Net Worth Trend</Card.Title>
        </Card.Header>
        <Card.Body>
          <Text color="gray.600" fontSize="sm" textAlign="center" py={8}>
            Historical net worth data will be displayed here once transaction history is available.
          </Text>
        </Card.Body>
      </Card.Root>
    </VStack>
  );
};
