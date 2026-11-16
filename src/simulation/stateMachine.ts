import { ROBOT_TRANSITIONS } from '../models/Robot';
import type { Robot, RobotState } from '../models/Robot';
import { TASK_TRANSITIONS } from '../models/Task';
import type { Task, TaskStatus } from '../models/Task';

export class InvalidTransitionError extends Error {}

export function canRobotTransition(from: RobotState, to: RobotState): boolean {
  return from === to || ROBOT_TRANSITIONS[from].includes(to);
}

export function canTaskTransition(from: TaskStatus, to: TaskStatus): boolean {
  return from === to || TASK_TRANSITIONS[from].includes(to);
}

/** Moves a robot to a new state, rejecting anything the state machine does not allow. */
export function transitionRobot(robot: Robot, to: RobotState): void {
  if (robot.state === to) return;
  if (!ROBOT_TRANSITIONS[robot.state].includes(to)) {
    throw new InvalidTransitionError(`Robot ${robot.id}: invalid transition ${robot.state} → ${to}`);
  }
  robot.state = to;
}

export function transitionTask(task: Task, to: TaskStatus, tick: number, robotId: string | null): void {
  if (task.status === to) return;
  if (!TASK_TRANSITIONS[task.status].includes(to)) {
    throw new InvalidTransitionError(`Task ${task.id}: invalid transition ${task.status} → ${to}`);
  }
  task.status = to;
  task.history.push({ tick, status: to, robotId });
}
