import { describe, expect, it } from 'vitest';
import { SimulationEngine } from '../../src/simulation/SimulationEngine';
import { checkInvariants } from '../../src/simulation/invariants';
import { isValidPath } from '../../src/algorithms/pathfinding';
import { isObstacle, toKey } from '../../src/models/Grid';
import type { ScenarioDefinition } from '../../src/models/SimulationState';

function scenario(extra: Partial<ScenarioDefinition> = {}): ScenarioDefinition {
  return {
    id: 'test',
    name: 'Test',
    description: '',
    rows: 10,
    cols: 10,
    obstacles: [],
    robots: [{ r: 0, c: 0 }],
    tasks: [{ cell: { r: 0, c: 5 }, priority: 3, duration: 2 }],
    events: [],
    ...extra,
  };
}

const stepN = (e: SimulationEngine, n: number) => {
  for (let i = 0; i < n; i++) {
    e.step();
    expect(checkInvariants(e.state)).toEqual([]);
  }
};

describe('SimulationEngine — movement and completion', () => {
  it('assigns, moves one cell per tick, executes and completes a task', () => {
    const e = new SimulationEngine(scenario());
    const r = e.state.robots[0];
    const t = e.state.tasks[0];
    e.step(); // tick 1: allocate, plan, first move
    expect(t.status).toBe('IN_PROGRESS');
    expect(r.state).toBe('MOVING');
    expect(r.position).toEqual({ r: 0, c: 1 });
    stepN(e, 4); // ticks 2–5: reach (0,5)
    expect(r.position).toEqual({ r: 0, c: 5 });
    expect(r.state).toBe('EXECUTING');
    stepN(e, 2); // execution takes duration ticks
    expect(t.status).toBe('COMPLETED');
    expect(t.completedBy).toBe('R1');
    expect(r.state).toBe('COMPLETED');
    expect(r.distanceTravelled).toBe(5);
    expect(e.state.finished).toBe(true);
  });

  it('robots follow the path planned by the selected algorithm', () => {
    for (const alg of ['astar', 'dijkstra'] as const) {
      const e = new SimulationEngine(scenario({ obstacles: [{ r: 0, c: 3 }, { r: 1, c: 3 }] }), { pathAlgorithm: alg });
      e.step();
      const r = e.state.robots[0];
      expect(isValidPath(e.state.grid, r.path)).toBe(true);
      expect(r.path.length - 1).toBe(9); // detour around the wall
      expect(e.state.metrics.nodesExplored).toBeGreaterThan(0);
    }
  });

  it('is deterministic', () => {
    const run = () => {
      const e = new SimulationEngine(scenario({ robots: [{ r: 0, c: 0 }, { r: 9, c: 9 }], tasks: [
        { cell: { r: 5, c: 5 }, priority: 3, duration: 2 },
        { cell: { r: 2, c: 8 }, priority: 5, duration: 1 },
        { cell: { r: 8, c: 1 }, priority: 1, duration: 3 },
      ] }));
      e.runUntilFinished(200);
      return JSON.stringify(e.state.events.map((x) => [x.tick, x.message]));
    };
    expect(run()).toEqual(run());
  });
});

