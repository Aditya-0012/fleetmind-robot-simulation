import { toKey } from '../models/Grid';
import type { EngineContext } from './context';
import { invalidatePathsThrough } from './ReplanningManager';
import { runAllocation } from './AllocationManager';
import { transitionRobot } from './stateMachine';
import { releaseTask } from './TaskManager';

export interface FailureReport {
  robotId: string;
  affectedTasks: string[];
  newAssignments: { robotId: string; taskId: string }[];
  unrecovered: string[];
  replannedRobots: string[];
}

/**
 * Robot failure recovery pipeline:
 *  1. detect failure            2. state → FAILED          3. stop movement
 *  4. find unfinished tasks     5. release them            6. exclude robot from allocation
 *  7–8. recompute costs and reallocate (selected algorithm)
 *  9. replan any robot whose route ran through the failed robot's cell
 * 10. simulation resumes on the next tick
 */
export function failRobot(ctx: EngineContext, robotId: string, source: string): FailureReport | null {
  const state = ctx.state;
  const robot = ctx.robot(robotId);
  if (!robot || robot.state === 'FAILED') return null;

  ctx.log('FAILURE', 'critical', `Robot ${robot.id} failure detected (${source}) while ${robot.state}`, { robotId: robot.id });
  transitionRobot(robot, 'FAILED');
  robot.failedAt = state.tick;
  robot.failures++;
  state.metrics.failures++;

  // Stop movement and collect unfinished work (completed tasks are untouched).
  const affected = [...(robot.currentTaskId ? [robot.currentTaskId] : []), ...robot.queue];
  robot.currentTaskId = null;
  robot.queue = [];
  robot.path = [];
  robot.pathIndex = 0;
  robot.executionRemaining = 0;
  for (const id of affected) releaseTask(ctx, ctx.task(id)!, `${robot.id} failed`);

  // The broken-down robot now physically blocks its cell.
  const replanned = invalidatePathsThrough(ctx, toKey(robot.position, state.grid.cols), `${robot.id} stalled`);

  if (affected.length > 0) ctx.log('ALLOCATION', 'info', `Task reallocation initiated for ${affected.join(', ')}`, { robotId: robot.id });
  const { assigned } = runAllocation(ctx, `${robot.id} failure`);
  const newAssignments = assigned.filter((a) => affected.includes(a.taskId));
  const unrecovered = affected.filter((id) => !newAssignments.some((a) => a.taskId === id));

  ctx.notify({
    kind: 'failure-recovery',
    severity: 'critical',
    title: `Robot ${robot.id} failed`,
    lines: [
      affected.length ? `Affected tasks: ${affected.join(', ')}` : 'No unfinished tasks were affected',
      affected.length
        ? `Reallocation: ${newAssignments.length}/${affected.length} tasks reassigned`
        : 'Reallocation: not required',
      ...newAssignments.map((a) => `${a.taskId} → ${a.robotId}`),
      ...(unrecovered.length ? [`Waiting for capacity or route: ${unrecovered.join(', ')}`] : []),
      replanned.length ? `Replanned around the stalled robot: ${replanned.join(', ')}` : 'No other routes affected',
    ],
  });

  return { robotId: robot.id, affectedTasks: affected, newAssignments, unrecovered, replannedRobots: replanned };
}

export function restoreRobot(ctx: EngineContext, robotId: string, source: string): boolean {
  const robot = ctx.robot(robotId);
  if (!robot || robot.state !== 'FAILED') return false;
  transitionRobot(robot, 'IDLE');
  robot.failedAt = null;
  ctx.log('RECOVERY', 'success', `Robot ${robot.id} restored to service (${source})`, { robotId: robot.id });
  ctx.notify({ kind: 'success', severity: 'success', title: `${robot.id} back online`, lines: ['Robot is available for allocation again'] });
  ctx.markAllocationDirty();
  return true;
}
