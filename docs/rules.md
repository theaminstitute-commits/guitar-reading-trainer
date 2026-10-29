# Rule set

The rules the app follows, in the order they were decided. Every new rule is checked against the
ones before it; conflicts and how they were settled are logged at the end. Rules the user has
stated are marked **(user)**; the rest are defaults the user accepted.

| # | Rule | Decided | Where in the code |
|---|---|---|---|
| R1 | Spelling is strict: an enharmonic answer (E♯ for F) is a pitch mistake, not a soft category. **(user)** | 2026-09-30 | `grading/grade.ts`, `notation/accidentals.ts` |
| R2 | Pitches are stored as sounding MIDI; written pitch is an octave higher, converted in one place. **(user)** | 2026-09-30 | `music/pitch.ts` |
| R3 | The key signature is always given. The tonic sounds twice before the count-in from stage 3. Three listens per melody in Part A, two in Part B. | 2026-09-30 | `melody/stages.ts`, `audio/player.ts` |
| R4 | Every bar starts on a chord tone; melodies start and end on degree 1, 3 or 5; leaps are limited per stage. | 2026-10-01 | `melody/generator.ts` |
| R5 | Keys are random within a stage's set; new keys arrive two per stage in cycle-of-fifths order. | 2026-09-30 | `melody/stages.ts` |
| R6 | No click under the feedback playback. **(user)** | 2026-10-01 | `components/FeedbackScreen.tsx` |
| R7 | A stage that adds frets or strings puts at least one note on a newly added position in every melody. **(user)** | 2026-10-05 | `Stage.introduces`, `melody/generator.ts` |
| R8 | A stage unlocks after ten flawless melodies (every note and every length right). Melodies with any mistake neither count nor cost. Two weak rounds in a row drop a stage. **(user)** | 2026-10-05 | `session/progression.ts` |
| R9 | Every main stage (1 to 21) is one bar of 4/4. There is no length control anywhere. **(user)** | 2026-10-05 | `melody/levelConfig.ts`, `components/StartScreen.tsx` |
| R10 | Extra counts exist only as bonus stages after free reading: 19 to 30 (22 to 33 until 2026-10-08) carry 5 to 16 counts, fixed, with random keys from every major and minor form and positions over the whole neck. **(user)** | 2026-10-05 | `melody/stages.ts` |
| R11 | The count-in and the metronome use the Tempus click: one uniform click, no accent. The metronome is off by default. **(user)** | 2026-10-05 | `audio/click.ts`, `audio/player.ts` |
| R12 | A stage guide page opens before a stage the first time it is met and from a button on the start screen. There is no optional stage. **(user)** | 2026-10-05 | `components/StageGuide.tsx` |
| R13 | The newest fret stays in use: every melody on a main stage puts at least one note on the highest fret of the stage's window that has an in-key note on one of the stage's strings. Where the top fret has none (F major in first position has no note on fret 4 on any string), the next fret down counts. Waived on the stage that adds strings (6, under R19; 12, 13 and 15 of the old ladder before that), see the conflict log. **(user, rule 1 of 2026-10-06)** | 2026-10-06 | `LevelConfig.featureFret`, `melody/generator.ts` |
| R14 | In a key with a key signature, every melody contains at least one note altered by that signature (a B♭ in F major, an F♯ or C♯ in D major). Raised minor degrees do not count; they are not in the signature. **(user, rule 2 of 2026-10-06)** | 2026-10-06 | `melody/generator.ts` |
| R15 | Stage 1 reads from written D4 to G5: strings 1 to 4, frets 0 to 3. **(user, rule 3 of 2026-10-06)** | 2026-10-06 | `melody/levelConfig.ts` |
| R16 | No melody is given twice on the same stage. Two melodies are the same when their key, pitches and lengths match; where the notes are played does not count. The app remembers what each stage has given (per track, up to 400 melodies a stage) and draws again until it has something new. **(user, rule 4 of 2026-10-06)** | 2026-10-06 | `session/progression.ts` (`fingerprint`, `withMelodyHeard`), `App.tsx` |
| R17 | A stage lost through demotion shows its guide page again when it is won back. **(user, rule 5 of 2026-10-06)** | 2026-10-06 | `App.tsx` (`record`) |
| R18 | A stage that introduces keys uses only those keys, so the learner meets what the stage is about from the first melody (stage 3: G and F; 4: D and B♭; 6: A and E♭; 8: E and A♭; 9: B and D♭; 10: F♯ and G♭; 11: C♯ and C♭; 14: A, E and D minor; 15: B, G, F♯ and C minor). Every other stage draws from all the keys introduced so far. **(user, 2026-10-08)** | 2026-10-08 | `melody/stages.ts` |
| R19 | The fifth and sixth strings arrive with A and E♭ major (stage 6), from the open low E, and stay in every stage after that, including the keys introduced earlier when those come round again. **(user, 2026-10-08)** | 2026-10-08 | `melody/stages.ts` |
| R20 | In Watch and write the staff panel says "Write what you see"; in Listen only, "Write what you heard". **(user, 2026-10-08)** | 2026-10-08 | `components/ExerciseScreen.tsx` |
| R22 | The app has two modes, Watch and write and Listen only, on one progress track. Read and play (the microphone grading what the learner played) was removed on 2026-10-13 and is not to come back as a graded mode: its grades depended on the microphone, the room and the guitar's overtones, and the app's promise is that a grade is always right. **(user, 2026-10-13)** | 2026-10-13 | `session/progression.ts`, `storage/progress.ts` |
| R27 | A stage that brings something new opens with a short lesson before its guide page, the first time it is met: sharps, flats and key signatures (stage 3), eighth notes (5), ledger lines and the low strings (6), whole and dotted notes (7), positions (12), minor keys (14), chords (18). Each is one or two explanations and a drill. Every lesson can be replayed from the Learn list. **(user, 2026-10-28)** | 2026-10-28 | `tutorial/lessons.ts` (`STAGE_LESSONS`), `App.tsx` (`begin`) |
| R26 | Beginner hints on stage 1 only (they end when stage 2 is reached; stage 2 was dropped from them by the user on 2026-10-29), on by default and switched off on the start screen: a coach checks each note as it is written and names it after two wrong tries, the lit fretboard dot shows the note's letter, and the first Play runs a little slower. Nowhere else. **(user, 2026-10-28)** | 2026-10-28 | `tutorial/coach.ts`, `components/ExerciseScreen.tsx`, `Progress.hints` |
| R25 | A placement test for players who can already read: tiers of four questions in ladder order (staff notes, one and two accidentals, eighth notes, ledger lines below, three to six accidentals, ledger lines above, raised notes in minor). Three right passes a tier; the test stops at the first tier failed and places the learner at the stage that teaches it, opening every stage before it. Passing everything places them at stage 18, the first chord stage. **(user, 2026-10-28)** | 2026-10-28 | `tutorial/placement.ts`, `components/PlacementScreen.tsx` |
| R24 | Part 0, the tutorial: five lessons before stage 1 (the staff; the guitar octave; notes on the neck; beat and rhythm with a tap-along; a first melody with a coach and unlimited listens). It is optional: a new learner is offered it, the placement test, or stage 1 directly. One idea per screen, each followed by something to do; answers are judged at once. Nothing in the tutorial counts towards the ladder or is remembered as a melody heard. **(user, 2026-10-28)** | 2026-10-28 | `tutorial/`, `components/LessonRunner.tsx`, `components/QuestionCard.tsx`, `components/StartScreen.tsx` |
| R23 | Part D, chords: 29 stages between melodic minor (17) and free reading sit at 18 to 46, in the user's order: power chords; thirds and sixths; fourths, octaves and tenths; open major triads; open minor triads; open triads with F and B minor; barre chords (E and A shapes); diminished, augmented and suspended triads; dominant, minor, major, half-diminished, diminished, minor-major and augmented sevenths with 7sus4; sixth, added-note and six-nine chords; ninths, elevenths, thirteenths; altered dominants; slash chords and inversions; drop 2 and drop 3; quartal and cluster voicings; polychords; chord melody. The learner writes every note of each chord on the staff. Free reading (47) and the bonus stages (48 to 59) mix chords and melody, with the melody note on top of every chord. Chord tones are spelled from the chord's root (a sharp nine over C is D♯). **(user, 2026-10-26)** | 2026-10-26 | `chords/` (formulas, voicings, vocabulary, generator), `melody/stages.ts`, `notation/answer.ts` (chord mode) |
| R28 | Every string that sounds on a fretboard vibrates slightly while it rings, and only the part that really moves: from the fret wire under the finger (or the nut, for an open string) to the bridge end. The swing is larger on a longer free length and dies away like a plucked string. No motion for users who ask their system for reduced motion. **(user, 2026-10-28)** | 2026-10-28 | `components/Fretboard.tsx` (`ringing`), `styles.css` (`fb-vibrate`) |
| R29 | A fretted note is drawn a quarter of a fret from its fret wire, halfway between the middle of the fret and the wire, where the finger should press. Everywhere a fretboard dot is drawn: the sounding note, the trail, answer marks. Open notes are circled on the strings, which run on past a slightly thicker nut to reach them, so they look as playable as any fret; the open dots sit on those circles. **(user, 2026-10-28)** | 2026-10-28 | `components/Fretboard.tsx` (`noteX`) |
| R30 | "Which open string?" is answered on the fretboard, not with buttons: a tap anywhere on a string means that open string, and it sounds at once. **(user, 2026-10-28)** | 2026-10-28 | `tutorial/lessons.ts` (`openStringQuestions`), `components/QuestionCard.tsx` (`openOnly`) |
| R21 | In Listen only, the starting note of every melody is shown on the staff before it plays: its place only, with the key signature, no name and no length. Few people have perfect pitch; relative pitch can be trained, so the ear gets an anchor to hear from. The learner still writes the first note; it is graded like the others. **(user, 2026-10-13)** | 2026-10-13 | `notation/startNote.ts`, `components/StartNote.tsx`, `components/ExerciseScreen.tsx` |

