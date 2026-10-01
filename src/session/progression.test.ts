import { describe, expect, it } from 'vitest';
import { STAGES } from '../melody/stages';
import { accuracyOf, applyResult, initialProgress, withBars, withStage, type Progress } from './progression';

const clean = { pitchScore: 1, rhythmScore: 0.95 };
const okay = { pitchScore: 0.8, rhythmScore: 0.7 };
const weak = { pitchScore: 0.5, rhythmScore: 0.5 };

function run(p: Progress, result: typeof clean, times: number) {
  let change = null;
  for (let i = 0; i < times; i++) ({ progress: p, change } = applyResult(p, result, STAGES));
  return { p, change };
}

describe('stage ladder progression', () => {
  it('starts at stage 1 with its starting length', () => {
    const p = initialProgress(STAGES);
    expect(p.stage).toBe(0);
    expect(p.bars).toBe(STAGES[0]!.startBars);
  });

  it('gets a bar longer after enough clean rounds in a row', () => {
    const { p, change } = run(initialProgress(STAGES), clean, STAGES[0]!.promoteAfter);
    expect(change).toBe('longer');
    expect(p.bars).toBe(2);
    expect(p.cleanStreak).toBe(0);
    expect(p.exercises).toBe(STAGES[0]!.promoteAfter);
  });

  it('an okay round breaks the clean streak', () => {
    let p = initialProgress(STAGES);
    p = run(p, clean, 2).p;
    p = run(p, okay, 1).p;
    expect(p.cleanStreak).toBe(0);
    p = run(p, clean, 1).p;
    expect(p.bars).toBe(1);
  });

  it('unlocks the next stage after clean rounds at the maximum length, starting at that stage’s length', () => {
    let p = withBars(initialProgress(STAGES), STAGES[0]!.bars, STAGES);
    const { p: next, change } = run(p, clean, STAGES[0]!.promoteAfter);
    expect(change).toBe('stage-up');
    expect(next.stage).toBe(1);
    expect(next.bars).toBe(STAGES[1]!.startBars);
    expect(next.cleanStreak).toBe(0);
  });

  it('gets shorter after weak rounds, then drops a stage at the starting length', () => {
    let p = withStage(initialProgress(STAGES), 1, STAGES);
    p = withBars(p, 3, STAGES);
    let r = run(p, weak, STAGES[1]!.demoteAfter);
    expect(r.change).toBe('shorter');
    expect(r.p.bars).toBe(2);
    r = run(r.p, weak, STAGES[1]!.demoteAfter);
    expect(r.change).toBe('stage-down');
    expect(r.p.stage).toBe(0);
    expect(r.p.bars).toBe(STAGES[0]!.bars);
  });

  it('never drops below stage 1 and one bar, never rises past the last stage at its maximum', () => {
    let r = run(initialProgress(STAGES), weak, 10);
    expect(r.p.stage).toBe(0);
    expect(r.p.bars).toBe(1);
    const last = STAGES.length - 1;
    let p = withStage(initialProgress(STAGES), last, STAGES);
    p = withBars(p, STAGES[last]!.bars, STAGES);
    r = run(p, clean, 12);
    expect(r.p.stage).toBe(last);
    expect(r.p.bars).toBe(STAGES[last]!.bars);
    expect(r.change).toBeNull();
  });

  it('walks the whole ladder on clean rounds alone', () => {
    let p = initialProgress(STAGES);
    for (let i = 0; i < 200 && p.stage < STAGES.length - 1; i++) p = applyResult(p, clean, STAGES).progress;
    expect(p.stage).toBe(STAGES.length - 1);
  });

  it('skips the optional stage unless opted in', () => {
    const optionalIndex = STAGES.findIndex((s) => s.optional);
    expect(optionalIndex).toBeGreaterThan(0);
    let p = withStage(initialProgress(STAGES), optionalIndex - 1, STAGES);
    p = withBars(p, STAGES[optionalIndex - 1]!.bars, STAGES);
    let r = run(p, clean, STAGES[optionalIndex - 1]!.promoteAfter);
    expect(r.change).toBe('stage-up');
    expect(r.p.stage).toBe(optionalIndex + 1);

    p = { ...withStage(initialProgress(STAGES), optionalIndex - 1, STAGES), includeOptional: true };
    p = withBars(p, STAGES[optionalIndex - 1]!.bars, STAGES);
    r = run(p, clean, STAGES[optionalIndex - 1]!.promoteAfter);
    expect(r.p.stage).toBe(optionalIndex);

    // Dropping back from the stage after the optional one also skips it.
    p = withStage(initialProgress(STAGES), optionalIndex + 1, STAGES);
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

  it('withBars and withStage clamp and reset streaks', () => {
    const p = { ...initialProgress(STAGES), cleanStreak: 2 };
    expect(withBars(p, 9, STAGES).bars).toBe(STAGES[0]!.bars);
    expect(withBars(p, 0, STAGES).bars).toBe(1);
    expect(withBars(p, 3, STAGES).cleanStreak).toBe(0);
    expect(withStage(p, 99, STAGES).stage).toBe(STAGES.length - 1);
    expect(withStage(p, -1, STAGES).stage).toBe(0);
    expect(withStage(p, 2, STAGES).bars).toBe(STAGES[2]!.startBars);
  });
});
