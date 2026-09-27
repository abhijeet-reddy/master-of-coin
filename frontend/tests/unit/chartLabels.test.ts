import { describe, expect, it } from 'vitest';
import { labelIndices } from '@/charts/geometry';

describe('labelIndices', () => {
  it('keeps every label when there is room', () => {
    expect(labelIndices(4, 400, 64)).toEqual([0, 1, 2, 3]);
  });

  it('thins labels and always ends on the last one', () => {
    const out = labelIndices(180, 285, 81);
    expect(out[0]).toBe(0);
    expect(out[out.length - 1]).toBe(179);
    const pitch = 285 / 179;
    for (let i = 1; i < out.length; i++)
      expect((out[i] - out[i - 1]) * pitch).toBeGreaterThanOrEqual(81);
  });

  it('drops the label before the end-anchored last one when they would touch', () => {
    // 27 daily points on a narrow chart: 18 and 26 sit 81px apart, too close for an end-anchored label.
    const out = labelIndices(27, 265, 81);
    expect(out).toEqual([0, 9, 26]);
  });
});
