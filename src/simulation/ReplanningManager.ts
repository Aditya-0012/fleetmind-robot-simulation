import { findPath } from '../algorithms/pathfinding';
import { pointLabel, samePoint, toKey } from '../models/Grid';
import type { Robot } from '../models/Robot';
import { PATH_ALGORITHM_LABEL } from '../algorithms/pathfinding/types';
import type { EngineContext } from './context';
import { failedRobotCells } from './context';
import { transitionRobot } from './stateMachine';
import { releaseTask } from './TaskManager';

export type PlanOutcome = 'moving' | 'arrived' | 'no-route';

/**
 * Plans a route from the robot's position to its current task with the selected algorithm.
 * Failed robots are treated as extra obstacles. Updates search metrics.
 */
export function planRoute(ctx: EngineContext, robot: Robot, reason: 'initial' | 'replan'): PlanOutcome {
  const state = ctx.state;
  const task = robot.currentTaskId ? ctx.task(robot.currentTaskId) : undefined;
  if (!task) return 'no-route';

  const blocked = failedRobotCells(state, robot.id);
  const res = findPath(state.config.pathAlgorithm, state.grid, robot.position, task.position, {
    extraBlocked: blocked,
    recordTrace: state.config.showSearch,
  });
  state.metrics.nodesExplored += res.nodesExplored;
  state.metrics.pathTimeMs += res.timeMs;
  state.metrics.pathPlans++;

  if (res.trace) {
    const expanded: number[] = [];
    const opened: number[] = [];
    for (const s of res.trace) (s.kind === 'expand' ? expanded : opened).push(s.key);
    state.lastSearch = {
      robotId: robot.id,
      taskId: task.id,
      algorithm: res.algorithm,
      expanded,
      opened,
      tick: state.tick,
      nodesExplored: res.nodesExplored,
      pathLength: res.found ? res.cost : 0,
    };
  }

  if (!res.found) {
    ctx.log('REPLANNING', 'critical', `No route for ${robot.id} to ${task.id} — ${res.error ?? 'unreachable'}`, {
      robotId: robot.id,
      taskId: task.id,
    });
    robot.path = [];
    robot.pathIndex = 0;
    robot.currentTaskId = null;
    releaseTask(ctx, task, 'route blocked');
    transitionRobot(robot, 'WAITING');
    robot.waitTicks = 1;
    return 'no-route';
  }

  robot.path = res.path;
  robot.pathIndex = 0;
  state.metrics.plannedPathLength += res.cost;
  const label = PATH_ALGORITHM_LABEL[res.algorithm];
  if (reason === 'replan') {
    ctx.log('REPLANNING', 'success', `NEW PATH GENERATED for ${robot.id} → ${task.id}: ${res.cost} steps (${label}, ${res.nodesExplored} nodes)`, {
      robotId: robot.id,
      taskId: task.id,
    });
  } else {
    ctx.log('MOVEMENT', 'info', `${robot.id} planned ${res.cost}-step route to ${task.id} with ${label} (${res.nodesExplored} nodes)`, {
      robotId: robot.id,
      taskId: task.id,
    });
  }

  if (samePoint(robot.position, task.position)) {
    transitionRobot(robot, 'EXECUTING');
    robot.executionRemaining = task.duration - task.progress;
    return 'arrived';
  }
  transitionRobot(robot, 'MOVING');
  return 'moving';
}

/** True when the cell lies on the part of the robot's route it has not yet walked. */
export function pathUsesCell(robot: Robot, cellKey: number, cols: number): boolean {
  for (let i = robot.pathIndex + 1; i < robot.path.length; i++) {
    if (toKey(robot.path[i], cols) === cellKey) return true;
  }
  return false;
}

/**
 * Called whenever a cell becomes blocked (new obstacle or a robot failing on it).
 * Every robot whose remaining route crosses the cell is replanned immediately:
 *   PATH INVALIDATED → REPLANNING → NEW PATH GENERATED (or task released when no route exists)
 */
export function invalidatePathsThrough(ctx: EngineContext, cellKey: number, cause: string): string[] {
  const state = ctx.state;
  const affected: string[] = [];
  for (const robot of state.robots) {
    if (robot.state !== 'MOVING' && robot.state !== 'WAITING' && robot.state !== 'REPLANNING') continue;
    if (!robot.currentTaskId || !pathUsesCell(robot, cellKey, state.grid.cols)) continue;
    affected.push(robot.id);
    const cell = pointLabel({ r: Math.floor(cellKey / state.grid.cols), c: cellKey % state.grid.cols });
    ctx.log('REPLANNING', 'warning', `PATH INVALIDATED for ${robot.id} — ${cause} at ${cell}`, {
      robotId: robot.id,
      taskId: robot.currentTaskId,
    });
    transitionRobot(robot, 'REPLANNING');
    robot.replans++;
    state.metrics.replans++;
    ctx.log('REPLANNING', 'info', `REPLANNING… ${robot.id} running ${PATH_ALGORITHM_LABEL[state.config.pathAlgorithm]}`, {
      robotId: robot.id,
      taskId: robot.currentTaskId,
    });
    const taskId = robot.currentTaskId;
    const before = robot.path.length - 1 - robot.pathIndex;
    const outcome = planRoute(ctx, robot, 'replan');
    ctx.notify({
      kind: 'replanning',
      severity: outcome === 'no-route' ? 'critical' : 'warning',
      title: outcome === 'no-route' ? `${robot.id}: no route available` : `${robot.id}: new path generated`,
      lines: [
        `Path invalidated — ${cause} at ${cell}`,
        outcome === 'no-route'
          ? `${taskId} released for reallocation`
          : `Route to ${taskId}: ${before} → ${robot.path.length - 1} steps`,
      ],
    });
  }
  return affected;
}
