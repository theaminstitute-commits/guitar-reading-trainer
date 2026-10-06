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
| R10 | Extra counts exist only as bonus stages after free reading: 22 to 33 carry 5 to 16 counts, fixed, with random keys from every major and minor form and positions over the whole neck. **(user)** | 2026-10-05 | `melody/stages.ts` |
| R11 | The count-in and both metronomes use the Tempus click: one uniform click, no accent. The metronome is off by default. **(user)** | 2026-10-05 | `audio/click.ts`, `audio/player.ts` |
| R12 | A stage guide page opens before a stage the first time it is met and from a button on the start screen. There is no optional stage. **(user)** | 2026-10-05 | `components/StageGuide.tsx` |
| R13 | The newest fret stays in use: every melody on a main stage puts at least one note on the highest fret of the stage's window that has an in-key note on one of the stage's strings. Where the top fret has none (F major in first position has no note on fret 4 on any string), the next fret down counts. Waived on the stages that add a string (12, 13, 15), see the conflict log. **(user, rule 1 of 2026-10-06)** | 2026-10-06 | `LevelConfig.featureFret`, `melody/generator.ts` |
| R14 | In a key with a key signature, every melody contains at least one note altered by that signature (a B♭ in F major, an F♯ or C♯ in D major). Raised minor degrees do not count; they are not in the signature. **(user, rule 2 of 2026-10-06)** | 2026-10-06 | `melody/generator.ts` |
| R15 | Stage 1 reads from written D4 to G5: strings 1 to 4, frets 0 to 3. **(user, rule 3 of 2026-10-06)** | 2026-10-06 | `melody/levelConfig.ts` |
| R16 | No melody is given twice on the same stage. Two melodies are the same when their key, pitches and lengths match; where the notes are played does not count. The app remembers what each stage has given (per track, up to 400 melodies a stage) and draws again until it has something new. **(user, rule 4 of 2026-10-06)** | 2026-10-06 | `session/progression.ts` (`fingerprint`, `withMelodyHeard`), `App.tsx` |
| R17 | A stage lost through demotion shows its guide page again when it is won back. **(user, rule 5 of 2026-10-06)** | 2026-10-06 | `App.tsx` (`record`) |

## How a rule is enforced

R7, R13 and R14 are checked on every generated melody. The generator draws a melody, and if a
rule is not met it redraws with a new seed, up to 200 times. R7 and R13 are about *where* a note
is played, so when every draw fails they are met by moving a note of the right pitch onto a
qualifying position (stage 2 in C major: the B that also lives on the open second string is put on
fret 4 of the third string). R14 is about pitch, so only a redraw can meet it. The test suite
checks all three over every stage and forty seeds.

## Conflict log

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
