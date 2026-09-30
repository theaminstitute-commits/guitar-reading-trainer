/**
 * Sequence alignment (Needleman-Wunsch style edit distance) so that an extra
 * or missing note shifts the comparison instead of marking everything after it
 * wrong. Generic over the two note types; the caller supplies the cost of
 * pairing a target note with an answer note (0 = identical, up to 1 = nothing
 * in common). A gap (missing or extra note) costs 1.
 */

export interface AlignedPair {
  /** Index into the target sequence, or null for an extra answer note. */
  target: number | null;
  /** Index into the answer sequence, or null for a missing note. */
  answer: number | null;
}

export function align<T, A>(
  target: readonly T[],
  answer: readonly A[],
  cost: (t: T, a: A) => number,
  gap = 1,
): AlignedPair[] {
  const n = target.length;
  const m = answer.length;
  // score[i][j] = minimal cost aligning target[0..i) with answer[0..j)
  const score: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = 1; i <= n; i++) score[i]![0] = i * gap;
  for (let j = 1; j <= m; j++) score[0]![j] = j * gap;
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const pair = score[i - 1]![j - 1]! + cost(target[i - 1]!, answer[j - 1]!);
      const missing = score[i - 1]![j]! + gap;
      const extra = score[i]![j - 1]! + gap;
      score[i]![j] = Math.min(pair, missing, extra);
    }
  }

  // Trace back, preferring a pairing over gaps when costs tie.
  const pairs: AlignedPair[] = [];
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    const current = score[i]![j]!;
    if (i > 0 && j > 0 && Math.abs(current - (score[i - 1]![j - 1]! + cost(target[i - 1]!, answer[j - 1]!))) < 1e-9) {
      pairs.push({ target: i - 1, answer: j - 1 });
      i--;
      j--;
    } else if (i > 0 && Math.abs(current - (score[i - 1]![j]! + gap)) < 1e-9) {
      pairs.push({ target: i - 1, answer: null });
      i--;
    } else {
      pairs.push({ target: null, answer: j - 1 });
      j--;
    }
  }
  return pairs.reverse();
}
