import { DateStyle } from '@/lib/format';
import { usePreferences } from '@/lib/preferences';
import {
  Button,
  ButtonVariant,
  Chip,
  Combobox,
  ControlSize,
  DatePicker,
  Field,
  Input,
  Select,
  Switch,
} from '@/ui';
import { useDebouncedDraft } from '../hooks/useDebouncedDraft';
import type { TransactionFiltersApi } from '../hooks/useTransactionFilters';
import { useAccounts, useCategories, usePeople } from '../hooks/useTxQueries';
import {
  activeChips,
  rangeImpliesOut,
  UNCATEGORISED,
  type Direction,
  type PaidBy,
} from '../lib/filters';
import { accountOptions, categoryOptions, personOptions } from '../lib/options';
import { Segmented } from './Segmented';
import styles from './Transactions.module.css';

const ALL = 'all';
const DIRS: { value: Direction; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'in', label: 'Money in' },
  { value: 'out', label: 'Money out' },
];
const PAID: { value: PaidBy; label: string }[] = [
  { value: 'all', label: 'Include' },
  { value: 'only', label: 'Only these' },
  { value: 'exclude', label: 'Hide them' },
];

const num = (s: string) => {
  const n = Number(s);
  return s.trim() === '' || !Number.isFinite(n) ? undefined : Math.abs(n);
};

/** Search box; its own component so the rail header can show it on phones. */
export function SearchField({ f }: { f: TransactionFiltersApi }) {
  const [q, setQ] = useDebouncedDraft(f.filters.q, (v) => f.setFilters({ q: v }));
  return (
    <Field label="Search" plain>
      <Input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search title and notes"
      />
    </Field>
  );
}

/** Every filter except search. Rendered in the rail on desktop and in a sheet on phones. */
export function FilterFields({ f }: { f: TransactionFiltersApi }) {
  const accounts = useAccounts();
  const categories = useCategories();
  const people = usePeople();
  const v = f.filters;
  const pinned = f.scope;
  const [min, setMin] = useDebouncedDraft(v.min == null ? '' : String(v.min), (s) =>
    f.setFilters({ min: num(s) })
  );
  const [max, setMax] = useDebouncedDraft(v.max == null ? '' : String(v.max), (s) =>
    f.setFilters({ max: num(s) })
  );

  return (
    <>
      {pinned?.accountId ? null : (
        <Field label="Account" plain>
          <Combobox
            value={v.account[0] ?? ALL}
            onChange={(id) => f.setFilters({ account: !id || id === ALL ? [] : [id] })}
            options={[{ value: ALL, label: 'All accounts' }, ...accountOptions(accounts.data)]}
            searchPlaceholder="Search accounts"
          />
        </Field>
      )}
      {pinned?.categoryId ? null : (
        <Field label="Category" plain>
          <Combobox
            value={v.category[0] ?? ALL}
            onChange={(id) => f.setFilters({ category: !id || id === ALL ? [] : [id] })}
            options={[
              { value: ALL, label: 'All categories' },
              { value: UNCATEGORISED, label: 'Uncategorised' },
              ...categoryOptions(categories.data),
            ]}
            searchPlaceholder="Search categories"
          />
        </Field>
      )}
      {pinned?.personId ? null : (
        <Field label="Person" plain hint="Split with, or paid by, this person.">
          <Combobox
            value={v.person ?? ALL}
            onChange={(id) => f.setFilters({ person: !id || id === ALL ? undefined : id })}
            options={[{ value: ALL, label: 'Anyone' }, ...personOptions(people.data)]}
            searchPlaceholder="Search people"
          />
        </Field>
      )}
      <div className={styles.two}>
        <Field label="From" plain>
          <DatePicker
            value={v.from ?? null}
            onChange={(d) => f.setFilters({ from: d ?? undefined })}
            placeholder="Month start"
          />
        </Field>
        <Field label="To" plain>
          <DatePicker
            value={v.to ?? null}
            onChange={(d) => f.setFilters({ to: d ?? undefined })}
            placeholder="Month end"
          />
        </Field>
      </div>
      <div className={styles.two}>
        <Field label="Min amount" plain>
          <Input
            numeric
            inputMode="decimal"
            value={min}
            onChange={(e) => setMin(e.target.value)}
            placeholder="0.00"
          />
        </Field>
        <Field label="Max amount" plain>
          <Input
            numeric
            inputMode="decimal"
            value={max}
            onChange={(e) => setMax(e.target.value)}
            placeholder="Any"
          />
        </Field>
      </div>
      {rangeImpliesOut(v) ? (
        <p className={styles.hint}>An amount range with direction All matches money out.</p>
      ) : null}
      <Segmented
        legend="Direction"
        value={v.dir}
        options={DIRS}
        onChange={(dir) => f.setFilters({ dir })}
      />
      <div className={styles.swList}>
        <Switch
          checked={v.splits}
          onCheckedChange={(on) => f.setFilters({ splits: on })}
          label="Has splits"
        />
        <Switch
          checked={v.transfer}
          onCheckedChange={(on) => f.setFilters({ transfer: on })}
          label="In a transfer"
        />
      </div>
      <Field label="Paid by others" plain>
        <Select value={v.paid} onValueChange={(paid) => f.setFilters({ paid })} options={PAID} />
      </Field>
    </>
  );
}

/** Removable chips for every active filter, then Clear filters. */
export function FilterChips({ f }: { f: TransactionFiltersApi }) {
  const { fmt } = usePreferences();
  const accounts = useAccounts();
  const categories = useCategories();
  const people = usePeople();
  const chips = activeChips(f.filters, {
    account: (id) => accounts.data?.find((a) => a.id === id)?.name,
    category: (id) => categories.data?.find((c) => c.id === id)?.name,
    person: (id) => people.data?.find((p) => p.id === id)?.name,
    date: (iso) => fmt.date(iso, DateStyle.Medium),
  });
  if (!chips.length) return null;
  return (
    <>
      <div className={styles.chips} aria-label="Active filters" role="group">
        {chips.map((c) => (
          <Chip
            key={c.key}
            onRemove={() => f.setFilters(c.clear)}
            removeLabel={`Remove ${c.label} filter`}
          >
            {c.label}
          </Chip>
        ))}
      </div>
      <Button
        variant={ButtonVariant.Ghost}
        size={ControlSize.Sm}
        className={styles.clear}
        onClick={f.clear}
      >
        Clear filters
      </Button>
    </>
  );
}
