
import { describe, it, expect } from 'vitest';
import { getWindowedSeries } from './dataWindow';

describe('getWindowedSeries', () => {
  const mk = (ts: number) => ({ timestamp: new Date(ts).toISOString(), v: ts });

  it('returns latest N in ascending order', () => {
    const arr = [mk(1), mk(2), mk(3), mk(4)];
    expect(getWindowedSeries(arr, 2).map(x => x.v)).toEqual([3, 4]);
  });

  it('sorts descending inputs defensively', () => {
    const arr = [mk(4), mk(3), mk(2), mk(1)];
    expect(getWindowedSeries(arr, 3).map(x => x.v)).toEqual([2, 3, 4]);
  });
});
