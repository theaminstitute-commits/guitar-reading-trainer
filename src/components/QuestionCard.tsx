import { useEffect, useRef, useState, type ReactNode } from 'react';
import { sharedPlayer } from '../audio/player';
import { midiAt, type FretPosition } from '../music/fretboard';
import { C_MAJOR } from '../music/key';
import { midiFromSpelled, parseSpelled, spelledName, spelledFromStaffStep, staffStep, writtenFromSounding, type SpelledNote } from '../music/pitch';
import { PAPER } from '../notation/paper';
import { isRightFret, isRightStep, nameWithOctave, type Question } from '../tutorial/questions';
import { gradeTaps, tapPassed, tapVerdict, type TapResult } from '../tutorial/tap';
import Fretboard, { visibleFrets } from './Fretboard';
import { PlayIcon, StopIcon } from './icons';
import MiniStaff, { miniNotes, type MiniNote } from './MiniStaff';

interface QuestionCardProps {
  question: Question;
  leftHanded: boolean;
  /** Called when the learner moves on, with whether they got it right. */
  onNext: (correct: boolean) => void;
  /** Label of the button that moves on. */
  nextLabel?: string;
  /**
   * Lessons: a wrong answer says "G is incorrect, please try again." and the learner
   * tries again until right; the answer is not revealed, and only a first-time
   * right answer counts as correct. The placement test leaves this off: one try.
   */
  retry?: boolean;
}

/** Sounding pitch of the rhythm questions: written B4, the middle line. */
const RHYTHM_MIDI = 59;
const RHYTHM_STEP = staffStep(parseSpelled('B4'));

/** `correct` counts for the score (right first time); `solved` colours the message (finally right). */
type Outcome = { correct: boolean; solved: boolean; text: string } | null;

/**
 * One tutorial or placement question: what to show, how the learner answers,
 * and an immediate verdict with the right answer before moving on.
 */
