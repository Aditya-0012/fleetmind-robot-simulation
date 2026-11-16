import { now } from '../pathfinding/common';
import { DistanceOracle, computeCost, taskOrder } from './costFunction';
import type { AllocRobot, AllocationInput, AllocationResult, Assignment, CostBreakdown, UnassignedReason } from './types';

/** Cost used for infeasible pairs. Much larger than any real cost, so the solver only uses
 *  such a pair if every perfect matching needs it — we then drop it as "unassigned". */
const BIG = 1e7;

export interface HungarianResult {
  /** rowToCol[i] = column assigned to row i, or -1 (dummy / infeasible). */
  rowToCol: number[];
  /** Sum of real (feasible, non-dummy) assigned costs. */
  totalCost: number;
  /** Inner-loop iterations — an O(n³) operation count. */
  operations: number;
  /** Size of the padded square matrix actually solved. */
  size: number;
}

/**
 * Hungarian algorithm (Kuhn–Munkres) for the minimum-cost assignment problem, using the
 * O(n³) potentials / shortest augmenting path formulation.
 *
 * Given an n × m cost matrix it finds a one-to-one matching of rows (robots) to columns
 * (tasks) minimising total cost.
 *
 * Rectangular matrices: the matrix is padded to N × N (N = max(n, m)) with dummy rows or
 * columns of cost 0. A robot matched to a dummy column receives no task; a task matched to
 * a dummy row stays unassigned. Infeasible pairs (Infinity) are replaced by BIG and
 * discarded from the answer.
 *
 * Potentials u (rows) and v (columns) keep the reduced costs c[i][j] − u[i] − v[j] ≥ 0.
 * Each of the N phases adds one row by growing a shortest-path tree over reduced costs
 * (minv[] = slack, way[] = predecessor) and augmenting along it.
 *
 * Time O(N³), space O(N²) for the padded matrix.
 */
export function hungarian(cost: number[][]): HungarianResult {
  const n = cost.length;
  const m = n > 0 ? cost[0].length : 0;
  if (n === 0 || m === 0) return { rowToCol: new Array(n).fill(-1), totalCost: 0, operations: 0, size: 0 };
  const N = Math.max(n, m);

  // 1-indexed padded matrix a[1..N][1..N]
  const a: Float64Array[] = [];
  for (let i = 0; i <= N; i++) a.push(new Float64Array(N + 1));
  for (let i = 1; i <= N; i++) {
    for (let j = 1; j <= N; j++) {
      if (i <= n && j <= m) {
        const c = cost[i - 1][j - 1];
        a[i][j] = Number.isFinite(c) ? c : BIG;
      } else {
        a[i][j] = 0; // dummy row/column
      }
    }
  }

  const u = new Float64Array(N + 1);
  const v = new Float64Array(N + 1);
  const p = new Int32Array(N + 1); // p[j] = row matched to column j (0 = none)
  const way = new Int32Array(N + 1);
  let ops = 0;

  for (let i = 1; i <= N; i++) {
    p[0] = i;
    let j0 = 0;
    const minv = new Float64Array(N + 1).fill(Infinity);
    const used = new Uint8Array(N + 1);
    do {
      used[j0] = 1;
      const i0 = p[j0];
      let delta = Infinity;
      let j1 = 0;
      for (let j = 1; j <= N; j++) {
        if (used[j]) continue;
        ops++;
        const cur = a[i0][j] - u[i0] - v[j];
        if (cur < minv[j]) {
          minv[j] = cur;
          way[j] = j0;
        }
        if (minv[j] < delta) {
          delta = minv[j];
          j1 = j;
        }
      }
      for (let j = 0; j <= N; j++) {
        if (used[j]) {
          u[p[j]] += delta;
          v[j] -= delta;
        } else {
          minv[j] -= delta;
        }
      }
      j0 = j1;
    } while (p[j0] !== 0);
    // augment along the alternating path
    do {
      const j1 = way[j0];
      p[j0] = p[j1];
      j0 = j1;
    } while (j0 !== 0);
  }

  const rowToCol = new Array<number>(n).fill(-1);
  let total = 0;
  for (let j = 1; j <= N; j++) {
    const i = p[j];
    if (i >= 1 && i <= n && j <= m) {
      const c = cost[i - 1][j - 1];
      if (Number.isFinite(c)) {
        rowToCol[i - 1] = j - 1;
        total += c;
      }
    }
  }
  return { rowToCol, totalCost: total, operations: ops, size: N };
}

