# Guitar Reading Trainer

A web app that teaches self-learning guitarists to read standard notation while training their ear. Created and maintained by Dirk Swanepoel. The app plays a short melody, shows it on a fretboard, and the learner writes it on a treble staff. Every mistake is graded and explained.

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

Linux Mint / Ubuntu packages (.deb, .run, zip) come from `VERSION=0.18.2 sh linux/build-packages.sh` run on Linux or WSL after the single-file build; see `linux/INSTALL-LINUX.txt`.

The Android app is the same single-file page in a WebView (`android/`): `.androiduild-apk.ps1 -Version 0.18.2` in PowerShell builds `dist/GuitarReadingTrainer-v0.18.2.apk` without Gradle, using Android Studio's bundled JDK and SDK build-tools 36 (aapt2, javac, d8, zipalign, apksigner with the debug key); the versionCode is derived from the version. The wrapper needs no permissions, draws edge to edge and hands the system bar insets to the page as the CSS variables `--safe-top` and `--safe-bottom`; the page reports its theme through `window.AndroidTheme` so the status bar icons stay readable. See `android/INSTALL-ANDROID.txt`.

## Music rules baked into the code

- **Guitar is a transposing instrument.** Every pitch is stored as the *sounding* MIDI number. Written pitch is sounding plus one octave, computed only in `src/music/pitch.ts` (`writtenFromSounding` / `soundingFromWritten`). Audio and the fretboard use sounding pitch; the staff uses written pitch.
- **Spelling is strict.** A note is spelled by `spellInKey` in `src/music/key.ts`: diatonic notes take the key's spelling; a chromatic note that merely cancels the key signature is written with a natural (F♮ in G major); other chromatic notes use sharps in C major and sharp keys, flats in flat keys. An enharmonic answer (E♯ for F) is graded as a pitch mistake.
- **Signs follow standard engraving rules** (`src/notation/accidentals.ts`, after Alfred's *Essential Dictionary of Music Notation*): a plain note takes the key signature; a written sign applies to that pitch for the rest of the bar until another sign on it; it must be rewritten in the next bar; other octaves are separate; a courtesy sign that restates what already applies is legal, not a mistake. The learner's answer stores the sign drawn in front of each note and is read with these rules before grading.
- **Keys and modes.** Every melody carries a key drawn from its stage's `keys`. `MAJOR_KEYS` and `MINOR_KEYS` hold the fifteen keys of the circle of fifths; a minor key has a mode (natural, harmonic, melodic). The key signature is always the natural form, so the raised degrees of harmonic and melodic minor are written with signs, and melodic minor uses the raised 6th and 7th going up and the natural ones coming down (generator rule). Append `?key=G`, `?key=Am-h` or `?key=Cm-m` to the URL to force a key and `?unlock=59` to open every stage for testing.
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

**Watch and write** lights up each note on the fretboard as it plays. **Listen only** hides the fretboard for dictation by ear; the starting note is shown on a short staff with the key signature, as a place only, no name and no length (`src/notation/startNote.ts`, `src/components/StartNote.tsx`), because relative pitch can be trained and perfect pitch mostly cannot; a row of pips shows how far the melody has got. Both modes share one progress track. A third mode, read and play, where the microphone graded what the learner played on the guitar, was removed on 2026-10-13 (R22 in `docs/rules.md`): its grading depended on the microphone, the room and the guitar's overtones rather than on the code, and could not keep the promise that a grade is always right. The mode is chosen on the start screen and remembered with the rest of the progress, as is the guitar handedness: the left-handed view mirrors the fretboard with the nut on the right.

### Interface

The look is a small design system in `src/styles.css`: tokens for colour, radius and shadow; `.panel` cards; a `.segmented` control; a toggle switch; `Ring` (progress ring); `.path` for the stage ladder grouped by part; `.sticky-cta` for the primary action on phones. Icons are inline SVG in `src/components/icons.tsx`, so the single-file build needs no icon font. The theme is chosen on the home screen (Auto follows the device, or Light or Dark; the light theme uses a blue accent and a maple fretboard, the dark theme a cool blue on slate and rosewood; switching crossfades through the View Transitions API, or a CSS colour transition where that is missing; `Progress.theme`, a `data-theme` attribute on `<html>`). Every staff sits on a cream paper card in both themes, with the notation colours fixed in `src/notation/paper.ts`, so what is read here looks like printed music.

### Stage guides and metronome

The count-in and both metronomes use the same click as the user's Tempus (Seiko-style) metronome, synthesised in `src/audio/click.ts`: a 1000 Hz sine with a quarter of 2 kHz overtone, 1 ms attack, exponential decay over 60 ms, rendered once into a buffer and played through a gain node. One uniform click, no accent, as in Tempus.

`src/melody/stageGuide.ts` builds, for any stage, the list of pitches it can draw on (via the generator's pitch pool in C major, or the stage's first key), named as written, with the ones new since the previous stage flagged, plus the keys, note lengths and range in words. `src/components/StageGuide.tsx` shows that as a page: the pitches on a staff with their names (new ones in blue, tap "Hear them in order" to play them), the same positions dotted on the fretboard, and a Start button. The page opens by itself the first time a stage is met (`Progress.seenGuides`) and from the Stage guide button on the start screen. `Progress.metronome` turns on a click on every beat during playback (`PlayOptions.metronome` and `barBeats`); it is off by default and never sounds under the feedback playback.

## Progression

The stage ladder in `docs/stage-ladder.md` is implemented in `src/melody/stages.ts` (configs) and `src/session/progression.ts` (rules). Length is counted in beats (`src/melody/meter.ts`): 4 counts is a bar of 4/4, 5 is 4/4 + 1/4, 8 is two bars of 4/4, 9 is 4/4 + 4/4 + 1/4, up to 16. A stage unlocks after ten flawless melodies (every note and every length right); melodies with mistakes neither count nor cost anything. Two weak rounds (under 60%) in a row drop back a stage. Every main stage (1 to 47) plays one bar of 4/4; there is no length control. A stage that adds frets or strings (`Stage.introduces`, computed from the previous stage) puts at least one note on a new position in every melody; every main-stage melody also uses the top usable fret of its window, and in a key with a signature carries a note altered by it. The generator redraws up to 200 times and moves notes between positions until the rules hold; `docs/rules.md` lists every rule and the conflicts between them. No melody repeats on a stage: each track remembers the fingerprints (key, pitches, lengths) of what every stage has given and draws fresh seeds until it has something new. A stage lost by demotion shows its guide again when it is won back. After free reading come twelve bonus stages (48 to 59), each one count longer (5 counts is 4/4 + 1/4, up to 16), with keys drawn from every major and minor form and positions from the whole neck. Stages are hard-locked: the start screen only offers stages already reached. Every bar of a generated melody starts on a chord tone of its key. All 47 main stages are configured: majors added two keys per stage in cycle-of-fifths order, with a key-introducing stage using only its new keys and every other stage all keys so far (R18); eighths at stage 5; strings 5 and 6 from the open low E at stage 6 with A and E♭ major (R19); whole and dotted notes at stage 7; fifth position at 12; frets 9 to 12 at 13; natural, harmonic and melodic minor (14-17); then Part D, 29 chord stages (18-46, R23) from power chords through open, barre, diminished, augmented and suspended triads, every seventh chord, sixths and added notes, ninths to thirteenths, altered dominants, slash chords, drop 2 and drop 3, quartal, cluster and polychord voicings to chord melody; and free reading (47) over the whole neck with chords under the melody. Part C and free reading allow two listens, the chord stages three. The stage, length and lifetime counts persist in localStorage; the start screen lets you pick any stage already reached.

## Tutorial

`src/tutorial/` holds the beginner course as data and pure functions. `lessons.ts` defines Part 0 (five lessons before stage 1) and the stage lessons that run before the guides of stages 3, 5, 6, 7, 12, 14 and 18; a lesson is a list of steps: an explanation with an example staff, fretboard and sound, a drill of generated questions, or the coached first melody. `questions.ts` generates the question kinds (name the note, tap the line or space, staff to fretboard, fretboard to staff, which rhythm, tap along), `placement.ts` the placement test's tiers and the stage it places at, `coach.ts` the note-by-note verdicts, and `tap.ts` the tap-along timing. The screens are `LessonRunner`, `QuestionCard` (draws and grades every question kind on a `MiniStaff` and a tappable `Fretboard`), and `PlacementScreen`. `Progress.tutorial` remembers finished lessons, `Progress.tutorialSkipped` hides the welcome panel, and `Progress.hints` switches the beginner hints on stages 1 and 2. Rules R24 to R27 in `docs/rules.md`.

## Chords

A chord is a run of melody notes that share a `chord` id (`src/melody/types.ts`), listed from the lowest note up and sharing one length; `src/melody/bars.ts` counts a chord's beats once and never splits it across a bar line. `src/chords/formulas.ts` defines every chord quality as intervals from the root, and spells each tone from the root so altered and extended tones are written as the chord demands (D♯ for the sharp nine of C7♯9, A♭ for the diminished seventh of B°7). `src/chords/voicings.ts` holds the open shapes and the moveable E- and A-shapes, and a search that places a chord's tones on any string set within a hand span, which yields close, drop-2 and drop-3 voicings, inversions, slash chords and dyads; `src/chords/vocabulary.ts` says what each Part D stage draws from, and `src/chords/generator.ts` draws chords for a bar or puts them under melody notes with that note on top. On the staff the learner turns on Chord mode and taps lines and spaces to stack notes on the selected note (`AnswerAction` `stack`); the grader aligns chord tones like any other notes, reports a wrong chord length once, and the player strums a chord from the lowest note up. The guide of a chord stage shows example chords, named, and the fretboard lights every note of the chord that is sounding.

## Levels

A stage is a `LevelConfig` object (`src/melody/levelConfig.ts`) with a number, name and summary (`src/melody/stages.ts`). Stage 1: C major, 4/4, 1 to 4 bars, strings 1-3, frets 0-3, quarter and half notes, leaps up to a third, start and end on a chord tone, 72 bpm, three listens.

## Licence

Copyright 2026 Dirk Swanepoel. The app's own code and content are licensed under the [PolyForm Noncommercial License 1.0.0](LICENSE.md): free to use, study, change and share for any noncommercial purpose, including personal practice, teaching, schools, charities and public research. Commercial use, such as selling the app or a modified copy, or building a paid product on it, needs a separate licence from the copyright holder. Anyone who passes the software on must include the licence terms and the "Required Notice" line.

The app's About and licences screen (start screen, bottom link; `src/components/AboutScreen.tsx`) shows the version, the maintainer, this licence and every third-party part with its copyright lines and full licence text, as their licences require. The list lives in `src/about/licences.json`, generated by `node tools/licences.mjs` from the lock file and each package's own LICENSE file; a test fails if a production dependency is added or updated without regenerating it.

Third-party parts keep their own licences: VexFlow and Tone.js (MIT), the bundled Bravura and Academico music fonts (SIL Open Font License 1.1, see `src/notation/vendor/NOTICE.md`), and the FluidR3_GM guitar samples by Frank Wen via midi-js-soundfonts (CC BY 3.0, credited in the app footer).
