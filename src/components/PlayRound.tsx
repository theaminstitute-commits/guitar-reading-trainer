import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { sharedPlayer } from '../audio/player';
import { gradePlaying, playTargets, verdictText, type PlayGrade, type PlayTap } from '../grading/playTiming';
import { groupEvents, splitIntoBars, totalBeats } from '../melody/bars';
import type { LevelConfig } from '../melody/levelConfig';
import { timeSignaturesFor } from '../melody/meter';
import type { Melody } from '../melody/types';
import { beatsOf, beatsPerBar } from '../music/duration';
import { midiAt, type FretPosition } from '../music/fretboard';
import { instrumentOf } from '../music/instrument';
import { keyName, keySignatureCount, keySignatureSpec, spellInKey } from '../music/key';
import { spelledName, staffStep, writtenFromSounding } from '../music/pitch';
import { displaySignsForBars } from '../notation/accidentals';
import { ensureNotationFonts } from '../notation/fonts';
import { PAPER } from '../notation/paper';
import { renderStaff, type RenderBar } from '../notation/renderStaff';
import Fretboard from './Fretboard';
import { CheckIcon, PlayIcon } from './icons';

/** Where the two panels stood before the swap, in page coordinates (top edges). */
export interface SwapFrom {
  board: number | null;
  staff: number | null;
}

interface PlayRoundProps {
  melody: Melody;
  level: LevelConfig;
  leftHanded: boolean;
  /** Beginner hints: the tapped dot shows its letter (R26). */
  noteNames: boolean;
  /** Mistakes in what was written, to say so before the playing. */
  writtenMistakes: number;
  from: SwapFrom;
  onDone: (play: PlayGrade) => void;
}

type Phase = 'ready' | 'counting' | 'running' | 'done';

const SWAP_MS = 650;

/**
 * The play round (R46): after Check the staff and the fretboard swap places, the staff now showing the
 * melody as written, and the learner plays it on the fretboard to a click: one bar of count-in, then
 * every note within a tenth of a beat. The first take is graded; more takes are practice.
 */
