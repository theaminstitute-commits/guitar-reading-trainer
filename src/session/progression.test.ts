import { describe, expect, it } from 'vitest';
import { MAX_COUNTS, MIN_COUNTS } from '../melody/meter';
import { MAIN_STAGE_COUNT, STAGES } from '../melody/stages';
import { accuracyOf, applyResult, initialProgress, initialTrack, trackOf, withStage, withTrack, withUnlocked, type Track } from './progression';

const perfect = { pitchScore: 1, rhythmScore: 1 };
const clean = { pitchScore: 0.95, rhythmScore: 0.95 };
const okay = { pitchScore: 0.8, rhythmScore: 0.7 };
const weak = { pitchScore: 0.5, rhythmScore: 0.5 };

function run(t: Track, result: typeof clean, times: number) {
  let change = null;
  for (let i = 0; i < times; i++) ({ track: t, change } = applyResult(t, result, STAGES));
  return { t, change };
}

describe('stage ladder progression', () => {
  it('starts at stage 1 with one bar of 4/4 and no flawless melodies yet', () => {
    const t = initialTrack(STAGES);
    expect(t.stage).toBe(0);
    expect(t.counts).toBe(MIN_COUNTS);
    expect(t.tally).toBe(0);
  });

  it('counts only flawless melodies; clean, okay and weak rounds leave the count alone', () => {
    let t = run(initialTrack(STAGES), perfect, 3).t;
    expect(t.tally).toBe(3);
    t = run(t, clean, 2).t;
    t = run(t, okay, 2).t;
    t = run(t, weak, 1).t;
    expect(t.tally).toBe(3);
    expect(t.exercises).toBe(8);
  });

  it('unlocks the next stage after ten flawless melodies, not nine', () => {
    expect(STAGES.every((s) => s.unlockAfter === 10)).toBe(true);
    expect(run(initialTrack(STAGES), perfect, 9).t.stage).toBe(0);
    const { t, change } = run(initialTrack(STAGES), perfect, 10);
    expect(change).toBe('stage-up');
    expect(t.stage).toBe(1);
    expect(t.unlocked).toBe(1);
    expect(t.tally).toBe(0);
    expect(t.counts).toBe(STAGES[1]!.startCounts);
  });

  it('melody length never changes inside a stage', () => {
    let t = initialTrack(STAGES);
    for (const r of [perfect, clean, okay, weak, perfect]) {
      t = applyResult(t, r, STAGES).track;
      expect(t.counts).toBe(MIN_COUNTS);
    }
    const bonus = withStage(withUnlocked(initialTrack(STAGES), MAIN_STAGE_COUNT, STAGES), MAIN_STAGE_COUNT, STAGES);
    expect(bonus.counts).toBe(MIN_COUNTS + 1);
    expect(applyResult(bonus, weak, STAGES).track.counts).toBe(MIN_COUNTS + 1);
  });

  it('two weak rounds in a row drop a stage; an okay round in between resets the streak', () => {
    const t = withStage(withUnlocked(initialTrack(STAGES), 1, STAGES), 1, STAGES);
    let r = run(t, weak, 1);
    expect(r.change).toBeNull();
    r = run(r.t, okay, 1);
    r = run(r.t, weak, 1);
    expect(r.change).toBeNull();
    r = run(r.t, weak, 1);
    expect(r.change).toBe('stage-down');
    expect(r.t.stage).toBe(0);
    expect(r.t.counts).toBe(STAGES[0]!.startCounts);
    expect(r.t.unlocked).toBe(1);
    expect(r.t.tally).toBe(0);
  });

  it('never drops below stage 1, never rises past the last bonus stage', () => {
    let r = run(initialTrack(STAGES), weak, 10);
    expect(r.t.stage).toBe(0);
    const last = STAGES.length - 1;
    const t = withStage(withUnlocked(initialTrack(STAGES), last, STAGES), last, STAGES);
    r = run(t, perfect, 25);
    expect(r.t.stage).toBe(last);
    expect(r.t.counts).toBe(MAX_COUNTS);
    expect(r.t.tally).toBe(25);
  });

  it('takes ten flawless melodies per unlock through the whole ladder', () => {
    const last = STAGES.length - 1;
    let t = initialTrack(STAGES);
    let rounds = 0;
    while (t.stage < last && rounds < 5000) {
      t = applyResult(t, perfect, STAGES).track;
      rounds++;
    }
    expect(t.stage).toBe(last);
    expect(rounds).toBe(10 * last);
    expect(10 * (MAIN_STAGE_COUNT - 1)).toBe(200);
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
    let q = run(t, perfect, 10).t;
    expect(q.unlocked).toBe(1);
    q = run(q, weak, 2).t;
    expect(q.stage).toBe(0);
    expect(withStage(q, 1, STAGES).stage).toBe(1);
    expect(withUnlocked(q, 4, STAGES).unlocked).toBe(4);
    expect(withUnlocked(withUnlocked(q, 4, STAGES), 0, STAGES).unlocked).toBe(4);
  });

  it('withStage clamps to unlocked stages and resets the count', () => {
    const t = { ...initialTrack(STAGES), tally: 2 };
    const open = withUnlocked(t, STAGES.length - 1, STAGES);
    expect(withStage(open, 99, STAGES).stage).toBe(STAGES.length - 1);
    expect(withStage(open, -1, STAGES).stage).toBe(0);
    expect(withStage(open, 2, STAGES).counts).toBe(STAGES[2]!.startCounts);
    expect(withStage(open, 2, STAGES).tally).toBe(0);
  });

  it('keeps writing and playing progress apart', () => {
    let p = initialProgress(STAGES);
    expect(trackOf(p)).toBe(p.write);
    p = withTrack(p, run(p.write, perfect, 10).t);
    expect(p.write.stage).toBe(1);
    expect(p.play.stage).toBe(0);
    p = { ...p, mode: 'play' };
    expect(trackOf(p)).toBe(p.play);
    p = withTrack(p, run(p.play, perfect, 10).t);
    expect(p.play.stage).toBe(1);
    expect(p.write.stage).toBe(1);
  });
});
