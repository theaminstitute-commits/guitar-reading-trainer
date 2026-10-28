import { describe, expect, it } from 'vitest';
import { EXPLAINERS } from '../explainers/content';
import { STAGES } from '../melody/stages';
import { stageGuide } from '../melody/stageGuide';
import type { DurationId } from '../music/duration';
import { parseSpelled } from '../music/pitch';
import { ALL_LESSONS } from '../tutorial/lessons';
import { barLength, measure, restsToFill, type Measurable } from './measure';

const rest = (duration: DurationId): Measurable => ({ duration, rest: true });
const q = (n: number): Measurable[] => Array.from({ length: n }, () => ({ duration: 'q' as const }));
const durations = (bars: Measurable[][]) => bars.map((b) => b.map((n) => `${n.duration}${n.rest ? 'r' : ''}`).join(' '));

describe('complete bars', () => {
  it('turns a lone last note into a whole note (the alphabet example: nine quarters)', () => {
    expect(durations(measure(q(9), rest))).toEqual(['q q q q', 'q q q q', 'w']);
  });

  it('fills a short last bar with rests that start on beats', () => {
    expect(durations(measure(q(6), rest))).toEqual(['q q q q', 'q q hr']);
    expect(durations(measure(q(3), rest))).toEqual(['q q q qr']);
    expect(restsToFill(1)).toEqual(['q', 'h']);
    expect(restsToFill(0.5)).toEqual(['e', 'q', 'h']);
    expect(restsToFill(3)).toEqual(['q']);
  });

  it('puts one whole note per bar and never splits a chord', () => {
    const wholes: Measurable[] = Array.from({ length: 3 }, () => ({ duration: 'w' as const }));
    expect(durations(measure(wholes, rest))).toEqual(['w', 'w', 'w']);
    const chords: Measurable[] = [
      { duration: 'h', chord: 1 },
      { duration: 'h', chord: 1 },
      { duration: 'h', chord: 2 },
      { duration: 'h', chord: 2 },
      { duration: 'h', chord: 3 },
    ];
    const bars = measure(chords, rest);
    expect(bars.map(barLength)).toEqual([4, 4]);
    expect(durations(bars)).toEqual(['h h h h', 'w']);
  });

  it('gives every lesson example, explainer card and stage guide bars of exactly four beats', () => {
    for (const lesson of ALL_LESSONS) {
      for (const step of lesson.steps) {
        if (step.kind !== 'explain' || !step.staff) continue;
        const bars = measure<Measurable>(step.staff.notes.map((n) => ({ duration: n.duration ?? 'q', chord: n.chord })), rest);
        for (const bar of bars) expect(barLength(bar), `${lesson.id}: ${step.title}`).toBe(4);
        expect(step.staff.notes.every((n) => parseSpelled(n.name))).toBe(true);
      }
    }
    for (const card of Object.values(EXPLAINERS)) {
      if (!card.example) continue;
      for (const bar of measure(card.example.notes, rest)) expect(barLength(bar), card.id).toBe(4);
    }
    for (const stage of STAGES.filter((s) => !s.chords)) {
      const pitches = stageGuide(stage, null).pitches;
      for (let i = 0; i < pitches.length; i += 4) {
        const bar = measure<Measurable>(pitches.slice(i, i + 4).map(() => ({ duration: 'q' as const })), rest)[0]!;
        expect(barLength(bar), stage.id).toBe(4);
      }
    }
  });
});
