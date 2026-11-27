import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { BASS_STAGES, STAGES } from '../melody/stages';
import { hasProgress, initialProgress, resetProgress, withInstrument } from '../session/progression';
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
    expect(p.version).toBe(9);
    expect(p.mode).toBe('listen');
    expect(p.write.stage).toBe(46);
    expect(p.write.unlocked).toBe(49);
    // Three flawless melodies towards ten before R47 are nine points towards thirty.
    expect(p.write.tally).toBe(9);
    expect(p.write.earned).toEqual([]);
    expect(p.seenGuides).toEqual([1, 17, 47, 48]);
    // Melodies heard on the old eighth-note stage (5) move with it to stage 10 (R45).
    expect(Object.keys(p.write.melodies).sort()).toEqual(['10', '47', '48']);
    expect(STAGES[46]!.name).toBe('Free reading');
  });

  it('keeps the points of a record made since R47', () => {
    localStorage.setItem(KEY, JSON.stringify({ version: 9, instrument: 'guitar', mode: 'watch', handedness: 'right', theme: 'system', metronome: false, seenGuides: [1], write: { ...track(0, 0), tally: 7, earned: [1, 3, 3, 'x'] } }));
    const p = localProgressStore.load(STAGES);
    expect(p.write.tally).toBe(7);
    expect(p.write.earned).toEqual([1, 3, 3]);
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
    expect(p.version).toBe(9);
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

describe('guitar and bass keep their own progress (R41)', () => {
  beforeEach(() => {
    globalThis.localStorage = fakeStorage();
  });

  it('reads a version 7 record as guitar, with no bass lane yet', () => {
    localStorage.setItem(KEY, JSON.stringify({ version: 7, mode: 'watch', handedness: 'right', theme: 'system', metronome: false, seenGuides: [3], write: track(5, 9) }));
    const p = localProgressStore.load(STAGES);
    expect(p.instrument).toBe('guitar');
    expect(p.other).toBeNull();
    // Old stage 6 (A and E♭ major with the low strings) is stage 5 since R45.
    expect(p.write.stage).toBe(4);
  });

  it('switches to bass with a fresh ladder and back to guitar with the guitar ladder intact', () => {
    localStorage.setItem(KEY, JSON.stringify({ version: 7, mode: 'watch', handedness: 'left', theme: 'frost', metronome: false, seenGuides: [3], write: track(5, 9) }));
    const guitar = localProgressStore.load(STAGES);
    const bass = withInstrument(guitar, 'bass');
    expect(bass.instrument).toBe('bass');
    expect(bass.write.stage).toBe(0);
    expect(bass.write.unlocked).toBe(0);
    expect(bass.seenGuides).toEqual([]);
    expect([bass.handedness, bass.theme]).toEqual(['left', 'frost']);
    const back = withInstrument({ ...bass, write: { ...bass.write, stage: 2, unlocked: 2 } }, 'guitar');
    expect(back.write.stage).toBe(4);
    expect(back.seenGuides).toEqual([3]);
    expect(back.other?.write.stage).toBe(2);
  });

  it('saves and loads a bass record against the bass ladder, keeping the guitar lane', () => {
    localStorage.setItem(KEY, JSON.stringify({ version: 7, mode: 'watch', handedness: 'right', theme: 'system', metronome: false, seenGuides: [], write: track(40, 45) }));
    const bass = withInstrument(localProgressStore.load(STAGES), 'bass');
    localProgressStore.save({ ...bass, write: { ...bass.write, stage: 30, unlocked: 30 } });
    const loaded = localProgressStore.load(STAGES);
    expect(loaded.instrument).toBe('bass');
    // The bass ladder has 17 stages: anything past it is clamped to stage 17.
    expect(loaded.write.stage).toBe(BASS_STAGES.length - 1);
    expect(loaded.other?.write.stage).toBe(40);
  });

  it('resets only the instrument in use, with its lessons', () => {
    const start = initialProgress(STAGES);
    const guitar = { ...start, tutorial: ['staff', 'octave'], write: { ...start.write, stage: 4, unlocked: 4, exercises: 9 } };
    const bass = { ...withInstrument(guitar, 'bass'), tutorial: ['staff', 'octave', 'bass-staff'] };
    const reset = resetProgress({ ...bass, write: { ...bass.write, exercises: 3 } }, BASS_STAGES);
    expect(reset.instrument).toBe('bass');
    expect(reset.write.exercises).toBe(0);
    expect(reset.tutorial).toEqual(['staff', 'octave']);
    expect(reset.other?.write.stage).toBe(4);
    expect(hasProgress(reset)).toBe(false);
  });
});

describe('eighth notes later (R45, version 9)', () => {
  beforeEach(() => {
    globalThis.localStorage = fakeStorage();
  });

  it('keeps every learner on the pitch ladder and moves what belongs to the rhythm stages with them', () => {
    // Old stage 5 (eighths) and 6 (A and E♭ major) both land on the new stage 5; old 7 (whole and dotted) and 8 (E and A♭) on 6.
    const at = (stage: number) => {
      localStorage.setItem(KEY, JSON.stringify({ version: 8, instrument: 'guitar', other: null, mode: 'watch', handedness: 'right', theme: 'system', metronome: false, seenGuides: [], write: track(stage, stage) }));
      return localProgressStore.load(STAGES).write.stage + 1;
    };
    expect([0, 3, 4, 5, 6, 7, 8, 9, 10, 11, 16, 30].map(at)).toEqual([1, 4, 5, 5, 6, 6, 7, 8, 9, 12, 17, 31]);
    localStorage.setItem(
      KEY,
      JSON.stringify({ version: 8, instrument: 'guitar', other: null, mode: 'watch', handedness: 'right', theme: 'system', metronome: false, seenGuides: [4, 5, 6, 7, 8], write: track(7, 7, { '5': ['C|60e'], '7': ['C|60w'] }), tutorial: ['staff', 'stage-5', 'stage-6', 'stage-7', 'bass-stage-6'] }),
    );
    const p = localProgressStore.load(STAGES);
    expect(p.version).toBe(9);
    expect([...p.seenGuides].sort((a, b) => a - b)).toEqual([4, 5, 6, 10, 11]);
    expect(Object.keys(p.write.melodies).sort()).toEqual(['10', '11']);
    expect(p.tutorial).toEqual(['staff', 'stage-10', 'stage-5', 'stage-11', 'bass-stage-5']);
  });

  it('leaves a version 9 record as it is', () => {
    localStorage.setItem(KEY, JSON.stringify({ version: 9, instrument: 'guitar', other: null, mode: 'watch', handedness: 'right', theme: 'system', metronome: false, seenGuides: [5, 10], write: track(9, 10), tutorial: ['stage-5'] }));
    const p = localProgressStore.load(STAGES);
    expect(p.write.stage).toBe(9);
    expect(p.seenGuides).toEqual([5, 10]);
    expect(p.tutorial).toEqual(['stage-5']);
  });
});
