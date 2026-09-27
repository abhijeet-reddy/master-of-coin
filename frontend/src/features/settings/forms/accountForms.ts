/** Profile, password and preferences forms. Limits mirror backend/src/models/user.rs. */
import { z } from 'zod';
import type { User } from '@/api/types';
import { DateFormat, NumberLocale, WeekStart, type UserPreferences } from '@/api/types/preferences';

export const NAME_MAX = 100;
export const EMAIL_MAX = 255;
export const PASSWORD_MIN = 8;

export const profileSchema = z.object({
  name: z.string().trim().min(1, 'Enter your name').max(NAME_MAX, `At most ${NAME_MAX} characters`),
  email: z
    .string()
    .trim()
    .max(EMAIL_MAX, `At most ${EMAIL_MAX} characters`)
    .pipe(z.email('Enter a valid email address')),
});
export type ProfileValues = z.infer<typeof profileSchema>;

export const profileDefaults = (u: User | null): ProfileValues => ({
  name: u?.name ?? '',
  email: u?.email ?? '',
});

/** Only what changed; an empty object means nothing to save. */
export function profilePatch(v: ProfileValues, before: User | null) {
  const out: { name?: string; email?: string } = {};
  if (v.name.trim() !== (before?.name ?? '')) out.name = v.name.trim();
  if (v.email.trim() !== (before?.email ?? '')) out.email = v.email.trim();
  return out;
}

export const passwordSchema = z
  .object({
    current_password: z.string().min(1, 'Enter your current password'),
    new_password: z.string().min(PASSWORD_MIN, `At least ${PASSWORD_MIN} characters`),
    confirm: z.string(),
  })
  .refine((v) => v.confirm === v.new_password, {
    path: ['confirm'],
    message: 'Passwords do not match',
  })
  .refine((v) => v.new_password !== v.current_password || v.new_password === '', {
    path: ['new_password'],
    message: 'Choose a password different from the current one',
  });
export type PasswordValues = z.infer<typeof passwordSchema>;

export const PASSWORD_DEFAULTS: PasswordValues = {
  current_password: '',
  new_password: '',
  confirm: '',
};

export const preferencesSchema = z.object({
  default_currency: z.string().length(3),
  date_format: z.enum(DateFormat),
  number_locale: z.string().min(2),
  week_start: z.enum(WeekStart),
});
export type PreferencesValues = z.infer<typeof preferencesSchema>;

export const toPreferences = (v: PreferencesValues): UserPreferences => ({ ...v });

export const DATE_FORMAT_LABEL: Record<DateFormat, string> = {
  [DateFormat.DMY]: 'DD/MM/YYYY',
  [DateFormat.MDY]: 'MM/DD/YYYY',
  [DateFormat.ISO]: 'YYYY-MM-DD',
};

export const LOCALE_LABEL: Record<NumberLocale, string> = {
  [NumberLocale.EN_US]: 'English (US), 1,234.56',
  [NumberLocale.DE_DE]: 'German, 1.234,56',
  [NumberLocale.FR_FR]: 'French, 1 234,56',
  [NumberLocale.EN_IN]: 'English (India), 1,23,456.78',
};

export const WEEK_START_LABEL: Record<WeekStart, string> = {
  [WeekStart.MONDAY]: 'Monday',
  [WeekStart.SUNDAY]: 'Sunday',
};
