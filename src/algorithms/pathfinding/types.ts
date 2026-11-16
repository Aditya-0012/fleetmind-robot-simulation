import type { Point } from '../../models/Grid';

export type PathAlgorithm = 'astar' | 'dijkstra';

export const PATH_ALGORITHM_LABEL: Record<PathAlgorithm, string> = {
  astar: 'Targeted routing',
  dijkstra: 'Exhaustive routing',
};

/** One step of the recorded search, used by the step-by-step visualiser. */
export type TraceStep =
  | { kind: 'expand'; key: number } // node popped from the open set and moved to closed
  | { kind: 'open'; key: number; g: number; h: number; f: number; parent: number }; // node pushed / improved

export interface NodeScore {
  g: number;
  h: number;
  f: number;
  parent: number; // -1 for the start node
}

export interface SearchResult {
  algorithm: PathAlgorithm;
  found: boolean;
  /** Path from start to goal inclusive. Empty when not found. */
  path: Point[];
  /** Number of edges in the path (path.length - 1), or Infinity when unreachable. */
  cost: number;
  /** Nodes removed from the open set and expanded. Machine-independent measure of work. */
  nodesExplored: number;
  /** Total pushes into the priority queue (including lazy duplicates). */
  heapPushes: number;
  /** Largest open-set size observed — a proxy for peak memory. */
  maxOpenSize: number;
  /** Wall-clock time in ms measured with performance.now(). Varies by machine. */
  timeMs: number;
  /** Optional detailed trace for visualisation (only recorded when requested). */
  trace?: TraceStep[];
  /** Final g/h/f/parent for every node touched (only recorded when requested). */
  scores?: Map<number, NodeScore>;
  error?: string;
}

export interface SearchOptions {
  /** Record trace + scores for visualisation. Off in the simulation loop for speed. */
  recordTrace?: boolean;
  /** Extra blocked cells (e.g. failed robots) on top of the grid's obstacles. */
  extraBlocked?: ReadonlySet<number>;
}
