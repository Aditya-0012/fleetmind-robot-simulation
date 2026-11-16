import { now } from '../pathfinding/common';
import { DistanceOracle, computeCost, taskOrder } from './costFunction';
import type { AllocRobot, AllocationInput, AllocationResult, Assignment, CostBreakdown, UnassignedReason } from './types';

/**
 * Greedy task allocation (multi-task per robot).
 *
 *   sort tasks by (priority desc, createdAt asc, id)
 *   for each task T:
 *       for each robot R with spare capacity that can reach T:
 *           compute Cost(R, T)
 *       assign T to the cheapest R
 *           tie-break: lower cost → lower workload → lower robot id
 *       R.workload += 1;  R.backlog += D + duration;  R.anchor = T.position
 *
 * Each choice is locally optimal for that task only, so the overall total cost is NOT
 * guaranteed to be minimal — Hungarian (on a one-to-one batch) can beat it.
 *
 * Complexity (T tasks, R robots, V cells):
 *   sort                        O(T log T)
 *   cost evaluations            O(T · R)
 *   BFS distance fields         O(A · V) where A ≤ R + T distinct anchors
 *   total                       O(T log T + T·R + (R + T)·V)
 */
export function greedyAllocate(input: AllocationInput): AllocationResult {
  const t0 = now();
  const oracle = new DistanceOracle(input.grid, input.extraBlocked);
  // Work on copies so the caller's robot snapshots are not mutated.
  const robots: AllocRobot[] = input.robots.map((r) => ({ ...r, anchor: { ...r.anchor } }));
  const tasks = [...input.tasks].sort(taskOrder);
  const assignments: Assignment[] = [];
  const unassigned: { taskId: string; reason: UnassignedReason }[] = [];
  let evaluations = 0;

  for (const task of tasks) {
    if (robots.length === 0) {
      unassigned.push({ taskId: task.id, reason: 'no-robots' });
      continue;
    }
    let best: { robot: AllocRobot; cost: CostBreakdown } | null = null;
    let reachableByAnyone = false;

    for (const robot of robots) {
      const d = oracle.distance(robot.anchor, task.position);
      if (d < 0) continue;
      reachableByAnyone = true;
      if (robot.workload >= robot.capacity) continue;
      const cost = computeCost(input.grid, robot, task, d, input.weights);
      evaluations++;
      if (
        !best ||
        cost.total < best.cost.total - 1e-12 ||
        (Math.abs(cost.total - best.cost.total) <= 1e-12 &&
          (robot.workload < best.robot.workload ||
            (robot.workload === best.robot.workload && robot.id.localeCompare(best.robot.id, 'en', { numeric: true }) < 0)))
      ) {
        best = { robot, cost };
      }
    }

    if (!best) {
      unassigned.push({ taskId: task.id, reason: reachableByAnyone ? 'no-capacity' : 'unreachable' });
      continue;
    }

    assignments.push({ robotId: best.robot.id, taskId: task.id, cost: best.cost.total, breakdown: best.cost });
    best.robot.workload += 1;
    best.robot.backlogTicks += best.cost.D + task.duration;
    best.robot.anchor = { ...task.position };
  }

  return {
    algorithm: 'greedy',
    assignments,
    unassigned,
    totalCost: assignments.reduce((s, a) => s + a.cost, 0),
    costEvaluations: evaluations,
    bfsRuns: oracle.bfsRuns,
    rounds: 1,
    timeMs: now() - t0,
  };
}

/**
 * Greedy on a fixed one-to-one cost matrix (rows = robots, cols = tasks already sorted by
 * priority). Used by the analytics page to compare against Hungarian on the *same* matrix.
 * Infinity marks an infeasible pair.
 */
export function greedyMatrix(cost: number[][]): { rowToCol: number[]; totalCost: number; evaluations: number } {
  const n = cost.length;
  const m = n ? cost[0].length : 0;
  const rowUsed = new Array<boolean>(n).fill(false);
  const rowToCol = new Array<number>(n).fill(-1);
  let total = 0;
  let evaluations = 0;
  for (let j = 0; j < m; j++) {
    let bestRow = -1;
    for (let i = 0; i < n; i++) {
      if (rowUsed[i]) continue;
      evaluations++;
      if (!Number.isFinite(cost[i][j])) continue;
      if (bestRow === -1 || cost[i][j] < cost[bestRow][j]) bestRow = i;
    }
    if (bestRow >= 0) {
      rowUsed[bestRow] = true;
      rowToCol[bestRow] = j;
      total += cost[bestRow][j];
    }
  }
  return { rowToCol, totalCost: total, evaluations };
}
