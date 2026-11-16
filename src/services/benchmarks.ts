import { astar, dijkstra, largestComponent } from '../algorithms/pathfinding';
import type { SearchResult } from '../algorithms/pathfinding';
import { DistanceOracle, computeCost, greedyAllocate, greedyMatrix, hungarian, hungarianAllocate, taskOrder } from '../algorithms/allocation';
import type { AllocRobot, AllocTask, AllocationResult, CostWeights } from '../algorithms/allocation';
import { now } from '../algorithms/pathfinding/common';
import { cloneGrid, fromKey } from '../models/Grid';
import type { GridData, Point } from '../models/Grid';
import type { SimConfig, SimState } from '../models/SimulationState';
import { SimulationEngine } from '../simulation/SimulationEngine';
import { SCENARIOS } from '../simulation/scenarios';
import { failedRobotCells } from '../simulation/context';
import { mulberry32, shuffle } from '../utils/random';

// ───────────────────────────── pathfinding ─────────────────────────────

export interface PathPairResult {
  pair: number;
  start: Point;
  goal: Point;
  astar: Pick<SearchResult, 'cost' | 'nodesExplored' | 'heapPushes' | 'maxOpenSize' | 'timeMs' | 'found'>;
  dijkstra: Pick<SearchResult, 'cost' | 'nodesExplored' | 'heapPushes' | 'maxOpenSize' | 'timeMs' | 'found'>;
}

export interface PathBenchmark {
  gridLabel: string;
  cells: number;
  pairs: PathPairResult[];
  summary: {
    algorithm: 'A*' | 'Dijkstra';
    avgPath: number;
    avgExplored: number;
    avgPushes: number;
    avgMaxOpen: number;
    avgTimeMs: number;
    totalTimeMs: number;
  }[];
  pathsEqual: boolean;
}

const pick = (r: SearchResult) => ({ cost: r.cost, nodesExplored: r.nodesExplored, heapPushes: r.heapPushes, maxOpenSize: r.maxOpenSize, timeMs: r.timeMs, found: r.found });

/** Runs A* and Dijkstra on the SAME grid and the SAME start/goal pairs. */
export function benchmarkPathfinding(grid: GridData, gridLabel: string, pairs: number, seed: number): PathBenchmark {
  const comp = [...largestComponent(grid)];
  const rnd = mulberry32(seed);
  shuffle(rnd, comp);
  // warm-up so JIT compilation does not distort the first measurement
  if (comp.length >= 2) {
    const a = fromKey(comp[0], grid.cols);
    const b = fromKey(comp[1], grid.cols);
    for (let i = 0; i < 3; i++) {
      astar(grid, a, b);
      dijkstra(grid, a, b);
    }
  }
  const out: PathPairResult[] = [];
  for (let i = 0; i + 1 < comp.length && out.length < pairs; i += 2) {
    const start = fromKey(comp[i], grid.cols);
    const goal = fromKey(comp[i + 1], grid.cols);
    const a = astar(grid, start, goal);
    const d = dijkstra(grid, start, goal);
    out.push({ pair: out.length + 1, start, goal, astar: pick(a), dijkstra: pick(d) });
  }
  const sum = (sel: (p: PathPairResult) => number) => out.reduce((s, p) => s + sel(p), 0);
  const n = Math.max(1, out.length);
  return {
    gridLabel,
    cells: grid.rows * grid.cols,
    pairs: out,
    pathsEqual: out.every((p) => p.astar.cost === p.dijkstra.cost),
    summary: [
      {
        algorithm: 'A*',
        avgPath: sum((p) => p.astar.cost) / n,
        avgExplored: sum((p) => p.astar.nodesExplored) / n,
        avgPushes: sum((p) => p.astar.heapPushes) / n,
        avgMaxOpen: sum((p) => p.astar.maxOpenSize) / n,
        avgTimeMs: sum((p) => p.astar.timeMs) / n,
        totalTimeMs: sum((p) => p.astar.timeMs),
      },
      {
        algorithm: 'Dijkstra',
        avgPath: sum((p) => p.dijkstra.cost) / n,
        avgExplored: sum((p) => p.dijkstra.nodesExplored) / n,
        avgPushes: sum((p) => p.dijkstra.heapPushes) / n,
        avgMaxOpen: sum((p) => p.dijkstra.maxOpenSize) / n,
        avgTimeMs: sum((p) => p.dijkstra.timeMs) / n,
        totalTimeMs: sum((p) => p.dijkstra.timeMs),
      },
    ],
  };
}

// ───────────────────────────── allocation ─────────────────────────────

