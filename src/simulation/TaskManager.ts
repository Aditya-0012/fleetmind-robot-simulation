import { PRIORITY_LABEL } from '../models/Task';
import type { Robot } from '../models/Robot';
import type { Task } from '../models/Task';
import type { EngineContext } from './context';
import { transitionRobot, transitionTask } from './stateMachine';

/** Keeps a robot's queue ordered by priority (desc), then creation time, then id. */
export function sortQueue(ctx: EngineContext, robot: Robot): void {
  robot.queue.sort((a, b) => {
    const ta = ctx.task(a)!;
    const tb = ctx.task(b)!;
    return tb.priority - ta.priority || ta.createdAt - tb.createdAt || a.localeCompare(b, 'en', { numeric: true });
  });
}

/**
 * Commits an allocator decision. Enforces: completed tasks are never assigned, failed robots
 * never receive tasks, and a task is never held by two robots.
 */
export function assignTask(ctx: EngineContext, robot: Robot, task: Task, cost: number): boolean {
  if (robot.state === 'FAILED') return false;
  if (task.status === 'COMPLETED' || task.status === 'ASSIGNED' || task.status === 'IN_PROGRESS') return false;
  const tick = ctx.state.tick;

  transitionTask(task, 'ASSIGNED', tick, robot.id);
  task.assignedRobotId = robot.id;
  task.assignedAt = tick;
  robot.queue.push(task.id);
  sortQueue(ctx, robot);

  if (task.awaitingReallocation) {
    task.awaitingReallocation = false;
    task.reassignCount++;
    ctx.state.metrics.reallocations++;
    ctx.log('ALLOCATION', 'success', `${task.id} reassigned to ${robot.id} (cost ${cost.toFixed(3)})`, {
      robotId: robot.id,
      taskId: task.id,
    });
  } else {
    ctx.log('ASSIGNMENT', 'info', `${robot.id} assigned ${task.id} (cost ${cost.toFixed(3)})`, {
      robotId: robot.id,
      taskId: task.id,
    });
  }

  if (robot.state === 'IDLE' || robot.state === 'COMPLETED') transitionRobot(robot, 'ASSIGNED');
  maybePreempt(ctx, robot, task);
  return true;
}

/**
 * Emergency pre-emption: a critical task jumps ahead of a lower-priority task the robot is
 * still travelling to. A task already being executed is never interrupted.
 */
function maybePreempt(ctx: EngineContext, robot: Robot, task: Task): void {
  if (!robot.currentTaskId || task.priority < 5) return;
  if (robot.state === 'EXECUTING') return;
  const current = ctx.task(robot.currentTaskId)!;
  if (current.priority >= task.priority) return;
  if (robot.queue[0] !== task.id) return;

  // current task goes back to the queue (still assigned to this robot)
  transitionTask(current, 'ASSIGNED', ctx.state.tick, robot.id);
  // The critical task stays at the head of the queue; the interrupted one rejoins the queue.
  robot.queue.push(current.id);
  sortQueue(ctx, robot);
  robot.currentTaskId = null;
  robot.path = [];
  robot.pathIndex = 0;
  ctx.state.metrics.preemptions++;
  if (robot.state === 'MOVING' || robot.state === 'WAITING' || robot.state === 'REPLANNING') transitionRobot(robot, 'ASSIGNED');
  ctx.log('PRIORITY', 'warning', `${robot.id} pre-empted ${current.id} to serve critical ${task.id}`, {
    robotId: robot.id,
    taskId: task.id,
  });
}

/**
 * Releases a task back to the pool (robot failed or its route vanished). Progress is reset,
 * history is kept, and the task is flagged so its next assignment counts as a reallocation.
 */
export function releaseTask(ctx: EngineContext, task: Task, reason: string): void {
  if (task.status === 'COMPLETED') return;
  const prevRobot = task.assignedRobotId;
  transitionTask(task, 'UNASSIGNED', ctx.state.tick, null);
  task.assignedRobotId = null;
  task.progress = 0;
  task.startedAt = null;
  task.awaitingReallocation = true;
  ctx.log('TASK', 'warning', `${task.id} released${prevRobot ? ` from ${prevRobot}` : ''} — ${reason}`, {
    robotId: prevRobot ?? undefined,
    taskId: task.id,
  });
  ctx.markAllocationDirty();
}

export function completeTask(ctx: EngineContext, robot: Robot, task: Task): void {
  const tick = ctx.state.tick;
  transitionTask(task, 'COMPLETED', tick, robot.id);
  task.completedAt = tick;
  task.completedBy = robot.id;
  task.progress = task.duration;
  robot.completedTaskIds.push(task.id);
  robot.currentTaskId = null;
  robot.path = [];
  robot.pathIndex = 0;
  ctx.log('TASK', 'success', `${robot.id} completed ${task.id} (${PRIORITY_LABEL[task.priority]}) in ${tick - task.createdAt}s`, {
    robotId: robot.id,
    taskId: task.id,
  });
  transitionRobot(robot, robot.queue.length > 0 ? 'ASSIGNED' : 'COMPLETED');
  ctx.markAllocationDirty(); // capacity freed
}
