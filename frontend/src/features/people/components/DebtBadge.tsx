import type { Person } from '@/api/types';
import { Badge, Tone } from '@/ui';
import { DEBT_LABEL, DebtDirection, personNet } from '../lib/peopleModel';

const TONE: Record<DebtDirection, Tone> = {
  [DebtDirection.OwesMe]: Tone.Pos,
  [DebtDirection.IOwe]: Tone.Crit,
  [DebtDirection.Settled]: Tone.Neutral,
};

/** Which way the debt runs, in words (colour is only a second cue). */
export function DebtBadge({ person }: { person: Pick<Person, 'debt_summary'> }) {
  const d = personNet(person).direction;
  return <Badge tone={TONE[d]}>{DEBT_LABEL[d]}</Badge>;
}
