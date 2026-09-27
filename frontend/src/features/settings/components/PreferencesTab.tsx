import { Controller } from 'react-hook-form';
import { CurrencyCode } from '@/api/types/currency';
import { DateFormat, NumberLocale, WeekStart } from '@/api/types/preferences';
import { ThemePreference, useTheme } from '@/design';
import { usePreferences } from '@/lib/preferences';
import { Button, ButtonVariant, Field, Panel, Select } from '@/ui';
import { DATE_FORMAT_LABEL, LOCALE_LABEL, WEEK_START_LABEL } from '../forms/accountForms';
import { usePreferencesForm } from '../hooks/useAccountForms';
import { Notice } from './Notice';
import styles from './Settings.module.css';

const DATE_OPTIONS = Object.values(DateFormat).map((v) => ({
  value: v,
  label: DATE_FORMAT_LABEL[v],
}));
const LOCALE_OPTIONS = Object.values(NumberLocale).map((v) => ({
  value: v,
  label: LOCALE_LABEL[v],
}));
const WEEK_OPTIONS = [WeekStart.MONDAY, WeekStart.SUNDAY].map((v) => ({
  value: String(v),
  label: WEEK_START_LABEL[v],
}));
const THEME_LABEL: Record<ThemePreference, string> = {
  [ThemePreference.System]: 'Match system',
  [ThemePreference.Dark]: 'Dark',
  [ThemePreference.Light]: 'Light',
};

const currencyOptions = (current: string) =>
  [...new Set<string>([...Object.values(CurrencyCode), current])].map((c) => ({
    value: c,
    label: c,
  }));

/** Display preferences saved to the server, plus the theme, which stays in this browser. */
export function PreferencesTab() {
  return (
    <div className={styles.tabBody}>
      <PreferencesForm />
      <ThemePanel />
    </div>
  );
}

function PreferencesForm() {
  const { fmt } = usePreferences();
  const f = usePreferencesForm();
  const { control, formState } = f.form;
  return (
    <Panel title="Display">
      <form className={styles.form} noValidate onSubmit={(e) => void f.submit(e)}>
        <p className={styles.lead}>
          Totals across accounts are converted to the default currency. Dates and numbers everywhere
          use these formats, for example {fmt.date(new Date())} and {fmt.money(1234.5)}.
        </p>
        <div className={styles.two}>
          <Field label="Default currency" plain>
            <Controller
              control={control}
              name="default_currency"
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                  options={currencyOptions(field.value)}
                />
              )}
            />
          </Field>
          <Field label="Date format" plain>
            <Controller
              control={control}
              name="date_format"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange} options={DATE_OPTIONS} />
              )}
            />
          </Field>
          <Field label="Number format" plain>
            <Controller
              control={control}
              name="number_locale"
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                  options={LOCALE_OPTIONS}
                />
              )}
            />
          </Field>
          <Field label="Week starts on" plain>
            <Controller
              control={control}
              name="week_start"
              render={({ field }) => (
                <Select
                  value={String(field.value)}
                  onValueChange={(v) => field.onChange(Number(v) as WeekStart)}
                  options={WEEK_OPTIONS}
                />
              )}
            />
          </Field>
        </div>
        {formState.errors.root?.message ? <Notice>{formState.errors.root.message}</Notice> : null}
        <div className={styles.actions}>
          <Button
            type="submit"
            variant={ButtonVariant.Primary}
            loading={f.saving}
            disabled={!formState.isDirty}
          >
            Save preferences
          </Button>
        </div>
      </form>
    </Panel>
  );
}

function ThemePanel() {
  const { preference, setPreference } = useTheme();
  return (
    <Panel title="Theme" actions={<span className={styles.meta}>This browser only</span>}>
      <div className={`${styles.themes} moc-stagger`} role="radiogroup" aria-label="Theme">
        {Object.values(ThemePreference).map((t) => (
          <Button
            key={t}
            role="radio"
            aria-checked={preference === t}
            variant={preference === t ? ButtonVariant.Primary : ButtonVariant.Secondary}
            onClick={() => setPreference(t)}
          >
            {THEME_LABEL[t]}
          </Button>
        ))}
      </div>
    </Panel>
  );
}