export interface AllocationBenchmark {
  robots: string[];
  tasks: string[];
  matrix: number[][];
  oneToOne: {
    greedy: { rowToCol: number[]; totalCost: number; assigned: number; timeMs: number; operations: number };
    hungarian: { rowToCol: number[]; totalCost: number; assigned: number; timeMs: number; operations: number };
  };
  multi: { greedy: AllocationResult; hungarian: AllocationResult };
  workload: { robot: string; greedy: number; hungarian: number }[];
}

/**
 * Builds ONE cost matrix from the current fleet (every operational robot at its current cell,
 * zero workload) and every unfinished task, then runs Greedy and Hungarian on it.
 */
export function benchmarkAllocation(state: SimState, weights: CostWeights, capacity: number): AllocationBenchmark | null {
  const blocked = failedRobotCells(state);
  const robots: AllocRobot[] = state.robots
    .filter((r) => r.state !== 'FAILED')
    .map((r) => ({ id: r.id, anchor: { ...r.position }, workload: 0, backlogTicks: 0, capacity }));
  const tasks: AllocTask[] = state.tasks
    .filter((t) => t.status !== 'COMPLETED')
    .map((t) => ({ id: t.id, position: t.position, priority: t.priority, duration: t.duration, createdAt: t.createdAt }))
    .sort(taskOrder);
  if (robots.length === 0 || tasks.length === 0) return null;

  const oracle = new DistanceOracle(state.grid, blocked);
  const matrix = robots.map((r) =>
    tasks.map((t) => {
      const d = oracle.distance(r.anchor, t.position);
      return d < 0 ? Infinity : computeCost(state.grid, r, t, d, weights).total;
    }),
  );

  let t0 = now();
  const g = greedyMatrix(matrix);
  const gTime = now() - t0;
  t0 = now();
  const h = hungarian(matrix);
  const hTime = now() - t0;

  const input = { grid: state.grid, robots, tasks, weights, extraBlocked: blocked };
  const mg = greedyAllocate(input);
  const mh = hungarianAllocate(input);
  const count = (res: AllocationResult, id: string) => res.assignments.filter((a) => a.robotId === id).length;

  return {
    robots: robots.map((r) => r.id),
    tasks: tasks.map((t) => t.id),
    matrix,
    oneToOne: {
      greedy: { rowToCol: g.rowToCol, totalCost: g.totalCost, assigned: g.rowToCol.filter((x) => x >= 0).length, timeMs: gTime, operations: g.evaluations },
      hungarian: { rowToCol: h.rowToCol, totalCost: h.totalCost, assigned: h.rowToCol.filter((x) => x >= 0).length, timeMs: hTime, operations: h.operations },
    },
    multi: { greedy: mg, hungarian: mh },
    workload: robots.map((r) => ({ robot: r.id, greedy: count(mg, r.id), hungarian: count(mh, r.id) })),
  };
}

// ───────────────────────────── whole-scenario runs ─────────────────────────────

export interface ScenarioRun {
  scenario: string;
  config: string;
  failures: number;
  reallocations: number;
  replans: number;
  distance: number;
  completed: number;
  total: number;
  completionTick: number;
  nodesExplored: number;
  algorithmMs: number;
}

export const RUN_CONFIGS: { label: string; config: Partial<SimConfig> }[] = [
  { label: 'A* + Greedy', config: { pathAlgorithm: 'astar', allocationAlgorithm: 'greedy' } },
  { label: 'A* + Hungarian', config: { pathAlgorithm: 'astar', allocationAlgorithm: 'hungarian' } },
  { label: 'Dijkstra + Greedy', config: { pathAlgorithm: 'dijkstra', allocationAlgorithm: 'greedy' } },
];

/** Runs every predefined scenario headless under each configuration. Deterministic. */
export function benchmarkScenarios(weights: CostWeights, capacity: number): ScenarioRun[] {
  const out: ScenarioRun[] = [];
  for (const sc of SCENARIOS) {
    for (const rc of RUN_CONFIGS) {
      const e = new SimulationEngine(sc, { ...rc.config, weights, capacity, showSearch: false });
      e.runUntilFinished(2000);
      const s = e.state;
      out.push({
        scenario: sc.name,
        config: rc.label,
        failures: s.metrics.failures,
        reallocations: s.metrics.reallocations,
        replans: s.metrics.replans,
        distance: s.robots.reduce((a, r) => a + r.distanceTravelled, 0),
        completed: s.tasks.filter((t) => t.status === 'COMPLETED').length,
        total: s.tasks.length,
        completionTick: s.tick,
        nodesExplored: s.metrics.nodesExplored,
        algorithmMs: s.metrics.pathTimeMs + s.metrics.allocationTimeMs,
      });
    }
  }
  return out;
}

export function currentGridCopy(state: SimState): GridData {
  return cloneGrid(state.grid);
}
