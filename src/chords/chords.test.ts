import { describe, expect, it } from 'vitest';
import { groupEvents, totalBeats } from '../melody/bars';
import { generateMelody } from '../melody/generator';
import { STAGES } from '../melody/stages';
import { midiAt } from '../music/fretboard';
import { keyId } from '../music/key';
import { midiFromSpelled, spelledToString, writtenFromSounding } from '../music/pitch';
import { INTERVALS, QUALITIES, spellInterval } from './formulas';
import { adjacentSets, findVoicings, OPEN_SHAPES, placeShape, shapeById, voicingFromFrets, voicingType } from './voicings';

const root = (letter: 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B', accidental: -1 | 0 | 1 = 0) => ({ letter, accidental });

describe('chord spelling from the root', () => {
  it('spells altered and extended tones by interval, not by key', () => {
    expect(spelledToString(spellInterval(root('C'), INTERVALS.A9, 75))).toBe('D#5');
    expect(spelledToString(spellInterval(root('E', -1), INTERVALS.A9, 66))).toBe('F#4');
    expect(spelledToString(spellInterval(root('B'), INTERVALS.d7, 68))).toBe('Ab4');
    expect(spelledToString(spellInterval(root('C', -1), INTERVALS.M3, 63))).toBe('Eb4');
    expect(spelledToString(spellInterval(root('C'), INTERVALS.A11, 66))).toBe('F#4');
    expect(spelledToString(spellInterval(root('F', 1), INTERVALS.M3, 70))).toBe('A#4');
  });
});

describe('voicings', () => {
  it('reads every open shape as the chord it claims to be', () => {
    for (const shape of OPEN_SHAPES) {
      const v = voicingFromFrets(QUALITIES[shape.quality], shape.root, shape.frets);
      expect(v, `${shape.root.letter}${shape.quality}`).not.toBeNull();
      for (let i = 1; i < v!.midis.length; i++) expect(v!.midis[i]!).toBeGreaterThan(v!.midis[i - 1]!);
    }
  });

  it('moves the E shape to F as the F barre chord', () => {
    const v = placeShape(shapeById('E-maj'), root('F'))!;
    expect(v.positions.map((p) => p.fret)).toEqual([1, 3, 3, 2, 1, 1]);
    expect(placeShape(shapeById('E-maj'), root('C'))!.positions[0]!.fret).toBe(8);
    expect(placeShape(shapeById('A-maj'), root('B', -1))!.positions[0]!.fret).toBe(1);
  });

  it('finds close and drop-2 seventh chords on four adjacent strings and classifies them', () => {
    const vs = findVoicings(root('C'), QUALITIES.maj7, { stringSets: adjacentSets(4), inversions: true });
    expect(vs.length).toBeGreaterThan(4);
    for (const v of vs) {
      expect(v.tones.map((t) => t.label).sort()).toEqual(['1', '3', '5', '7']);
      expect(Math.max(...v.positions.map((p) => p.fret))).toBeLessThanOrEqual(12);
    }
    expect(voicingType([55, 60, 64, 71])).toBe('drop2'); // G C E B
    expect(voicingType([60, 64, 67, 71])).toBe('close');
    expect(voicingType([52, 60, 67, 71])).toBe('drop3'); // E C G B: the E of C E G B dropped an octave
    expect(vs.some((v) => voicingType(v.midis) === 'drop2')).toBe(true);
    const drop3 = findVoicings(root('C'), QUALITIES.maj7, { stringSets: [[6, 4, 3, 2], [5, 3, 2, 1]], inversions: true, types: ['drop3'] });
    expect(drop3.length).toBeGreaterThan(0);
  });

  it('keeps the root in the bass unless inversions or a bass tone are asked for', () => {
    const rootPosition = findVoicings(root('G'), QUALITIES.maj, { stringSets: adjacentSets(3) });
    expect(rootPosition.every((v) => v.tones[0]!.semitones === 0)).toBe(true);
    const slash = findVoicings(root('G'), QUALITIES.maj, { stringSets: adjacentSets(4), bassTone: INTERVALS.M3 });
    expect(slash.length).toBeGreaterThan(0);
    expect(slash.every((v) => v.tones[0] === INTERVALS.M3)).toBe(true);
  });
});

describe('chord stages', () => {
  const chordStages = STAGES.filter((s) => s.chords);
  const SEEDS = [1, 2, 3, 5, 8, 13, 21, 34];

  it('exist for Part D, free reading and the bonus stages', () => {
    expect(chordStages.length).toBe(29 + 1 + 12);
    expect(chordStages[0]!.number).toBe(18);
    expect(STAGES.find((s) => s.name === 'Free reading')!.number).toBe(47);
  });

  it('generate bars that add up, with every chord ascending, in range, spelled consistently and fingerable', () => {
    for (const stage of chordStages) {
      for (const seed of SEEDS) {
        const melody = generateMelody(stage, seed);
        const label = `${stage.id} ${keyId(melody.key)} seed ${seed}`;
        expect(totalBeats(melody.notes), label).toBe(melody.counts);
        const events = groupEvents(melody.notes);
        const chords = events.filter((e) => e.length > 1);
        if (stage.chords!.mix === undefined) expect(chords.length, label).toBe(events.length);
        for (const chord of chords) {
          expect(chord.every((n) => n.duration === chord[0]!.duration), label).toBe(true);
          for (let i = 1; i < chord.length; i++) expect(chord[i]!.midi, label).toBeGreaterThan(chord[i - 1]!.midi);
          const fretted = chord.map((n) => n.fret).filter((f) => f > 0);
          if (fretted.length > 1) expect(Math.max(...fretted) - Math.min(...fretted), label).toBeLessThanOrEqual(5);
          for (const n of chord) {
            expect(n.fret, label).toBeGreaterThanOrEqual(0);
            expect(n.fret, label).toBeLessThanOrEqual(12);
            expect(midiAt({ string: n.string, fret: n.fret }), label).toBe(n.midi);
            expect(n.spelled, label).toBeDefined();
            expect(midiFromSpelled(n.spelled!), label).toBe(writtenFromSounding(n.midi));
          }
        }
      }
    }
  });

  it('draws open-chord stages only in keys that hold their chords, and only the chords of that key', () => {
    const open = STAGES.find((s) => s.name === 'Open major triads')!;
    // C flat major holds the open E shape as F flat major (same pitch classes, spelled from the key).
    expect(open.keys.map((k) => keyId(k)).sort()).toEqual(['A', 'B', 'C', 'Cb', 'D', 'E', 'F', 'G']);
    for (let seed = 1; seed <= 30; seed++) {
      const melody = generateMelody(open, seed);
      for (const chord of groupEvents(melody.notes).filter((e) => e.length > 1)) {
        for (const n of chord) expect(n.spelled!.accidental === 0 || keyId(melody.key) !== 'C', `${keyId(melody.key)} seed ${seed}`).toBe(true);
      }
    }
  });

  it('put chords under some melody notes on mixed stages, with the melody note on top', () => {
    const chordMelody = STAGES.find((s) => s.name === 'Chord melody')!;
    let withChords = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const melody = generateMelody(chordMelody, seed);
      const chords = groupEvents(melody.notes).filter((e) => e.length > 1);
      if (chords.length > 0) withChords++;
    }
    expect(withChords).toBeGreaterThan(10);
  });
});
