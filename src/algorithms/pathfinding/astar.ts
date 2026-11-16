import { fromKey, neighbors, toKey } from '../../models/Grid';
import type { GridData, Point } from '../../models/Grid';
import { MinHeap } from './priorityQueue';
import { manhattan } from './heuristics';
import { failedResult, now, reconstructPath, validateEndpoints } from './common';
import type { NodeScore, SearchOptions, SearchResult, TraceStep } from './types';

interface OpenEntry {
  key: number;
  f: number;
  h: number;
  g: number;
  seq: number; // insertion order, makes tie-breaking fully deterministic
}

/**
 * A* search on a 4-connected unit-cost grid.
 *
 *   f(n) = g(n) + h(n)
 *   g(n) = exact cost of the best known path from start to n
 *   h(n) = Manhattan distance from n to goal (admissible + consistent)
 *
 * Data structures
 *   open set   : MinHeap ordered by (f, h, seq) — lower h breaks ties toward the goal
 *   closed set : Uint8Array flag per cell (O(1) membership)
 *   gScore     : Float64Array, initialised to +Infinity
 *   parent     : Int32Array, -1 = none (used for path reconstruction)
 *
 * Because h is consistent, the first time the goal is popped its g value is optimal and
 * no closed node ever needs reopening.
 *
 * Time  : O((V + E) log V) with a binary heap; on a grid E <= 4V so O(V log V).
 * Space : O(V) for the score arrays and heap.
 */
export function astar(grid: GridData, start: Point, goal: Point, options: SearchOptions = {}): SearchResult {
  const t0 = now();
  const err = validateEndpoints(grid, start, goal, options.extraBlocked);
  if (err) return failedResult('astar', err, t0);

  const { cols } = grid;
  const V = grid.rows * cols;
  const startKey = toKey(start, cols);
  const goalKey = toKey(goal, cols);

  const g = new Float64Array(V).fill(Infinity);
  const parent = new Int32Array(V).fill(-1);
  const closed = new Uint8Array(V);
  const trace: TraceStep[] | undefined = options.recordTrace ? [] : undefined;
  const scores: Map<number, NodeScore> | undefined = options.recordTrace ? new Map() : undefined;

  const open = new MinHeap<OpenEntry>((a, b) => a.f - b.f || a.h - b.h || a.seq - b.seq);
  let seq = 0;
  let pushes = 0;
  let maxOpen = 0;
  let explored = 0;

  const h0 = manhattan(start, goal);
  g[startKey] = 0;
  open.push({ key: startKey, g: 0, h: h0, f: h0, seq: seq++ });
  pushes++;
  trace?.push({ kind: 'open', key: startKey, g: 0, h: h0, f: h0, parent: -1 });
  scores?.set(startKey, { g: 0, h: h0, f: h0, parent: -1 });

  while (!open.isEmpty()) {
    maxOpen = Math.max(maxOpen, open.size);
    const cur = open.pop() as OpenEntry;
    // Lazy deletion: skip stale heap entries for nodes already finalised.
    if (closed[cur.key]) continue;
    closed[cur.key] = 1;
    explored++;
    trace?.push({ kind: 'expand', key: cur.key });

    if (cur.key === goalKey) {
      const path = reconstructPath(parent, goalKey, cols);
      return {
        algorithm: 'astar',
        found: true,
        path,
        cost: g[goalKey],
        nodesExplored: explored,
        heapPushes: pushes,
        maxOpenSize: maxOpen,
        timeMs: now() - t0,
        trace,
        scores,
      };
    }

    for (const nk of neighbors(grid, cur.key, options.extraBlocked)) {
      if (closed[nk]) continue;
      const tentative = g[cur.key] + 1; // uniform edge cost
      if (tentative < g[nk]) {
        // Relaxation: found a strictly better route to nk.
        g[nk] = tentative;
        parent[nk] = cur.key;
        const h = manhattan(fromKey(nk, cols), goal);
        const f = tentative + h;
        open.push({ key: nk, g: tentative, h, f, seq: seq++ });
        pushes++;
        trace?.push({ kind: 'open', key: nk, g: tentative, h, f, parent: cur.key });
        scores?.set(nk, { g: tentative, h, f, parent: cur.key });
      }
    }
  }

  return {
    algorithm: 'astar',
    found: false,
    path: [],
    cost: Infinity,
    nodesExplored: explored,
    heapPushes: pushes,
    maxOpenSize: maxOpen,
    timeMs: now() - t0,
    trace,
    scores,
    error: 'Goal is unreachable from start',
  };
}
