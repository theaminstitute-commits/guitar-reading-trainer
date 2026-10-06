/**
 * Where progress lives. Today: localStorage. The interface is small on purpose
 * so a server-backed store can replace it later without touching the UI.
 */
import { MIN_COUNTS } from '../melody/meter';
import type { Stage } from '../melody/stages';
import { initialProgress, initialTrack, type Progress, type Track } from '../session/progression';

export interface ProgressStore {
  load(stages: readonly Stage[]): Progress;
  save(progress: Progress): void;
  clear(): void;
}

const KEY = 'guitar-reading-trainer.progress.v1';

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object';
}

/** Fingerprints of melodies heard per stage; anything malformed is dropped. */
function migrateMelodies(value: unknown): Record<string, string[]> {
  if (!isRecord(value)) return {};
  const out: Record<string, string[]> = {};
  for (const [stage, list] of Object.entries(value)) {
    if (Array.isArray(list)) out[stage] = list.filter((f): f is string => typeof f === 'string');
  }
  return out;
}

/** A track from any older or current record shape; null if it is not one. */
function migrateTrack(value: unknown, stages: readonly Stage[]): Track | null {
  if (!isRecord(value)) return null;
  const numbers = ['weakStreak', 'exercises', 'accuracySum'];
  if (!numbers.every((k) => typeof value[k] === 'number')) return null;
  const stage = typeof value.stage === 'number' ? value.stage : 0;
  const stageIndex = Math.max(0, Math.min(stages.length - 1, Math.round(stage)));
  const maxCounts = stages[stageIndex]!.maxCounts;
  let counts: number;
  if (typeof value.counts === 'number') counts = value.counts;
  else if (typeof value.bars === 'number') counts = value.bars * 4;
  else return null;
  return {
    stage: stageIndex,
    unlocked: Math.max(stageIndex, Math.min(stages.length - 1, typeof value.unlocked === 'number' ? Math.round(value.unlocked) : stageIndex)),
    counts: Math.max(MIN_COUNTS, Math.min(maxCounts, Math.round(counts))),
    // Records before the tally rule carried a clean streak instead; it starts the tally at zero.
    tally: typeof value.tally === 'number' ? Math.max(0, Math.round(value.tally)) : 0,
    melodies: migrateMelodies(value.melodies),
    weakStreak: value.weakStreak as number,
    exercises: value.exercises as number,
    accuracySum: value.accuracySum as number,
  };
}

/**
 * Accept every record shape so far: versions 1-3 kept one set of counters at
 * the top level (that becomes the writing track); version 4 has two tracks.
 */
function migrate(value: unknown, stages: readonly Stage[]): Progress | null {
  if (!isRecord(value)) return null;
  let write: Track | null;
  let play: Track | null;
  if (value.version === 4) {
    write = migrateTrack(value.write, stages);
    play = migrateTrack(value.play, stages);
    if (!write || !play) return null;
  } else {
    write = migrateTrack(value, stages);
    if (!write) return null;
    play = initialTrack(stages);
  }
  const mode = value.mode === 'listen' || value.mode === 'play' ? value.mode : 'watch';
  return {
    version: 4,
    mode,
    handedness: value.handedness === 'left' ? 'left' : 'right',
    metronome: value.metronome === true,
    seenGuides: Array.isArray(value.seenGuides) ? value.seenGuides.filter((n): n is number => typeof n === 'number') : [],
    write,
    play,
  };
}

export const localProgressStore: ProgressStore = {
  load(stages) {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const migrated = migrate(JSON.parse(raw), stages);
        if (migrated) return migrated;
      }
    } catch {
      // Private mode, blocked storage or corrupt data: start fresh.
    }
    return initialProgress(stages);
  },
  save(progress) {
    try {
      localStorage.setItem(KEY, JSON.stringify(progress));
    } catch {
      // Storage unavailable: progress lasts for this visit only.
    }
  },
  clear() {
    try {
      localStorage.removeItem(KEY);
    } catch {
      // ignore
    }
  },
};

/** In-memory store for tests and for environments without storage. */
export function createMemoryStore(): ProgressStore {
  let saved: Progress | null = null;
  return {
    load: (stages) => saved ?? initialProgress(stages),
    save: (p) => {
      saved = p;
    },
    clear: () => {
      saved = null;
    },
  };
}
