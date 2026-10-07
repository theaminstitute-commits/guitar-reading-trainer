/**
 * Colours for notation drawn on the cream "paper" cards. The paper is the same
 * in the light and the dark theme, so these are fixed: what the learner reads
 * here should look like printed music whatever the rest of the app looks like.
 * The CSS tokens --paper, --paper-ink and friends in styles.css match these.
 */
export const PAPER = {
  background: '#f8f1e3',
  ink: '#1f1a13',
  muted: '#7d7468',
  /** The note being played or the one selected for editing. */
  active: '#c9780c',
  good: '#1e8a4e',
  bad: '#c9402b',
  missing: '#8c8478',
  /** Bar highlights on the input staff. */
  fullBar: 'rgba(30, 138, 78, 0.12)',
  rejectedBar: 'rgba(201, 64, 43, 0.22)',
};