export default function PlayRound({ melody, level, leftHanded, noteNames, writtenMistakes, from, onDone }: PlayRoundProps) {
  const instrument = instrumentOf(melody.instrument);
  const targets = useMemo(() => playTargets(melody), [melody]);
  const events = useMemo(() => groupEvents(melody.notes), [melody]);
  const [phase, setPhase] = useState<Phase>('ready');
  const [countBeat, setCountBeat] = useState<number | null>(null);
  const [current, setCurrent] = useState<number | null>(null);
  const [lit, setLit] = useState<FretPosition[]>([]);
  const [trail, setTrail] = useState<FretPosition[]>([]);
  const [ringKey, setRingKey] = useState(0);
  const [grade, setGrade] = useState<PlayGrade | null>(null);
  const [takes, setTakes] = useState(0);
  const [note, setNote] = useState<string | null>(null);
  const first = useRef<PlayGrade | null>(null);
  const taps = useRef<PlayTap[]>([]);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const phaseRef = useRef<Phase>('ready');
  phaseRef.current = phase;

  const staffPanel = useRef<HTMLDivElement>(null);
  const boardPanel = useRef<HTMLDivElement>(null);

  const clearTimers = () => {
    for (const t of timers.current) clearTimeout(t);
    timers.current = [];
  };

  // Have the instrument ready for the first tap, and stop everything on the way out.
  useEffect(() => {
    void sharedPlayer().load().catch(() => undefined);
    return () => {
      clearTimers();
      sharedPlayer().stopClicks();
    };
  }, []);

  // The swap: each panel starts where the other one was and glides into its new place.
  useLayoutEffect(() => {
    window.scrollTo({ top: 0 });
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const glide = (el: HTMLElement | null, fromTop: number | null, side: number) => {
      if (!el || fromTop === null || typeof el.animate !== 'function') return;
      const dy = fromTop - (el.getBoundingClientRect().top + window.scrollY);
      if (Math.abs(dy) < 2) return;
      el.animate(
        [
          { transform: `translate(0, ${dy}px)`, zIndex: 2 },
          { transform: `translate(${side * 18}px, ${dy / 2}px) scale(0.96)`, zIndex: 2, offset: 0.5 },
          { transform: 'none', zIndex: 2 },
        ],
        { duration: SWAP_MS, easing: 'cubic-bezier(.45,.05,.25,1)' },
      );
    };
    glide(boardPanel.current, from.board, 1);
    glide(staffPanel.current, from.staff, -1);
  }, [from]);

  // A take stops if the app goes to the background; it can be started again and is not graded.
  useEffect(() => {
    const onVisibility = () => {
      if (!document.hidden || (phaseRef.current !== 'counting' && phaseRef.current !== 'running')) return;
      clearTimers();
      sharedPlayer().stopClicks();
      setPhase(first.current ? 'done' : 'ready');
      setCountBeat(null);
      setCurrent(null);
      setNote('Stopped when the app went to the background. Start again when you are ready.');
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  const start = async () => {
    const p = sharedPlayer();
    setNote(null);
    try {
      await p.load();
    } catch (e) {
      setNote(`Could not start audio: ${(e as Error).message}`);
      return;
    }
    clearTimers();
    taps.current = [];
    setTrail([]);
    setLit([]);
    setGrade(null);
    setCurrent(null);
    setPhase('counting');
    const spb = 60 / melody.tempo;
    const countIn = beatsPerBar(melody.timeSignature);
    const clicks = await p.clickTrack(melody.tempo, totalBeats(melody.notes), countIn, (i) => {
      if (i < countIn) setCountBeat(i);
      else if (i === countIn) {
        setCountBeat(null);
        setPhase('running');
      }
    });
    const begin = clicks[0]!;
    const lastLength = beatsOf(events[events.length - 1]![0]!.duration);
    const at = (seconds: number) => Math.max(0, (seconds - p.now()) * 1000);
    targets.forEach((t, i) => timers.current.push(setTimeout(() => setCurrent(i), at(begin + t.beat * spb))));
    const end = begin + (targets[targets.length - 1]!.beat + lastLength) * spb;
    timers.current.push(
      setTimeout(() => {
        const g = gradePlaying(targets, taps.current, begin, spb, lastLength);
        first.current ??= g;
        setGrade(g);
        setTakes((n) => n + 1);
        setCurrent(null);
        setPhase('done');
      }, at(end) + 60),
    );
  };

  const onPick = (pos: FretPosition, timeStamp: number) => {
    const p = sharedPlayer();
    const midi = midiAt(pos, instrument.tuning);
    p.pluck(midi);
    setLit([pos]);
    setRingKey((k) => k + 1);
    if (phaseRef.current === 'counting' || phaseRef.current === 'running') {
      taps.current.push({ time: p.heardAt(timeStamp), midi });
      setTrail((t) => [...t, pos]);
    }
  };

  const taking = phase === 'counting' || phase === 'running';
  const beatsInBar = beatsPerBar(melody.timeSignature);
  const litLabels = noteNames ? lit.map((pos) => spelledName(spellInKey(writtenFromSounding(midiAt(pos, instrument.tuning)), melody.key))) : undefined;
  /** Colour of each event on the staff: blue while it is due, then green or red once graded. */
  const eventColor = (i: number): string => {
    if (taking) return i === current ? PAPER.active : PAPER.ink;
    if (phase === 'done' && grade) {
      const v = grade.events[i]!.verdict;
      return v === 'good' ? PAPER.good : v === 'missed' ? PAPER.missing : PAPER.bad;
    }
    return PAPER.ink;
  };

  const firstProblem = grade ? grade.events.findIndex((e) => e.verdict !== 'good') : -1;
  const problemText =
    grade && firstProblem >= 0
      ? `${events[firstProblem]!.length > 1 ? 'Chord' : 'Note'} ${firstProblem + 1}: ${verdictText(grade.events[firstProblem]!, events[firstProblem]!.length > 1)}.`
      : grade && grade.stray > 0
        ? `${grade.stray} ${grade.stray === 1 ? 'tap' : 'taps'} outside the melody.`
        : '';

  return (
    <section className="exercise play-round">
      <div className="panel tight status-card">
        <div className="status-line" aria-live="polite">
          {phase === 'ready' && !note && 'Your turn: play it on the fretboard. One bar of clicks counts you in, then each note must land within a tenth of a beat. Any string will do.'}
          {phase === 'ready' && note}
          {phase === 'counting' && (
            <span className="count-in">
              Count-in{' '}
              {Array.from({ length: beatsInBar }, (_, i) => (
                <span key={i} className={i === countBeat ? 'beat on' : 'beat'}>
                  {i + 1}
                </span>
              ))}
            </span>
          )}
          {phase === 'running' && current !== null && `${events[current]!.length > 1 ? 'Chord' : 'Note'} ${current + 1} of ${events.length}`}
          {phase === 'running' && current === null && 'Play!'}
          {phase === 'done' &&
            grade &&
            `${grade.passed ? `In time: all ${grade.total} right.` : `${grade.good} of ${grade.total} in time. ${problemText}`}${takes > 1 ? ' Practice take: the first take counts.' : ''}`}
          {phase === 'done' && note && ` ${note}`}
        </div>
      </div>

      <div ref={staffPanel} className="panel swap-panel">
        <span className="eyebrow">Play what you read · {keyName(melody.key)}</span>
        <p className={`written-line ${writtenMistakes === 0 ? 'good' : 'try'}`}>
          {writtenMistakes === 0
            ? 'Written right. Now play what you wrote.'
            : `Your writing has ${writtenMistakes} ${writtenMistakes === 1 ? 'thing' : 'things'} to look at, shown next. This is the melody as written: play it.`}
        </p>
        <PlayStaff melody={melody} eventColor={eventColor} />
      </div>

      <div ref={boardPanel} className="panel board swap-panel">
        <Fretboard
          active={lit}
          played={trail}
          frets={level.fretRange}
          mirrored={leftHanded}
          labels={litLabels}
          ringing={lit}
          ringKey={ringKey}
          onPick={onPick}
        />
      </div>

      {phase === 'done' && (
        <div className="controls">
          <button data-sound="none" onClick={() => void start()}>
            <PlayIcon size={18} /> Play it again (practice)
          </button>
        </div>
      )}

      <div className="sticky-cta">
        {first.current ? (
          <button className="btn primary big" disabled={taking} onClick={() => first.current && onDone(first.current)}>
            <CheckIcon size={22} /> See results
          </button>
        ) : (
          <button className="btn primary big" data-sound="none" disabled={taking} onClick={() => void start()}>
            <PlayIcon size={22} /> {taking ? 'Playing…' : 'Start playing'}
          </button>
        )}
      </div>
    </section>
  );
}

/** The melody as written, read-only, each note or chord in the colour `eventColor` gives it. */
function PlayStaff({ melody, eventColor }: { melody: Melody; eventColor: (event: number) => string }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [fontsReady, setFontsReady] = useState(false);

  useEffect(() => {
    ensureNotationFonts().then(() => setFontsReady(true));
  }, []);

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () => setWidth(el.clientWidth);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const colors = groupEvents(melody.notes).map((_, i) => eventColor(i)).join(',');

  useLayoutEffect(() => {
    const el = canvasRef.current;
    if (!el || !fontsReady || width === 0) return;
    const bars = splitIntoBars(melody.notes, melody.barBeats);
    const written = bars.map((bar) => bar.notes.map((n) => n.spelled ?? spellInKey(writtenFromSounding(n.midi), melody.key)));
    const signs = displaySignsForBars(written, melody.key);
    const palette = colors.split(',');
    // Event number of each note: the notes of a chord share one.
    const eventOf = new Map(groupEvents(melody.notes).flatMap((group, e) => group.map((n) => [n, e] as const)));
    let id = 0;
    const render: RenderBar[] = bars.map((bar, b) => ({
      notes: bar.notes.map((n, k) => {
        const color = palette[eventOf.get(n) ?? -1] ?? PAPER.ink;
        return { id: id++, step: staffStep(written[b]![k]!), sign: signs[b]![k]!, duration: n.duration, chord: n.chord, style: { fill: color, stroke: color } };
      }),
    }));
    renderStaff(el, render, {
      timeSignature: melody.timeSignature,
      barTimeSignatures: timeSignaturesFor(melody.barBeats),
      width,
      barsPerRow: 2,
      scale: width < 480 ? 1.35 : 1.6,
      ink: PAPER.ink,
      keySignature: keySignatureSpec(melody.key),
      keySignatureAccidentals: Math.abs(keySignatureCount(melody.key)),
      instrument: instrumentOf(melody.instrument),
    });
  }, [melody, width, fontsReady, colors]);

  return (
    <div ref={wrapRef} className="play-staff" aria-label="The melody to play, on the staff">
      <div ref={canvasRef} className="staff-canvas static" />
    </div>
  );
}
