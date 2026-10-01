/**
 * The learner's side of the feedback screen: how to draw what they produced
 * and how to play it back. One builder per mode.
 */
import type { Take } from '../audio/mic';
import { sharedPlayer, type PlayableNote } from '../audio/player';
import type { YoursStaff } from '../components/FeedbackStaff';
import { timeSignaturesFor } from '../melody/meter';
import type { Melody } from '../melody/types';
import { spellInKey, type Key } from '../music/key';
import { spelledName, staffStep, writtenFromSounding, type SpelledNote } from '../music/pitch';
import { displaySignsForBars } from '../notation/accidentals';
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
    bars: answerBars.map((bar) => ({ notes: bar.map((n) => ({ step: n.step, sign: n.sign, duration: n.duration })) })),
    names: answerBars.flatMap((bar) => resolveAnswerBar(bar, key).map(name)),
    barTimeSignatures: timeSignaturesFor(melody.barBeats),
    showTimeSignature: true,
  };
}

/** The written answer played on the sampled guitar at the melody's tempo. */
export function hearWrittenAnswer(answerBars: readonly (readonly AnswerNote[])[], melody: Melody, key: Key): HearMine {
  const notes: PlayableNote[] = answerBars.flatMap((bar) => {
    const sounding = answerBarToSounding(bar, key);
    return bar.map((n, i) => ({ midi: sounding[i]!, duration: n.duration }));
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

/**
 * Notes the learner played, transcribed as quarter notes four to a bar (no
 * time signature: timing was not graded), spelled the way the key would.
 */
export function yoursFromTake(take: Take, key: Key): YoursStaff {
  const written = take.notes.map((n) => spellInKey(writtenFromSounding(n.midi), key));
  const bars: { notes: { step: number; sign: 'none' | 'sharp' | 'flat' | 'natural'; duration: 'q' }[] }[] = [];
  for (let i = 0; i < written.length; i += 4) bars.push({ notes: [] });
  if (bars.length === 0) bars.push({ notes: [] });
  const signsPerBar = displaySignsForBars(
    bars.map((_, b) => written.slice(b * 4, b * 4 + 4)),
    key,
  );
  written.forEach((w, i) => {
    const b = Math.floor(i / 4);
    bars[b]!.notes.push({ step: staffStep(w), sign: signsPerBar[b]![i - b * 4]!, duration: 'q' });
  });
  return { caption: 'You played', bars, names: written.map(name), showTimeSignature: false };
}

/** The recording of the take, with the note highlight following the recorded times. */
export function hearRecording(take: Take): HearMine | null {
  if (!take.recordingUrl) return null;
  let audio: HTMLAudioElement | null = null;
  let frame = 0;
  return {
    play(onNote) {
      return new Promise<void>((resolve) => {
        audio = new Audio(take.recordingUrl!);
        const tick = () => {
          if (!audio) return;
          const t = audio.currentTime + take.armedAt;
          let index: number | null = null;
          take.notes.forEach((n, i) => {
            if (n.start <= t && (n.end === null || t < n.end + 0.15)) index = i;
          });
          onNote(index);
          frame = requestAnimationFrame(tick);
        };
        const finish = () => {
          cancelAnimationFrame(frame);
          onNote(null);
          audio = null;
          resolve();
        };
        audio.onended = finish;
        audio.onerror = finish;
        audio.onpause = finish;
        void audio.play().then(() => {
          frame = requestAnimationFrame(tick);
        }, finish);
      });
    },
    stop() {
      audio?.pause();
    },
  };
}
