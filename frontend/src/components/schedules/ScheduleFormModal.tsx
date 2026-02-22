import { useCallback, useEffect, useReducer } from 'react';
import {
  Badge,
  Button,
  CloseButton,
  Dialog,
  Field,
  Input,
  Portal,
  Stack,
  Text,
  VStack,
} from '@chakra-ui/react';
import { CronPresetSelector } from './CronPresetSelector';
import { useCreateSchedule, useUpdateSchedule } from '@/hooks/api/useSchedules';
import { CRON_PRESETS, JobType } from '@/types';
import type { Schedule } from '@/types';

interface ScheduleFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** When provided, the modal operates in edit mode with pre-filled data */
  editSchedule?: Schedule;
}

interface FormState {
  name: string;
  jobType: JobType;
  cronExpr: string;
  isAdvanced: boolean;
  lookbackDays: string;
}

type FormAction =
  | { type: 'SET_NAME'; value: string }
  | { type: 'SET_JOB_TYPE'; value: JobType }
  | { type: 'SET_CRON'; value: string }
  | { type: 'TOGGLE_ADVANCED' }
  | { type: 'SET_LOOKBACK_DAYS'; value: string }
  | { type: 'RESET'; initial: FormState };

const defaultState: FormState = {
  name: '',
  jobType: JobType.DRIFT_DETECTION,
  cronExpr: CRON_PRESETS[0].value,
  isAdvanced: false,
  lookbackDays: '7',
};

/** Derive initial form state from an existing schedule (edit mode) */
function deriveInitialState(schedule?: Schedule): FormState {
  if (!schedule) return defaultState;

  const isPreset = CRON_PRESETS.some((p) => p.value === schedule.cron_expr);
  const lookback = schedule.parameters?.lookback_days;

  return {
    name: schedule.name,
    jobType: (schedule.job_type as JobType) ?? JobType.DRIFT_DETECTION,
    cronExpr: schedule.cron_expr,
    isAdvanced: !isPreset,
    lookbackDays: typeof lookback === 'number' ? String(lookback) : '7',
  };
}

function formReducer(state: FormState, action: FormAction): FormState {
  switch (action.type) {
    case 'SET_NAME':
      return { ...state, name: action.value };
    case 'SET_JOB_TYPE':
      return { ...state, jobType: action.value };
    case 'SET_CRON':
      return { ...state, cronExpr: action.value };
    case 'TOGGLE_ADVANCED':
      return { ...state, isAdvanced: !state.isAdvanced };
    case 'SET_LOOKBACK_DAYS':
      return { ...state, lookbackDays: action.value };
    case 'RESET':
      return action.initial;
    default:
      return state;
  }
}

