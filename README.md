# Guitar Reading Trainer

A web app that teaches self-learning guitarists to read standard notation while training their ear. The app plays a short melody, shows it on a fretboard, and the learner writes it on a treble staff. Every mistake is graded and explained.

## Run

```bash
npm install
npm run dev        # http://localhost:5181
npm test           # unit tests (Vitest)
npm run typecheck  # TypeScript
npm run build      # production build + PWA service worker in dist/
```

## Music rules baked into the code

- **Guitar is a transposing instrument.** Every pitch is stored as the *sounding* MIDI number. Written pitch is sounding plus one octave, computed only in `src/music/pitch.ts` (`writtenFromSounding` / `soundingFromWritten`). Audio and the fretboard use sounding pitch; the staff uses written pitch.
- **Spelling is strict.** A note is spelled by `spellInKey` in `src/music/key.ts`: diatonic notes take the key's spelling, chromatic notes use sharps in C major and sharp keys, flats in flat keys. An enharmonic answer (E♯ for F) is graded as a pitch mistake.
- **Position is separate from pitch.** A melody note carries `midi` plus the `string`/`fret` chosen for display (`src/melody/types.ts`).

## Layout

```
src/
  music/      pitch (MIDI, spelling, transposition), key, duration, fretboard tuning
  melody/     level configs, seeded generator, bar splitting
  grading/    edit-distance alignment, pitch/rhythm scoring, mistake classification and explanations
  session/    melody-length progression rules
  storage/    localStorage-backed progress behind a small ProgressStore interface
  audio/      Tone.js sampler playback (samples decoded from embedded data, no fetch)
  notation/   VexFlow rendering, tap hit-testing, the learner answer model, bundled music fonts
  explainers/ short teaching cards
  components/ Start, Exercise (fretboard + staff input), Feedback (overlay + explanations), ExplainerCard
tools/single-file.mjs  turns dist/ into one self-contained HTML file
```

## Grading

Target and answer are aligned with an edit-distance pass so an extra or missing note shifts the comparison instead of failing everything after it. Pitch and rhythm are scored separately over target notes plus extras. Mistakes are classified as wrong letter, wrong accidental, octave error, enharmonic spelling, wrong duration, missing or extra, each with a short explanation and a link to an explainer card.

## Progression

Melodies start at one bar. Three clean rounds in a row (pitch and rhythm both at 90% or better) add a bar, two weak rounds (under 60%) remove one, up to the level maximum of four. The current length and lifetime counts persist in localStorage.

## Levels

A level is a `LevelConfig` object in `src/melody/levelConfig.ts`. Level 1: C major, 4/4, 4 bars, strings 1-3, frets 0-3, quarter and half notes, leaps up to a third, start and end on a chord tone, 72 bpm.
