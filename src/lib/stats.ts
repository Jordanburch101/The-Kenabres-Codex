export type ValueKind = 'num' | 'word';

/** All-digit values render as big numbers; everything else as word labels. */
export function valueKind(value: string): ValueKind {
  return /^\d+$/.test(value.trim()) ? 'num' : 'word';
}

/**
 * Full-width six-column grid when all six abilities are present (main
 * characters); otherwise the left-aligned, capped-width layout used by
 * sparse companion builds.
 */
export function statGridClass(count: number): 'stats--full' | 'stats--few' {
  return count >= 6 ? 'stats--full' : 'stats--few';
}
