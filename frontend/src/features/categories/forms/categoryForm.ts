/** Category create/edit form: schema, defaults and request builder. */
import { z } from 'zod';
import type { Category } from '@/api/types';
import type { CategoryWrite } from '@/api/categories';

export const NAME_MAX = 100;
/** Emoji can be several code points (flags, skin tones); the server allows 50. */
export const ICON_MAX = 10;
export const HEX_RE = /^#[0-9a-fA-F]{6}$/;
export const DEFAULT_ICON = '📁';

/** A readable palette for new categories: the chart categorical set. */
export const PALETTE = [
  '#3987E5',
  '#D95926',
  '#199E70',
  '#C98500',
  '#D55181',
  '#008300',
  '#9085E9',
  '#E66767',
] as const;

export const ICON_SUGGESTIONS = [
  '🛒',
  '🍽️',
  '☕',
  '🏠',
  '🚗',
  '🚆',
  '💡',
  '📱',
  '🎬',
  '✈️',
  '💊',
  '🎁',
] as const;

export const categorySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Name is required')
    .max(NAME_MAX, `Keep the name under ${NAME_MAX} characters`),
  icon: z
    .string()
    .trim()
    .refine((v) => [...v].length <= ICON_MAX, 'Use one emoji'),
  color: z
    .string()
    .trim()
    .refine((v) => v === '' || HEX_RE.test(v), 'Use a hex colour like #3987E5'),
  excluded: z.boolean(),
});

export type CategoryFormValues = z.infer<typeof categorySchema>;

export const CATEGORY_FIELDS = ['name', 'icon', 'color'] as const;

/** Picks a palette colour; `seed` makes it deterministic in tests. */
export function pickColor(seed: number = Math.random()): string {
  return PALETTE[Math.floor(Math.abs(seed) * PALETTE.length) % PALETTE.length];
}

export function categoryDefaults(c?: Category, seed?: number): CategoryFormValues {
  if (!c) return { name: '', icon: DEFAULT_ICON, color: pickColor(seed), excluded: false };
  return {
    name: c.name,
    icon: c.icon ?? '',
    color: c.color ?? '',
    excluded: !!c.is_excluded_from_analysis,
  };
}

/**
 * The request body. Create leaves out an empty icon or colour; update sends
 * them as empty strings, since the server treats a missing field as unchanged.
 * The exclusion flag is only sent on update, when it changed.
 */
export function buildCategoryRequest(
  v: CategoryFormValues,
  before?: Category
): CategoryWrite & { is_excluded_from_analysis?: boolean } {
  const name = v.name.trim();
  const icon = v.icon.trim();
  const color = v.color.trim().toUpperCase();
  if (!before) {
    return { name, ...(icon ? { icon } : {}), ...(color ? { color } : {}) };
  }
  const out: CategoryWrite & { is_excluded_from_analysis?: boolean } = { name, icon, color };
  if (v.excluded !== !!before.is_excluded_from_analysis) out.is_excluded_from_analysis = v.excluded;
  return out;
}
