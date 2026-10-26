import { describe, expect, it } from 'vitest';
import { generateMelody } from '../melody/generator';
import { STAGES } from '../melody/stages';
import type { Melody } from '../melody/types';
import { keyFromId, spellInKey } from '../music/key';
import { parseSpelled, staffStep, writtenFromSounding } from '../music/pitch';
import { PAPER } from './paper';
import { startNoteBar } from './startNote';

const melodyIn = (keyId: string, firstMidi: number): Melody => ({
  seed: 1,
  levelId: 'test',
  key: keyFromId(keyId)!,
  tempo: 72,
  barBeats: [4],
  timeSignature: [4, 4],
  bars: 1,
  counts: 4,
  notes: [
    { midi: firstMidi, duration: 'q', string: 1, fret: 0 },
    { midi: firstMidi + 2, duration: 'q', string: 1, fret: 2 },
  ],
});

describe('starting note (R21)', () => {
  it('draws only the first note, as a whole note in the active colour, at its written place', () => {
    const bar = startNoteBar(melodyIn('C', 64)); // sounding E4, written E5
    expect(bar.notes).toHaveLength(1);
    const note = bar.notes[0]!;
    expect(note.duration).toBe('w');
    expect(note.step).toBe(staffStep(parseSpelled('E5')));
    expect(note.sign).toBe('none');
    expect(note.style).toEqual({ fill: PAPER.active, stroke: PAPER.active });
  });

  it('takes no sign for a note the key signature covers and a sign for a raised minor degree', () => {
    expect(startNoteBar(melodyIn('G', 66)).notes[0]!.sign).toBe('none'); // F♯ in G major
    expect(startNoteBar(melodyIn('Am-h', 68)).notes[0]!.sign).toBe('sharp'); // G♯ in A harmonic minor
    expect(startNoteBar(melodyIn('F', 58)).notes[0]!.sign).toBe('none'); // B♭ in F major
  });

  it('matches the first note of every stage over several seeds', () => {
    for (const stage of STAGES) {
      for (const seed of [3, 17, 101]) {
        const melody = generateMelody(stage, seed);
        const first = melody.notes[0]!;
        const written = first.spelled ?? spellInKey(writtenFromSounding(first.midi), melody.key);
        expect(startNoteBar(melody).notes[0]!.step, stage.id).toBe(staffStep(written));
      }
    }
  });
});