/**
 * Multi-task allocation built from repeated Hungarian batches.
 *
 * The Hungarian algorithm only solves ONE-TO-ONE assignment. To give robots several tasks
 * we run it in rounds:
 *
 *   while unassigned tasks remain and some robot has spare capacity:
 *       build matrix  rows = robots with capacity,  cols = remaining tasks
 *       cost[i][j] = Cost(R_i, T_j) using each robot's current anchor & workload
 *       solve optimally with hungarian()
 *       commit the feasible pairs; update each robot's anchor, workload and backlog
 *
 * Each round is optimal for its own batch. The sequence of rounds is NOT guaranteed to be
 * globally optimal for the full multi-task scheduling problem (that problem is NP-hard in
 * general — it contains the travelling salesman problem).
 *
 * Complexity: each round O(N³ + R·T) with N = max(R, T); at most ⌈T / 1⌉ rounds in the
 * worst case, typically ⌈T / R⌉.
 */
export function hungarianAllocate(input: AllocationInput): AllocationResult {
  const t0 = now();
  const oracle = new DistanceOracle(input.grid, input.extraBlocked);
  const robots: AllocRobot[] = input.robots.map((r) => ({ ...r, anchor: { ...r.anchor } }));
  let remaining = [...input.tasks].sort(taskOrder);
  const assignments: Assignment[] = [];
  let evaluations = 0;
  let rounds = 0;

  // Tasks no robot can reach at all are reported up-front.
  const unreachable = new Set<string>();
  for (const t of remaining) {
    if (!robots.some((r) => oracle.distance(r.anchor, t.position) >= 0)) unreachable.add(t.id);
  }
  remaining = remaining.filter((t) => !unreachable.has(t.id));

  while (remaining.length > 0) {
    const rows = robots.filter((r) => r.workload < r.capacity);
    if (rows.length === 0) break;
    rounds++;
    const breakdowns: (CostBreakdown | null)[][] = [];
    const matrix: number[][] = rows.map((r) => {
      const brow: (CostBreakdown | null)[] = [];
      const row = remaining.map((t) => {
        const d = oracle.distance(r.anchor, t.position);
        if (d < 0) {
          brow.push(null);
          return Infinity;
        }
        evaluations++;
        const b = computeCost(input.grid, r, t, d, input.weights);
        brow.push(b);
        return b.total;
      });
      breakdowns.push(brow);
      return row;
    });

    const { rowToCol } = hungarian(matrix);
    const taken = new Set<number>();
    rowToCol.forEach((j, i) => {
      if (j < 0) return;
      const b = breakdowns[i][j];
      if (!b) return;
      const robot = rows[i];
      const task = remaining[j];
      assignments.push({ robotId: robot.id, taskId: task.id, cost: b.total, breakdown: b });
      robot.workload += 1;
      robot.backlogTicks += b.D + task.duration;
      robot.anchor = { ...task.position };
      taken.add(j);
    });
    if (taken.size === 0) break; // no progress possible (all remaining unreachable from current anchors)
    remaining = remaining.filter((_, j) => !taken.has(j));
  }

  const unassigned: { taskId: string; reason: UnassignedReason }[] = [];
  for (const id of unreachable) unassigned.push({ taskId: id, reason: robots.length ? 'unreachable' : 'no-robots' });
  for (const t of remaining) unassigned.push({ taskId: t.id, reason: robots.length ? 'no-capacity' : 'no-robots' });

  return {
    algorithm: 'hungarian',
    assignments,
    unassigned,
    totalCost: assignments.reduce((s, a) => s + a.cost, 0),
    costEvaluations: evaluations,
    bfsRuns: oracle.bfsRuns,
    rounds,
    timeMs: now() - t0,
  };
}
