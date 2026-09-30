import { useEffect, useState } from 'react';
import { sharedPlayer, type PlayableNote } from '../audio/player';
import { explainMistake, type ExplainerId } from '../grading/explain';
import type { GradeResult } from '../grading/grade';
import type { LevelConfig } from '../melody/levelConfig';
import { splitIntoBars } from '../melody/bars';
import type { Melody } from '../melody/types';
import { answerNoteToSounding, type AnswerNote } from '../notation/answer';
import type { LengthChange } from '../session/progression';
import FeedbackStaff from './FeedbackStaff';

interface FeedbackScreenProps {
  melody: Melody;
  level: LevelConfig;
  answerBars: readonly (readonly AnswerNote[])[];
  result: GradeResult;
  lengthChange: LengthChange;
  nextBars: number;
  onNext: () => void;
  onExplainer: (id: ExplainerId) => void;
}

const EXPLAINER_LABEL: Record<ExplainerId, string> = {
  'staff-basics': 'Staff basics',
  durations: 'Note lengths',
  'guitar-octave': 'Guitar octave',
};

type Playing = 'correct' | 'mine' | null;

export default function FeedbackScreen({ melody, level, answerBars, result, lengthChange, nextBars, onNext, onExplainer }: FeedbackScreenProps) {
  const [playing, setPlaying] = useState<Playing>(null);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  useEffect(() => () => sharedPlayer().stop(), []);

  const play = async (which: Exclude<Playing, null>) => {
    const player = sharedPlayer();
    player.stop();
    const notes: PlayableNote[] =
      which === 'correct'
        ? melody.notes
        : answerBars.flat().map((n) => ({ midi: answerNoteToSounding(n), duration: n.duration }));
    if (notes.length === 0) return;
    setPlaying(which);
    setActiveIndex(null);
    await player.play(
      notes,
      { tempo: melody.tempo, timeSignature: melody.timeSignature, countIn: false },
      {
        onNote: (i) => setActiveIndex(which === 'correct' ? i : null),
        onEnd: () => {
          setPlaying(null);
          setActiveIndex(null);
        },
      },
    );
  };

  const stop = () => sharedPlayer().stop();

  const pct = (v: number) => `${Math.round(v * 100)}%`;
  const targetBars = splitIntoBars(melody.notes, melody.timeSignature);
  const notesInBar = (bar: number) => targetBars[bar]?.notes.length ?? 0;
  const explanations = result.mistakes.map((m) => explainMistake(m, result.pairs[m.pairIndex]!, level.key, notesInBar));
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
          : `${result.mistakes.length} ${result.mistakes.length === 1 ? 'thing' : 'things'} to look at. Compare the two versions by ear, then read the notes below.`}
      </p>

      <FeedbackStaff melody={melody} musicKey={level.key} result={result} activeIndex={activeIndex} />

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

      {lengthChange && (
        <p className={`length-change ${lengthChange}`}>
          {lengthChange === 'longer'
            ? `Three clean rounds in a row. Melodies are now ${nextBars} ${nextBars === 1 ? 'bar' : 'bars'} long.`
            : `Back to ${nextBars} ${nextBars === 1 ? 'bar' : 'bars'} for a while. Short and right beats long and shaky.`}
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
