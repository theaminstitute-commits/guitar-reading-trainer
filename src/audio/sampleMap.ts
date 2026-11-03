/**
 * Sample URLs for the guitar, bass and piano samplers. Vite turns these imports into URLs, and
 * because `build.assetsInlineLimit` is high they become data URIs in the bundle,
 * so the built app is a single self-contained file. See samples/NOTICE.md for
 * the licence.
 */
import C3 from './samples/C3.mp3';
import Eb3 from './samples/Eb3.mp3';
import G3 from './samples/G3.mp3';
import A3 from './samples/A3.mp3';
import B3 from './samples/B3.mp3';
import C4 from './samples/C4.mp3';
import D4 from './samples/D4.mp3';
import E4 from './samples/E4.mp3';
import F4 from './samples/F4.mp3';
import G4 from './samples/G4.mp3';
import Bb4 from './samples/Bb4.mp3';
import Db5 from './samples/Db5.mp3';
import E5 from './samples/E5.mp3';
import G5 from './samples/G5.mp3';
import Bb5 from './samples/Bb5.mp3';
import C6 from './samples/C6.mp3';
import PianoE4 from './samples/piano/E4.mp3';
import PianoE5 from './samples/piano/E5.mp3';
import PianoG2 from './samples/piano/G2.mp3';
import PianoG3 from './samples/piano/G3.mp3';
import BassE1 from './samples/bass/E1.mp3';
import BassG1 from './samples/bass/G1.mp3';
import BassBb1 from './samples/bass/Bb1.mp3';
import BassDb2 from './samples/bass/Db2.mp3';
import BassE2 from './samples/bass/E2.mp3';
import BassG2 from './samples/bass/G2.mp3';
import BassBb2 from './samples/bass/Bb2.mp3';
import BassDb3 from './samples/bass/Db3.mp3';
import BassE3 from './samples/bass/E3.mp3';
import BassG3 from './samples/bass/G3.mp3';

/** Keys are Tone.js note names of the SOUNDING pitch. */
export const GUITAR_SAMPLES: Record<string, string> = {
  C3,
  Eb3,
  G3,
  A3,
  B3,
  C4,
  D4,
  E4,
  F4,
  G4,
  Bb4,
  Db5,
  E5,
  G5,
  Bb5,
  C6,
};

/** The bass (R41), sounding E1 to G3 (open low E to the G string's 12th fret): a minor third apart, the rest pitch-shifted. */
export const BASS_SAMPLES: Record<string, string> = {
  E1: BassE1,
  G1: BassG1,
  Bb1: BassBb1,
  Db2: BassDb2,
  E2: BassE2,
  G2: BassG2,
  Bb2: BassBb2,
  Db3: BassDb3,
  E3: BassE3,
  G3: BassG3,
};

/**
 * The piano, only for the lessons that compare the instrument with the piano (R37): E4 and E5 for the
 * guitar's open high E, G2 and G3 for the bass's open G string; the rest pitch-shifted.
 */
export const PIANO_SAMPLES: Record<string, string> = { G2: PianoG2, G3: PianoG3, E4: PianoE4, E5: PianoE5 };

export const SAMPLE_CREDIT =
  'Guitar, bass and piano sound: FluidR3_GM acoustic steel guitar, fingered electric bass and acoustic grand piano (Frank Wen), MP3 rendering by midi-js-soundfonts, CC BY 3.0.';
