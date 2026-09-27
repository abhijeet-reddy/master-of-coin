import type { CSSProperties } from 'react';
import { useId } from 'react';
import { Controller, useWatch } from 'react-hook-form';
import type { Category } from '@/api/types';
import { Button, ButtonVariant, Dialog, Field, Input, Switch } from '@/ui';
import { HEX_RE, ICON_SUGGESTIONS, PALETTE } from '../forms/categoryForm';
import { useCategoryForm } from '../hooks/useCategoryForm';
import { CategoryTile } from './CategoryTile';
import { Notice } from './Notice';
import styles from './Categories.module.css';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category?: Category;
}

/** Create or edit a category: name, emoji, colour, and (editing) the analysis exclusion. */
export function CategoryFormDialog({ open, onOpenChange, category }: Props) {
  const formId = useId();
  const f = useCategoryForm(category, () => onOpenChange(false));
  const { control, register, formState, setValue } = f.form;
  const errors = formState.errors;
  const [name, icon, color] = useWatch({ control, name: ['name', 'icon', 'color'] });
  const validColor = HEX_RE.test(color.trim()) ? color.trim() : '';

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !f.saving && onOpenChange(o)}
      title={f.creating ? 'Create category' : 'Edit category'}
      description={f.creating ? 'Group transactions for budgets and reports.' : undefined}
      footer={
        <>
          <Button onClick={() => onOpenChange(false)} disabled={f.saving}>
            Cancel
          </Button>
          <Button type="submit" form={formId} variant={ButtonVariant.Primary} loading={f.saving}>
            {f.creating ? 'Create category' : 'Save changes'}
          </Button>
        </>
      }
    >
      <form id={formId} className={styles.form} onSubmit={(e) => void f.submit(e)} noValidate>
        <div className={styles.preview} aria-hidden>
          <CategoryTile category={{ icon, color: validColor }} />
          <span className={styles.previewName}>{name.trim() || 'New category'}</span>
        </div>
        <Field label="Name" required error={errors.name?.message}>
          <Input autoComplete="off" placeholder="e.g. Groceries" {...register('name')} />
        </Field>
        <Field label="Icon" error={errors.icon?.message} hint="One emoji. Leave empty for none.">
          <Input autoComplete="off" placeholder="📁" {...register('icon')} />
        </Field>
        <div className={styles.picks} role="group" aria-label="Suggested icons">
          {ICON_SUGGESTIONS.map((e) => (
            <button
              key={e}
              type="button"
              aria-label={`Use ${e}`}
              aria-pressed={icon.trim() === e}
              onClick={() => setValue('icon', e, { shouldDirty: true, shouldValidate: true })}
            >
              {e}
            </button>
          ))}
        </div>
        <Field
          label="Colour"
          error={errors.color?.message}
          hint="Hex, e.g. #3987E5. Leave empty for none."
        >
          <div className={styles.colorRow}>
            <input
              type="color"
              className={styles.colorWell}
              aria-label="Pick a colour"
              value={validColor || '#8F8F8F'}
              onChange={(e) =>
                setValue('color', e.target.value.toUpperCase(), {
                  shouldDirty: true,
                  shouldValidate: true,
                })
              }
            />
            <Input
              autoComplete="off"
              placeholder="#3987E5"
              spellCheck={false}
              {...register('color')}
            />
          </div>
        </Field>
        <div
          className={`${styles.picks} ${styles.swatches}`}
          role="group"
          aria-label="Suggested colours"
        >
          {PALETTE.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={`Use colour ${c}`}
              aria-pressed={validColor.toUpperCase() === c}
              style={{ '--c': c } as CSSProperties}
              onClick={() => setValue('color', c, { shouldDirty: true, shouldValidate: true })}
            />
          ))}
        </div>
        {f.creating ? null : (
          <Controller
            control={control}
            name="excluded"
            render={({ field }) => (
              <Switch
                checked={field.value}
                onCheckedChange={field.onChange}
                label="Exclude from analysis"
                description="Leaves it out of the dashboard, reports and all-spending budgets. Its transactions stay in the ledger."
              />
            )}
          />
        )}
        {errors.root?.message ? <Notice>{errors.root.message}</Notice> : null}
      </form>
    </Dialog>
  );
}
