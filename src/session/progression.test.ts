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

const clean = { pitchScore: 0.95, rhythmScore: 0.95 };
const perfect = { pitchScore: 1, rhythmScore: 1 };
const okay = { pitchScore: 0.8, rhythmScore: 0.7 };
const weak = { pitchScore: 0.5, rhythmScore: 0.5 };

function run(t: Track, result: typeof clean, times: number, includeOptional = false) {
  let change = null;
  for (let i = 0; i < times; i++) ({ track: t, change } = applyResult(t, result, STAGES, includeOptional));
  return { t, change };
}

describe('stage ladder progression', () => {
  it('starts at stage 1 with one bar of 4/4 and an empty tally', () => {
    const t = initialTrack(STAGES);
    expect(t.stage).toBe(0);
    expect(t.counts).toBe(MIN_COUNTS);
    expect(t.tally).toBe(0);
  });

  it('a clean round adds a point and a count; a perfect round adds two points', () => {
    let r = run(initialTrack(STAGES), clean, 1);
    expect(r.change).toBe('longer');
    expect(r.t.counts).toBe(5);
    expect(r.t.tally).toBe(1);
    r = run(initialTrack(STAGES), perfect, 1);
    expect(r.t.tally).toBe(2);
    expect(r.t.counts).toBe(5);
    expect(r.change).toBe('longer');
  });

  it('unlocks the next stage when the tally reaches the target, whatever the length', () => {
    const target = STAGES[0]!.unlockTally;
    const { t, change } = run(initialTrack(STAGES), clean, target);
    expect(change).toBe('stage-up');
    expect(t.stage).toBe(1);
    expect(t.unlocked).toBe(1);
    expect(t.counts).toBe(STAGES[1]!.startCounts);
    expect(t.tally).toBe(0);
  });

  it('two perfect rounds unlock a stage with a tally of three', () => {
    expect(STAGES[0]!.unlockTally).toBe(3);
    const { t, change } = run(initialTrack(STAGES), perfect, 2);
    expect(change).toBe('stage-up');
    expect(t.stage).toBe(1);
  });

  it('an okay round leaves the tally alone; a weak round takes a point off, never below zero', () => {
    let t = run(initialTrack(STAGES), clean, 1).t;
    t = run(t, okay, 1).t;
    expect(t.tally).toBe(1);
    t = run(t, weak, 1).t;
    expect(t.tally).toBe(0);
    t = run(t, weak, 1).t;
    expect(t.tally).toBe(0);
  });

  it('length stops growing at the stage growth ceiling but the tally still unlocks', () => {
    const open = withUnlocked(initialTrack(STAGES), 3, STAGES);
    let t = withCounts(withStage(open, 2, STAGES), STAGES[2]!.growCounts, STAGES);
    const r1 = applyResult(t, clean, STAGES);
    expect(r1.change).toBeNull();
    expect(r1.track.counts).toBe(STAGES[2]!.growCounts);
    expect(r1.track.tally).toBe(1);
    t = run(r1.track, clean, STAGES[2]!.unlockTally - 1).t;
    expect(t.stage).toBe(3);
  });

  it('a weak round shortens the melody; two weak rounds at the starting length drop a stage', () => {
    let t = withStage(withUnlocked(initialTrack(STAGES), 1, STAGES), 1, STAGES);
    t = withCounts(t, 5, STAGES);
    let r = run(t, weak, 1);
    expect(r.change).toBe('shorter');
    expect(r.t.counts).toBe(STAGES[1]!.startCounts);
    r = run(r.t, weak, 1);
    expect(r.change).toBeNull();
    r = run(r.t, weak, 1);
    expect(r.change).toBe('stage-down');
    expect(r.t.stage).toBe(0);
    expect(r.t.counts).toBe(STAGES[0]!.growCounts);
    expect(r.t.unlocked).toBe(1);
    expect(r.t.tally).toBe(0);
  });

  it('never drops below stage 1 and four counts, never rises past the last stage', () => {
    let r = run(initialTrack(STAGES), weak, 10);
    expect(r.t.stage).toBe(0);
    expect(r.t.counts).toBe(MIN_COUNTS);
    const last = STAGES.length - 1;
    const t = withStage(withUnlocked(initialTrack(STAGES), last, STAGES), last, STAGES);
    r = run(t, perfect, 12);
    expect(r.t.stage).toBe(last);
    expect(r.t.counts).toBe(STAGES[last]!.growCounts);
    expect(STAGES[last]!.growCounts).toBe(MAX_COUNTS);
    expect(r.t.tally).toBeGreaterThan(STAGES[last]!.unlockTally);
  });

  it('reaches free reading in two perfect or three clean rounds per unlock', () => {
    const last = STAGES.length - 1;
    const unlocks = STAGES.filter((s) => !s.optional).length - 1;
    for (const [result, perUnlock] of [
      [perfect, 2],
      [clean, 3],
    ] as const) {
      let t = initialTrack(STAGES);
      let rounds = 0;
      while (t.stage < last && rounds < 500) {
        t = applyResult(t, result, STAGES).track;
        rounds++;
      }
      expect(t.stage).toBe(last);
      expect(rounds).toBe(unlocks * perUnlock);
    }
  });

  it('skips the optional stage unless opted in', () => {
    const optionalIndex = STAGES.findIndex((s) => s.optional);
    expect(optionalIndex).toBeGreaterThan(0);
    const open = withUnlocked(initialTrack(STAGES), STAGES.length - 1, STAGES);
    let t = withStage(open, optionalIndex - 1, STAGES);
    let r = run(t, clean, STAGES[optionalIndex - 1]!.unlockTally);
    expect(r.change).toBe('stage-up');
    expect(r.t.stage).toBe(optionalIndex + 1);

    t = withStage(open, optionalIndex - 1, STAGES);
    r = run(t, clean, STAGES[optionalIndex - 1]!.unlockTally, true);
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
    let q = run(t, clean, STAGES[0]!.unlockTally).t;
    expect(q.unlocked).toBe(1);
    q = run(q, weak, STAGES[1]!.demoteAfter).t;
    expect(q.stage).toBe(0);
    expect(withStage(q, 1, STAGES).stage).toBe(1);
    expect(withUnlocked(q, 4, STAGES).unlocked).toBe(4);
    expect(withUnlocked(withUnlocked(q, 4, STAGES), 0, STAGES).unlocked).toBe(4);
  });

  it('withCounts clamps up to the maximum and keeps the tally; withStage resets it', () => {
    const t = { ...initialTrack(STAGES), tally: 2 };
    expect(withCounts(t, 99, STAGES).counts).toBe(MAX_COUNTS);
    expect(withCounts(t, 0, STAGES).counts).toBe(MIN_COUNTS);
    expect(withCounts(t, 9, STAGES).tally).toBe(2);
    const open = withUnlocked(t, STAGES.length - 1, STAGES);
    expect(withStage(open, 99, STAGES).stage).toBe(STAGES.length - 1);
    expect(withStage(open, -1, STAGES).stage).toBe(0);
    expect(withStage(open, 2, STAGES).counts).toBe(STAGES[2]!.startCounts);
    expect(withStage(open, 2, STAGES).tally).toBe(0);
  });

  it('keeps writing and playing progress apart', () => {
    let p = initialProgress(STAGES);
    expect(trackOf(p)).toBe(p.write);
    p = withTrack(p, run(p.write, clean, 1).t);
    expect(p.write.counts).toBe(5);
    expect(p.play.counts).toBe(MIN_COUNTS);
    p = { ...p, mode: 'play' };
    expect(trackOf(p)).toBe(p.play);
    p = withTrack(p, run(p.play, clean, 1).t);
    expect(p.play.counts).toBe(5);
    expect(p.write.counts).toBe(5);
  });
});
