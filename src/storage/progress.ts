/**
 * Where progress lives. Today: localStorage. The interface is small on purpose
 * so a server-backed store can replace it later without touching the UI.
 */
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

/** Accept version 1 (no stage) and version 2 records; anything else starts fresh. */
function migrate(value: unknown, stages: readonly Stage[]): Progress | null {
  if (!isRecord(value)) return null;
  const numbers = ['bars', 'cleanStreak', 'weakStreak', 'exercises', 'accuracySum'];
  if (!numbers.every((k) => typeof value[k] === 'number')) return null;
  const stage = value.version === 2 && typeof value.stage === 'number' ? value.stage : 0;
  const stageIndex = Math.max(0, Math.min(stages.length - 1, Math.round(stage)));
  const maxBars = stages[stageIndex]!.bars;
  return {
    version: 2,
    stage: stageIndex,
    includeOptional: value.includeOptional === true,
    bars: Math.max(1, Math.min(maxBars, value.bars as number)),
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
