import { describe, expect, it } from 'vitest';
import { MAX_COUNTS, MIN_COUNTS } from '../melody/meter';
import { STAGES } from '../melody/stages';
import {
  accuracyOf,
  applyResult,
  initialProgress,
  initialTrack,
  trackOf,
  withCounts,
  withStage,
  withTrack,
  withUnlocked,
  type Track,
} from './progression';

const clean = { pitchScore: 1, rhythmScore: 0.95 };
const okay = { pitchScore: 0.8, rhythmScore: 0.7 };
const weak = { pitchScore: 0.5, rhythmScore: 0.5 };

function run(t: Track, result: typeof clean, times: number, includeOptional = false) {
  let change = null;
  for (let i = 0; i < times; i++) ({ track: t, change } = applyResult(t, result, STAGES, includeOptional));
  return { t, change };
}

describe('stage ladder progression', () => {
  it('starts at stage 1 with one bar of 4/4', () => {
    const t = initialTrack(STAGES);
    expect(t.stage).toBe(0);
    expect(t.counts).toBe(MIN_COUNTS);
  });

  it('gets one count longer after enough clean rounds in a row', () => {
    const { t, change } = run(initialTrack(STAGES), clean, STAGES[0]!.promoteAfter);
    expect(change).toBe('longer');
    expect(t.counts).toBe(5);
    expect(t.cleanStreak).toBe(0);
    expect(t.exercises).toBe(STAGES[0]!.promoteAfter);
  });

  it('an okay round breaks the clean streak', () => {
    let t = initialTrack(STAGES);
    t = run(t, clean, 2).t;
    t = run(t, okay, 1).t;
    expect(t.cleanStreak).toBe(0);
    t = run(t, clean, 1).t;
    expect(t.counts).toBe(MIN_COUNTS);
  });

  it('unlocks the next stage after clean rounds at the maximum length, starting at that stage’s length', () => {
    const t = withCounts(initialTrack(STAGES), MAX_COUNTS, STAGES);
    const { t: next, change } = run(t, clean, STAGES[0]!.promoteAfter);
    expect(change).toBe('stage-up');
    expect(next.stage).toBe(1);
    expect(next.unlocked).toBe(1);
    expect(next.counts).toBe(STAGES[1]!.startCounts);
    expect(next.cleanStreak).toBe(0);
  });

  it('gets shorter after weak rounds, then drops a stage at the starting length', () => {
    let t = withStage(withUnlocked(initialTrack(STAGES), 1, STAGES), 1, STAGES);
    t = withCounts(t, 9, STAGES);
    let r = run(t, weak, STAGES[1]!.demoteAfter);
    expect(r.change).toBe('shorter');
    expect(r.t.counts).toBe(8);
    r = run(r.t, weak, STAGES[1]!.demoteAfter);
    expect(r.change).toBe('stage-down');
    expect(r.t.stage).toBe(0);
    expect(r.t.counts).toBe(STAGES[0]!.maxCounts);
    expect(r.t.unlocked).toBe(1);
  });

  it('never drops below stage 1 and four counts, never rises past the last stage at its maximum', () => {
    let r = run(initialTrack(STAGES), weak, 10);
    expect(r.t.stage).toBe(0);
    expect(r.t.counts).toBe(MIN_COUNTS);
    const last = STAGES.length - 1;
    let t = withStage(withUnlocked(initialTrack(STAGES), last, STAGES), last, STAGES);
    t = withCounts(t, MAX_COUNTS, STAGES);
    r = run(t, clean, 12);
    expect(r.t.stage).toBe(last);
    expect(r.t.counts).toBe(MAX_COUNTS);
    expect(r.change).toBeNull();
  });

  it('walks the whole ladder on clean rounds alone, one count at a time', () => {
    let t = initialTrack(STAGES);
    let steps = 0;
    for (let i = 0; i < 2000 && t.stage < STAGES.length - 1; i++) {
      const r = applyResult(t, clean, STAGES);
      if (r.change === 'longer') {
        expect(r.track.counts).toBe(t.counts + 1);
        steps++;
      }
      t = r.track;
    }
    expect(t.stage).toBe(STAGES.length - 1);
    expect(steps).toBeGreaterThan(100);
  });

  it('skips the optional stage unless opted in', () => {
    const optionalIndex = STAGES.findIndex((s) => s.optional);
    expect(optionalIndex).toBeGreaterThan(0);
    const open = withUnlocked(initialTrack(STAGES), STAGES.length - 1, STAGES);
    let t = withStage(open, optionalIndex - 1, STAGES);
    t = withCounts(t, MAX_COUNTS, STAGES);
    let r = run(t, clean, STAGES[optionalIndex - 1]!.promoteAfter);
    expect(r.change).toBe('stage-up');
    expect(r.t.stage).toBe(optionalIndex + 1);

    t = withStage(open, optionalIndex - 1, STAGES);
    t = withCounts(t, MAX_COUNTS, STAGES);
    r = run(t, clean, STAGES[optionalIndex - 1]!.promoteAfter, true);
    expect(r.t.stage).toBe(optionalIndex);

    t = withStage(open, optionalIndex + 1, STAGES);
    r = run(t, weak, STAGES[optionalIndex + 1]!.demoteAfter);
    expect(r.change).toBe('stage-down');
    expect(r.t.stage).toBe(optionalIndex - 1);
  });

  it('tracks lifetime accuracy', () => {
    let t = initialTrack(STAGES);
    t = applyResult(t, clean, STAGES).track;
    t = applyResult(t, weak, STAGES).track;
    expect(t.exercises).toBe(2);
    expect(t.accuracySum).toBeCloseTo(accuracyOf(clean) + accuracyOf(weak));
  });

  it('locks stages until they are reached; unlocking never lowers what was earned', () => {
    const t = initialTrack(STAGES);
    expect(withStage(t, 5, STAGES).stage).toBe(0);
    let q = withCounts(t, MAX_COUNTS, STAGES);
    q = run(q, clean, STAGES[0]!.promoteAfter).t;
    expect(q.unlocked).toBe(1);
    q = run(q, weak, STAGES[1]!.demoteAfter).t;
    expect(q.stage).toBe(0);
    expect(withStage(q, 1, STAGES).stage).toBe(1);
    expect(withUnlocked(q, 4, STAGES).unlocked).toBe(4);
    expect(withUnlocked(withUnlocked(q, 4, STAGES), 0, STAGES).unlocked).toBe(4);
  });

  it('withCounts and withStage clamp and reset streaks', () => {
    const t = { ...initialTrack(STAGES), cleanStreak: 2 };
    expect(withCounts(t, 99, STAGES).counts).toBe(MAX_COUNTS);
    expect(withCounts(t, 0, STAGES).counts).toBe(MIN_COUNTS);
    expect(withCounts(t, 9, STAGES).cleanStreak).toBe(0);
    const open = withUnlocked(t, STAGES.length - 1, STAGES);
    expect(withStage(open, 99, STAGES).stage).toBe(STAGES.length - 1);
    expect(withStage(open, -1, STAGES).stage).toBe(0);
    expect(withStage(open, 2, STAGES).counts).toBe(STAGES[2]!.startCounts);
  });

  it('keeps writing and playing progress apart', () => {
    let p = initialProgress(STAGES);
    expect(trackOf(p)).toBe(p.write);
    p = withTrack(p, run(p.write, clean, 3).t);
    expect(p.write.counts).toBe(5);
    expect(p.play.counts).toBe(MIN_COUNTS);
    p = { ...p, mode: 'play' };
    expect(trackOf(p)).toBe(p.play);
    p = withTrack(p, run(p.play, clean, 3).t);
    expect(p.play.counts).toBe(5);
    expect(p.write.counts).toBe(5);
  });
});
