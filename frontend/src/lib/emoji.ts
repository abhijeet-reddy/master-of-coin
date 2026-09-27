const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });

/**
 * True when `value` is one visible glyph. Counts graphemes, not code points, so
 * compound emoji (ZWJ sequences like 🏋️‍♂️, skin tones, flags) count as one.
 */
export function isSingleGlyph(value: string | null | undefined): value is string {
  if (!value) return false;
  let n = 0;
  for (const _ of segmenter.segment(value)) if (++n > 1) return false;
  return n === 1;
}
