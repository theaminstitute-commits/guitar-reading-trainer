import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { STAGES } from '../melody/stages';
import { localProgressStore } from './progress';

const KEY = 'guitar-reading-trainer.progress.v1';

/** A minimal localStorage for Node. */
function fakeStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    clear: () => map.clear(),
    key: () => null,
    get length() {
      return map.size;
    },
  } as unknown as Storage;
}

const track = (stage: number, unlocked: number, melodies: Record<string, string[]> = {}) => ({
  stage,
  unlocked,
  counts: 4,
  tally: 3,
  weakStreak: 0,
  exercises: 40,
  accuracySum: 35,
  melodies,
});

describe('progress migration to version 7 (Part D inserted before free reading)', () => {
  beforeEach(() => {
    (globalThis as { localStorage?: Storage }).localStorage = fakeStorage();
  });
  afterEach(() => {
    delete (globalThis as { localStorage?: Storage }).localStorage;
  });

  it('moves free reading and the bonus stages up by 29 and leaves stages 1 to 17 alone', () => {
    localStorage.setItem(KEY, JSON.stringify({ version: 6, mode: 'listen', handedness: 'left', theme: 'dark', metronome: true, seenGuides: [1, 17, 18, 19], write: track(17, 20, { '18': ['C|60q'], '19': ['G|67h'], '5': ['C|62q'] }) }));
    const p = localProgressStore.load(STAGES);
    expect(p.version).toBe(7);
    expect(p.mode).toBe('listen');
    expect(p.write.stage).toBe(46);
    expect(p.write.unlocked).toBe(49);
    expect(p.write.tally).toBe(3);
    expect(p.seenGuides).toEqual([1, 17, 47, 48]);
    expect(Object.keys(p.write.melodies).sort()).toEqual(['47', '48', '5']);
    expect(STAGES[46]!.name).toBe('Free reading');
  });

  it('keeps a learner inside Part A to C exactly where they were', () => {
    localStorage.setItem(KEY, JSON.stringify({ version: 6, mode: 'watch', handedness: 'right', theme: 'system', metronome: false, seenGuides: [1, 2, 3], write: track(11, 12) }));
    const p = localProgressStore.load(STAGES);
    expect(p.write.stage).toBe(11);
    expect(p.write.unlocked).toBe(12);
  });

  it('still reads a version 4 record through both renumberings and drops its playing track', () => {
    localStorage.setItem(KEY, JSON.stringify({ version: 4, mode: 'play', handedness: 'right', theme: 'light', metronome: false, seenGuides: [1, 21], write: { ...track(20, 20), tally: undefined }, play: track(2, 2) }));
    const p = localProgressStore.load(STAGES);
    expect(p.version).toBe(7);
    expect(p.mode).toBe('watch');
    // Old stage index 20 (free reading on the 21-stage ladder) became 17 at version 5 and 46 now.
    expect(p.write.stage).toBe(46);
    expect(p.seenGuides).toEqual([1, 47]);
    expect('play' in p).toBe(false);
  });

  it('writes version 7 records back unchanged', () => {
    localStorage.setItem(KEY, JSON.stringify({ version: 7, mode: 'watch', handedness: 'right', theme: 'system', metronome: false, seenGuides: [30], write: track(29, 30) }));
    const p = localProgressStore.load(STAGES);
    expect(p.write.stage).toBe(29);
    expect(p.seenGuides).toEqual([30]);
  });

  it('keeps every theme the picker offers and drops unknown ones to Auto', () => {
    for (const theme of ['midnight', 'plum', 'frost', 'contrast', 'light', 'dark']) {
      localStorage.setItem(KEY, JSON.stringify({ version: 7, mode: 'watch', handedness: 'right', theme, metronome: false, seenGuides: [], write: track(0, 0) }));
      expect(localProgressStore.load(STAGES).theme).toBe(theme);
    }
    localStorage.setItem(KEY, JSON.stringify({ version: 7, mode: 'watch', handedness: 'right', theme: 'neon', metronome: false, seenGuides: [], write: track(0, 0) }));
    expect(localProgressStore.load(STAGES).theme).toBe('system');
    // Ocean was dropped in 0.19.2: a learner who had picked it goes back to Auto.
    localStorage.setItem(KEY, JSON.stringify({ version: 7, mode: 'watch', handedness: 'right', theme: 'ocean', metronome: false, seenGuides: [], write: track(0, 0) }));
    expect(localProgressStore.load(STAGES).theme).toBe('system');
  });

  it('keeps button sounds on unless switched off (R34)', () => {
    localStorage.setItem(KEY, JSON.stringify({ version: 7, mode: 'watch', handedness: 'right', theme: 'system', metronome: false, seenGuides: [], write: track(0, 0) }));
    expect(localProgressStore.load(STAGES).buttonSounds).toBe(true);
    localStorage.setItem(KEY, JSON.stringify({ version: 7, mode: 'watch', handedness: 'right', theme: 'system', metronome: false, seenGuides: [], write: track(0, 0), buttonSounds: false }));
    expect(localProgressStore.load(STAGES).buttonSounds).toBe(false);
  });
});