export const ScheduleFormModal = ({ isOpen, onClose, editSchedule }: ScheduleFormModalProps) => {
  const isEditMode = !!editSchedule;
  const initial = deriveInitialState(editSchedule);

  const [form, dispatch] = useReducer(formReducer, initial);
  const createSchedule = useCreateSchedule();
  const updateSchedule = useUpdateSchedule();

  const isPending = isEditMode ? updateSchedule.isPending : createSchedule.isPending;

  // Reset form when the modal opens or the schedule changes
  useEffect(() => {
    if (isOpen) {
      dispatch({ type: 'RESET', initial: deriveInitialState(editSchedule) });
    }
  }, [isOpen, editSchedule]);

  const handleSubmit = useCallback(() => {
    const parameters: Record<string, unknown> = {};
    if (form.jobType === JobType.DRIFT_DETECTION) {
      parameters.lookback_days = parseInt(form.lookbackDays, 10) || 7;
    }

    const params = Object.keys(parameters).length > 0 ? parameters : undefined;

    if (isEditMode && editSchedule) {
      updateSchedule.mutate(
        {
          id: editSchedule.id,
          request: {
            name: form.name,
            cron_expr: form.cronExpr,
            parameters: params,
          },
        },
        {
          onSuccess: () => {
            onClose();
          },
        }
      );
    } else {
      createSchedule.mutate(
        {
          name: form.name,
          job_type: form.jobType,
          cron_expr: form.cronExpr,
          parameters: params,
        },
        {
          onSuccess: () => {
            dispatch({ type: 'RESET', initial: defaultState });
            onClose();
          },
        }
      );
    }
  }, [form, isEditMode, editSchedule, createSchedule, updateSchedule, onClose]);

  const isValid = form.name.trim().length > 0 && form.cronExpr.trim().length > 0;

  return (
    <Dialog.Root
      lazyMount
      open={isOpen}
      onOpenChange={(e) => {
        if (!e.open) {
          dispatch({ type: 'RESET', initial: deriveInitialState(editSchedule) });
          onClose();
        }
      }}
      size="md"
    >
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>{isEditMode ? 'Edit Schedule' : 'Create Schedule'}</Dialog.Title>
              <Dialog.CloseTrigger asChild>
                <CloseButton size="sm" />
              </Dialog.CloseTrigger>
            </Dialog.Header>

            <Dialog.Body>
              <Stack gap={4}>
                {/* Schedule Name */}
                <Field.Root>
                  <Field.Label>Schedule Name</Field.Label>
                  <Input
                    placeholder="e.g. Weekly drift check"
                    value={form.name}
                    onChange={(e) => dispatch({ type: 'SET_NAME', value: e.target.value })}
                  />
                </Field.Root>

                {/* Job Type — only Drift Detection is supported for schedules */}
                <Field.Root>
                  <Field.Label>Job Type</Field.Label>
                  <Badge variant="surface" colorPalette="blue" size="lg" px={3} py={1}>
                    Drift Detection
                  </Badge>
                </Field.Root>

                {/* Type-specific parameters */}
                {form.jobType === JobType.DRIFT_DETECTION && (
                  <Field.Root>
                    <Field.Label>Lookback Days</Field.Label>
                    <Input
                      type="number"
                      min={1}
                      max={365}
                      value={form.lookbackDays}
                      onChange={(e) =>
                        dispatch({ type: 'SET_LOOKBACK_DAYS', value: e.target.value })
                      }
                    />
                    <Field.HelperText>
                      Number of days to look back for drift detection
                    </Field.HelperText>
                  </Field.Root>
                )}

                {/* Cron Frequency */}
                <Field.Root>
                  <Field.Label>
                    Frequency
                    <Button
                      variant="ghost"
                      size="xs"
                      ml={2}
                      onClick={() => dispatch({ type: 'TOGGLE_ADVANCED' })}
                    >
                      {form.isAdvanced ? 'Simple' : 'Advanced'}
                    </Button>
                  </Field.Label>

                  {form.isAdvanced ? (
                    <VStack gap={2} alignItems="stretch">
                      <Input
                        placeholder="0 0 * * 0"
                        value={form.cronExpr}
                        onChange={(e) => dispatch({ type: 'SET_CRON', value: e.target.value })}
                        fontFamily="mono"
                      />
                      <Text fontSize="xs" color="fg.muted">
                        5-field cron: minute hour day-of-month month day-of-week
                      </Text>
                    </VStack>
                  ) : (
                    <CronPresetSelector
                      value={form.cronExpr}
                      onChange={(v) => dispatch({ type: 'SET_CRON', value: v })}
                    />
                  )}
                </Field.Root>
              </Stack>
            </Dialog.Body>

            <Dialog.Footer>
              <Dialog.ActionTrigger asChild>
                <Button variant="outline" disabled={isPending}>
                  Cancel
                </Button>
              </Dialog.ActionTrigger>
              <Button
                colorPalette="blue"
                onClick={handleSubmit}
                loading={isPending}
                disabled={!isValid}
              >
                {isEditMode ? 'Save Changes' : 'Create Schedule'}
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
};
