# Guitar Reading Trainer

A web app that teaches self-learning guitarists to read standard notation while training their ear. The app plays a short melody, shows it on a fretboard, and the learner writes it on a treble staff. Every mistake is graded and explained.

Live: https://theaminstitute-commits.github.io/guitar-reading-trainer/ (installable as a PWA from the browser menu). Every push to `main` runs the tests, builds, and deploys to GitHub Pages through `.github/workflows/deploy.yml`.

## Run

```bash
npm install
npm run dev        # http://localhost:5181
npm test           # unit tests (Vitest)
npm run typecheck  # TypeScript
npm run build      # production build + PWA service worker in dist/
node tools/single-file.mjs  # one self-contained HTML file from dist/
```

Linux Mint / Ubuntu packages (.deb, .run, zip) come from `VERSION=0.1.1 sh linux/build-packages.sh` run on Linux or WSL after the single-file build; see `linux/INSTALL-LINUX.txt`.

## Music rules baked into the code

- **Guitar is a transposing instrument.** Every pitch is stored as the *sounding* MIDI number. Written pitch is sounding plus one octave, computed only in `src/music/pitch.ts` (`writtenFromSounding` / `soundingFromWritten`). Audio and the fretboard use sounding pitch; the staff uses written pitch.
- **Spelling is strict.** A note is spelled by `spellInKey` in `src/music/key.ts`: diatonic notes take the key's spelling; a chromatic note that merely cancels the key signature is written with a natural (F♮ in G major); other chromatic notes use sharps in C major and sharp keys, flats in flat keys. An enharmonic answer (E♯ for F) is graded as a pitch mistake.
- **Signs follow standard engraving rules** (`src/notation/accidentals.ts`, after Alfred's *Essential Dictionary of Music Notation*): a plain note takes the key signature; a written sign applies to that pitch for the rest of the bar until another sign on it; it must be rewritten in the next bar; other octaves are separate; a courtesy sign that restates what already applies is legal, not a mistake. The learner's answer stores the sign drawn in front of each note and is read with these rules before grading.
- **Keys.** Every melody carries a key drawn from its level's `keys`; all fifteen major keys of the circle of fifths exist in `MAJOR_KEYS`. Level 1 still uses C major only; append `?key=G` (or `Bb`, `F#`, ...) to the URL to force a key while the stage ladder is being built.
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
