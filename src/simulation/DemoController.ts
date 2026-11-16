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
    algorithm: 'Floor map',
    explanation: 'Four robots wait at their docks. Dark blocks are shelving racks robots must drive around; diamonds are pick tasks, coloured by urgency.',
    reached: () => true,
  },
  {
    id: 'allocate',
    title: 'Tasks handed out',
    algorithm: 'Dispatch',
    explanation:
      'Each task gets a score for every robot based on travel distance, how busy the robot already is, how urgent the task is and when it could be finished. The lowest score wins.',
    reached: (s) => s.metrics.allocationRuns > 0 && s.tasks.some((t) => t.assignedRobotId !== null || t.status === 'COMPLETED'),
  },
  {
    id: 'move',
    title: 'Robots plan routes and move',
    algorithm: 'Routing',
    explanation:
      'Every robot works out the shortest drive to its task, searching towards the destination first. The faint shading shows the cells it checked; the dashed line is its route.',
    reached: (s) => s.robots.some((r) => r.distanceTravelled > 0),
  },
  {
    id: 'failure',
    title: 'Robot R2 breaks down',
    algorithm: 'Breakdown',
    explanation:
      'R2 stops on the spot. Work it had not finished goes back into the pool (finished work is kept) and it gets no new tasks. Other robots now drive around it.',
    reached: (s) => s.metrics.failures > 0,
  },
  {
    id: 'reassign',
    title: 'Work is reassigned automatically',
    algorithm: 'Reassignment',
    explanation: 'Scores are recalculated for the robots that still work, and R2’s unfinished tasks go to whoever is now the best fit.',
    reached: (s) => s.metrics.reallocations > 0,
  },
  {
    id: 'obstacle',
    title: 'An aisle gets blocked',
    algorithm: 'Route check',
    explanation: 'A pallet drops just ahead of a moving robot. The system checks every planned route and spots the one that now runs into it.',
    reached: (s) => s.metrics.obstaclesAdded > 0,
  },
  {
    id: 'replan',
    title: 'The robot reroutes',
    algorithm: 'Rerouting',
    explanation: 'Route blocked → rerouting → new route found. The robot plans again from where it stands and carries on without touching the obstacle.',
    reached: (s) => s.metrics.replans > 0,
  },
  {
    id: 'emergency',
    title: 'Emergency task arrives',
    algorithm: 'Urgent work first',
    explanation: 'A critical job appears. It is assigned first, and the chosen robot pauses lower-priority travel to go there straight away.',
    reached: (s) => s.tasks.some((t) => t.priority === 5),
  },
  {
    id: 'served',
    title: 'Emergency handled',
    algorithm: 'Task completed',
    explanation: 'The critical task is finished while the rest of the fleet continues with its own lists.',
    reached: (s) => s.tasks.some((t) => t.priority === 5 && t.status === 'COMPLETED'),
  },
  {
    id: 'complete',
    title: 'Mission complete',
    algorithm: 'All done',
    explanation:
      'Every task is finished despite one breakdown and two blocked aisles. The counts for breakdowns, reassignments, reroutes and distance are all measured live, not scripted.',
    reached: (s) => s.finished,
  },
];

export function currentDemoStep(s: SimState): number {
  let idx = 0;
  for (let i = 0; i < DEMO_STEPS.length; i++) if (DEMO_STEPS[i].reached(s)) idx = i;
  return idx;
}
