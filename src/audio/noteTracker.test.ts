import { describe, expect, it } from 'vitest';
import { NoteTracker } from './noteTracker';
import { frames, synthesize, type SynthNote } from './synth.test-helper';

const SR = 44100;

function track(notes: SynthNote[], seconds: number): number[] {
  const signal = synthesize(notes, seconds, SR);
  const tracker = new NoteTracker({ sampleRate: SR });
  for (const { frame, time } of frames(signal, 2048, 1024, SR)) tracker.push(frame, time);
  tracker.finish(seconds);
  return tracker.notes.map((n) => n.midi);
}

describe('NoteTracker', () => {
  it('hears separate plucks with gaps between them', () => {
    expect(
      track(
        [
          { midi: 55, at: 0.3, length: 0.5 },
          { midi: 59, at: 1.0, length: 0.5 },
          { midi: 64, at: 1.7, length: 0.5 },
        ],
        2.5,
      ),
    ).toEqual([55, 59, 64]);
  });

  it('counts the same note plucked twice as two notes', () => {
    expect(
      track(
        [
          { midi: 60, at: 0.2, length: 0.9 },
          { midi: 60, at: 0.7, length: 0.9 }, // re-attacked while the first still rings
          { midi: 60, at: 1.2, length: 0.9 },
        ],
        2.4,
      ),
    ).toEqual([60, 60, 60]);
  });

  it('hears a pitch change without a new attack as a new note', () => {
    expect(
      track(
        [
          { midi: 57, at: 0.2, length: 0.4 },
          { midi: 59, at: 0.6, length: 0.5, attack: 'slur' },
        ],
        1.4,
      ),
    ).toEqual([57, 59]);
  });

  it('ignores silence and reports nothing for an empty signal', () => {
    expect(track([], 1.0)).toEqual([]);
  });

  it('keeps the order of a short melody with mixed gaps and re-attacks', () => {
    const notes: SynthNote[] = [
      { midi: 55, at: 0.2, length: 0.6 },
      { midi: 57, at: 0.8, length: 0.6 },
      { midi: 59, at: 1.4, length: 0.6 },
      { midi: 59, at: 1.9, length: 0.6 },
      { midi: 60, at: 2.6, length: 0.8 },
    ];
    expect(track(notes, 3.6)).toEqual([55, 57, 59, 59, 60]);
  });

  it('does not report octave flicker as extra notes while a note decays', () => {
    expect(track([{ midi: 64, at: 0.1, length: 2.5 }], 2.8)).toEqual([64]);
  });
});
