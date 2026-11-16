export type EventType =
  | 'SIMULATION'
  | 'ALLOCATION'
  | 'ASSIGNMENT'
  | 'MOVEMENT'
  | 'TASK'
  | 'FAILURE'
  | 'RECOVERY'
  | 'OBSTACLE'
  | 'REPLANNING'
  | 'PRIORITY'
  | 'DEMO';

export const EVENT_TYPES: EventType[] = [
  'SIMULATION',
  'ALLOCATION',
  'ASSIGNMENT',
  'MOVEMENT',
  'TASK',
  'FAILURE',
  'RECOVERY',
  'OBSTACLE',
  'REPLANNING',
  'PRIORITY',
  'DEMO',
];

export type Severity = 'info' | 'success' | 'warning' | 'critical';

export interface SimEvent {
  id: number;
  tick: number;
  type: EventType;
  severity: Severity;
  message: string;
  robotId?: string;
  taskId?: string;
}

/** A richer, user-facing notification (toast) produced by the engine. */
export interface Notice {
  id: number;
  tick: number;
  kind: 'failure-recovery' | 'replanning' | 'info' | 'warning' | 'success';
  title: string;
  lines: string[];
  severity: Severity;
}

/** Simulation time: 1 tick = 1 simulated second. Formats as [mm:ss]. */
export function formatTick(tick: number): string {
  const m = Math.floor(tick / 60);
  const s = tick % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
