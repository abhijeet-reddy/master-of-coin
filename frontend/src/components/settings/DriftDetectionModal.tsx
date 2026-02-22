import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Button,
  CloseButton,
  Dialog,
  Field,
  Input,
  Portal,
  Text,
  VStack,
} from '@chakra-ui/react';
import { useStartDriftDetection } from '@/hooks/api/useDriftDetection';

interface DriftDetectionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/** Returns YYYY-MM-DD for the first day of the current month */
function getStartOfMonth(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}-01`;
}

/** Returns YYYY-MM-DD for today */
function getToday(): string {
  const now = new Date();
  return now.toISOString().split('T')[0];
}

/**
 * Modal for triggering a drift detection job with date range inputs.
 * Uses Chakra Dialog + Field components for proper form structure.
 * On submit, calls startDriftDetection and navigates to the job detail page.
 */
export const DriftDetectionModal = ({ isOpen, onClose }: DriftDetectionModalProps) => {
  const navigate = useNavigate();
  const startDriftDetection = useStartDriftDetection();
  const [startDate, setStartDate] = useState(getStartOfMonth);
  const [endDate, setEndDate] = useState(getToday);

  const handleSubmit = useCallback(() => {
    startDriftDetection.mutate(
      { start_date: startDate, end_date: endDate },
      {
        onSuccess: (data) => {
          onClose();
          void navigate(`/jobs/drift-detection/${data.job_id}`);
        },
      }
    );
  }, [startDriftDetection, startDate, endDate, onClose, navigate]);

  const isValid = startDate.length > 0 && endDate.length > 0 && startDate <= endDate;

  return (
    <Dialog.Root open={isOpen} onOpenChange={(e) => !e.open && onClose()} size="md">
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>Run Drift Detection Job</Dialog.Title>
              <Dialog.CloseTrigger asChild>
                <CloseButton size="sm" />
              </Dialog.CloseTrigger>
            </Dialog.Header>

            <Dialog.Body>
              <VStack gap={4} alignItems="stretch">
                <Text fontSize="sm" color="fg.muted">
                  Compare local transactions with your external split provider to find differences.
                </Text>

                <Field.Root>
                  <Field.Label>Start Date</Field.Label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </Field.Root>

                <Field.Root>
                  <Field.Label>End Date</Field.Label>
                  <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                </Field.Root>

                {startDriftDetection.isError && (
                  <Alert.Root status="error" size="sm">
                    <Alert.Indicator />
                    <Alert.Title>Failed to start drift detection. Please try again.</Alert.Title>
                  </Alert.Root>
                )}
              </VStack>
            </Dialog.Body>

            <Dialog.Footer>
              <Dialog.ActionTrigger asChild>
                <Button variant="outline" disabled={startDriftDetection.isPending}>
                  Cancel
                </Button>
              </Dialog.ActionTrigger>
              <Button
                colorPalette="blue"
                onClick={handleSubmit}
                loading={startDriftDetection.isPending}
                disabled={!isValid}
              >
                Run Drift Detection Job
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
};
