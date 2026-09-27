/** Pure helpers for linking a person to a Splitwise or SplitPro friend. */
import type { SplitProvider, SplitwiseFriend } from '@/api/types';
import { SplitProviderType } from '@/api/types';

export const PROVIDER_LABEL: Record<string, string> = {
  [SplitProviderType.SPLITWISE]: 'Splitwise',
  [SplitProviderType.SPLITPRO]: 'SplitPro',
};

export const providerLabel = (type: string) => PROVIDER_LABEL[type] ?? type;

/** Only connected, active providers can be linked. */
export const activeProviders = (list: readonly SplitProvider[]) => list.filter((p) => p.is_active);

export const friendName = (f: Pick<SplitwiseFriend, 'full_name' | 'first_name' | 'last_name'>) =>
  f.full_name?.trim() || [f.first_name, f.last_name].filter(Boolean).join(' ').trim() || 'Unnamed';

/** Friend options, with the email as the hint; sorted by name. */
export function friendOptions(friends: readonly SplitwiseFriend[]) {
  return friends
    .map((f) => ({ value: String(f.id), label: friendName(f), hint: f.email || undefined }))
    .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));
}

/** Suggest the friend whose email or name matches the person. */
export function suggestFriend(
  friends: readonly SplitwiseFriend[],
  person: { name: string; email?: string | null }
): string | null {
  const email = person.email?.trim().toLocaleLowerCase();
  if (email) {
    const byEmail = friends.find((f) => f.email?.toLocaleLowerCase() === email);
    if (byEmail) return String(byEmail.id);
  }
  const name = person.name.trim().toLocaleLowerCase();
  const byName = friends.filter((f) => friendName(f).toLocaleLowerCase() === name);
  return byName.length === 1 ? String(byName[0].id) : null;
}