## How a rule is enforced

R7, R13 and R14 are checked on every generated melody. The generator draws a melody, and if a
rule is not met it redraws with a new seed, up to 200 times. R7 and R13 are about *where* a note
is played, so when every draw fails they are met by moving a note of the right pitch onto a
qualifying position (stage 2 in C major: the B that also lives on the open second string is put on
fret 4 of the third string). R14 is about pitch, so only a redraw can meet it. The test suite
checks all three over every stage and forty seeds.

## Conflict log

- **2026-10-28, R24 to R27 (tutorial) against the rule set.** Checked one by one:
  - **R8, ten flawless melodies to unlock.** The tutorial sits outside the ladder: its drills and its coached melody never touch the flawless count or the weak streak. The placement test (R25) is a deliberate exception that opens stages without flawless melodies, the way `?unlock` does for testing; it only ever opens stages, never closes one already reached.
  - **R8 against R26.** With hints on, a flawless melody on stage 1 still counts, although the coach has helped. Accepted: that stage is where beginners need help, and the hints switch off for anyone who wants the unaided count.
  - **R12 and R17, the guide page.** A stage lesson (R27) runs before the guide the first time a stage is met, then the guide shows as before. A lesson already taken is not repeated when a lost stage is won back; the guide is (R17).
  - **R16, no repeated melodies.** The coached melody is drawn fresh each time and is not remembered on stage 1, so it never uses up stage 1's melodies.
  - **R11, the Tempus click.** The tap-along uses the same click.
  - **R22, no microphone.** The tap-along grades taps on the screen against the click, not sound.
  - **R1, strict spelling.** Lesson examples are spelled in their key; a test checks that no example needs a sign it did not ask for (this caught an F written for F♯ in the G major example).
  - **R21, the starting note.** Unchanged; the coached lesson runs in Watch and write, where the fretboard shows every note.

