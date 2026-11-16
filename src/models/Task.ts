import type { Point } from './Grid';

export type TaskStatus = 'UNASSIGNED' | 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED' | 'BLOCKED';

export const TASK_STATUSES: TaskStatus[] = ['UNASSIGNED', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'BLOCKED'];

/**
 * Task state machine. COMPLETED is terminal — a completed task can never be reassigned.
 */
export const TASK_TRANSITIONS: Record<TaskStatus, readonly TaskStatus[]> = {
  UNASSIGNED: ['ASSIGNED', 'BLOCKED'],
  ASSIGNED: ['IN_PROGRESS', 'UNASSIGNED', 'BLOCKED'],
  IN_PROGRESS: ['COMPLETED', 'ASSIGNED', 'UNASSIGNED', 'BLOCKED'],
  BLOCKED: ['UNASSIGNED', 'ASSIGNED'],
  COMPLETED: [],
};

export const PRIORITY_LABEL: Record<number, string> = {
  1: 'Low',
  2: 'Normal',
  3: 'Medium',
  4: 'High',
  5: 'Critical',
};

export interface Task {
  id: string;
  position: Point;
  /** 1 (low) … 5 (critical). */
  priority: number;
  status: TaskStatus;
  assignedRobotId: string | null;
  /** Ticks of work at the destination. */
  duration: number;
  progress: number;
  createdAt: number;
  assignedAt: number | null;
  startedAt: number | null;
  completedAt: number | null;
  completedBy: string | null;
  /** How many times the task was released by a failure/blocked route and handed out again. */
  reassignCount: number;
  /** True after a release, until the task is assigned again (used to count reallocations). */
  awaitingReallocation: boolean;
  history: { tick: number; status: TaskStatus; robotId: string | null }[];
}

export function createTask(id: string, position: Point, priority: number, duration: number, createdAt: number): Task {
  return {
    id,
    position: { ...position },
    priority,
    status: 'UNASSIGNED',
    assignedRobotId: null,
    duration,
    progress: 0,
    createdAt,
    assignedAt: null,
    startedAt: null,
    completedAt: null,
    completedBy: null,
    reassignCount: 0,
    awaitingReallocation: false,
    history: [{ tick: createdAt, status: 'UNASSIGNED', robotId: null }],
  };
}
