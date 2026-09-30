import { describe, expect, it } from 'vitest';
import { align } from './align';

const cost = (t: string, a: string) => (t === a ? 0 : 1);
const show = (pairs: ReturnType<typeof align>) => pairs.map((p) => `${p.target ?? '-'}:${p.answer ?? '-'}`).join(' ');

describe('align', () => {
  it('pairs identical sequences one to one', () => {
    expect(show(align(['C', 'D', 'E'], ['C', 'D', 'E'], cost))).toBe('0:0 1:1 2:2');
  });

  it('detects an extra note without shifting the rest', () => {
    expect(show(align(['C', 'D', 'E'], ['C', 'X', 'D', 'E'], cost))).toBe('0:0 -:1 1:2 2:3');
  });

  it('detects a missing note', () => {
    expect(show(align(['C', 'D', 'E', 'F'], ['C', 'E', 'F'], cost))).toBe('0:0 1:- 2:1 3:2');
  });

  it('prefers a substitution over a delete plus insert', () => {
    expect(show(align(['C', 'D', 'E'], ['C', 'X', 'E'], cost))).toBe('0:0 1:1 2:2');
  });

  it('handles empty answers and empty targets', () => {
    expect(show(align(['C', 'D'], [], cost))).toBe('0:- 1:-');
    expect(show(align([], ['C'], cost))).toBe('-:0');
    expect(align([], [], cost)).toEqual([]);
  });

  it('uses partial costs to pair near matches', () => {
    const near = (t: string, a: string) => (t === a ? 0 : t.toLowerCase() === a.toLowerCase() ? 0.3 : 1);
    // 'd' is a near match for 'D' and should pair rather than be treated as extra.
    expect(show(align(['C', 'D', 'E'], ['C', 'd', 'E'], near))).toBe('0:0 1:1 2:2');
  });
});
