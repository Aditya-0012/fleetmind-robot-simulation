import { allocate } from '../algorithms/allocation';
import type { AllocRobot, AllocTask } from '../algorithms/allocation';
import { manhattan } from '../algorithms/pathfinding/heuristics';
import { bfsDistances } from '../algorithms/pathfinding/bfs';
import { toKey } from '../models/Grid';
import { ALLOCATION_ALGORITHM_LABEL } from '../algorithms/allocation/types';
import type { Robot } from '../models/Robot';
import { robotWorkload } from '../models/Robot';
import type { EngineContext } from './context';
import { failedRobotCells } from './context';
import { assignTask } from './TaskManager';
import { transitionTask } from './stateMachine';

/**
 * Builds the allocator's view of a robot:
 *   anchor   = where it will be once its committed work is done (last queued task)
 *   workload = tasks committed
 *   backlog  = remaining route + remaining execution + estimated work for queued tasks
 * Queued tasks use Manhattan distance as a cheap lower-bound estimate between stops.
 */
export function snapshotRobot(ctx: EngineContext, r: Robot): AllocRobot {
  let anchor = r.position;
  let backlog = 0;
  if (r.currentTaskId) {
    const cur = ctx.task(r.currentTaskId)!;
    const remainingPath = r.path.length > 0 ? r.path.length - 1 - r.pathIndex : manhattan(r.position, cur.position);
    backlog += remainingPath + (r.state === 'EXECUTING' ? r.executionRemaining : cur.duration - cur.progress);
    anchor = cur.position;
  }
  for (const id of r.queue) {
    const t = ctx.task(id)!;
    backlog += manhattan(anchor, t.position) + t.duration;
    anchor = t.position;
  }
  return {
    id: r.id,
    anchor: { ...anchor },
    workload: robotWorkload(r),
    backlogTicks: backlog,
    capacity: ctx.state.config.capacity,
  };
}

/**
 * Runs the selected allocation algorithm over every UNASSIGNED / BLOCKED task and every
 * non-failed robot. Failed robots are excluded entirely, so they can never receive work.
 */
export function runAllocation(ctx: EngineContext, trigger: string): { assigned: { robotId: string; taskId: string }[] } {
  const state = ctx.state;
  const open = state.tasks.filter((t) => t.status === 'UNASSIGNED' || t.status === 'BLOCKED');
  if (open.length === 0) return { assigned: [] };

  const robots = state.robots.filter((r) => r.state !== 'FAILED').map((r) => snapshotRobot(ctx, r));
  const tasks: AllocTask[] = open.map((t) => ({
    id: t.id,
    position: t.position,
    priority: t.priority,
    duration: t.duration,
    createdAt: t.createdAt,
  }));

  const result = allocate(state.config.allocationAlgorithm, {
    grid: state.grid,
    robots,
    tasks,
    weights: state.config.weights,
    extraBlocked: failedRobotCells(state),
  });

  state.metrics.allocationRuns++;
  state.metrics.allocationTimeMs += result.timeMs;
  state.metrics.costEvaluations += result.costEvaluations;
  state.lastAllocation = result;

  if (result.assignments.length > 0) {
    ctx.log(
      'ALLOCATION',
      'info',
      `${ALLOCATION_ALGORITHM_LABEL[result.algorithm]}: ${result.assignments.length} task${result.assignments.length === 1 ? '' : 's'} assigned (${trigger})`,
    );
  }

  // Guard: the allocator measures distance from each robot's *anchor*. Make sure the robot can
  // actually reach the task from where it physically stands, otherwise skip the pair.
  const blocked = failedRobotCells(state);
  const reach = new Map<string, Int32Array>();
  const reachable = (robot: Robot, cellKey: number): boolean => {
    let field = reach.get(robot.id);
    if (!field) {
      field = bfsDistances(state.grid, robot.position, blocked);
      reach.set(robot.id, field);
    }
    return field[cellKey] >= 0;
  };

  const assigned: { robotId: string; taskId: string }[] = [];
  for (const a of result.assignments) {
    const robot = ctx.robot(a.robotId)!;
    const task = ctx.task(a.taskId)!;
    if (!reachable(robot, toKey(task.position, state.grid.cols))) continue;
    if (task.status === 'BLOCKED') transitionTask(task, 'UNASSIGNED', state.tick, null);
    if (assignTask(ctx, robot, task, a.cost)) assigned.push({ robotId: robot.id, taskId: task.id });
  }

  for (const u of result.unassigned) {
    const task = ctx.task(u.taskId)!;
    if (u.reason === 'no-capacity') {
      if (task.status === 'BLOCKED') {
        transitionTask(task, 'UNASSIGNED', state.tick, null);
        ctx.log('TASK', 'info', `${task.id} reachable again — waiting for a free robot`, { taskId: task.id });
      }
    } else if (task.status !== 'BLOCKED') {
      transitionTask(task, 'BLOCKED', state.tick, null);
      ctx.log(
        'TASK',
        'critical',
        u.reason === 'no-robots' ? `${task.id} unreachable — no working robots left` : `${task.id} unreachable — no working robot can get there`,
        { taskId: task.id },
      );
    }
  }
  return { assigned };
}
