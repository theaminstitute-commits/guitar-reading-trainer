import { useEffect, useState } from 'react';
import { sharedPlayer } from '../audio/player';
import { explainMistake, type ExplainerId } from '../grading/explain';
import type { GradeResult } from '../grading/grade';
import { splitIntoBars } from '../melody/bars';
import { barBeatsForCounts, describeMeter } from '../melody/meter';
import type { Stage } from '../melody/stages';
import type { Melody } from '../melody/types';
import { isClean, isPerfect, type ProgressChange } from '../session/progression';
import type { HearMine } from '../session/yours';
import FeedbackStaff, { type YoursStaff } from './FeedbackStaff';

interface FeedbackScreenProps {
  melody: Melody;
  result: GradeResult;
  change: ProgressChange;
  nextStage: Stage;
  /** Melody length after this result, in counts. */
  nextCounts: number;
  /** Tally towards the next stage after this result. */
  nextTally: number;
  yours: YoursStaff;
  /** Playback of the learner's version, or null when there is nothing to play. */
  hearMine: HearMine | null;
  onNext: () => void;
  onExplainer: (id: ExplainerId) => void;
}

const EXPLAINER_LABEL: Record<ExplainerId, string> = {
  'staff-basics': 'Staff basics',
  'key-signatures': 'Key signatures',
  'minor-keys': 'Minor keys',
  'ledger-lines': 'Ledger lines',
  durations: 'Note lengths',
  'guitar-octave': 'Guitar octave',
};

type Playing = 'correct' | 'mine' | null;

export default function FeedbackScreen({ melody, result, change, nextStage, nextCounts, nextTally, yours, hearMine, onNext, onExplainer }: FeedbackScreenProps) {
  const nextMeter = describeMeter(barBeatsForCounts(nextCounts));
  const [playing, setPlaying] = useState<Playing>(null);
  const [activeTarget, setActiveTarget] = useState<number | null>(null);
  const [activeAnswer, setActiveAnswer] = useState<number | null>(null);

  useEffect(
    () => () => {
      sharedPlayer().stop();
      hearMine?.stop();
    },
    [hearMine],
  );

  const stop = () => {
    sharedPlayer().stop();
    hearMine?.stop();
  };

  const playCorrect = async () => {
    stop();
    setPlaying('correct');
    setActiveTarget(null);
    await sharedPlayer().play(
      melody.notes,
      { tempo: melody.tempo, timeSignature: melody.timeSignature, countIn: false },
      {
        onNote: (i) => setActiveTarget(i),
        onEnd: () => {
          setPlaying(null);
          setActiveTarget(null);
        },
      },
    );
  };

  const playMine = async () => {
    if (!hearMine) return;
    stop();
    setPlaying('mine');
    setActiveAnswer(null);
    await hearMine.play((i) => setActiveAnswer(i));
    setPlaying(null);
    setActiveAnswer(null);
  };

  const pct = (v: number) => `${Math.round(v * 100)}%`;
  const targetBars = splitIntoBars(melody.notes, melody.barBeats);
  const notesInBar = (bar: number) => targetBars[bar]?.notes.length ?? 0;
  const explanations = result.mistakes.map((m) => explainMistake(m, result.pairs[m.pairIndex]!, melody.key, notesInBar));
  const perfect = result.mistakes.length === 0;
  const rightNotes = result.targetCount - result.missingCount - result.pairs.filter((p) => p.target && p.answer && p.mistakes.length > 0).length;

  return (
    <section className="feedback">
      <div className={`score-row${result.timingGraded ? '' : ' two'}`}>
        <div className="score">
          <span className="score-label">{result.timingGraded ? 'Pitch' : 'Tones'}</span>
          <span className={`score-value ${result.pitchScore >= 0.9 ? 'good' : result.pitchScore < 0.6 ? 'bad' : ''}`}>{pct(result.pitchScore)}</span>
        </div>
        {result.timingGraded && (
          <div className="score">
            <span className="score-label">Rhythm</span>
            <span className={`score-value ${result.rhythmScore >= 0.9 ? 'good' : result.rhythmScore < 0.6 ? 'bad' : ''}`}>{pct(result.rhythmScore)}</span>
          </div>
        )}
        <div className="score">
          <span className="score-label">Notes</span>
          <span className="score-value">
            {rightNotes}/{result.targetCount}
          </span>
        </div>
      </div>

      <p className="verdict">
        {perfect
          ? result.timingGraded
            ? 'Every note and every length right. Well read.'
            : 'Every tone right, and the right number of them. Well played.'
          : `${result.mistakes.length} ${result.mistakes.length === 1 ? 'thing' : 'things'} to look at. Play each version and watch its staff, then read the notes below.`}
      </p>

      <FeedbackStaff melody={melody} musicKey={melody.key} result={result} yours={yours} activeTarget={activeTarget} activeAnswer={activeAnswer} />

      <div className="controls">
        {playing ? (
          <button onClick={stop}>Stop</button>
        ) : (
          <>
            <button onClick={() => void playCorrect()}>Hear correct</button>
            <button onClick={() => void playMine()} disabled={!hearMine || result.answerCount === 0}>
              Hear mine
            </button>
          </>
        )}
        <button className="primary" onClick={onNext}>
          Next melody
        </button>
      </div>

      {(change || isClean(result)) && (
        <p className={`length-change ${change === 'shorter' || change === 'stage-down' ? 'shorter' : 'longer'}`}>
          {change !== 'stage-up' && change !== 'stage-down' && isClean(result) && `${isPerfect(result) ? 'Perfect round, two points.' : 'Clean round, one point.'} Tally ${nextTally} of ${nextStage.unlockTally} towards stage ${nextStage.number + 1}. `}
          {change === 'longer' && `Melodies are now ${nextCounts} counts long: ${nextMeter}.`}
          {change === 'shorter' && `Weak round, one point off. Back to ${nextCounts} counts (${nextMeter}) for a while.`}
          {change === 'stage-up' && `Stage ${nextStage.number} unlocked: ${nextStage.name}. ${nextStage.summary} Melodies start at ${nextCounts} counts (${nextMeter}) again.`}
          {change === 'stage-down' && `Back to stage ${nextStage.number}, ${nextStage.name}, at ${nextCounts} counts (${nextMeter}). Build the tally up again.`}
        </p>
      )}

      {explanations.length > 0 && (
        <ol className="mistakes">
          {explanations.map((e) => (
            <li key={e.number}>
              <span className="mistake-number">{e.number}</span>
              <div>
                <strong>{e.title}</strong>
                <span className="muted"> · bar {e.bar}</span>
                <p>{e.text}</p>
                {e.explainer && (
                  <button className="link" onClick={() => onExplainer(e.explainer!)}>
                    Read: {EXPLAINER_LABEL[e.explainer]}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