describe('SimulationEngine — failures', () => {
  it('releases unfinished tasks of a failed robot and reallocates them', () => {
    const e = new SimulationEngine(
      scenario({
        robots: [{ r: 0, c: 0 }, { r: 9, c: 9 }],
        tasks: [{ cell: { r: 0, c: 4 }, priority: 3, duration: 2 }, { cell: { r: 1, c: 4 }, priority: 3, duration: 2 }],
      }),
      { capacity: 4 },
    );
    e.step();
    const r1 = e.state.robots[0];
    const held = [r1.currentTaskId, ...r1.queue].filter(Boolean) as string[];
    expect(held.length).toBeGreaterThan(0);

    const report = e.failRobot('R1')!;
    expect(r1.state).toBe('FAILED');
    expect(r1.queue).toEqual([]);
    expect(r1.currentTaskId).toBeNull();
    expect(report.affectedTasks.sort()).toEqual(held.sort());
    for (const id of held) {
      const t = e.task(id)!;
      expect(t.assignedRobotId).toBe('R2');
      expect(t.reassignCount).toBe(1);
    }
    expect(e.state.metrics.reallocations).toBe(held.length);
    expect(checkInvariants(e.state)).toEqual([]);

    const pos = { ...r1.position };
    stepN(e, 30);
    expect(r1.position).toEqual(pos); // failed robot never moves
    expect(e.state.tasks.every((t) => t.status === 'COMPLETED' && t.completedBy === 'R2')).toBe(true);
  });

  it('never gives tasks to a failed robot and never reassigns completed tasks', () => {
    const e = new SimulationEngine(
      scenario({
        robots: [{ r: 0, c: 0 }, { r: 9, c: 9 }],
        tasks: [{ cell: { r: 0, c: 1 }, priority: 3, duration: 1 }, { cell: { r: 9, c: 5 }, priority: 3, duration: 4 }],
      }),
    );
    stepN(e, 3);
    const done = e.state.tasks.filter((t) => t.status === 'COMPLETED').map((t) => t.id);
    expect(done.length).toBeGreaterThan(0);
    e.failRobot('R1');
    e.addTask({ r: 4, c: 4 }, 3, 1);
    stepN(e, 40);
    for (const id of done) expect(e.task(id)!.completedBy).toBe('R1');
    expect(e.state.tasks.filter((t) => t.assignedRobotId === 'R1' && t.status !== 'COMPLETED')).toEqual([]);
  });

  it('blocks tasks when every robot has failed, and recovers on restore', () => {
    const e = new SimulationEngine(scenario());
    e.step();
    e.failRobot('R1');
    expect(e.state.tasks[0].status).toBe('BLOCKED');
    e.restoreRobot('R1');
    expect(e.state.robots[0].state).toBe('IDLE');
    stepN(e, 20);
    expect(e.state.tasks[0].status).toBe('COMPLETED');
  });

  it('treats a failed robot as an obstacle for other robots', () => {
    // corridor: row 0 open, rows below blocked except col 0 and col 9
    const obstacles = [];
    for (let c = 1; c < 9; c++) obstacles.push({ r: 1, c });
    const e = new SimulationEngine(
      scenario({ rows: 3, cols: 10, obstacles, robots: [{ r: 0, c: 0 }, { r: 0, c: 4 }], tasks: [{ cell: { r: 0, c: 9 }, priority: 3, duration: 1 }] }),
    );
    e.failRobot('R2');
    e.step();
    const r1 = e.state.robots[0];
    expect(r1.path.some((p) => p.r === 0 && p.c === 4)).toBe(false);
    expect(r1.path.length - 1).toBe(13); // around through row 2
  });
});

describe('SimulationEngine — dynamic obstacles and replanning', () => {
  it('invalidates an affected path and replans around the new obstacle', () => {
    const e = new SimulationEngine(scenario({ tasks: [{ cell: { r: 0, c: 9 }, priority: 3, duration: 1 }] }));
    e.step();
    const r = e.state.robots[0];
    const before = r.path.length;
    const res = e.addObstacle({ r: 0, c: 5 });
    expect(res.ok).toBe(true);
    expect(e.state.metrics.replans).toBe(1);
    expect(r.replans).toBe(1);
    expect(r.state).toBe('MOVING');
    expect(r.path.some((p) => p.r === 0 && p.c === 5)).toBe(false);
    expect(r.path.length).toBeGreaterThan(before - r.pathIndex);
    expect(e.state.events.some((ev) => ev.message.startsWith('PATH INVALIDATED'))).toBe(true);
    expect(e.state.events.some((ev) => ev.message.startsWith('NEW PATH GENERATED'))).toBe(true);
    stepN(e, 30);
    expect(e.state.tasks[0].status).toBe('COMPLETED');
  });

  it('does not replan robots whose routes are unaffected', () => {
    const e = new SimulationEngine(scenario({ tasks: [{ cell: { r: 0, c: 9 }, priority: 3, duration: 1 }] }));
    e.step();
    e.addObstacle({ r: 7, c: 7 });
    expect(e.state.metrics.replans).toBe(0);
  });

  it('marks the task BLOCKED when no route exists and recovers when the obstacle is removed', () => {
    const e = new SimulationEngine(scenario({ rows: 1, cols: 8, tasks: [{ cell: { r: 0, c: 7 }, priority: 3, duration: 1 }] }));
    e.step();
    e.addObstacle({ r: 0, c: 4 });
    stepN(e, 2);
    expect(e.state.tasks[0].status).toBe('BLOCKED');
    expect(['WAITING', 'IDLE']).toContain(e.state.robots[0].state);
    e.removeObstacle({ r: 0, c: 4 });
    stepN(e, 15);
    expect(e.state.tasks[0].status).toBe('COMPLETED');
  });

  it('robots never stand on obstacles', () => {
    const e = new SimulationEngine(scenario({ tasks: [{ cell: { r: 9, c: 9 }, priority: 3, duration: 1 }] }));
    for (let i = 0; i < 25; i++) {
      e.step();
      if (i % 3 === 0) e.blockActivePath();
      for (const r of e.state.robots) expect(isObstacle(e.state.grid, r.position)).toBe(false);
    }
  });

  it('rejects invalid placements', () => {
    const e = new SimulationEngine(scenario());
    expect(e.addObstacle({ r: 0, c: 0 }).ok).toBe(false); // robot
    expect(e.addObstacle({ r: 0, c: 5 }).ok).toBe(false); // task
    expect(e.addObstacle({ r: 20, c: 0 }).ok).toBe(false); // out of bounds
    expect(e.addTask({ r: 0, c: 0 }, 3).ok).toBe(false);
    e.addObstacle({ r: 3, c: 3 });
    expect(e.addTask({ r: 3, c: 3 }, 3).ok).toBe(false);
    expect(e.toggleObstacle({ r: 3, c: 3 }).ok).toBe(true);
    expect(e.state.grid.obstacles[toKey({ r: 3, c: 3 }, 10)]).toBe(0);
  });
});

