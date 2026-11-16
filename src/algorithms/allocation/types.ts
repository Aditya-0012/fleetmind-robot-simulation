import type { GridData, Point } from '../../models/Grid';

export type AllocationAlgorithm = 'greedy' | 'hungarian';

export const ALLOCATION_ALGORITHM_LABEL: Record<AllocationAlgorithm, string> = {
  greedy: 'Quick dispatch',
  hungarian: 'Optimized dispatch',
};

/** α, β, γ, δ in Cost(R,T) = αD + βW + γP + δL */
export interface CostWeights {
  alpha: number; // travel distance
  beta: number; // current workload
  gamma: number; // priority penalty
  delta: number; // estimated completion time
}

export const DEFAULT_WEIGHTS: CostWeights = { alpha: 1, beta: 0.6, gamma: 0.8, delta: 0.4 };

/** A robot as seen by the allocator — a snapshot, never the live simulation object. */
export interface AllocRobot {
  id: string;
  /** Where the robot will be when it is free to start a new task (end of its current queue). */
  anchor: Point;
  /** Number of tasks already queued (including the one in progress). */
  workload: number;
  /** Ticks of work already committed (remaining travel + remaining execution). */
  backlogTicks: number;
  /** Maximum queued tasks per robot. */
  capacity: number;
}

export interface AllocTask {
  id: string;
  position: Point;
  /** 1 (low) … 5 (critical). */
  priority: number;
  /** Ticks needed to execute at the destination. */
  duration: number;
  createdAt: number;
}

export interface AllocationInput {
  grid: GridData;
  robots: AllocRobot[]; // already filtered to eligible (non-failed) robots
  tasks: AllocTask[]; // already filtered to UNASSIGNED / BLOCKED tasks
  weights: CostWeights;
  /** cells that robots cannot pass (e.g. failed robots) */
  extraBlocked?: ReadonlySet<number>;
}

export interface CostBreakdown {
  D: number; // raw travel distance (cells)
  W: number; // raw workload (tasks)
  P: number; // priority penalty in [0, 1]
  L: number; // raw estimated completion time (ticks)
  Dn: number;
  Wn: number;
  Ln: number;
  total: number;
}

export interface Assignment {
  robotId: string;
  taskId: string;
  cost: number;
  breakdown: CostBreakdown;
}

export type UnassignedReason = 'unreachable' | 'no-capacity' | 'no-robots';

export interface AllocationResult {
  algorithm: AllocationAlgorithm;
  assignments: Assignment[];
  unassigned: { taskId: string; reason: UnassignedReason }[];
  totalCost: number;
  /** Number of cost-function evaluations — machine-independent work measure. */
  costEvaluations: number;
  /** BFS runs performed for distance estimation. */
  bfsRuns: number;
  /** Hungarian: number of assignment batches; Greedy: always 1. */
  rounds: number;
  timeMs: number;
}
