import type { Point } from './Grid';

export type RobotState =
  | 'IDLE'
  | 'ASSIGNED'
  | 'MOVING'
  | 'EXECUTING'
  | 'WAITING'
  | 'REPLANNING'
  | 'FAILED'
  | 'COMPLETED';

export const ROBOT_STATES: RobotState[] = ['IDLE', 'ASSIGNED', 'MOVING', 'EXECUTING', 'WAITING', 'REPLANNING', 'FAILED', 'COMPLETED'];

/**
 * Explicit robot state machine. Any transition not listed here is rejected by
 * `transitionRobot()` — e.g. FAILED → MOVING is impossible, so a failed robot can never move.
 */
export const ROBOT_TRANSITIONS: Record<RobotState, readonly RobotState[]> = {
  IDLE: ['ASSIGNED', 'FAILED'],
  ASSIGNED: ['MOVING', 'EXECUTING', 'REPLANNING', 'WAITING', 'IDLE', 'COMPLETED', 'FAILED'],
  MOVING: ['EXECUTING', 'REPLANNING', 'WAITING', 'ASSIGNED', 'FAILED'],
  EXECUTING: ['ASSIGNED', 'COMPLETED', 'IDLE', 'FAILED'],
  WAITING: ['REPLANNING', 'MOVING', 'ASSIGNED', 'EXECUTING', 'IDLE', 'COMPLETED', 'FAILED'],
  REPLANNING: ['MOVING', 'EXECUTING', 'WAITING', 'ASSIGNED', 'IDLE', 'COMPLETED', 'FAILED'],
  FAILED: ['IDLE'],
  COMPLETED: ['ASSIGNED', 'IDLE', 'FAILED'],
};

export interface Robot {
  id: string;
  color: string;
  position: Point;
  home: Point;
  state: RobotState;
  /** Assigned tasks not yet started, ordered by (priority desc, createdAt asc). */
  queue: string[];
  /** Task currently being travelled to or executed. */
  currentTaskId: string | null;
  /** Planned route; path[pathIndex] is the robot's current cell. */
  path: Point[];
  pathIndex: number;
  distanceTravelled: number;
  executionRemaining: number;
  waitTicks: number;
  completedTaskIds: string[];
  replans: number;
  failedAt: number | null;
  failures: number;
}

export const ROBOT_COLORS = ['#2BD9F2', '#9B7BFF', '#3EE6A0', '#FFC247', '#4C8DFF', '#FF7AC6', '#7CF3D0', '#FF9A5A', '#B7E34B', '#C08BFF'];

export function createRobot(index: number, position: Point): Robot {
  return {
    id: `R${index + 1}`,
    color: ROBOT_COLORS[index % ROBOT_COLORS.length],
    position: { ...position },
    home: { ...position },
    state: 'IDLE',
    queue: [],
    currentTaskId: null,
    path: [],
    pathIndex: 0,
    distanceTravelled: 0,
    executionRemaining: 0,
    waitTicks: 0,
    completedTaskIds: [],
    replans: 0,
    failedAt: null,
    failures: 0,
  };
}

/** Workload = tasks committed to the robot (current + queued). */
export const robotWorkload = (r: Robot): number => r.queue.length + (r.currentTaskId ? 1 : 0);
