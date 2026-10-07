import { useEffect, useState } from 'react';
import { sharedPlayer } from '../audio/player';
import { explainMistake, type ExplainerId } from '../grading/explain';
import type { GradeResult } from '../grading/grade';
import { splitIntoBars } from '../melody/bars';
import { barBeatsForCounts, describeMeter } from '../melody/meter';
import type { Stage } from '../melody/stages';
import type { Melody } from '../melody/types';
import { isPerfect, type ProgressChange } from '../session/progression';
import type { HearMine } from '../session/yours';
import FeedbackStaff, { type YoursStaff } from './FeedbackStaff';
import { EarIcon, PlayIcon, StopIcon } from './icons';
import Ring from './Ring';

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

  const tone = (v: number) => (v >= 0.9 ? 'var(--good)' : v < 0.6 ? 'var(--bad)' : 'var(--accent)');

  return (
    <section className="feedback">
      <div className={`panel result-hero${perfect ? ' perfect' : ''}`}>
        <div className="result-rings">
          <Ring value={result.pitchScore} color={tone(result.pitchScore)} label={pct(result.pitchScore)} sub={result.timingGraded ? 'pitch' : 'tones'} />
          {result.timingGraded && <Ring value={result.rhythmScore} color={tone(result.rhythmScore)} label={pct(result.rhythmScore)} sub="rhythm" />}
        </div>
        <div className="result-text">
          <h2 className="result-title">{perfect ? 'Flawless' : `${result.mistakes.length} ${result.mistakes.length === 1 ? 'thing' : 'things'} to look at`}</h2>
          <p className="verdict">
            {perfect
              ? result.timingGraded
                ? 'Every note and every length right. Well read.'
                : 'Every tone right, and the right number of them. Well played.'
              : 'Play each version and watch its staff, then read the notes below.'}
          </p>
          <span className="notes-count">
            {rightNotes}/{result.targetCount} notes right
          </span>
        </div>
      </div>

      {change === null && (
        <div className="tally-strip" aria-label={`${nextTally} of ${nextStage.unlockAfter} flawless melodies on this stage`}>
          <div className="tally-dots" aria-hidden="true">
            {Array.from({ length: nextStage.unlockAfter }, (_, i) => (
              <span key={i} className={i < nextTally ? 'on' : ''} />
            ))}
          </div>
          <span className="tally-text muted">
            {nextTally} of {nextStage.unlockAfter} flawless{isPerfect(result) ? ' · +1' : ''}
          </span>
        </div>
      )}

      {change && (
        <p className={`length-change ${change === 'stage-down' ? 'shorter' : 'longer'}`}>
          {change === 'stage-up' && `Stage ${nextStage.number} unlocked: ${nextStage.name}. ${nextStage.summary} Melodies are ${nextCounts} counts long (${nextMeter}).`}
          {change === 'stage-down' && `Back to stage ${nextStage.number}, ${nextStage.name}, at ${nextCounts} counts (${nextMeter}). Ten flawless melodies bring the next stage back.`}
        </p>
      )}

      <div className="panel">
        <FeedbackStaff melody={melody} musicKey={melody.key} result={result} yours={yours} activeTarget={activeTarget} activeAnswer={activeAnswer} />
      </div>

      <div className="controls">
        {playing ? (
          <button onClick={stop}>
            <StopIcon size={18} /> Stop
          </button>
        ) : (
          <>
            <button onClick={() => void playCorrect()}>
              <PlayIcon size={18} /> Hear correct
            </button>
            <button onClick={() => void playMine()} disabled={!hearMine || result.answerCount === 0}>
              <EarIcon size={18} /> Hear mine
            </button>
          </>
        )}
      </div>
      <div className="sticky-cta">
        <button className="btn primary big" onClick={onNext}>
          Next melody
        </button>
      </div>

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