export default function QuestionCard({ question: q, leftHanded, onNext, nextLabel = 'Next', retry = false }: QuestionCardProps) {
  const [outcome, setOutcome] = useState<Outcome>(null);
  const [picked, setPicked] = useState<string | number | null>(null);
  const [tappedStep, setTappedStep] = useState<number | null>(null);
  const [tappedFret, setTappedFret] = useState<FretPosition | null>(null);
  /** Wrong tries so far (choices or rhythm options), shown red and locked. */
  const [wrong, setWrong] = useState<(string | number)[]>([]);
  const [misses, setMisses] = useState(0);
  const [retryText, setRetryText] = useState<string | null>(null);
  /** A tapped string that is sounding: it vibrates on the fretboard for a moment. */
  const [ring, setRing] = useState<{ at: FretPosition; n: number } | null>(null);
  useEffect(() => {
    if (!ring) return;
    const t = setTimeout(() => setRing(null), 1800);
    return () => clearTimeout(t);
  }, [ring]);

  useEffect(() => {
    setOutcome(null);
    setPicked(null);
    setTappedStep(null);
    setTappedFret(null);
    setWrong([]);
    setMisses(0);
    setRetryText(null);
    setRing(null);
    // Fretboard taps sound at once: have the guitar ready before the first one.
    if (q.kind === 'staff-to-fret') void sharedPlayer().load();
  }, [q]);

  /** A wrong try in retry mode: say what was picked, count it, keep the question open. */
  const tryAgain = (what: string) => {
    setMisses((m) => m + 1);
    setRetryText(`${what} is incorrect, please try again.`);
  };
  /** The right answer: counts as correct only when it was the first try. */
  const solved = (text: string) => {
    setRetryText(null);
    setOutcome({ correct: misses === 0, solved: true, text });
  };

  useEffect(() => () => sharedPlayer().stop(), []);

  const answer = (correct: boolean, text: string) => setOutcome({ correct, solved: correct, text });

  let body: ReactNode;
  /** After a right fretboard tap: where else the same note is, said in words under the verdict. */
  let alsoNote: string | null = null;
  switch (q.kind) {
    case 'name': {
      const notes = miniNotes(
        q.notes.map((note) => ({ note, duration: 'w' as const, chord: q.notes.length > 1 ? 1 : undefined })),
        q.key,
      );
      body = (
        <>
          <MiniStaff bars={[notes]} musicKey={q.key} barsPerRow={1} />
          <div className="choice-grid">
            {q.choices.map((c) => {
              const state = wrong.includes(c) ? ' wrong' : picked === null ? '' : c === q.answer ? ' right' : c === picked ? ' wrong' : '';
              return (
                <button
                  key={c}
                  className={`choice${state}`}
                  disabled={picked !== null || wrong.includes(c)}
                  onClick={() => {
                    if (c === q.answer) {
                      setPicked(c);
                      solved(`${q.answer} is correct!`);
                    } else if (retry) {
                      setWrong((w) => [...w, c]);
                      tryAgain(c);
                    } else {
                      setPicked(c);
                      answer(false, `It is ${q.answer}.`);
                    }
                  }}
                >
                  {c}
                </button>
              );
            })}
          </div>
        </>
      );
      break;
    }
    case 'place':
    case 'fret-to-staff': {
      const target = q.target;
      const shown: MiniNote[] = [];
      if (tappedStep !== null) {
        const right = isRightStep(q, tappedStep);
        // A wrong tap shows both notes stacked as one whole-note chord, so the bar still holds four beats.
        // In retry mode only the wrong note shows: the answer is not given away.
        const reveal = !right && !retry;
        shown.push({ step: tappedStep, sign: 'none', duration: 'w', color: right ? PAPER.good : PAPER.bad, chord: reveal ? 1 : undefined });
        if (reveal) shown.push({ step: staffStep(target), sign: 'none', duration: 'w', color: PAPER.good, chord: 1 });
        shown.sort((a, b) => a.step - b.step);
      }
      body = (
        <>
          {q.kind === 'fret-to-staff' && <Fretboard frets={q.frets} active={[q.position]} mirrored={leftHanded} />}
          <MiniStaff
            bars={[shown]}
            musicKey={q.key}
            barsPerRow={1}
            onTapStep={
              outcome
                ? undefined
                : (step) => {
                    setTappedStep(step);
                    const right = isRightStep(q, step);
                    const tapped = nameWithOctave(spelledFromStaffStep(step));
                    if (right) solved(`${nameWithOctave(target)} is correct!`);
                    else if (retry) tryAgain(tapped);
                    else answer(false, `That line or space is ${tapped}. ${nameWithOctave(target)} is the green note.`);
                  }
            }
          />
          {/* The instruction sits right under the staff it refers to, as a callout (the user: make it stand out). */}
          <p className="tap-instruction">{emphasise(q.prompt, nameWithOctave(target))}</p>
        </>
      );
      break;
    }
    case 'staff-to-fret': {
      const marks: { position: FretPosition; tone: 'good' | 'bad' | 'also' }[] = [];
      const place = (a: FretPosition) => (a.fret === 0 ? `the open ${a.string}${ordinal(a.string)} string` : `string ${a.string}, fret ${a.fret}`);
      const everywhere = samePitchPlaces(q.note, q.frets);
      if (tappedFret) {
        const right = isRightFret(q, tappedFret);
        marks.push({ position: tappedFret, tone: right ? 'good' : 'bad' });
        if (!right && !retry) everywhere.forEach((p) => marks.push({ position: p, tone: 'good' }));
        if (right && !q.openOnly) {
          // The same note elsewhere on the board is right too: ringed in a lighter green, and said in words.
          const others = everywhere.filter((p) => p.string !== tappedFret.string || p.fret !== tappedFret.fret);
          others.forEach((p) => marks.push({ position: p, tone: 'also' }));
          if (others.length > 0) {
            alsoNote = `The same ${nameWithOctave(q.note)} is also on ${others.map(place).join(' and ')}, ringed in light green. A guitar often has one note in more than one place; each of them is right.`;
          }
        }
      }
      body = (
        <>
          <MiniStaff bars={[miniNotes([{ note: q.note, duration: 'w' }], q.key)]} musicKey={q.key} barsPerRow={1} dropKey={q.dropIn ? q : undefined} />
          <Fretboard
            frets={q.frets}
            active={null}
            mirrored={leftHanded}
            marks={marks}
            ringing={ring ? [ring.at] : []}
            naturalNames={q.fretNames}
            ringKey={ring?.n}
            onPick={
              outcome
                ? undefined
                : (tap) => {
                    // An open-string question reads a tap anywhere on a string as that open string.
                    const p = q.openOnly ? { string: tap.string, fret: 0 } : tap;
                    // Every tapped note sounds at once and its string vibrates, right or wrong (the user: hear what you tap).
                    void sharedPlayer().play([{ midi: midiAt(p), duration: 'h' }], { tempo: 100, timeSignature: [4, 4], countIn: false });
                    setRing((r) => ({ at: p, n: (r?.n ?? 0) + 1 }));
                    setTappedFret(p);
                    const right = isRightFret(q, p);
                    if (q.openOnly) {
                      if (right) solved(`${OPEN_LABEL[p.string]} is correct!`);
                      else if (retry) tryAgain(OPEN_LABEL[p.string]!);
                      else answer(false, `It is the ${OPEN_LABEL[q.answers[0]!.string]} string, marked in green.`);
                      return;
                    }
                    const where = everywhere.map(place).join(' or ');
                    if (right) solved(`${spelledName(q.note)} on ${place(p)} is correct!`);
                    else if (retry) tryAgain(place(p).replace(/^./, (ch) => ch.toUpperCase()));
                    else answer(false, `${spelledName(q.note)} is ${where}, marked in green.`);
                  }
            }
          />
        </>
      );
      break;
    }
    case 'rhythm':
      body = (
        <RhythmBody
          q={q}
          picked={picked}
          wrong={wrong}
          onPick={(i) => {
            if (i === q.answer) {
              setPicked(i);
              solved('That rhythm is correct!');
            } else if (retry) {
              setWrong((w) => [...w, i]);
              tryAgain('That rhythm');
            } else {
              setPicked(i);
              answer(false, 'Not that one: the right bar is marked in green.');
            }
          }}
        />
      );
      break;
    case 'tap':
      body = <TapBody tempo={q.tempo} beats={q.beats} onResult={(r) => answer(tapPassed(r), tapVerdict(r))} done={outcome !== null} />;
      break;
  }

  return (
    <div className="panel question">
      {q.kind !== 'place' && q.kind !== 'fret-to-staff' && <p className="question-prompt">{q.prompt}</p>}
      {q.memoryAid && (
        <p className="memory-aid">
          <span className="aid-lines">Lines E G B D F: Every Good Boy Deserves Fruit</span>
          <span className="aid-spaces">Spaces: F A C E</span>
        </p>
      )}
      {body}
      {outcome && (
        <div className={`verdict-line ${outcome.solved ? 'good' : 'bad'}`} aria-live="polite">
          {outcome.text}
        </div>
      )}
      {outcome?.solved && alsoNote && <p className="also-note">{alsoNote}</p>}
      {!outcome && retryText && (
        <div className="verdict-line bad" aria-live="polite">
          {retryText}
        </div>
      )}
      {outcome && (
        <div className="controls">
          {q.kind === 'tap' && !outcome.correct && (
            <button onClick={() => setOutcome(null)}>Try again</button>
          )}
          <button className="primary" onClick={() => onNext(outcome.correct)}>
            {nextLabel}
          </button>
        </div>
      )}
    </div>
  );
}

