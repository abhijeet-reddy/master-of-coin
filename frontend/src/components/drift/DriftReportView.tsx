import { useState } from 'react';
import { Box, Card, Tabs, VStack } from '@chakra-ui/react';
import { DriftSummaryCard } from './DriftSummaryCard';
import { DriftedItemList, MissingOnExternalList, MissingOnLocalList } from './DriftItemList';
import type { DriftReport } from '@/types';

interface DriftReportViewProps {
  report: DriftReport;
}

export const DriftReportView = ({ report }: DriftReportViewProps) => {
  const [activeTab, setActiveTab] = useState('drifted');

  const { summary, drifted, missing_on_external, missing_on_local } = report;

  return (
    <VStack gap={6} alignItems="stretch">
      <DriftSummaryCard summary={summary} />

      <Card.Root variant="elevated">
        <Card.Body p={4}>
          <Tabs.Root
            value={activeTab}
            onValueChange={(e) => setActiveTab(e.value)}
            variant="enclosed"
          >
            <Tabs.List>
              <Tabs.Trigger value="drifted">Drifted ({drifted.length})</Tabs.Trigger>
              <Tabs.Trigger value="missing_external">
                Missing on External ({missing_on_external.length})
              </Tabs.Trigger>
              <Tabs.Trigger value="missing_local">
                Missing on Local ({missing_on_local.length})
              </Tabs.Trigger>
            </Tabs.List>

            <Box mt={4}>
              <Tabs.Content value="drifted">
                <DriftedItemList items={drifted} />
              </Tabs.Content>
              <Tabs.Content value="missing_external">
                <MissingOnExternalList items={missing_on_external} />
              </Tabs.Content>
              <Tabs.Content value="missing_local">
                <MissingOnLocalList items={missing_on_local} />
              </Tabs.Content>
            </Box>
          </Tabs.Root>
        </Card.Body>
      </Card.Root>
    </VStack>
  );
};
