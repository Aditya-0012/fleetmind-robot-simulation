import { neighbors, toKey } from '../../models/Grid';
import type { GridData, Point } from '../../models/Grid';

/**
 * Breadth-first distance field from one source to every reachable cell.
 *
 * Used by the task allocator to estimate travel distance D in the cost function:
 * one BFS per robot gives exact shortest distances to *all* tasks in O(V + E), which is
 * much cheaper than running a separate A* per (robot, task) pair.
 *
 * BFS is correct here because every edge has the same cost (1). The queue is a plain
 * array with a moving head index — an O(1) FIFO without shift() overhead.
 *
 * Returns Int32Array where -1 means unreachable.
 */
export function bfsDistances(grid: GridData, source: Point, extraBlocked?: ReadonlySet<number>): Int32Array {
  const V = grid.rows * grid.cols;
  const dist = new Int32Array(V).fill(-1);
  const s = toKey(source, grid.cols);
  if (grid.obstacles[s] === 1) return dist;
  const queue = new Int32Array(V);
  let head = 0;
  let tail = 0;
  dist[s] = 0;
  queue[tail++] = s;
  while (head < tail) {
    const u = queue[head++];
    for (const v of neighbors(grid, u, extraBlocked)) {
      if (dist[v] !== -1) continue;
      dist[v] = dist[u] + 1;
      queue[tail++] = v;
    }
  }
  return dist;
}

/** Connected components labelling — used by the scenario generator to guarantee reachability. */
export function largestComponent(grid: GridData): Set<number> {
  const V = grid.rows * grid.cols;
  const seen = new Uint8Array(V);
  let best: number[] = [];
  const queue = new Int32Array(V);
  for (let s = 0; s < V; s++) {
    if (seen[s] || grid.obstacles[s]) continue;
    let head = 0;
    let tail = 0;
    queue[tail++] = s;
    seen[s] = 1;
    const comp: number[] = [];
    while (head < tail) {
      const u = queue[head++];
      comp.push(u);
      for (const v of neighbors(grid, u)) {
        if (!seen[v]) {
          seen[v] = 1;
          queue[tail++] = v;
        }
      }
    }
    if (comp.length > best.length) best = comp;
  }
  return new Set(best);
}
