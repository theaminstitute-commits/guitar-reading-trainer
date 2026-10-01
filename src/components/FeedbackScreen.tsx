import { useEffect, useState } from 'react';
import { sharedPlayer, type PlayableNote } from '../audio/player';
import { explainMistake, type ExplainerId } from '../grading/explain';
import type { GradeResult } from '../grading/grade';
import type { LevelConfig } from '../melody/levelConfig';
import { splitIntoBars } from '../melody/bars';
import { barBeatsForCounts, describeMeter } from '../melody/meter';
import type { Melody } from '../melody/types';
import { answerBarToSounding, type AnswerNote } from '../notation/answer';
import type { Stage } from '../melody/stages';
import type { ProgressChange } from '../session/progression';
import FeedbackStaff from './FeedbackStaff';

interface FeedbackScreenProps {
  melody: Melody;
  level: LevelConfig;
  answerBars: readonly (readonly AnswerNote[])[];
  result: GradeResult;
  change: ProgressChange;
  nextStage: Stage;
  /** Melody length after this result, in counts. */
  nextCounts: number;
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

export default function FeedbackScreen({ melody, answerBars, result, change, nextStage, nextCounts, onNext, onExplainer }: FeedbackScreenProps) {
  const nextMeter = describeMeter(barBeatsForCounts(nextCounts));
  const [playing, setPlaying] = useState<Playing>(null);
  const [activeTarget, setActiveTarget] = useState<number | null>(null);
  const [activeAnswer, setActiveAnswer] = useState<number | null>(null);

  useEffect(() => () => sharedPlayer().stop(), []);

  const play = async (which: Exclude<Playing, null>) => {
    const player = sharedPlayer();
    player.stop();
    const notes: PlayableNote[] =
      which === 'correct'
        ? melody.notes
        : answerBars.flatMap((bar) => {
            const sounding = answerBarToSounding(bar, melody.key);
            return bar.map((n, i) => ({ midi: sounding[i]!, duration: n.duration }));
          });
    if (notes.length === 0) return;
    setPlaying(which);
    setActiveTarget(null);
    setActiveAnswer(null);
    await player.play(
      notes,
      { tempo: melody.tempo, timeSignature: melody.timeSignature, countIn: false },
      {
        onNote: (i) => (which === 'correct' ? setActiveTarget(i) : setActiveAnswer(i)),
        onEnd: () => {
          setPlaying(null);
          setActiveTarget(null);
          setActiveAnswer(null);
        },
      },
    );
  };

  const stop = () => sharedPlayer().stop();

  const pct = (v: number) => `${Math.round(v * 100)}%`;
  const targetBars = splitIntoBars(melody.notes, melody.barBeats);
  const notesInBar = (bar: number) => targetBars[bar]?.notes.length ?? 0;
  const explanations = result.mistakes.map((m) => explainMistake(m, result.pairs[m.pairIndex]!, melody.key, notesInBar));
  const perfect = result.mistakes.length === 0;

  return (
    <section className="feedback">
      <div className="score-row">
        <div className="score">
          <span className="score-label">Pitch</span>
          <span className={`score-value ${result.pitchScore >= 0.9 ? 'good' : result.pitchScore < 0.6 ? 'bad' : ''}`}>{pct(result.pitchScore)}</span>
        </div>
        <div className="score">
          <span className="score-label">Rhythm</span>
          <span className={`score-value ${result.rhythmScore >= 0.9 ? 'good' : result.rhythmScore < 0.6 ? 'bad' : ''}`}>{pct(result.rhythmScore)}</span>
        </div>
        <div className="score">
          <span className="score-label">Notes</span>
          <span className="score-value">
            {result.targetCount - result.missingCount - result.pairs.filter((p) => p.target && p.answer && p.mistakes.length > 0).length}/{result.targetCount}
          </span>
        </div>
      </div>

      <p className="verdict">
        {perfect
          ? 'Every note and every length right. Well read.'
          : `${result.mistakes.length} ${result.mistakes.length === 1 ? 'thing' : 'things'} to look at. Play each version and watch its staff, then read the notes below.`}
      </p>

      <FeedbackStaff melody={melody} musicKey={melody.key} result={result} answerBars={answerBars} activeTarget={activeTarget} activeAnswer={activeAnswer} />

      <div className="controls">
        {playing ? (
          <button onClick={stop}>Stop</button>
        ) : (
          <>
            <button onClick={() => play('correct')}>Hear correct</button>
            <button onClick={() => play('mine')} disabled={result.answerCount === 0}>
              Hear mine
            </button>
          </>
        )}
        <button className="primary" onClick={onNext}>
          Next melody
        </button>
      </div>

      {change && (
        <p className={`length-change ${change === 'longer' || change === 'stage-up' ? 'longer' : 'shorter'}`}>
          {change === 'longer' && `Three clean rounds in a row. Melodies are now ${nextCounts} counts long: ${nextMeter}.`}
          {change === 'shorter' && `Back to ${nextCounts} counts (${nextMeter}) for a while. Short and right beats long and shaky.`}
          {change === 'stage-up' && `Stage ${nextStage.number} unlocked: ${nextStage.name}. ${nextStage.summary} Melodies start at ${nextCounts} counts (${nextMeter}) again.`}
          {change === 'stage-down' && `Back to stage ${nextStage.number}, ${nextStage.name}, at ${nextCounts} counts (${nextMeter}). Build the streak up again.`}
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