/** Open strings by number, as the lessons name them. */
const OPEN_LABEL = ['', '1st (high E)', '2nd (B)', '3rd (G)', '4th (D)', '5th (A)', '6th (low E)'];

/** Every place on the drawn fretboard (open strings when the nut shows) that sounds a written note. */
function samePitchPlaces(note: SpelledNote, frets: readonly [number, number]): FretPosition[] {
  const { first, last } = visibleFrets(frets);
  const cells = [...(frets[0] === 0 ? [0] : []), ...Array.from({ length: last - first + 1 }, (_, i) => first + i)];
  const target = midiFromSpelled(note);
  const out: FretPosition[] = [];
  for (let string = 1; string <= 6; string++) for (const fret of cells) if (writtenFromSounding(midiAt({ string, fret })) === target) out.push({ string, fret });
  return out;
}

function ordinal(n: number): string {
  return n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th';
}

/** The prompt with the note name in it set in bold accent colour, so it is the first thing read. */
function emphasise(text: string, name: string): ReactNode {
  const at = text.indexOf(name);
  if (at < 0) return text;
  return (
    <>
      {text.slice(0, at)}
      <strong className="tap-target">{name}</strong>
      {text.slice(at + name.length)}
    </>
  );
}

function RhythmBody({ q, picked, wrong, onPick }: { q: Extract<Question, { kind: 'rhythm' }>; picked: string | number | null; wrong: readonly (string | number)[]; onPick: (i: number) => void }) {
  const [playing, setPlaying] = useState(false);
  const play = async () => {
    setPlaying(true);
    await sharedPlayer().play(
      q.options[q.answer]!.map((d) => ({ midi: RHYTHM_MIDI, duration: d })),
      { tempo: 76, timeSignature: [4, 4], countIn: true },
      { onEnd: () => setPlaying(false) },
    );
  };
  return (
    <>
      <div className="controls">
        {playing ? (
          <button onClick={() => sharedPlayer().stop()}>
            <StopIcon size={18} /> Stop
          </button>
        ) : (
          <button className="primary" onClick={() => void play()}>
            <PlayIcon size={18} /> Play the bar
          </button>
        )}
      </div>
      <div className="rhythm-options">
        {q.options.map((bar, i) => {
          const state = wrong.includes(i) ? ' wrong' : picked === null ? '' : i === q.answer ? ' right' : i === picked ? ' wrong' : '';
          return (
            <button key={i} className={`rhythm-option${state}`} disabled={picked !== null || wrong.includes(i)} onClick={() => onPick(i)} aria-label={`Rhythm ${i + 1}`}>
              <MiniStaff bars={[bar.map((d) => ({ step: RHYTHM_STEP, sign: 'none', duration: d }))]} musicKey={C_MAJOR} timeSignature barsPerRow={1} />
            </button>
          );
        })}
      </div>
    </>
  );
}

