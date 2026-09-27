import { useState } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { Command } from 'cmdk';
import { Check, ChevronDown, Search } from 'lucide-react';
import { cx } from './cx';
import { useFieldControl } from './fieldContext';
import type { SelectOption } from './types';
import controls from './controls.module.css';
import styles from './Combobox.module.css';

export interface ComboboxProps<V extends string> {
  value: V | null;
  onChange: (value: V | null) => void;
  options: ReadonlyArray<SelectOption<V>>;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  /** Show a "None" row that clears the value. */
  clearable?: boolean;
  disabled?: boolean;
  'aria-label'?: string;
}

/** Type-ahead picker (people, categories, accounts). */
export function Combobox<V extends string>({
  value,
  onChange,
  options,
  placeholder = 'Select',
  searchPlaceholder = 'Search',
  emptyText = 'No matches',
  clearable = false,
  disabled,
  ...rest
}: ComboboxProps<V>) {
  const [open, setOpen] = useState(false);
  const a11y = useFieldControl({});
  const selected = options.find((o) => o.value === value);

  const pick = (next: V | null) => {
    onChange(next);
    setOpen(false);
  };

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        {...a11y}
        role="combobox"
        aria-expanded={open}
        aria-label={rest['aria-label']}
        disabled={disabled}
        className={controls.control}
      >
        <span className={cx(controls.value, !selected && controls.placeholder)}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown aria-hidden className={controls.chevron} />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className={cx(controls.popover, styles.panel)}
          align="start"
          sideOffset={4}
        >
          <Command loop>
            <div className={styles.search}>
              <Search aria-hidden />
              <Command.Input
                className={styles.searchInput}
                placeholder={searchPlaceholder}
                aria-label={searchPlaceholder}
              />
            </div>
            <Command.List className={styles.list}>
              <Command.Empty className={styles.empty}>{emptyText}</Command.Empty>
              {clearable ? (
                <Command.Item
                  className={controls.option}
                  value="__none"
                  onSelect={() => pick(null)}
                >
                  None
                </Command.Item>
              ) : null}
              {options.map((o) => (
                <Command.Item
                  key={o.value}
                  value={`${o.label} ${o.value}`}
                  disabled={o.disabled}
                  className={controls.option}
                  onSelect={() => pick(o.value)}
                >
                  <span>{o.label}</span>
                  {o.hint ? <span className={controls.optionHint}>{o.hint}</span> : null}
                  {o.value === value ? <Check aria-hidden className={controls.check} /> : null}
                </Command.Item>
              ))}
            </Command.List>
          </Command>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
