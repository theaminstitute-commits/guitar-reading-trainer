import { describe, expect, it } from 'vitest';
import { MAX_COUNTS, MIN_COUNTS } from '../melody/meter';
import { STAGES } from '../melody/stages';
import { accuracyOf, applyResult, initialProgress, withCounts, withStage, withUnlocked, type Progress } from './progression';

const clean = { pitchScore: 1, rhythmScore: 0.95 };
const okay = { pitchScore: 0.8, rhythmScore: 0.7 };
const weak = { pitchScore: 0.5, rhythmScore: 0.5 };

function run(p: Progress, result: typeof clean, times: number) {
  let change = null;
  for (let i = 0; i < times; i++) ({ progress: p, change } = applyResult(p, result, STAGES));
  return { p, change };
}

describe('stage ladder progression', () => {
  it('starts at stage 1 with one bar of 4/4', () => {
    const p = initialProgress(STAGES);
    expect(p.stage).toBe(0);
    expect(p.counts).toBe(MIN_COUNTS);
  });

  it('gets one count longer after enough clean rounds in a row', () => {
    const { p, change } = run(initialProgress(STAGES), clean, STAGES[0]!.promoteAfter);
    expect(change).toBe('longer');
    expect(p.counts).toBe(5);
    expect(p.cleanStreak).toBe(0);
    expect(p.exercises).toBe(STAGES[0]!.promoteAfter);
  });

  it('an okay round breaks the clean streak', () => {
    let p = initialProgress(STAGES);
    p = run(p, clean, 2).p;
    p = run(p, okay, 1).p;
    expect(p.cleanStreak).toBe(0);
    p = run(p, clean, 1).p;
    expect(p.counts).toBe(MIN_COUNTS);
  });

  it('unlocks the next stage after clean rounds at the maximum length, starting at that stage’s length', () => {
    const p = withCounts(initialProgress(STAGES), MAX_COUNTS, STAGES);
    const { p: next, change } = run(p, clean, STAGES[0]!.promoteAfter);
    expect(change).toBe('stage-up');
    expect(next.stage).toBe(1);
    expect(next.counts).toBe(STAGES[1]!.startCounts);
    expect(next.cleanStreak).toBe(0);
  });

  it('gets shorter after weak rounds, then drops a stage at the starting length', () => {
    let p = withStage(withUnlocked(initialProgress(STAGES), 1, STAGES), 1, STAGES);
    p = withCounts(p, 9, STAGES);
    let r = run(p, weak, STAGES[1]!.demoteAfter);
    expect(r.change).toBe('shorter');
    expect(r.p.counts).toBe(8);
    r = run(r.p, weak, STAGES[1]!.demoteAfter);
    expect(r.change).toBe('stage-down');
    expect(r.p.stage).toBe(0);
    expect(r.p.counts).toBe(STAGES[0]!.maxCounts);
  });

  it('never drops below stage 1 and four counts, never rises past the last stage at its maximum', () => {
    let r = run(initialProgress(STAGES), weak, 10);
    expect(r.p.stage).toBe(0);
    expect(r.p.counts).toBe(MIN_COUNTS);
    const last = STAGES.length - 1;
    let p = withStage(withUnlocked(initialProgress(STAGES), last, STAGES), last, STAGES);
    p = withCounts(p, MAX_COUNTS, STAGES);
    r = run(p, clean, 12);
    expect(r.p.stage).toBe(last);
    expect(r.p.counts).toBe(MAX_COUNTS);
    expect(r.change).toBeNull();
  });

  it('walks the whole ladder on clean rounds alone, one count at a time', () => {
    let p = initialProgress(STAGES);
    let steps = 0;
    for (let i = 0; i < 2000 && p.stage < STAGES.length - 1; i++) {
      const r = applyResult(p, clean, STAGES);
      if (r.change === 'longer') {
        expect(r.progress.counts).toBe(p.counts + 1);
        steps++;
      }
      p = r.progress;
    }
    expect(p.stage).toBe(STAGES.length - 1);
    expect(steps).toBeGreaterThan(100);
  });

  it('skips the optional stage unless opted in', () => {
    const optionalIndex = STAGES.findIndex((s) => s.optional);
    expect(optionalIndex).toBeGreaterThan(0);
    const open = withUnlocked(initialProgress(STAGES), STAGES.length - 1, STAGES);
    let p = withStage(open, optionalIndex - 1, STAGES);
    p = withCounts(p, MAX_COUNTS, STAGES);
    let r = run(p, clean, STAGES[optionalIndex - 1]!.promoteAfter);
    expect(r.change).toBe('stage-up');
    expect(r.p.stage).toBe(optionalIndex + 1);

    p = { ...withStage(open, optionalIndex - 1, STAGES), includeOptional: true };
    p = withCounts(p, MAX_COUNTS, STAGES);
    r = run(p, clean, STAGES[optionalIndex - 1]!.promoteAfter);
    expect(r.p.stage).toBe(optionalIndex);

    p = withStage(open, optionalIndex + 1, STAGES);
    r = run(p, weak, STAGES[optionalIndex + 1]!.demoteAfter);
    expect(r.change).toBe('stage-down');
    expect(r.p.stage).toBe(optionalIndex - 1);
  });

  it('tracks lifetime accuracy', () => {
    let p = initialProgress(STAGES);
    p = applyResult(p, clean, STAGES).progress;
    p = applyResult(p, weak, STAGES).progress;
    expect(p.exercises).toBe(2);
    expect(p.accuracySum).toBeCloseTo(accuracyOf(clean) + accuracyOf(weak));
  });

  it('locks stages until they are reached, and ?unlock-style unlocking opens them', () => {
    const p = initialProgress(STAGES);
    expect(p.unlocked).toBe(0);
    // Cannot jump ahead by hand.
    expect(withStage(p, 5, STAGES).stage).toBe(0);
    // Earning the next stage unlocks it, and it stays unlocked after dropping back.
    let q = withCounts(p, MAX_COUNTS, STAGES);
    q = run(q, clean, STAGES[0]!.promoteAfter).p;
    expect(q.stage).toBe(1);
    expect(q.unlocked).toBe(1);
    q = run(q, weak, STAGES[1]!.demoteAfter).p;
    expect(q.stage).toBe(0);
    expect(q.unlocked).toBe(1);
    expect(withStage(q, 1, STAGES).stage).toBe(1);
    // The testing aid never lowers what was earned.
    expect(withUnlocked(q, 4, STAGES).unlocked).toBe(4);
    expect(withUnlocked(withUnlocked(q, 4, STAGES), 0, STAGES).unlocked).toBe(4);
  });

  it('withCounts and withStage clamp and reset streaks', () => {
    const p = { ...initialProgress(STAGES), cleanStreak: 2 };
    expect(withCounts(p, 99, STAGES).counts).toBe(MAX_COUNTS);
    expect(withCounts(p, 0, STAGES).counts).toBe(MIN_COUNTS);
    expect(withCounts(p, 9, STAGES).cleanStreak).toBe(0);
    const open = withUnlocked(p, STAGES.length - 1, STAGES);
    expect(withStage(open, 99, STAGES).stage).toBe(STAGES.length - 1);
    expect(withStage(open, -1, STAGES).stage).toBe(0);
    expect(withStage(open, 2, STAGES).counts).toBe(STAGES[2]!.startCounts);
  });
});
