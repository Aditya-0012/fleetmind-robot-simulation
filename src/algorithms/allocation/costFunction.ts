import type { GridData } from '../../models/Grid';
import { toKey } from '../../models/Grid';
import { bfsDistances } from '../pathfinding/bfs';
import type { AllocRobot, AllocTask, CostBreakdown, CostWeights } from './types';

export const MAX_PRIORITY = 5;
export const MIN_PRIORITY = 1;

/**
 * Assignment cost:
 *
 *   Cost(R, T) = α·Dn + β·Wn + γ·P + δ·Ln
 *
 *   D  = shortest-path distance (cells) from the robot's anchor to the task (BFS, exact)
 *   W  = tasks already queued on the robot
 *   P  = (MAX_PRIORITY − priority) / (MAX_PRIORITY − MIN_PRIORITY)   ∈ [0, 1]
 *        → critical tasks (5) get penalty 0, low tasks (1) get penalty 1
 *   L  = backlogTicks + D + duration  — estimated tick at which the robot would finish T
 *
 * Normalisation (so the weights are comparable and grid-size independent):
 *   Dn = D / (rows + cols)
 *   Wn = W / capacity
 *   Ln = L / (2 · (rows + cols))
 *
 * Note: P does not depend on the robot, so it never changes *which robot* is cheapest for a
 * single task. It does change *which tasks* win when tasks compete for robots (Hungarian with
 * more tasks than robots) and Greedy processes tasks in priority order.
 */
export function computeCost(
  grid: GridData,
  robot: AllocRobot,
  task: AllocTask,
  distance: number,
  weights: CostWeights,
): CostBreakdown {
  const span = grid.rows + grid.cols;
  const D = distance;
  const W = robot.workload;
  const P = (MAX_PRIORITY - clampPriority(task.priority)) / (MAX_PRIORITY - MIN_PRIORITY);
  const L = robot.backlogTicks + D + task.duration;
  const Dn = D / span;
  const Wn = robot.capacity > 0 && Number.isFinite(robot.capacity) ? W / robot.capacity : W / 10;
  const Ln = L / (2 * span);
  const total = weights.alpha * Dn + weights.beta * Wn + weights.gamma * P + weights.delta * Ln;
  return { D, W, P, L, Dn, Wn, Ln, total };
}

export function clampPriority(p: number): number {
  return Math.max(MIN_PRIORITY, Math.min(MAX_PRIORITY, Math.round(p)));
}

/**
 * Caches one BFS distance field per anchor cell. Robots that share an anchor, or a robot
 * whose anchor does not change, reuse the same field. Keyed by flat cell index.
 */
export class DistanceOracle {
  private readonly cache = new Map<number, Int32Array>();
  bfsRuns = 0;
  private readonly grid: GridData;
  private readonly extraBlocked?: ReadonlySet<number>;

  constructor(grid: GridData, extraBlocked?: ReadonlySet<number>) {
    this.grid = grid;
    this.extraBlocked = extraBlocked;
  }

  /** Returns shortest distance or -1 when unreachable. */
  distance(from: { r: number; c: number }, to: { r: number; c: number }): number {
    const fk = toKey(from, this.grid.cols);
    let field = this.cache.get(fk);
    if (!field) {
      field = bfsDistances(this.grid, from, this.extraBlocked);
      this.cache.set(fk, field);
      this.bfsRuns++;
    }
    return field[toKey(to, this.grid.cols)];
  }
}

/** Highest priority first, then oldest, then id — the deterministic processing order. */
export function taskOrder(a: AllocTask, b: AllocTask): number {
  return b.priority - a.priority || a.createdAt - b.createdAt || a.id.localeCompare(b.id, 'en', { numeric: true });
}
