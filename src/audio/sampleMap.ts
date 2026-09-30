/**
 * Sample URLs for the guitar sampler. Vite turns these imports into URLs, and
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

export const SAMPLE_CREDIT =
  'Guitar sound: FluidR3_GM acoustic steel guitar (Frank Wen), MP3 rendering by midi-js-soundfonts, CC BY 3.0.';
