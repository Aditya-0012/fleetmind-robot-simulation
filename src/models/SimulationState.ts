import type { AllocationAlgorithm, AllocationResult, CostWeights } from '../algorithms/allocation/types';
import type { PathAlgorithm } from '../algorithms/pathfinding/types';
import type { GridData, Point } from './Grid';
import type { Notice, SimEvent } from './Event';
import type { Robot } from './Robot';
import type { Task } from './Task';

export interface SimConfig {
  pathAlgorithm: PathAlgorithm;
  allocationAlgorithm: AllocationAlgorithm;
  weights: CostWeights;
  /** Max tasks committed to one robot at a time. */
  capacity: number;
  /** Record search traces so the map can show explored nodes (slightly slower). */
  showSearch: boolean;
}

/** Actions that can be scheduled for a future tick — the basis of deterministic scenarios. */
export type ScheduledAction =
  | { at: number; type: 'fail'; robotId: string; label?: string }
  | { at: number; type: 'restore'; robotId: string; label?: string }
  | { at: number; type: 'obstacle'; cell: Point; label?: string }
  | { at: number; type: 'blockPath'; robotId?: string; label?: string }
  | { at: number; type: 'task'; cell: Point; priority: number; duration: number; label?: string }
  | { at: number; type: 'priority'; taskId: string; priority: number; label?: string };

export interface ScenarioDefinition {
  id: string;
  name: string;
  description: string;
  rows: number;
  cols: number;
  obstacles: Point[];
  robots: Point[];
  tasks: { cell: Point; priority: number; duration: number }[];
  events: ScheduledAction[];
  config?: Partial<SimConfig>;
  seed?: number;
}

export interface SimMetrics {
  nodesExplored: number;
  pathPlans: number;
  plannedPathLength: number;
  replans: number;
  reallocations: number;
  failures: number;
  pathTimeMs: number;
  allocationRuns: number;
  allocationTimeMs: number;
  costEvaluations: number;
  obstaclesAdded: number;
  preemptions: number;
}

export interface MetricSample {
  tick: number;
  completed: number;
  inProgress: number;
  pending: number;
  blocked: number;
  distance: number;
  activeRobots: number;
  failedRobots: number;
  replans: number;
  reallocations: number;
  nodesExplored: number;
}

export interface SearchSnapshot {
  robotId: string;
  taskId: string;
  algorithm: PathAlgorithm;
  expanded: number[];
  opened: number[];
  tick: number;
  nodesExplored: number;
  pathLength: number;
}

export interface SimState {
  scenarioId: string;
  scenarioName: string;
  tick: number;
  finished: boolean;
  grid: GridData;
  robots: Robot[];
  tasks: Task[];
  events: SimEvent[];
  notices: Notice[];
  config: SimConfig;
  metrics: SimMetrics;
  history: MetricSample[];
  scheduled: ScheduledAction[];
  lastAllocation: AllocationResult | null;
  lastSearch: SearchSnapshot | null;
  nextTaskNumber: number;
}

export const emptyMetrics = (): SimMetrics => ({
  nodesExplored: 0,
  pathPlans: 0,
  plannedPathLength: 0,
  replans: 0,
  reallocations: 0,
  failures: 0,
  pathTimeMs: 0,
  allocationRuns: 0,
  allocationTimeMs: 0,
  costEvaluations: 0,
  obstaclesAdded: 0,
  preemptions: 0,
});