- **2026-10-26, R23 (chords) against the rules written for single notes.** Checked one by one:
  - **R9, one bar of 4/4.** Holds: a chord stage is one bar, with one or two chords (dyads: two to four).
  - **R13, top fret in use.** A chord's notes are fixed by its voicing, and the chord stages span the whole neck, so there is no top fret to feature. Waived on the pure chord stages (18 to 45), as it already is on the bonus stages. It still holds on chord melody (46) and free reading (47), where only the single notes may move to satisfy it; chord tones never move.
  - **R14, a signature note in every melody.** A power chord in G major has no F♯ to give. Waived on the pure chord stages; on chord melody, free reading and the bonus stages the melody notes carry it.
  - **R7, new frets and strings used at once.** Chord stages add no frets or strings (Part C already covers the neck), so nothing is introduced and nothing is forced.
  - **R18, key stages use only their new keys.** Chord stages introduce chord types, not keys; they draw from every major key (chord melody adds the natural minors) so the signature is read every time. No conflict.
  - **R1, strict spelling.** Kept, and made to follow the chord: every chord tone is spelled by its interval from the root, so C7♯9 carries D♯ even in a flat key, and a diminished seventh is spelled with its double flat where the root demands it. The root's own spelling is the key's when the root is in the key, unless that would force a double sign (D♭ diminished in G♭ major is written C♯ diminished).
  - **R3, the tonic before the count-in.** Kept: the tonic of the key still sounds, which is how a reader hears the chord's place in the key.
  - **R21, the starting note in Listen only.** When the melody opens with a chord, the bass note of that chord is shown.
  - **R8 and R12.** Unchanged: ten flawless melodies per stage, a guide page per stage. The guide of a chord stage shows example chords, named, instead of a pitch list. Reaching free reading now takes 460 flawless melodies and the last bonus stage 580.
  - **Listens.** Part C's two listens were for melody by ear; chords are harder to hear, so the chord stages return to three. Free reading keeps two.
  - **Saved progress.** Version 7 records: stages 1 to 17 keep their index, free reading and the bonus stages move up by 29, and the guides seen and melodies remembered move with them.

- **2026-10-13, R22 against R11 and the saved progress.** R11 spoke of "both metronomes"; the free-running one existed only for read and play and went with it, so R11 now reads "the metronome". Saved records of versions 4 and 5 carried a playing track; version 6 drops it and keeps the writing track, so nobody loses their place on the ladder. A saved mode of "play" becomes Watch and write. No other rule mentions the mode.

