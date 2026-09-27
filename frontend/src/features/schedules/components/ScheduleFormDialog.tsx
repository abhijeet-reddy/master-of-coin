import { zodResolver } from '@hookform/resolvers/zod';
import { CircleAlert } from 'lucide-react';
import { useId, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { toApiError } from '@/api/client';
import { JobType, type Schedule } from '@/api/types';
import { JOB_TYPE_LABEL } from '@/features/jobs';
import { Button, ButtonVariant, Dialog, Field, Input, Select } from '@/ui';
import {
  buildScheduleCreate,
  buildScheduleUpdate,
  scheduleDefaults,
  scheduleSchema,
  type ScheduleFormValues,
} from '../forms/scheduleForm';
import { useBankOptions, useSaveSchedule } from '../hooks/useScheduleQueries';
import {
  CRON_HINT,
  CRON_PLACEHOLDER,
  CRON_PRESETS,
  cronLabel,
  cronShapeError,
  LOOKBACK_MAX,
  LOOKBACK_MIN,
  presetFor,
  SCHEDULE_JOB_TYPES,
} from '../lib/cron';
import styles from './Schedules.module.css';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  schedule?: Schedule;
}

const TYPE_OPTIONS = SCHEDULE_JOB_TYPES.map((t) => ({ value: t, label: JOB_TYPE_LABEL[t] }));

/** Create or edit a schedule: what to run, with which parameters, and when. */
export function ScheduleFormDialog({ open, onOpenChange, schedule }: Props) {
  const formId = useId();
  const creating = !schedule;
  const save = useSaveSchedule();
  const banks = useBankOptions();
  const form = useForm<ScheduleFormValues>({
    resolver: zodResolver(scheduleSchema),
    defaultValues: scheduleDefaults(schedule),
  });
  const { register, control, watch, setValue, formState } = form;
  const errors = formState.errors;
  const jobType = watch('jobType');
  const cron = watch('cron');
  const [custom, setCustom] = useState(() => !presetFor(cron));

  const submit = form.handleSubmit(async (v) => {
    try {
      await (schedule
        ? save.mutateAsync({ id: schedule.id, patch: buildScheduleUpdate(v, schedule) })
        : save.mutateAsync({ body: buildScheduleCreate(v) }));
      onOpenChange(false);
    } catch (err) {
      form.setError('root', { message: toApiError(err).message });
    }
  });

  const preset = custom ? undefined : presetFor(cron);
  const preview = cronShapeError(cron) ? null : cronLabel(cron);

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !save.isPending && onOpenChange(o)}
      title={creating ? 'Create schedule' : 'Edit schedule'}
      description={creating ? 'Run a background job on a timetable.' : undefined}
      footer={
        <>
          <Button onClick={() => onOpenChange(false)} disabled={save.isPending}>
            Cancel
          </Button>
          <Button
            type="submit"
            form={formId}
            variant={ButtonVariant.Primary}
            loading={save.isPending}
          >
            {creating ? 'Create schedule' : 'Save changes'}
          </Button>
        </>
      }
    >
      <form id={formId} className={styles.form} onSubmit={(e) => void submit(e)} noValidate>
        <Field label="Name" required error={errors.name?.message}>
          <Input autoComplete="off" placeholder="e.g. Nightly drift check" {...register('name')} />
        </Field>
        <Field
          label="Job"
          required
          hint={creating ? undefined : 'The job cannot change once the schedule exists.'}
        >
          <Controller
            control={control}
            name="jobType"
            render={({ field }) => (
              <Select
                value={field.value}
                onValueChange={field.onChange}
                options={TYPE_OPTIONS}
                disabled={!creating}
              />
            )}
          />
        </Field>
        {jobType === JobType.DRIFT_DETECTION ? (
          <Field
            label="Lookback days"
            hint={`How far back to compare, ${LOOKBACK_MIN} to ${LOOKBACK_MAX} days.`}
            error={errors.lookback?.message}
          >
            <Input inputMode="numeric" autoComplete="off" {...register('lookback')} />
          </Field>
        ) : null}
        {jobType === JobType.BANK_SYNC ? (
          <Field label="Bank connection" required error={errors.bankProviderId?.message}>
            <Controller
              control={control}
              name="bankProviderId"
              render={({ field }) => (
                <Select
                  value={field.value || undefined}
                  onValueChange={field.onChange}
                  options={banks.options.map((b) => ({ value: b.id, label: b.name }))}
                  placeholder={
                    banks.isPending
                      ? 'Loading'
                      : banks.options.length
                        ? 'Pick a connection'
                        : 'No bank connections'
                  }
                  disabled={!banks.options.length}
                />
              )}
            />
          </Field>
        ) : null}
        <fieldset className={styles.when}>
          <legend className={styles.legend}>When</legend>
          <div className={styles.presets} role="group" aria-label="Frequency">
            {CRON_PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                aria-pressed={preset?.id === p.id}
                onClick={() => {
                  setCustom(false);
                  setValue('cron', p.expr, { shouldValidate: formState.isSubmitted });
                }}
              >
                {p.label}
              </button>
            ))}
            <button type="button" aria-pressed={custom} onClick={() => setCustom(true)}>
              Custom
            </button>
          </div>
          {custom ? (
            <Field label="Cron expression" hint={CRON_HINT} error={errors.cron?.message}>
              <Input
                autoComplete="off"
                spellCheck={false}
                className={styles.mono}
                placeholder={CRON_PLACEHOLDER}
                {...register('cron')}
              />
            </Field>
          ) : null}
          <p className={styles.preview} aria-live="polite">
            {preview ?? 'Enter a valid expression to see when it runs.'}
          </p>
        </fieldset>
        {errors.root?.message ? (
          <p className={styles.notice} role="alert">
            <CircleAlert aria-hidden />
            <span>{errors.root.message}</span>
          </p>
        ) : null}
      </form>
    </Dialog>
  );
}
