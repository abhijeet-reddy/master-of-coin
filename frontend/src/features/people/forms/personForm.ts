import { z } from 'zod';
import type { Person } from '@/api/types';
import type { UpdatePersonData } from '@/api/people';

export const NAME_MAX = 100;
export const PHONE_MAX = 20;
export const NOTES_MAX = 500;

export const personSchema = z.object({
  name: z.string().trim().min(1, 'Enter a name').max(NAME_MAX, `At most ${NAME_MAX} characters`),
  email: z
    .string()
    .trim()
    .refine((v) => v === '' || z.email().safeParse(v).success, 'Enter a valid email address'),
  phone: z.string().trim().max(PHONE_MAX, `At most ${PHONE_MAX} characters`),
  notes: z.string().trim().max(NOTES_MAX, `At most ${NOTES_MAX} characters`),
});

export type PersonFormValues = z.infer<typeof personSchema>;

export function personDefaults(p?: Person): PersonFormValues {
  return {
    name: p?.name ?? '',
    email: p?.email ?? '',
    phone: p?.phone ?? '',
    notes: p?.notes ?? '',
  };
}

export interface PersonCreate {
  name: string;
  email?: string;
  phone?: string;
  notes?: string;
}

/** Create: empty fields are left out. */
export function buildPersonCreate(v: PersonFormValues): PersonCreate {
  const out: PersonCreate = { name: v.name.trim() };
  for (const k of ['email', 'phone', 'notes'] as const) {
    const t = v[k].trim();
    if (t) out[k] = t;
  }
  return out;
}

/** Update: only what changed; a cleared field is sent as null. */
export function buildPersonUpdate(v: PersonFormValues, before: Person): UpdatePersonData {
  const out: UpdatePersonData = {};
  if (v.name.trim() !== before.name) out.name = v.name.trim();
  for (const k of ['email', 'phone', 'notes'] as const) {
    const t = v[k].trim();
    if (t !== (before[k] ?? '')) out[k] = t || null;
  }
  return out;
}
