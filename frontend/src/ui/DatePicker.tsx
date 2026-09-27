import { useState } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/style.css';
import { Calendar } from 'lucide-react';
import { WeekStart } from '@/api/types/preferences';
import { toDate, toIsoDate } from '@/lib/format';
import { usePreferences } from '@/lib/preferences';
import { Button } from './Button';
import { cx } from './cx';
import { useFieldControl } from './fieldContext';
import { ButtonVariant, ControlSize } from './types';
import controls from './controls.module.css';
import styles from './DatePicker.module.css';

export interface DatePickerProps {
  /** `YYYY-MM-DD` or null. */
  value: string | null;
  onChange: (value: string | null) => void;
  placeholder?: string;
  /** Hide the Clear button when a date is mandatory. */
  required?: boolean;
  'aria-label'?: string;
}

/** Date field: formatted in the user's pattern, calendar honours their week start. */
export function DatePicker({
  value,
  onChange,
  placeholder = 'Pick a date',
  required,
  ...rest
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const { fmt, prefs } = usePreferences();
  const a11y = useFieldControl({});
  const selected = toDate(value) ?? undefined;

  const pick = (d: Date | null) => {
    onChange(d ? toIsoDate(d) : null);
    setOpen(false);
  };

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        {...a11y}
        aria-label={rest['aria-label']}
        aria-haspopup="dialog"
        className={controls.control}
      >
        <Calendar aria-hidden className={styles.icon} />
        <span className={cx(controls.value, !selected && controls.placeholder)}>
          {selected ? fmt.date(selected) : placeholder}
        </span>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className={cx(controls.popover, styles.panel)}
          align="start"
          sideOffset={4}
          aria-label="Choose date"
        >
          <DayPicker
            className={styles.cal}
            mode="single"
            required={false}
            selected={selected}
            defaultMonth={selected}
            onSelect={(d) => pick(d ?? null)}
            weekStartsOn={prefs.week_start === WeekStart.SUNDAY ? 0 : 1}
            autoFocus
          />
          <div className={styles.foot}>
            <Button
              size={ControlSize.Sm}
              variant={ButtonVariant.Ghost}
              onClick={() => pick(new Date())}
            >
              Today
            </Button>
            {!required && selected ? (
              <Button
                size={ControlSize.Sm}
                variant={ButtonVariant.Ghost}
                onClick={() => pick(null)}
              >
                Clear
              </Button>
            ) : null}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
