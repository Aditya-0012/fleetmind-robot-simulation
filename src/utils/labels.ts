import type { RobotState } from '../models/Robot';
import type { TaskStatus } from '../models/Task';
import type { EventType } from '../models/Event';

/** Plain-language names shown in the interface. Internal identifiers stay unchanged. */
export const ROBOT_STATE_LABEL: Record<RobotState, string> = {
  IDLE: 'Idle',
  ASSIGNED: 'Assigned',
  MOVING: 'Moving',
  EXECUTING: 'Working',
  WAITING: 'Waiting',
  REPLANNING: 'Rerouting',
  FAILED: 'Broken down',
  COMPLETED: 'Done',
};

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  UNASSIGNED: 'Waiting for robot',
  ASSIGNED: 'Queued',
  IN_PROGRESS: 'In progress',
  COMPLETED: 'Completed',
  BLOCKED: 'Unreachable',
};

export const EVENT_TYPE_LABEL: Record<EventType, string> = {
  SIMULATION: 'System',
  ALLOCATION: 'Dispatch',
  ASSIGNMENT: 'Assignment',
  MOVEMENT: 'Movement',
  TASK: 'Task',
  FAILURE: 'Breakdown',
  RECOVERY: 'Repair',
  OBSTACLE: 'Obstruction',
  REPLANNING: 'Rerouting',
  PRIORITY: 'Priority',
  DEMO: 'Demo',
};

export const SEVERITY_LABEL = { info: 'Info', success: 'Success', warning: 'Warning', critical: 'Critical' } as const;
