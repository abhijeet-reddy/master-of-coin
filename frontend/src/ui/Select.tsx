import * as RSelect from '@radix-ui/react-select';
import { Check, ChevronDown } from 'lucide-react';
import { cx } from './cx';
import { useFieldControl } from './fieldContext';
import type { SelectOption } from './types';
import controls from './controls.module.css';

export interface SelectProps<V extends string> {
  value: V | undefined;
  onValueChange: (value: V) => void;
  options: ReadonlyArray<SelectOption<V>>;
  placeholder?: string;
  disabled?: boolean;
  /** Needed when there is no surrounding <Field>. */
  'aria-label'?: string;
  name?: string;
  className?: string;
}

/** Single choice from a short list. Use Combobox when the list needs type-ahead. */
export function Select<V extends string>({
  value,
  onValueChange,
  options,
  placeholder = 'Select',
  disabled,
  name,
  className,
  ...rest
}: SelectProps<V>) {
  const a11y = useFieldControl({});
  return (
    <RSelect.Root
      value={value}
      onValueChange={(v) => onValueChange(v as V)}
      disabled={disabled}
      name={name}
    >
      <RSelect.Trigger
        {...a11y}
        aria-label={rest['aria-label']}
        className={cx(controls.control, className)}
      >
        <span className={controls.value}>
          <RSelect.Value
            placeholder={<span className={controls.placeholder}>{placeholder}</span>}
          />
        </span>
        <RSelect.Icon asChild>
          <ChevronDown aria-hidden className={controls.chevron} />
        </RSelect.Icon>
      </RSelect.Trigger>
      <RSelect.Portal>
        <RSelect.Content className={controls.popover} position="popper" sideOffset={4}>
          <RSelect.Viewport>
            {options.map((o) => (
              <RSelect.Item
                key={o.value}
                value={o.value}
                disabled={o.disabled}
                className={controls.option}
              >
                <RSelect.ItemText>{o.label}</RSelect.ItemText>
                {o.hint ? <span className={controls.optionHint}>{o.hint}</span> : null}
                <RSelect.ItemIndicator className={controls.check}>
                  <Check aria-hidden />
                </RSelect.ItemIndicator>
              </RSelect.Item>
            ))}
          </RSelect.Viewport>
        </RSelect.Content>
      </RSelect.Portal>
    </RSelect.Root>
  );
}
