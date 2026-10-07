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

Linux Mint / Ubuntu packages (.deb, .run, zip) come from `VERSION=0.12.1 sh linux/build-packages.sh` run on Linux or WSL after the single-file build; see `linux/INSTALL-LINUX.txt`.

## Music rules baked into the code

- **Guitar is a transposing instrument.** Every pitch is stored as the *sounding* MIDI number. Written pitch is sounding plus one octave, computed only in `src/music/pitch.ts` (`writtenFromSounding` / `soundingFromWritten`). Audio and the fretboard use sounding pitch; the staff uses written pitch.
- **Spelling is strict.** A note is spelled by `spellInKey` in `src/music/key.ts`: diatonic notes take the key's spelling; a chromatic note that merely cancels the key signature is written with a natural (F♮ in G major); other chromatic notes use sharps in C major and sharp keys, flats in flat keys. An enharmonic answer (E♯ for F) is graded as a pitch mistake.
- **Signs follow standard engraving rules** (`src/notation/accidentals.ts`, after Alfred's *Essential Dictionary of Music Notation*): a plain note takes the key signature; a written sign applies to that pitch for the rest of the bar until another sign on it; it must be rewritten in the next bar; other octaves are separate; a courtesy sign that restates what already applies is legal, not a mistake. The learner's answer stores the sign drawn in front of each note and is read with these rules before grading.
- **Keys and modes.** Every melody carries a key drawn from its stage's `keys`. `MAJOR_KEYS` and `MINOR_KEYS` hold the fifteen keys of the circle of fifths; a minor key has a mode (natural, harmonic, melodic). The key signature is always the natural form, so the raised degrees of harmonic and melodic minor are written with signs, and melodic minor uses the raised 6th and 7th going up and the natural ones coming down (generator rule). Append `?key=G`, `?key=Am-h` or `?key=Cm-m` to the URL to force a key, `?unlock=33` to open every stage for testing, and `?selfplay=1` to run read-and-play against the app's own guitar.
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

### Interface

The look is a small design system in `src/styles.css`: tokens for colour, radius and shadow; `.panel` cards; a `.segmented` control; a toggle switch; `Ring` (progress ring); `.path` for the stage ladder grouped by part; `.sticky-cta` for the primary action on phones. Icons are inline SVG in `src/components/icons.tsx`, so the single-file build needs no icon font. The theme is chosen on the home screen (Auto follows the device, or Light or Dark; the light theme uses a blue accent, the dark theme amber; `Progress.theme`, a `data-theme` attribute on `<html>`). Every staff sits on a cream paper card in both themes, with the notation colours fixed in `src/notation/paper.ts`, so what is read here looks like printed music.

### Stage guides and metronome

The count-in and both metronomes use the same click as the user's Tempus (Seiko-style) metronome, synthesised in `src/audio/click.ts`: a 1000 Hz sine with a quarter of 2 kHz overtone, 1 ms attack, exponential decay over 60 ms, rendered once into a buffer and played through a gain node. One uniform click, no accent, as in Tempus.

`src/melody/stageGuide.ts` builds, for any stage, the list of pitches it can draw on (via the generator's pitch pool in C major, or the stage's first key), named as written, with the ones new since the previous stage flagged, plus the keys, note lengths and range in words. `src/components/StageGuide.tsx` shows that as a page: the pitches on a staff with their names (new ones in amber, tap "Hear them in order" to play them), the same positions dotted on the fretboard, and a Start button. The page opens by itself the first time a stage is met (`Progress.seenGuides`) and from the Stage guide button on the start screen. `Progress.metronome` turns on a click on every beat during playback in the writing modes (accent on bar starts, `PlayOptions.metronome` and `barBeats`); it is off by default and never sounds under the feedback playback. In read and play the same setting runs a free-running click at the melody tempo while the learner plays (`GuitarPlayer.startMetronome`); every click's time is handed to the listener, which skips the frames that contain it (`Listener.ignoreAround`) so a click on a ringing string is never counted as a new pluck.

### Microphone

`src/audio/pitch.ts` is a McLeod pitch detector (normalised square difference, first strong peak, parabolic interpolation), `src/audio/noteTracker.ts` turns level and pitch per frame into notes (onset on sound after silence or a level jump on a decaying string, a new note on a sustained pitch change), and `src/audio/mic.ts` opens the microphone with echo cancellation, noise suppression and automatic gain off, feeds 2048-sample frames every 20 ms and records the take for "Hear mine". Audio never leaves the device; the recording lives in memory for the current exercise only. The key note sounds before listening starts so the microphone does not hear it. A Mic check on the start screen shows the note heard, like a tuner. `?selfplay=1` makes the app play the melody into its own detector instead of listening, an end-to-end check that must grade clean.

## Progression

The stage ladder in `docs/stage-ladder.md` is implemented in `src/melody/stages.ts` (configs) and `src/session/progression.ts` (rules). Length is counted in beats (`src/melody/meter.ts`): 4 counts is a bar of 4/4, 5 is 4/4 + 1/4, 8 is two bars of 4/4, 9 is 4/4 + 4/4 + 1/4, up to 16. A stage unlocks after ten flawless melodies (every note and every length right); melodies with mistakes neither count nor cost anything. Two weak rounds (under 60%) in a row drop back a stage. Every main stage (1 to 21) plays one bar of 4/4; there is no length control. A stage that adds frets or strings (`Stage.introduces`, computed from the previous stage) puts at least one note on a new position in every melody; every main-stage melody also uses the top usable fret of its window, and in a key with a signature carries a note altered by it. The generator redraws up to 200 times and moves notes between positions until the rules hold; `docs/rules.md` lists every rule and the conflicts between them. No melody repeats on a stage: each track remembers the fingerprints (key, pitches, lengths) of what every stage has given and draws fresh seeds until it has something new. A stage lost by demotion shows its guide again when it is won back. After free reading come twelve bonus stages (22 to 33), each one count longer (5 counts is 4/4 + 1/4, up to 16), with keys drawn from every major and minor form and positions from the whole neck. Stages are hard-locked: the start screen only offers stages already reached. Every bar of a generated melody starts on a chord tone of its key. All twenty-one stages of the ladder are configured: majors added two keys per stage in cycle-of-fifths order, eighths at stage 5, whole and dotted notes at stage 7, the fifth string at 12, the sixth at 13, fifth position at 14 and 15, frets 9 to 12 at 16, then natural, harmonic and melodic minor (17-20) and free reading (21) over the whole neck. Part B allows two listens. The stage, length and lifetime counts persist in localStorage; the start screen lets you pick any stage already reached.

## Levels

A stage is a `LevelConfig` object (`src/melody/levelConfig.ts`) with a number, name and summary (`src/melody/stages.ts`). Stage 1: C major, 4/4, 1 to 4 bars, strings 1-3, frets 0-3, quarter and half notes, leaps up to a third, start and end on a chord tone, 72 bpm, three listens.
