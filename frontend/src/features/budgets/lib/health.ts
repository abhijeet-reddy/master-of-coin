import { CircleCheck, OctagonAlert, TriangleAlert } from 'lucide-react';
import { BudgetHealth } from '@/api/types';
import { Tone } from '@/ui';

/** Badge label, tone and icon per server health. */
export const HEALTH = {
  [BudgetHealth.OnTrack]: { label: 'OK', tone: Tone.Pos, Icon: CircleCheck },
  [BudgetHealth.Warning]: { label: 'Warning', tone: Tone.Warn, Icon: TriangleAlert },
  [BudgetHealth.Over]: { label: 'Exceeded', tone: Tone.Crit, Icon: OctagonAlert },
};

export const healthLabel = (h: BudgetHealth) => HEALTH[h].label;
export const healthTone = (h: BudgetHealth | null) => (h ? HEALTH[h].tone : Tone.Neutral);
