/**
 * Where progress lives. Today: localStorage. The interface is small on purpose
 * so a server-backed store can replace it later without touching the UI.
 */
import { MIN_COUNTS } from '../melody/meter';
import type { Stage } from '../melody/stages';
import { initialProgress, type Progress } from '../session/progression';

export interface ProgressStore {
  load(stages: readonly Stage[]): Progress;
  save(progress: Progress): void;
  clear(): void;
}

const KEY = 'guitar-reading-trainer.progress.v1';

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object';
}

/**
 * Accept older records: version 1 (no stage), version 2 (length in bars) and
 * version 3 (length in counts). Anything else starts fresh.
 */
function migrate(value: unknown, stages: readonly Stage[]): Progress | null {
  if (!isRecord(value)) return null;
  const numbers = ['cleanStreak', 'weakStreak', 'exercises', 'accuracySum'];
  if (!numbers.every((k) => typeof value[k] === 'number')) return null;
  const stage = typeof value.stage === 'number' ? value.stage : 0;
  const stageIndex = Math.max(0, Math.min(stages.length - 1, Math.round(stage)));
  const maxCounts = stages[stageIndex]!.maxCounts;
  let counts: number;
  if (value.version === 3 && typeof value.counts === 'number') counts = value.counts;
  else if (typeof value.bars === 'number') counts = value.bars * 4;
  else return null;
  return {
    version: 3,
    stage: stageIndex,
    unlocked: Math.max(stageIndex, Math.min(stages.length - 1, typeof value.unlocked === 'number' ? Math.round(value.unlocked) : stageIndex)),
    includeOptional: value.includeOptional === true,
    mode: value.mode === 'listen' ? 'listen' : 'watch',
    handedness: value.handedness === 'left' ? 'left' : 'right',
    counts: Math.max(MIN_COUNTS, Math.min(maxCounts, Math.round(counts))),
    cleanStreak: value.cleanStreak as number,
    weakStreak: value.weakStreak as number,
    exercises: value.exercises as number,
    accuracySum: value.accuracySum as number,
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
