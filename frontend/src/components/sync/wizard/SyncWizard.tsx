import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Button, CloseButton, Dialog, HStack, Portal, Steps, Text } from '@chakra-ui/react';
import { DriftedStepView } from './DriftedStepView';
import { MissingExternalStepView } from './MissingExternalStepView';
import { MissingLocalStepView } from './MissingLocalStepView';
import { ReviewStepView } from './ReviewStepView';
import useSyncWizard from '@/hooks/usecase/useSyncWizard';
import { useStartBulkSync } from '@/hooks/api/useBulkSync';
import type { DriftReport, SyncItem } from '@/types';

interface SyncWizardProps {
  isOpen: boolean;
  onClose: () => void;
  report: DriftReport;
}

const WIZARD_STEPS = [
  { title: 'Drifted Items', description: 'Select drifted items' },
  { title: 'Missing External', description: 'Push to provider' },
  { title: 'Missing Local', description: 'Pull from provider' },
  { title: 'Review & Submit', description: 'Confirm sync actions' },
];

/**
 * Modal wizard for selecting drift items to sync.
 * 4 steps: Drifted → Missing External → Missing Local → Review & Submit.
 * Uses Chakra Dialog + Steps components, useSyncWizard hook for state, useStartBulkSync for submission.
 */
export const SyncWizard = ({ isOpen, onClose, report }: SyncWizardProps) => {
  const navigate = useNavigate();
  const startBulkSync = useStartBulkSync();

  const {
    step,
    selectedDrifted,
    selectedMissingExternal,
    selectedMissingLocal,
    nextStep,
    prevStep,
    skipStep,
    reset,
    toggleDriftedItem,
    toggleMissingExternal,
    toggleMissingLocal,
    selectAllDrifted,
    selectAllMissingExternal,
    selectAllMissingLocal,
    buildSyncItems,
  } = useSyncWizard();

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [reset, onClose]);

  const handleSubmit = useCallback(
    (items: SyncItem[]) => {
      startBulkSync.mutate(
        { items },
        {
          onSuccess: (data) => {
            handleClose();
            void navigate(`/jobs/sync/${data.job_id}`);
          },
        }
      );
    },
    [startBulkSync, handleClose, navigate]
  );

  // Steps component uses 0-based index, our wizard uses 1-based
  const stepsIndex = step - 1;

  return (
    <Dialog.Root
      open={isOpen}
      onOpenChange={(e) => !e.open && handleClose()}
      size="xl"
      scrollBehavior="inside"
    >
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>Sync Wizard</Dialog.Title>
              <Dialog.CloseTrigger asChild>
                <CloseButton size="sm" />
              </Dialog.CloseTrigger>
            </Dialog.Header>

            <Dialog.Body>
              <Steps.Root step={stepsIndex} count={WIZARD_STEPS.length} size="sm" mb={6}>
                <Steps.List>
                  {WIZARD_STEPS.map((s, index) => (
                    <Steps.Item key={index} index={index}>
                      <Steps.Indicator />
                      <Steps.Title>{s.title}</Steps.Title>
                      <Steps.Separator />
                    </Steps.Item>
                  ))}
                </Steps.List>
              </Steps.Root>

              {step === 1 && (
                <DriftedStepView
                  items={report.drifted}
                  selected={selectedDrifted}
                  onToggle={toggleDriftedItem}
                  onSelectAll={selectAllDrifted}
                />
              )}
              {step === 2 && (
                <MissingExternalStepView
                  items={report.missing_on_external}
                  selected={selectedMissingExternal}
                  onToggle={toggleMissingExternal}
                  onSelectAll={selectAllMissingExternal}
                />
              )}
              {step === 3 && (
                <MissingLocalStepView
                  items={report.missing_on_local}
                  selected={selectedMissingLocal}
                  onToggle={toggleMissingLocal}
                  onSelectAll={selectAllMissingLocal}
                />
              )}
              {step === 4 && (
                <ReviewStepView
                  report={report}
                  selectedDrifted={selectedDrifted}
                  selectedMissingExternal={selectedMissingExternal}
                  selectedMissingLocal={selectedMissingLocal}
                  buildSyncItems={buildSyncItems}
                  onSubmit={handleSubmit}
                  isSubmitting={startBulkSync.isPending}
                />
              )}
            </Dialog.Body>

            <Dialog.Footer>
              <HStack justifyContent="space-between" width="100%">
                <Box>
                  {step > 1 && (
                    <Button variant="outline" onClick={prevStep} disabled={startBulkSync.isPending}>
                      ← Back
                    </Button>
                  )}
                </Box>
                <HStack gap={2}>
                  {step < 4 && (
                    <>
                      <Button variant="ghost" onClick={skipStep}>
                        Skip
                      </Button>
                      <Button colorPalette="blue" onClick={nextStep}>
                        Next →
                      </Button>
                    </>
                  )}
                  {startBulkSync.isError && (
                    <Text fontSize="sm" color="fg.error">
                      Failed to start sync. Please try again.
                    </Text>
                  )}
                </HStack>
              </HStack>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
};
