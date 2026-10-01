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

Linux Mint / Ubuntu packages (.deb, .run, zip) come from `VERSION=0.4.0 sh linux/build-packages.sh` run on Linux or WSL after the single-file build; see `linux/INSTALL-LINUX.txt`.

## Music rules baked into the code

- **Guitar is a transposing instrument.** Every pitch is stored as the *sounding* MIDI number. Written pitch is sounding plus one octave, computed only in `src/music/pitch.ts` (`writtenFromSounding` / `soundingFromWritten`). Audio and the fretboard use sounding pitch; the staff uses written pitch.
- **Spelling is strict.** A note is spelled by `spellInKey` in `src/music/key.ts`: diatonic notes take the key's spelling; a chromatic note that merely cancels the key signature is written with a natural (F♮ in G major); other chromatic notes use sharps in C major and sharp keys, flats in flat keys. An enharmonic answer (E♯ for F) is graded as a pitch mistake.
- **Signs follow standard engraving rules** (`src/notation/accidentals.ts`, after Alfred's *Essential Dictionary of Music Notation*): a plain note takes the key signature; a written sign applies to that pitch for the rest of the bar until another sign on it; it must be rewritten in the next bar; other octaves are separate; a courtesy sign that restates what already applies is legal, not a mistake. The learner's answer stores the sign drawn in front of each note and is read with these rules before grading.
- **Keys and modes.** Every melody carries a key drawn from its stage's `keys`. `MAJOR_KEYS` and `MINOR_KEYS` hold the fifteen keys of the circle of fifths; a minor key has a mode (natural, harmonic, melodic). The key signature is always the natural form, so the raised degrees of harmonic and melodic minor are written with signs, and melodic minor uses the raised 6th and 7th going up and the natural ones coming down (generator rule). Append `?key=G`, `?key=Am-h` or `?key=Cm-m` to the URL to force a key, `?unlock=18` to open every stage for testing, and `?selfplay=1` to run read-and-play against the app's own guitar.
- **Rhythm cells.** The generator writes eighths as beamed pairs on a beat and a dotted quarter always followed by an eighth, so no eighth starts off the beat (`DURATIONS[...].cell`).
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

## Modes

**Watch and write** lights up each note on the fretboard as it plays. **Listen only** hides the fretboard for dictation by ear; a row of pips shows how far the melody has got. **Read and play** reverses the task: the melody is shown as a score, the learner plays it on the guitar and the microphone listens. Only the tones and how many were played are graded, never the timing, and reading and playing keep separate progress tracks on the ladder. The mode is chosen on the start screen and remembered with the rest of the progress, as is the guitar handedness: the left-handed view mirrors the fretboard with the nut on the right.

### Microphone

`src/audio/pitch.ts` is a McLeod pitch detector (normalised square difference, first strong peak, parabolic interpolation), `src/audio/noteTracker.ts` turns level and pitch per frame into notes (onset on sound after silence or a level jump on a decaying string, a new note on a sustained pitch change), and `src/audio/mic.ts` opens the microphone with echo cancellation, noise suppression and automatic gain off, feeds 2048-sample frames every 20 ms and records the take for "Hear mine". Audio never leaves the device; the recording lives in memory for the current exercise only. The key note sounds before listening starts so the microphone does not hear it. A Mic check on the start screen shows the note heard, like a tuner. `?selfplay=1` makes the app play the melody into its own detector instead of listening, an end-to-end check that must grade clean.

## Progression

The stage ladder in `docs/stage-ladder.md` is implemented in `src/melody/stages.ts` (configs) and `src/session/progression.ts` (rules). Length is counted in beats (`src/melody/meter.ts`): 4 counts is a bar of 4/4, 5 is 4/4 + 1/4, 8 is two bars of 4/4, 9 is 4/4 + 4/4 + 1/4, up to 16. Inside a stage, three clean rounds in a row (pitch and rhythm both at 90% or better) add one count and two weak rounds (under 60%) remove one; clean rounds at 16 counts unlock the next stage, weak rounds at the stage starting length drop back a stage. Stages are hard-locked: the start screen only offers stages already reached. Every bar of a generated melody starts on a chord tone of its key. All eighteen stages of the ladder are configured: majors added two keys per stage in cycle-of-fifths order (stage 11 with seven accidentals is optional), eighths at stage 5, whole and dotted notes at stage 7, the fourth string at 12, fifth position at 13, then natural, harmonic and melodic minor (14-17) and free reading (18). Part B allows two listens. The stage, length and lifetime counts persist in localStorage; the start screen lets you pick a stage and length by hand.

## Levels

A stage is a `LevelConfig` object (`src/melody/levelConfig.ts`) with a number, name and summary (`src/melody/stages.ts`). Stage 1: C major, 4/4, 1 to 4 bars, strings 1-3, frets 0-3, quarter and half notes, leaps up to a third, start and end on a chord tone, 72 bpm, three listens.
