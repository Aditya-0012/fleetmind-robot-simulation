import type { SimState } from '../models/SimulationState';
import { isWalkable, samePoint } from '../models/Grid';
import type { Point } from '../models/Grid';
import { mulberry32 } from '../utils/random';
import { failedRobotCells } from './context';
import { bfsDistances } from '../algorithms/pathfinding/bfs';
import { toKey } from '../models/Grid';

/** Every dashboard number is derived here from live engine state — nothing is hard-coded. */
export function computeMetrics(s: SimState) {
  const rs = s.robots;
  const ts = s.tasks;
  const robotCount = (st: string) => rs.filter((r) => r.state === st).length;
  const taskCount = (st: string) => ts.filter((t) => t.status === st).length;
  const completed = ts.filter((t) => t.status === 'COMPLETED');
  const completionTimes = completed.map((t) => (t.completedAt ?? 0) - t.createdAt);
  return {
    robots: {
      total: rs.length,
      active: rs.filter((r) => r.state !== 'FAILED').length,
      moving: robotCount('MOVING'),
      executing: robotCount('EXECUTING'),
      idle: robotCount('IDLE'),
      assigned: robotCount('ASSIGNED'),
      waiting: robotCount('WAITING') + robotCount('REPLANNING'),
      failed: robotCount('FAILED'),
      completed: robotCount('COMPLETED'),
    },
    tasks: {
      total: ts.length,
      unassigned: taskCount('UNASSIGNED'),
      assigned: taskCount('ASSIGNED'),
      inProgress: taskCount('IN_PROGRESS'),
      completed: completed.length,
      blocked: taskCount('BLOCKED'),
    },
    perf: {
      totalDistance: rs.reduce((a, r) => a + r.distanceTravelled, 0),
      totalPathLength: s.metrics.plannedPathLength,
      avgPathLength: s.metrics.pathPlans ? s.metrics.plannedPathLength / s.metrics.pathPlans : 0,
      pathPlans: s.metrics.pathPlans,
      nodesExplored: s.metrics.nodesExplored,
      replans: s.metrics.replans,
      reallocations: s.metrics.reallocations,
      failures: s.metrics.failures,
      completionRate: ts.length ? completed.length / ts.length : 0,
      avgCompletionTime: completionTimes.length ? completionTimes.reduce((a, b) => a + b, 0) / completionTimes.length : 0,
      pathTimeMs: s.metrics.pathTimeMs,
      allocationTimeMs: s.metrics.allocationTimeMs,
      algorithmTimeMs: s.metrics.pathTimeMs + s.metrics.allocationTimeMs,
      allocationRuns: s.metrics.allocationRuns,
      preemptions: s.metrics.preemptions,
    },
  };
}

export type Metrics = ReturnType<typeof computeMetrics>;

/**
 * Picks a free cell reachable by at least one operational robot, deterministically from the
 * current tick — used by the "add emergency task" quick action.
 */
export function pickFreeReachableCell(s: SimState): Point | null {
  const blocked = failedRobotCells(s);
  const live = s.robots.filter((r) => r.state !== 'FAILED');
  if (!live.length) return null;
  const dist = bfsDistances(s.grid, live[0].position, blocked);
  const rnd = mulberry32(s.tick * 2654435761 + s.tasks.length);
  const candidates: Point[] = [];
  for (let r = 0; r < s.grid.rows; r++)
    for (let c = 0; c < s.grid.cols; c++) {
      const p = { r, c };
      if (!isWalkable(s.grid, p, blocked) || dist[toKey(p, s.grid.cols)] < 4) continue;
      if (s.robots.some((x) => samePoint(x.position, p))) continue;
      if (s.tasks.some((t) => t.status !== 'COMPLETED' && samePoint(t.position, p))) continue;
      candidates.push(p);
    }
  return candidates.length ? candidates[Math.floor(rnd() * candidates.length)] : null;
}
