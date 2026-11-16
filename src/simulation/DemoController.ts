import type { SimState } from '../models/SimulationState';
import { getScenario } from './scenarios';

export interface DemoStep {
  id: string;
  title: string;
  /** What the audience should notice. */
  explanation: string;
  /** Which algorithm or mechanism is at work. */
  algorithm: string;
  /** The step is reached when this predicate over the REAL engine state turns true. */
  reached: (s: SimState) => boolean;
}

/**
 * Demo mode narrates the deterministic "combined" scenario. It never fakes anything: every
 * step is marked reached only when the engine state shows the event really happened
 * (a failure counted, a reallocation counted, a replan counted, …).
 */
export const DEMO_SCENARIO = getScenario('combined');

export const DEMO_STEPS: DemoStep[] = [
  {
    id: 'load',
    title: 'Warehouse loaded',
    algorithm: 'Grid → graph',
    explanation:
      'The floor is an 18×26 grid. Every free cell is a graph vertex joined to its four neighbours with cost 1. Shelving racks are obstacles.',
    reached: () => true,
  },
  {
    id: 'allocate',
    title: 'Initial task allocation',
    algorithm: 'Greedy / Hungarian with Cost = αD + βW + γP + δL',
    explanation:
      'Each robot gets a BFS distance field. Tasks are scored by distance, workload, priority and estimated finish time, and handed to the cheapest robot.',
    reached: (s) => s.metrics.allocationRuns > 0 && s.tasks.some((t) => t.assignedRobotId !== null || t.status === 'COMPLETED'),
  },
  {
    id: 'move',
    title: 'Robots plan routes and move',
    algorithm: 'A* — f(n) = g(n) + h(n), Manhattan heuristic',
    explanation:
      'Each robot runs the selected path planner from its cell to its task. The faint overlay shows nodes the search explored; the dashed line is the final shortest path.',
    reached: (s) => s.robots.some((r) => r.distanceTravelled > 0),
  },
  {
    id: 'failure',
    title: 'Robot R2 fails',
    algorithm: 'Failure detection → state FAILED',
    explanation:
      'R2 stops instantly. Its unfinished tasks are released (completed work is kept) and it is excluded from every future allocation. Its cell becomes an obstacle.',
    reached: (s) => s.metrics.failures > 0,
  },
  {
    id: 'reassign',
    title: 'Automatic task reassignment',
    algorithm: 'Allocation re-run over surviving robots',
    explanation:
      'Costs are recomputed for the remaining robots only, and the released tasks go to whoever is now cheapest. Each reassignment is counted.',
    reached: (s) => s.metrics.reallocations > 0,
  },
  {
    id: 'obstacle',
    title: 'Obstacle appears on a live route',
    algorithm: 'Path validity check',
    explanation:
      'A pallet drops onto a cell ahead of a moving robot. The engine scans every remaining route for that cell and invalidates the affected path.',
    reached: (s) => s.metrics.obstaclesAdded > 0,
  },
  {
    id: 'replan',
    title: 'Dynamic replanning',
    algorithm: 'A* re-run from current position',
    explanation:
      'PATH INVALIDATED → REPLANNING → NEW PATH GENERATED. The robot searches again from where it stands and continues on the new route without passing through the obstacle.',
    reached: (s) => s.metrics.replans > 0,
  },
  {
    id: 'emergency',
    title: 'Emergency task arrives',
    algorithm: 'Priority-aware allocation',
    explanation:
      'A critical task (priority 5) gets priority penalty P = 0 and is allocated first. The chosen robot pre-empts lower-priority travel to serve it.',
    reached: (s) => s.tasks.some((t) => t.priority === 5),
  },
  {
    id: 'served',
    title: 'Emergency handled',
    algorithm: 'Execution state machine',
    explanation: 'The critical task is completed while the rest of the fleet carries on with its queues.',
    reached: (s) => s.tasks.some((t) => t.priority === 5 && t.status === 'COMPLETED'),
  },
  {
    id: 'complete',
    title: 'Mission complete',
    algorithm: 'Termination check',
    explanation:
      'Every reachable task is completed despite one failure and two route blockages. Check the metrics: failures, reallocations, replans and total distance are all measured, not scripted.',
    reached: (s) => s.finished,
  },
];

export function currentDemoStep(s: SimState): number {
  let idx = 0;
  for (let i = 0; i < DEMO_STEPS.length; i++) if (DEMO_STEPS[i].reached(s)) idx = i;
  return idx;
}
