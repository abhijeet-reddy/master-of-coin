import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { ROTATE_MS, useAlertRotation } from '@/app/shell/useAlertRotation';

describe('useAlertRotation', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('advances every interval and wraps', () => {
    const { result } = renderHook(() => useAlertRotation(3));
    expect(result.current.index).toBe(0);
    act(() => vi.advanceTimersByTime(ROTATE_MS));
    expect(result.current.index).toBe(1);
    act(() => vi.advanceTimersByTime(ROTATE_MS * 2));
    expect(result.current.index).toBe(0);
  });

  it('holds while hovered or focused', () => {
    const { result } = renderHook(() => useAlertRotation(3));
    act(() => result.current.holdHandlers.onPointerEnter());
    act(() => vi.advanceTimersByTime(ROTATE_MS * 3));
    expect(result.current.index).toBe(0);
    act(() => result.current.holdHandlers.onPointerLeave());
    act(() => vi.advanceTimersByTime(ROTATE_MS));
    expect(result.current.index).toBe(1);
  });

  it('stops while paused and starts paused for reduced motion', () => {
    const { result } = renderHook(() => useAlertRotation(2, ROTATE_MS, true));
    expect(result.current.paused).toBe(true);
    act(() => vi.advanceTimersByTime(ROTATE_MS * 2));
    expect(result.current.index).toBe(0);
    act(() => result.current.togglePause());
    act(() => vi.advanceTimersByTime(ROTATE_MS));
    expect(result.current.index).toBe(1);
  });

  it('does not rotate a single alert', () => {
    const { result } = renderHook(() => useAlertRotation(1));
    act(() => vi.advanceTimersByTime(ROTATE_MS * 4));
    expect(result.current.index).toBe(0);
  });
});
