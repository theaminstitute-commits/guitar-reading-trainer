/**
 * Where progress lives. Today: localStorage. The interface is small on purpose
 * so a server-backed store can replace it later without touching the UI.
 */
import type { LevelConfig } from '../melody/levelConfig';
import { initialProgress, type Progress } from '../session/progression';

export interface ProgressStore {
  load(level: LevelConfig): Progress;
  save(progress: Progress): void;
  clear(): void;
}

const KEY = 'guitar-reading-trainer.progress.v1';

function isProgress(value: unknown): value is Progress {
  if (!value || typeof value !== 'object') return false;
  const p = value as Record<string, unknown>;
  return (
    p.version === 1 &&
    typeof p.bars === 'number' &&
    typeof p.cleanStreak === 'number' &&
    typeof p.weakStreak === 'number' &&
    typeof p.exercises === 'number' &&
    typeof p.accuracySum === 'number'
  );
}

export const localProgressStore: ProgressStore = {
  load(level) {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed: unknown = JSON.parse(raw);
        if (isProgress(parsed)) {
          return { ...parsed, bars: Math.max(1, Math.min(level.bars, parsed.bars)) };
        }
      }
    } catch {
      // Private mode, blocked storage or corrupt data: start fresh.
    }
    return initialProgress(level);
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
    load: (level) => saved ?? initialProgress(level),
    save: (p) => {
      saved = p;
    },
    clear: () => {
      saved = null;
    },
  };
}