- **2026-10-13, R21 against R3 and the idea of Listen only.** R3 already gives the tonic by ear from
  stage 3; R21 adds the first note by eye. They do not clash: the tonic names the key, the starting
  note anchors the melody within it, and from stage 3 both are given. Listen only was described as
  "the ear does all the work", which R21 softens on purpose; the fretboard stays hidden and every
  note after the first is still heard, not seen. No other rule is touched: the note is drawn as a
  whole note so no length leaks (R8 grades the length the learner writes), the sign follows the
  key's spelling (R1), and the note is given in every melody, repeats or not (R16).

- **2026-10-08, R19 against the ladder settled under R15.** With strings 5 and 6 arriving at
  stage 6, the old stages 12 (fifth string), 13 (sixth string) and 15 (low strings in fifth
  position) taught nothing new. Settled by removing them: the main ladder is now 18 stages (fifth
  position at 12 on all six strings, the octave at 13, minors 14 to 17, free reading 18) and the
  bonus stages are 19 to 30. Saved progress is moved onto the new numbering (version 5 records):
  anyone on the removed stages lands on fifth position, later stages shift down by three.
- **2026-10-08, R19 against R13.** Stage 6 adds strings, so under the earlier settlement the
  top-fret rule is waived there (the new strings are the feature) and enforced again from stage 7.
- **2026-10-08, R18 against R5 and the stage guide.** R5 said keys are random within a stage's
  set; R18 narrows the set on key-introducing stages, which is a refinement, not a conflict. The
  guide page of such a stage now shows its pitches in the first new key (G major on stage 3)
  rather than in C, since C is no longer in the set.
- **2026-10-08, R18 against R14 on stage 6.** Every melody must carry a signature note *and* a
  note on the new strings, in A or E♭ major on one bar. C♯ and G♯ on the fifth and sixth strings
  (A major) and B♭ on the fifth (E♭ major) satisfy both at once; the test suite confirms every
  seed draws clean.

- **2026-10-06, R16 against the size of a stage.** A one-bar stage in one key (stage 1: eleven
  pitches, quarters and halves, R4 and R13 on top) has a few thousand distinct melodies, and the
  generator's rules narrow that further. A learner who stays on one stage for a very long time
  could exhaust it. Settled: the app tries sixty fresh draws, then accepts a repeat rather than
  stalling, and forgets the oldest of 400 remembered melodies per stage. In normal use, ten to
  thirty melodies per stage, nothing repeats.
- **2026-10-06, R17 against R12.** R12 shows a guide once per stage. R17 is a deliberate
  exception: demotion forgets that the higher stage's guide was seen, so it opens again on the way
  back up. The stage the learner drops to does not re-show its guide; only the regained one does.

- **2026-10-06, R15 against the ladder.** Stage 1 now includes the fourth string, so the old
  stage 12 ("fourth string") taught nothing new. Settled by splitting the low strings: stage 12
  adds the fifth string, stage 13 the sixth. One dimension per stage is kept, and the stage count
  stays at 21.
- **2026-10-06, rule 1's wording ("use lower pitched string sets") against the ladder.** Bringing
  all lower strings in early would empty stages 12 and 13. Settled by R15 (fourth string from the
  start) plus R13 (the top fret is used in every melody); strings 5 and 6 still arrive at 12 and 13.
  The user can overrule this.
- **2026-10-06, R13 against the fretboard itself.** In first position, fret 4 carries G♯, D♯, B,
  F♯, C♯ and G♯. F major has none of these on any string, and C major only the B. So in F major
  the rule falls back to fret 3 and in C major every melody carries a B on the third string. The
  rule cannot do more than the instrument allows.
- **2026-10-06, R14 against R4 and two-note bars.** A bar of two half notes starts and ends on
  degree 1, 3 or 5, so it can only carry a signature note when that note is a chord tone (F♯ in D
  major yes, B♭ in F major no). In such keys the redraw rejects two-note bars, so those melodies
  have three or four notes. Accepted.
- **2026-10-06, R13 against R10.** Bonus stages span the whole neck, where forcing a note on fret
  12 into every melody would be artificial. R13 applies to the main stages only.
- **2026-10-06, R13 against R7 on the stages that add a string (12, 13 and 15).** On those stages
  R7 wants a note on the new string and R13 a note on the top fret, and the two can lie more than
  an octave apart (stage 12 in B♭ major: B♭2 on the fifth string and E♭4 on fret 4 of the second),
  which a one-bar melody with leaps of a fourth cannot span. Found by the test suite. Settled by
  waiving R13 on 12, 13 and 15, where the new string is the feature; the top fret is enforced
  again from the next stage on (`featureFret` in `melody/stages.ts`).
