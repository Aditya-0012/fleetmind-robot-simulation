import { isWalkable, samePoint } from '../models/Grid';
import type { Robot, RobotState } from '../models/Robot';
import type { EngineContext } from './context';
import { failedRobotCells } from './context';
import { invalidatePathsThrough, planRoute } from './ReplanningManager';
import { transitionRobot, transitionTask } from './stateMachine';
import { completeTask } from './TaskManager';
import { toKey } from '../models/Grid';

/** Pops the highest-priority queued task and plans a route to it. */
function startNextTask(ctx: EngineContext, robot: Robot): void {
  if (!robot.currentTaskId) {
    const nextId = robot.queue.shift();
    if (!nextId) {
      transitionRobot(robot, robot.completedTaskIds.length > 0 ? 'COMPLETED' : 'IDLE');
      return;
    }
    const task = ctx.task(nextId)!;
    robot.currentTaskId = nextId;
    transitionTask(task, 'IN_PROGRESS', ctx.state.tick, robot.id);
    if (task.startedAt === null) task.startedAt = ctx.state.tick;
    ctx.log('MOVEMENT', 'info', `${robot.id} started ${task.id}`, { robotId: robot.id, taskId: task.id });
  }
  planRoute(ctx, robot, 'initial');
}

/** Moves the robot one cell along its route. Never steps onto an obstacle or failed robot. */
function advance(ctx: EngineContext, robot: Robot): void {
  const state = ctx.state;
  const task = ctx.task(robot.currentTaskId!)!;
  const next = robot.path[robot.pathIndex + 1];

  if (!next) {
    // Path exhausted — should coincide with arrival; replan defensively otherwise.
    if (samePoint(robot.position, task.position)) {
      transitionRobot(robot, 'EXECUTING');
      robot.executionRemaining = task.duration - task.progress;
    } else {
      transitionRobot(robot, 'REPLANNING');
      planRoute(ctx, robot, 'replan');
    }
    return;
  }

  const blocked = failedRobotCells(state, robot.id);
  if (!isWalkable(state.grid, next, blocked)) {
    // Safety net: the next cell became blocked without a broadcast invalidation.
    invalidatePathsThrough(ctx, toKey(next, state.grid.cols), 'obstacle detected ahead');
    return;
  }

  robot.position = { ...next };
  robot.pathIndex++;
  robot.distanceTravelled++;

  if (samePoint(robot.position, task.position)) {
    transitionRobot(robot, 'EXECUTING');
    robot.executionRemaining = task.duration - task.progress;
    ctx.log('MOVEMENT', 'info', `${robot.id} reached ${task.id}, working for ${robot.executionRemaining}s`, {
      robotId: robot.id,
      taskId: task.id,
    });
  }
}

/** One tick of robot behaviour, driven purely by its state machine. */
export function updateRobot(ctx: EngineContext, robot: Robot): void {
  if (robot.state === 'FAILED') return; // a failed robot never moves

  if (robot.state === 'IDLE' || robot.state === 'COMPLETED') {
    if (robot.queue.length === 0) return;
    transitionRobot(robot, 'ASSIGNED');
  }

  switch (robot.state) {
    case 'ASSIGNED': {
      startNextTask(ctx, robot);
      if ((robot.state as RobotState) === 'MOVING') advance(ctx, robot);
      return;
    }
    case 'WAITING': {
      if (robot.waitTicks > 0) {
        robot.waitTicks--;
        return;
      }
      if (robot.currentTaskId) {
        transitionRobot(robot, 'REPLANNING');
        planRoute(ctx, robot, 'replan');
      } else if (robot.queue.length > 0) {
        transitionRobot(robot, 'ASSIGNED');
        startNextTask(ctx, robot);
      } else {
        transitionRobot(robot, robot.completedTaskIds.length ? 'COMPLETED' : 'IDLE');
      }
      return;
    }
    case 'REPLANNING':
      planRoute(ctx, robot, 'replan');
      return;
    case 'MOVING':
      advance(ctx, robot);
      return;
    case 'EXECUTING': {
      const task = ctx.task(robot.currentTaskId!)!;
      robot.executionRemaining--;
      task.progress++;
      if (robot.executionRemaining <= 0) completeTask(ctx, robot, task);
      return;
    }
    default:
      return;
  }
}
