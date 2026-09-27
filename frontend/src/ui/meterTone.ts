import { Tone } from './types';

/** Budget-style tone: crit at or over the limit, warn from `warnAt` percent. */
export function meterTone(percent: number, warnAt = 80): Tone {
  if (!Number.isFinite(percent)) return Tone.Neutral;
  if (percent >= 100) return Tone.Crit;
  if (percent >= warnAt) return Tone.Warn;
  return Tone.Pos;
}