describe('SimulationEngine — priorities', () => {
  it('a critical task pre-empts lower-priority travel', () => {
    const e = new SimulationEngine(scenario({ tasks: [{ cell: { r: 0, c: 9 }, priority: 1, duration: 1 }] }));
    e.step();
    e.addTask({ r: 2, c: 1 }, 5, 1);
    e.step();
    const r = e.state.robots[0];
    expect(r.currentTaskId).toBe('T2');
    expect(e.task('T1')!.status).toBe('ASSIGNED');
    expect(e.state.metrics.preemptions).toBe(1);
    e.runUntilFinished(100);
    expect(e.task('T2')!.completedAt!).toBeLessThan(e.task('T1')!.completedAt!);
  });

  it('changing priority re-sorts a robot queue and cannot touch completed tasks', () => {
    const e = new SimulationEngine(
      scenario({ tasks: [
        { cell: { r: 0, c: 1 }, priority: 3, duration: 1 },
        { cell: { r: 5, c: 5 }, priority: 1, duration: 1 },
        { cell: { r: 9, c: 9 }, priority: 2, duration: 1 },
      ] }),
    );
    e.step();
    const r = e.state.robots[0];
    expect(r.queue).toEqual(['T3', 'T2']);
    e.setTaskPriority('T2', 4);
    expect(r.queue).toEqual(['T2', 'T3']);
    e.runUntilFinished(100);
    expect(e.setTaskPriority('T1', 5).ok).toBe(false);
  });
});

describe('SimulationEngine — reset and scheduling', () => {
  it('reset restores a clean scenario', () => {
    const e = new SimulationEngine(scenario());
    stepN(e, 4);
    e.addObstacle({ r: 5, c: 5 });
    e.failRobot('R1');
    e.reset();
    expect(e.state.tick).toBe(0);
    expect(e.state.robots[0].state).toBe('IDLE');
    expect(e.state.robots[0].position).toEqual({ r: 0, c: 0 });
    expect(e.state.tasks[0].status).toBe('UNASSIGNED');
    expect(e.state.grid.obstacles[toKey({ r: 5, c: 5 }, 10)]).toBe(0);
    expect(e.state.metrics.failures).toBe(0);
    expect(e.state.lastSearch).toBeNull();
  });

  it('executes scheduled actions at the right tick', () => {
    const e = new SimulationEngine(scenario({ robots: [{ r: 0, c: 0 }, { r: 9, c: 0 }], events: [{ at: 3, type: 'fail', robotId: 'R2' }] }));
    stepN(e, 2);
    expect(e.state.robots[1].state).not.toBe('FAILED');
    e.step();
    expect(e.state.robots[1].state).toBe('FAILED');
    expect(e.state.robots[1].failedAt).toBe(3);
  });
});

describe('SimulationEngine — randomised stress test', () => {
  it('keeps every invariant under random operator actions', () => {
    let seed = 12345;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    for (const alloc of ['greedy', 'hungarian'] as const) {
      const e = new SimulationEngine(
        scenario({
          rows: 14,
          cols: 14,
          robots: [{ r: 0, c: 0 }, { r: 13, c: 13 }, { r: 0, c: 13 }, { r: 13, c: 0 }],
          tasks: Array.from({ length: 10 }, (_, i) => ({ cell: { r: 2 + (i % 5) * 2, c: 1 + i }, priority: 1 + (i % 5), duration: 1 + (i % 3) })),
        }),
        { allocationAlgorithm: alloc, capacity: 3 },
      );
      for (let i = 0; i < 300; i++) {
        const x = rnd();
        const cell = { r: Math.floor(rnd() * 14), c: Math.floor(rnd() * 14) };
        if (x < 0.08) e.toggleObstacle(cell);
        else if (x < 0.11) e.failRobot(`R${1 + Math.floor(rnd() * 4)}`);
        else if (x < 0.16) e.restoreRobot(`R${1 + Math.floor(rnd() * 4)}`);
        else if (x < 0.22) e.addTask(cell, 1 + Math.floor(rnd() * 5), 1 + Math.floor(rnd() * 3));
        else if (x < 0.25) e.blockActivePath();
        else if (x < 0.28) e.setTaskPriority(`T${1 + Math.floor(rnd() * 12)}`, 1 + Math.floor(rnd() * 5));
        e.step();
        expect(checkInvariants(e.state)).toEqual([]);
      }
      // Every completed task stays completed exactly once and history is preserved.
      for (const t of e.state.tasks) {
        const completions = t.history.filter((h) => h.status === 'COMPLETED').length;
        expect(completions).toBe(t.status === 'COMPLETED' ? 1 : 0);
      }
    }
  });
});
