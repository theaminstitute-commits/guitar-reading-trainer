import type { DurationId } from '../music/duration';
import type { QualityId } from './formulas';
import type { VoicingType } from './voicings';

/** One kind of chord a stage may draw: a quality and where its voicings come from. */
export interface ChordItem {
  quality: QualityId;
  /** Fixed open-position shapes, named moveable shapes, or the voicing search. */
  source: 'open' | 'shapes' | 'find';
  /** For `open`: only these root letters (chart spelling, e.g. 'C', 'F'); all open shapes of the quality otherwise. */
  openRoots?: readonly string[];
  /** For `shapes`: ids from MOVEABLE_SHAPES. */
  shapes?: readonly string[];
  /** For `find`: string sets to search, lowest string first. */
  stringSets?: readonly (readonly number[])[];
  maxSpan?: number;
  /** Any chord tone may be in the bass. */
  inversions?: boolean;
  /** The tone that must be in the bass (slash chords). */
  bassTone?: 'third' | 'fifth';
  /** Keep only these voicing types. */
  types?: readonly VoicingType[];
  /**
   * Which roots: `diatonic` roots put every required tone in the key (the default,
   * falling back to any root when the key has none); `diatonic-only` skips the item
   * instead of falling back; `any` draws from all twelve.
   */
  roots?: 'diatonic' | 'diatonic-only' | 'any';
}

export interface ChordStageConfig {
  items: readonly ChordItem[];
  /** Note lengths a chord may take on a pure chord stage. */
  durations: readonly DurationId[];
  /**
   * Mixed stages: the share of melody events replaced by a chord whose top note
   * is the melody note (chord melody, free reading). Absent on pure chord stages.
   */
  mix?: number;
}
