import { useMemo, useState } from 'react';
import { STAGES } from '../melody/stages';
import { PASS_MARK, placementStage, QUESTIONS_PER_TIER, TIERS, tierQuestions } from '../tutorial/placement';
import { CheckIcon } from './icons';
import QuestionCard from './QuestionCard';

interface PlacementScreenProps {
  leftHanded: boolean;
  /** Called with the stage number to place the learner at. */
  onPlaced: (stageNumber: number) => void;
  onTutorial: () => void;
  onBack: () => void;
}

/**
 * The placement test (R25): tiers of four questions in ladder order. Three
 * right passes a tier; the test stops at the first tier failed and suggests
 * the stage that teaches it.
 */
export default function PlacementScreen({ leftHanded, onPlaced, onTutorial, onBack }: PlacementScreenProps) {
  const seed = useMemo(() => Math.floor(Math.random() * 1_000_000_000), []);
  const [started, setStarted] = useState(false);
  const [tier, setTier] = useState(0);
  const [at, setAt] = useState(0);
  const [right, setRight] = useState(0);
  const [passed, setPassed] = useState<boolean[]>([]);
  const questions = useMemo(() => (tier < TIERS.length ? tierQuestions(TIERS[tier]!, seed) : []), [tier, seed]);
  const finished = passed.length === TIERS.length || passed.includes(false);
  const stageNumber = placementStage(passed);
  const stage = STAGES[stageNumber - 1]!;

  if (!started) {
    return (
      <section className="lesson">
        <div className="panel lesson-step">
          <span className="eyebrow">Placement test</span>
          <h2>Find your starting stage</h2>
          <p>
            Quick questions in the order the stages teach them: notes on the staff, key signatures, rhythm, ledger lines and minor keys. Each group has {QUESTIONS_PER_TIER} questions; {PASS_MARK} right moves you on to the next group.
          </p>
          <p className="muted">The test stops at the first group you miss, and you start at the stage that teaches it. Every stage before it opens. It takes two to five minutes.</p>
          <div className="controls">
            <button className="primary big" onClick={() => setStarted(true)}>
              Start the test
            </button>
            <button onClick={onBack}>Back</button>
          </div>
        </div>
      </section>
    );
  }

  if (finished) {
    return (
      <section className="lesson">
        <div className="panel lesson-done">
          <CheckIcon size={28} />
          <span className="eyebrow">Placement test</span>
          <h2>
            Start at stage {stage.number}: {stage.name}
          </h2>
          <ul className="placement-results">
            {passed.map((ok, i) => (
              <li key={TIERS[i]!.id} className={ok ? 'good' : 'bad'}>
                {ok ? '✓' : '✗'} {TIERS[i]!.skill}
              </li>
            ))}
          </ul>
          {stageNumber === 1 && <p className="muted">The tutorial teaches everything stage 1 needs, step by step. It is worth the twenty minutes.</p>}
          <div className="controls">
            <button className="primary big" onClick={() => onPlaced(stageNumber)}>
              Start stage {stage.number}
            </button>
            {stageNumber === 1 && <button onClick={onTutorial}>Take the tutorial</button>}
            <button onClick={onBack}>Back to start</button>
          </div>
        </div>
      </section>
    );
  }

  const t = TIERS[tier]!;
  return (
    <section className="lesson">
      <div className="lesson-progress" aria-label={`Group ${tier + 1} of ${TIERS.length}`}>
        {TIERS.map((_, i) => (
          <span key={i} className={i < tier ? 'done' : i === tier ? 'now' : ''} />
        ))}
      </div>
      <div className="drill-head">
        <h2>{t.skill}</h2>
        <span className="muted">
          {at + 1} of {QUESTIONS_PER_TIER}
        </span>
      </div>
      <QuestionCard
        question={questions[at]!}
        leftHanded={leftHanded}
        onNext={(correct) => {
          const score = right + (correct ? 1 : 0);
          if (at + 1 < questions.length) {
            setRight(score);
            setAt(at + 1);
            return;
          }
          const ok = score >= PASS_MARK;
          setPassed((p) => [...p, ok]);
          setRight(0);
          setAt(0);
          if (ok) setTier(tier + 1);
        }}
      />
    </section>
  );
}
