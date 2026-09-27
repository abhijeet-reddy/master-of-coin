import { DatePicker, Field, Select } from '@/ui';
import { usePreferences } from '@/lib/preferences';
import type { useReportParams } from '../hooks/useReportParams';
import { daysIn, RANGE_LABEL, RANGE_PRESETS, RangePreset } from '../lib/reportRange';
import styles from './Reports.module.css';

const OPTIONS = RANGE_PRESETS.map((p) => ({ value: p, label: RANGE_LABEL[p] }));

/** Period picker: a preset, or custom from and to dates. */
export function RangeBar({ report }: { report: ReturnType<typeof useReportParams> }) {
  const { fmt } = usePreferences();
  const { range, preset } = report;
  const days = daysIn(range);
  return (
    <div className={`${styles.bar} moc-stagger`} role="group" aria-label="Report period">
      <Field label="Period" plain>
        <Select value={preset} onValueChange={report.setPreset} options={OPTIONS} />
      </Field>
      {preset === RangePreset.Custom ? (
        <>
          <Field label="From" plain>
            <DatePicker
              value={range.from}
              required
              onChange={(v) => v && report.setDates({ from: v })}
            />
          </Field>
          <Field label="To" plain>
            <DatePicker
              value={range.to}
              required
              onChange={(v) => v && report.setDates({ to: v })}
            />
          </Field>
        </>
      ) : null}
      <p className={styles.span} aria-live="polite">
        {fmt.date(range.from)} to {fmt.date(range.to)}, {days} {days === 1 ? 'day' : 'days'}
      </p>
    </div>
  );
}
