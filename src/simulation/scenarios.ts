import type { Point } from '../models/Grid';
import type { ScenarioDefinition, ScheduledAction } from '../models/SimulationState';

/** Warehouse floor: three rows of shelving racks with cross-aisles between them. */
const ROWS = 18;
const COLS = 26;

function rack(r0: number, c0: number, c1: number): Point[] {
  const out: Point[] = [];
  for (let r = r0; r <= r0 + 1; r++) for (let c = c0; c <= c1; c++) out.push({ r, c });
  return out;
}

const WAREHOUSE: Point[] = [
  ...rack(3, 3, 10),
  ...rack(3, 14, 22),
  ...rack(8, 3, 10),
  ...rack(8, 14, 22),
  ...rack(13, 3, 10),
  ...rack(13, 14, 22),
];

const DOCKS4: Point[] = [
  { r: 1, c: 1 },
  { r: 16, c: 1 },
  { r: 1, c: 24 },
  { r: 16, c: 24 },
];

const TASKS8 = [
  { cell: { r: 2, c: 6 }, priority: 3, duration: 3 },
  { cell: { r: 6, c: 18 }, priority: 2, duration: 3 },
  { cell: { r: 11, c: 8 }, priority: 3, duration: 2 },
  { cell: { r: 16, c: 16 }, priority: 4, duration: 3 },
  { cell: { r: 7, c: 5 }, priority: 1, duration: 2 },
  { cell: { r: 12, c: 20 }, priority: 3, duration: 3 },
  { cell: { r: 0, c: 12 }, priority: 2, duration: 2 },
  { cell: { r: 15, c: 9 }, priority: 3, duration: 3 },
];

function base(id: string, name: string, description: string, events: ScheduledAction[], extra: Partial<ScenarioDefinition> = {}): ScenarioDefinition {
  return {
    id,
    name,
    description,
    rows: ROWS,
    cols: COLS,
    obstacles: WAREHOUSE,
    robots: DOCKS4,
    tasks: TASKS8,
    events,
    ...extra,
  };
}

export const COMBINED_EVENTS: ScheduledAction[] = [
  { at: 5, type: 'fail', robotId: 'R2', label: 'drive motor fault' },
  { at: 9, type: 'blockPath', label: 'pallet dropped in aisle' },
  { at: 13, type: 'task', cell: { r: 10, c: 24 }, priority: 5, duration: 2, label: 'emergency spill response' },
  { at: 20, type: 'blockPath', label: 'forklift parked in aisle' },
];

export const SCENARIOS: ScenarioDefinition[] = [
  base('normal', 'Normal operation', 'Four robots share eight pick tasks across the warehouse. No disruptions — a baseline run.', []),
  base('single-failure', 'Single robot failure', 'R1 suffers a fault at 6s. Its unfinished tasks are released and reassigned to the remaining robots.', [
    { at: 6, type: 'fail', robotId: 'R1', label: 'battery fault' },
  ]),
  base('dynamic-obstacle', 'Dynamic obstacle', 'Obstacles appear on active routes at 4s and 10s, so robots must reroute.', [
    { at: 4, type: 'blockPath', label: 'crate fell into aisle' },
    { at: 10, type: 'blockPath', label: 'maintenance cart' },
  ]),
  base(
    'multi-failure',
    'Multiple robot failures',
    'Three of five robots fail at different times. The last two absorb the workload; capacity limits leave some tasks waiting.',
    [
      { at: 5, type: 'fail', robotId: 'R2', label: 'drive fault' },
      { at: 8, type: 'fail', robotId: 'R4', label: 'sensor fault' },
      { at: 14, type: 'fail', robotId: 'R1', label: 'battery fault' },
    ],
    {
      robots: [...DOCKS4, { r: 6, c: 12 }],
      tasks: [...TASKS8, { cell: { r: 10, c: 2 }, priority: 2, duration: 2 }, { cell: { r: 5, c: 24 }, priority: 3, duration: 2 }],
    },
  ),
  base('emergency', 'Emergency high-priority task', 'Two critical tasks arrive mid-run. Robots drop lower-priority travel to serve them first.', [
    { at: 6, type: 'task', cell: { r: 10, c: 24 }, priority: 5, duration: 2, label: 'emergency spill' },
    { at: 12, type: 'task', cell: { r: 6, c: 1 }, priority: 5, duration: 2, label: 'urgent restock' },
  ]),
  base(
    'combined',
    'Combined failure scenario',
    'The full demonstration: task assignment, a robot breakdown with automatic reassignment, an obstacle on a live route with rerouting, an emergency task, and continued operation to completion.',
    COMBINED_EVENTS,
  ),
];

export function getScenario(id: string): ScenarioDefinition {
  const s = SCENARIOS.find((x) => x.id === id);
  if (!s) throw new Error(`Unknown scenario ${id}`);
  return s;
}
