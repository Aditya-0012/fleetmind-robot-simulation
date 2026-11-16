import type { Point } from '../../models/Grid';

/**
 * Manhattan distance |r1 - r2| + |c1 - c2|.
 *
 * On a 4-connected grid with unit edge costs no path can be shorter than the Manhattan
 * distance, so the heuristic never over-estimates (admissible). It also satisfies
 * h(n) <= cost(n, n') + h(n') for neighbours (consistent / monotone), which guarantees
 * that A* never needs to re-open a node in the closed set.
 */
export function manhattan(a: Point, b: Point): number {
  return Math.abs(a.r - b.r) + Math.abs(a.c - b.c);
}

/** Zero heuristic. A* with h = 0 degenerates exactly into Dijkstra's algorithm. */
export function zeroHeuristic(): number {
  return 0;
}
