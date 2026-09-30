import { describe, expect, it } from 'vitest';
import { LEVEL_1 } from '../melody/levelConfig';
import { accuracyOf, applyResult, initialProgress, withBars } from './progression';

const clean = { pitchScore: 1, rhythmScore: 0.95 };
const okay = { pitchScore: 0.8, rhythmScore: 0.7 };
const weak = { pitchScore: 0.5, rhythmScore: 0.5 };

describe('progression', () => {
  it('starts at the level start length', () => {
    expect(initialProgress(LEVEL_1).bars).toBe(1);
  });

  it('gets a bar longer after enough clean rounds in a row', () => {
    let p = initialProgress(LEVEL_1);
    let change = null;
    for (let i = 0; i < LEVEL_1.promoteAfter; i++) ({ progress: p, change } = applyResult(p, clean, LEVEL_1));
    expect(change).toBe('longer');
    expect(p.bars).toBe(2);
    expect(p.cleanStreak).toBe(0);
    expect(p.exercises).toBe(3);
  });

  it('an okay round breaks the clean streak', () => {
    let p = initialProgress(LEVEL_1);
    p = applyResult(p, clean, LEVEL_1).progress;
    p = applyResult(p, clean, LEVEL_1).progress;
    p = applyResult(p, okay, LEVEL_1).progress;
    expect(p.cleanStreak).toBe(0);
    p = applyResult(p, clean, LEVEL_1).progress;
    expect(p.bars).toBe(1);
  });

  it('gets shorter after enough weak rounds, never below one bar', () => {
    let p = withBars(initialProgress(LEVEL_1), 2, LEVEL_1);
    let change = null;
    for (let i = 0; i < LEVEL_1.demoteAfter; i++) ({ progress: p, change } = applyResult(p, weak, LEVEL_1));
    expect(change).toBe('shorter');
    expect(p.bars).toBe(1);
    for (let i = 0; i < LEVEL_1.demoteAfter; i++) ({ progress: p, change } = applyResult(p, weak, LEVEL_1));
    expect(change).toBeNull();
    expect(p.bars).toBe(1);
  });

  it('never exceeds the level maximum', () => {
    let p = withBars(initialProgress(LEVEL_1), LEVEL_1.bars, LEVEL_1);
    for (let i = 0; i < 10; i++) p = applyResult(p, clean, LEVEL_1).progress;
    expect(p.bars).toBe(LEVEL_1.bars);
  });

  it('tracks lifetime accuracy', () => {
    let p = initialProgress(LEVEL_1);
    p = applyResult(p, clean, LEVEL_1).progress;
    p = applyResult(p, weak, LEVEL_1).progress;
    expect(p.exercises).toBe(2);
    expect(p.accuracySum).toBeCloseTo(accuracyOf(clean) + accuracyOf(weak));
  });

  it('withBars clamps and resets streaks', () => {
    const p = { ...initialProgress(LEVEL_1), cleanStreak: 2 };
    expect(withBars(p, 9, LEVEL_1).bars).toBe(LEVEL_1.bars);
    expect(withBars(p, 0, LEVEL_1).bars).toBe(1);
    expect(withBars(p, 3, LEVEL_1).cleanStreak).toBe(0);
  });
});
