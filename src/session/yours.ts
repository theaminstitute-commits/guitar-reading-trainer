/**
 * The learner's side of the feedback screen: how to draw what they produced
 * and how to play it back.
 */
import { sharedPlayer, type PlayableNote } from '../audio/player';
import type { YoursStaff } from '../components/FeedbackStaff';
import { timeSignaturesFor } from '../melody/meter';
import type { Melody } from '../melody/types';
import type { Key } from '../music/key';
import { spelledName, type SpelledNote } from '../music/pitch';
import { answerBarToSounding, resolveAnswerBar, type AnswerNote } from '../notation/answer';

export interface HearMine {
  /** Start playback; `onNote` gets the index of the note sounding, or null between notes. Resolves when finished or stopped. */
  play(onNote: (index: number | null) => void): Promise<void>;
  stop(): void;
}

const name = (s: SpelledNote) => `${spelledName(s)}${s.octave}`;

/** Notes written on the staff, bar for bar, exactly as the learner wrote them. */
export function yoursFromAnswer(answerBars: readonly (readonly AnswerNote[])[], melody: Melody, key: Key): YoursStaff {
  return {
    caption: 'Yours',
    bars: answerBars.map((bar) => ({ notes: bar.map((n) => ({ step: n.step, sign: n.sign, duration: n.duration, chord: n.chord })) })),
    names: answerBars.flatMap((bar) => resolveAnswerBar(bar, key).map(name)),
    barTimeSignatures: timeSignaturesFor(melody.barBeats),
    showTimeSignature: true,
  };
}

/** The written answer played on the sampled guitar at the melody's tempo. */
export function hearWrittenAnswer(answerBars: readonly (readonly AnswerNote[])[], melody: Melody, key: Key): HearMine {
  const notes: PlayableNote[] = answerBars.flatMap((bar) => {
    const sounding = answerBarToSounding(bar, key);
    return bar.map((n, i) => ({ midi: sounding[i]!, duration: n.duration, chord: n.chord }));
  });
  return {
    async play(onNote) {
      if (notes.length === 0) return;
      await sharedPlayer().play(
        notes,
        { tempo: melody.tempo, timeSignature: melody.timeSignature, countIn: false },
        { onNote: (i) => onNote(i), onEnd: () => onNote(null) },
      );
    },
    stop: () => sharedPlayer().stop(),
  };
}

