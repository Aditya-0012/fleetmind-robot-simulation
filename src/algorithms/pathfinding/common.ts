import { fromKey, inBounds, isWalkable, pointLabel, toKey } from '../../models/Grid';
import type { GridData, Point } from '../../models/Grid';
import type { PathAlgorithm, SearchResult } from './types';

export const now = (): number =>
  typeof performance !== 'undefined' && typeof performance.now === 'function' ? performance.now() : Date.now();

/** Validates start/goal. Returns an error message or null. */
export function validateEndpoints(
  grid: GridData,
  start: Point,
  goal: Point,
  extraBlocked?: ReadonlySet<number>,
): string | null {
  if (!inBounds(grid, start)) return `Start ${pointLabel(start)} is outside the grid`;
  if (!inBounds(grid, goal)) return `Goal ${pointLabel(goal)} is outside the grid`;
  // The start cell itself may be "extra blocked" (a robot standing on it) — only obstacles matter.
  if (!isWalkable(grid, start)) return `Start ${pointLabel(start)} is an obstacle`;
  if (!isWalkable(grid, goal, extraBlocked)) return `Goal ${pointLabel(goal)} is blocked`;
  return null;
}

/** Walk parent pointers back from the goal, then reverse. O(path length). */
export function reconstructPath(parent: Int32Array, goalKey: number, cols: number): Point[] {
  const path: Point[] = [];
  let k = goalKey;
  while (k !== -1) {
    path.push(fromKey(k, cols));
    k = parent[k];
  }
  return path.reverse();
}

export function failedResult(algorithm: PathAlgorithm, error: string, t0: number): SearchResult {
  return {
    algorithm,
    found: false,
    path: [],
    cost: Infinity,
    nodesExplored: 0,
    heapPushes: 0,
    maxOpenSize: 0,
    timeMs: now() - t0,
    error,
  };
}

/** Checks a path is contiguous, in-bounds and obstacle-free. Used by tests and the engine. */
export function isValidPath(grid: GridData, path: Point[], extraBlocked?: ReadonlySet<number>): boolean {
  for (let i = 0; i < path.length; i++) {
    const p = path[i];
    if (!inBounds(grid, p)) return false;
    // ignore extra-blocked on the very first cell (robot's own position)
    if (!isWalkable(grid, p, i === 0 ? undefined : extraBlocked)) return false;
    if (i > 0) {
      const q = path[i - 1];
      if (Math.abs(p.r - q.r) + Math.abs(p.c - q.c) !== 1) return false;
    }
  }
  return true;
}

export const keyOf = toKey;