function TapBody({ tempo, beats, onResult, done }: { tempo: number; beats: number; onResult: (r: TapResult) => void; done: boolean }) {
  const [phase, setPhase] = useState<'idle' | 'running'>('idle');
  const [count, setCount] = useState<number | null>(null);
  const taps = useRef<number[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const start = async () => {
    taps.current = [];
    setPhase('running');
    const player = sharedPlayer();
    const clicks = await player.clickTrack(tempo, beats, 4, (i) => setCount(i));
    const end = clicks[clicks.length - 1]! + 0.6 - player.now();
    timer.current = setTimeout(() => {
      setPhase('idle');
      setCount(null);
      onResult(gradeTaps(clicks, taps.current));
    }, end * 1000);
  };

  const label = count === null ? '' : count < 4 ? `Count-in ${count + 1}` : `Beat ${count - 3} of ${beats}`;
  return (
    <div className="tap-drill">
      {phase === 'idle' ? (
        <button className="primary" onClick={() => void start()} disabled={done}>
          <PlayIcon size={18} /> Start the clicks
        </button>
      ) : (
        <>
          <div className="muted tap-count" aria-live="polite">
            {label}
          </div>
          <button className="tap-pad" onPointerDown={() => taps.current.push(sharedPlayer().now())}>
            Tap
          </button>
        </>
      )}
    </div>
  );
}
