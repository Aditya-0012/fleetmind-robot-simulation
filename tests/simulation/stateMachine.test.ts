import { describe, expect, it } from 'vitest';
import { canRobotTransition, canTaskTransition, transitionRobot, transitionTask, InvalidTransitionError } from '../../src/simulation/stateMachine';
import { createRobot } from '../../src/models/Robot';
import { createTask } from '../../src/models/Task';

describe('Robot state machine', () => {
  it('allows the normal work cycle', () => {
    const r = createRobot(0, { r: 0, c: 0 });
    for (const s of ['ASSIGNED', 'MOVING', 'REPLANNING', 'MOVING', 'EXECUTING', 'COMPLETED'] as const) transitionRobot(r, s);
    expect(r.state).toBe('COMPLETED');
  });

  it('forbids a failed robot from moving or taking work', () => {
    expect(canRobotTransition('FAILED', 'MOVING')).toBe(false);
    expect(canRobotTransition('FAILED', 'ASSIGNED')).toBe(false);
    expect(canRobotTransition('FAILED', 'EXECUTING')).toBe(false);
    expect(canRobotTransition('FAILED', 'IDLE')).toBe(true);
    const r = createRobot(0, { r: 0, c: 0 });
    transitionRobot(r, 'FAILED');
    expect(() => transitionRobot(r, 'MOVING')).toThrow(InvalidTransitionError);
  });

  it('every state can fail except FAILED itself', () => {
    for (const s of ['IDLE', 'ASSIGNED', 'MOVING', 'EXECUTING', 'WAITING', 'REPLANNING', 'COMPLETED'] as const) {
      expect(canRobotTransition(s, 'FAILED')).toBe(true);
    }
  });

  it('idle robots cannot jump straight to moving', () => {
    expect(canRobotTransition('IDLE', 'MOVING')).toBe(false);
  });
});

describe('Task state machine', () => {
  it('COMPLETED is terminal', () => {
    for (const s of ['UNASSIGNED', 'ASSIGNED', 'IN_PROGRESS', 'BLOCKED'] as const) expect(canTaskTransition('COMPLETED', s)).toBe(false);
    const t = createTask('T1', { r: 0, c: 0 }, 3, 1, 0);
    transitionTask(t, 'ASSIGNED', 1, 'R1');
    transitionTask(t, 'IN_PROGRESS', 2, 'R1');
    transitionTask(t, 'COMPLETED', 3, 'R1');
    expect(() => transitionTask(t, 'ASSIGNED', 4, 'R2')).toThrow(InvalidTransitionError);
    expect(t.history.map((h) => h.status)).toEqual(['UNASSIGNED', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED']);
  });

  it('an unassigned task cannot be completed directly', () => {
    expect(canTaskTransition('UNASSIGNED', 'COMPLETED')).toBe(false);
    expect(canTaskTransition('UNASSIGNED', 'IN_PROGRESS')).toBe(false);
  });

  it('released tasks can return to the pool', () => {
    expect(canTaskTransition('IN_PROGRESS', 'UNASSIGNED')).toBe(true);
    expect(canTaskTransition('ASSIGNED', 'UNASSIGNED')).toBe(true);
    expect(canTaskTransition('BLOCKED', 'UNASSIGNED')).toBe(true);
  });
});
