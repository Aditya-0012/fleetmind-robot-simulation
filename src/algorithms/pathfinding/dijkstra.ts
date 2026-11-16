import { neighbors, toKey } from '../../models/Grid';
import type { GridData, Point } from '../../models/Grid';
import { MinHeap } from './priorityQueue';
import { failedResult, now, reconstructPath, validateEndpoints } from './common';
import type { NodeScore, SearchOptions, SearchResult, TraceStep } from './types';

interface DistEntry {
  key: number;
  d: number;
  seq: number;
}

/**
 * Dijkstra's single-source shortest path algorithm, stopped early when the goal is settled.
 *
 * Invariant: when a node is popped from the min-priority queue its distance is final,
 * because all edge weights are non-negative.
 *
 * Relaxation: for edge (u, v) with weight w, if dist[u] + w < dist[v] then
 *             dist[v] = dist[u] + w and parent[v] = u.
 *
 * Unlike A*, Dijkstra has no sense of direction — it expands nodes in rings of increasing
 * distance from the start, so it usually explores more nodes before reaching the goal.
 * On a uniform-cost grid both return a shortest path of equal length.
 *
 * Time  : O((V + E) log V) with a binary heap.
 * Space : O(V).
 */
export function dijkstra(grid: GridData, start: Point, goal: Point, options: SearchOptions = {}): SearchResult {
  const t0 = now();
  const err = validateEndpoints(grid, start, goal, options.extraBlocked);
  if (err) return failedResult('dijkstra', err, t0);

  const { cols } = grid;
  const V = grid.rows * cols;
  const startKey = toKey(start, cols);
  const goalKey = toKey(goal, cols);

  const dist = new Float64Array(V).fill(Infinity);
  const parent = new Int32Array(V).fill(-1);
  const settled = new Uint8Array(V);
  const trace: TraceStep[] | undefined = options.recordTrace ? [] : undefined;
  const scores: Map<number, NodeScore> | undefined = options.recordTrace ? new Map() : undefined;

  const pq = new MinHeap<DistEntry>((a, b) => a.d - b.d || a.seq - b.seq);
  let seq = 0;
  let pushes = 0;
  let maxOpen = 0;
  let explored = 0;

  dist[startKey] = 0;
  pq.push({ key: startKey, d: 0, seq: seq++ });
  pushes++;
  trace?.push({ kind: 'open', key: startKey, g: 0, h: 0, f: 0, parent: -1 });
  scores?.set(startKey, { g: 0, h: 0, f: 0, parent: -1 });

  while (!pq.isEmpty()) {
    maxOpen = Math.max(maxOpen, pq.size);
    const cur = pq.pop() as DistEntry;
    if (settled[cur.key]) continue; // stale entry (lazy deletion)
    settled[cur.key] = 1;
    explored++;
    trace?.push({ kind: 'expand', key: cur.key });

    if (cur.key === goalKey) {
      return {
        algorithm: 'dijkstra',
        found: true,
        path: reconstructPath(parent, goalKey, cols),
        cost: dist[goalKey],
        nodesExplored: explored,
        heapPushes: pushes,
        maxOpenSize: maxOpen,
        timeMs: now() - t0,
        trace,
        scores,
      };
    }

    for (const nk of neighbors(grid, cur.key, options.extraBlocked)) {
      if (settled[nk]) continue;
      const nd = dist[cur.key] + 1;
      if (nd < dist[nk]) {
        dist[nk] = nd;
        parent[nk] = cur.key;
        pq.push({ key: nk, d: nd, seq: seq++ });
        pushes++;
        trace?.push({ kind: 'open', key: nk, g: nd, h: 0, f: nd, parent: cur.key });
        scores?.set(nk, { g: nd, h: 0, f: nd, parent: cur.key });
      }
    }
  }

  return {
    algorithm: 'dijkstra',
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
