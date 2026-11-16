import { describe, expect, it } from 'vitest';
import {
  DEFAULT_WEIGHTS,
  computeCost,
  greedyAllocate,
  greedyMatrix,
  hungarian,
  hungarianAllocate,
} from '../../src/algorithms/allocation';
import type { AllocRobot, AllocTask, AllocationInput } from '../../src/algorithms/allocation';
import { createGrid, setObstacle } from '../../src/models/Grid';
import { mulberry32 } from '../../src/utils/random';

function bruteForceMin(cost: number[][]): number {
  // exhaustive search over permutations (n <= 7) — ground truth for the Hungarian tests
  const n = cost.length;
  const m = cost[0].length;
  let best = Infinity;
  const usedCols = new Array(m).fill(false);
  const k = Math.min(n, m);
  const rec = (i: number, assigned: number, acc: number) => {
    if (acc >= best) return;
    if (i === n) {
      if (assigned === k) best = Math.min(best, acc);
      return;
    }
    // row i may be left unmatched only if there are more rows than columns
    if (n - i - 1 >= k - assigned) rec(i + 1, assigned, acc);
    for (let j = 0; j < m; j++) {
      if (usedCols[j]) continue;
      usedCols[j] = true;
      rec(i + 1, assigned + 1, acc + cost[i][j]);
      usedCols[j] = false;
    }
  };
  rec(0, 0, 0);
  return best;
}

const robot = (id: string, r: number, c: number, extra: Partial<AllocRobot> = {}): AllocRobot => ({
  id,
  anchor: { r, c },
  workload: 0,
  backlogTicks: 0,
  capacity: 5,
  ...extra,
});
const task = (id: string, r: number, c: number, priority = 3, createdAt = 0): AllocTask => ({
  id,
  position: { r, c },
  priority,
  duration: 2,
  createdAt,
});

describe('Cost function', () => {
  it('matches the documented formula', () => {
    const g = createGrid(10, 10);
    const r = robot('R1', 0, 0, { workload: 2, backlogTicks: 6 });
    const t = task('T1', 3, 4, 4);
    const b = computeCost(g, r, t, 7, { alpha: 1, beta: 2, gamma: 3, delta: 4 });
    expect(b.D).toBe(7);
    expect(b.Dn).toBeCloseTo(7 / 20);
    expect(b.Wn).toBeCloseTo(2 / 5);
    expect(b.P).toBeCloseTo(0.25);
    expect(b.L).toBe(6 + 7 + 2);
    expect(b.Ln).toBeCloseTo(15 / 40);
    expect(b.total).toBeCloseTo(1 * (7 / 20) + 2 * (2 / 5) + 3 * 0.25 + 4 * (15 / 40));
  });

  it('gives critical tasks zero priority penalty and low tasks full penalty', () => {
    const g = createGrid(5, 5);
    expect(computeCost(g, robot('R', 0, 0), task('T', 0, 0, 5), 0, DEFAULT_WEIGHTS).P).toBe(0);
    expect(computeCost(g, robot('R', 0, 0), task('T', 0, 0, 1), 0, DEFAULT_WEIGHTS).P).toBe(1);
  });
});

describe('Hungarian algorithm', () => {
  it('solves a known 3x3 matrix', () => {
    const c = [
      [4, 1, 3],
      [2, 0, 5],
      [3, 2, 2],
    ];
    const res = hungarian(c);
    expect(res.totalCost).toBe(5); // (0,1)=1 + (1,0)=2 + (2,2)=2
    expect(res.rowToCol).toEqual([1, 0, 2]);
  });

  it('solves the classic 4x4 example', () => {
    const c = [
      [9, 2, 7, 8],
      [6, 4, 3, 7],
      [5, 8, 1, 8],
      [7, 6, 9, 4],
    ];
    expect(hungarian(c).totalCost).toBe(13);
  });

  it('handles rectangular matrices with more rows than columns (dummy columns)', () => {
    const c = [
      [10, 3],
      [1, 9],
      [4, 4],
    ];
    const res = hungarian(c);
    expect(res.totalCost).toBe(4); // row1->col0 (1) + row0->col1 (3)
    expect(res.rowToCol.filter((x) => x >= 0)).toHaveLength(2);
    expect(res.rowToCol[2]).toBe(-1); // matched to a dummy column
  });

  it('handles rectangular matrices with more columns than rows (dummy rows)', () => {
    const c = [
      [7, 2, 9, 4],
      [3, 8, 1, 6],
    ];
    const res = hungarian(c);
    expect(res.totalCost).toBe(3);
    expect(res.rowToCol).toEqual([1, 2]);
  });

  it('never assigns two rows to the same column', () => {
    const rnd = mulberry32(3);
    for (let trial = 0; trial < 50; trial++) {
      const n = 2 + Math.floor(rnd() * 6);
      const m = 2 + Math.floor(rnd() * 6);
      const c = Array.from({ length: n }, () => Array.from({ length: m }, () => Math.round(rnd() * 100)));
      const res = hungarian(c);
      const cols = res.rowToCol.filter((x) => x >= 0);
      expect(new Set(cols).size).toBe(cols.length);
      expect(cols.length).toBe(Math.min(n, m));
    }
  });

  it('matches exhaustive search on random matrices', () => {
    const rnd = mulberry32(11);
    for (let trial = 0; trial < 80; trial++) {
      const n = 1 + Math.floor(rnd() * 6);
      const m = 1 + Math.floor(rnd() * 6);
      const c = Array.from({ length: n }, () => Array.from({ length: m }, () => Math.round(rnd() * 50) / 7));
      expect(hungarian(c).totalCost).toBeCloseTo(bruteForceMin(c), 6);
    }
  });

  it('never does worse than greedy on the same matrix', () => {
    const rnd = mulberry32(99);
    for (let trial = 0; trial < 60; trial++) {
      const n = 2 + Math.floor(rnd() * 5);
      const c = Array.from({ length: n }, () => Array.from({ length: n }, () => rnd() * 10));
      expect(hungarian(c).totalCost).toBeLessThanOrEqual(greedyMatrix(c).totalCost + 1e-9);
    }
  });

  it('skips infeasible (Infinity) pairs', () => {
    const c = [
      [Infinity, 5],
      [Infinity, 2],
    ];
    const res = hungarian(c);
    expect(res.rowToCol.filter((x) => x === 0)).toHaveLength(0);
    expect(res.totalCost).toBe(2);
  });

  it('handles empty input', () => {
    expect(hungarian([]).rowToCol).toEqual([]);
  });
});

describe('Greedy allocation', () => {
  const grid = createGrid(10, 10);

  it('assigns each task to the cheapest robot', () => {
    const input: AllocationInput = {
      grid,
      robots: [robot('R1', 0, 0), robot('R2', 9, 9)],
      tasks: [task('T1', 1, 1), task('T2', 8, 8)],
      weights: DEFAULT_WEIGHTS,
    };
    const res = greedyAllocate(input);
    const map = Object.fromEntries(res.assignments.map((a) => [a.taskId, a.robotId]));
    expect(map).toEqual({ T1: 'R1', T2: 'R2' });
    expect(res.unassigned).toEqual([]);
  });

  it('updates workload so tasks spread across robots', () => {
    const res = greedyAllocate({
      grid,
      robots: [robot('R1', 0, 0), robot('R2', 0, 1)],
      tasks: [task('T1', 0, 5), task('T2', 0, 5), task('T3', 0, 5), task('T4', 0, 5)],
      weights: { alpha: 0, beta: 1, gamma: 0, delta: 0 }, // workload only
    });
    const counts: Record<string, number> = {};
    res.assignments.forEach((a) => (counts[a.robotId] = (counts[a.robotId] ?? 0) + 1));
    expect(counts).toEqual({ R1: 2, R2: 2 });
  });

  it('excludes robots that are not passed in (failed) and respects capacity', () => {
    const res = greedyAllocate({
      grid,
      robots: [robot('R2', 5, 5, { capacity: 1 })],
      tasks: [task('T1', 0, 0), task('T2', 1, 1)],
      weights: DEFAULT_WEIGHTS,
    });
    expect(res.assignments).toHaveLength(1);
    expect(res.assignments[0].robotId).toBe('R2');
    expect(res.unassigned).toEqual([{ taskId: expect.any(String), reason: 'no-capacity' }]);
  });

  it('reports unreachable tasks', () => {
    const g = createGrid(5, 5);
    for (let r = 0; r < 5; r++) setObstacle(g, { r, c: 2 }, true);
    const res = greedyAllocate({
      grid: g,
      robots: [robot('R1', 0, 0)],
      tasks: [task('T1', 0, 4)],
      weights: DEFAULT_WEIGHTS,
    });
    expect(res.assignments).toEqual([]);
    expect(res.unassigned).toEqual([{ taskId: 'T1', reason: 'unreachable' }]);
  });

  it('reports no-robots when every robot has failed', () => {
    const res = greedyAllocate({ grid, robots: [], tasks: [task('T1', 0, 0)], weights: DEFAULT_WEIGHTS });
    expect(res.unassigned[0].reason).toBe('no-robots');
  });

  it('processes high-priority tasks first', () => {
    const res = greedyAllocate({
      grid,
      robots: [robot('R1', 0, 0, { capacity: 1 })],
      tasks: [task('LOW', 0, 1, 1), task('CRIT', 0, 9, 5)],
      weights: DEFAULT_WEIGHTS,
    });
    expect(res.assignments.map((a) => a.taskId)).toEqual(['CRIT']);
  });

  it('breaks ties deterministically by robot id', () => {
    const res = greedyAllocate({
      grid,
      robots: [robot('R2', 0, 2), robot('R1', 0, 0)],
      tasks: [task('T1', 0, 1)],
      weights: DEFAULT_WEIGHTS,
    });
    expect(res.assignments[0].robotId).toBe('R1');
  });
});

describe('Hungarian allocation (repeated batches)', () => {
  const grid = createGrid(12, 12);

  it('assigns every reachable task with no duplicates', () => {
    const res = hungarianAllocate({
      grid,
      robots: [robot('R1', 0, 0), robot('R2', 11, 11), robot('R3', 0, 11)],
      tasks: Array.from({ length: 8 }, (_, i) => task(`T${i + 1}`, (i * 5) % 12, (i * 7) % 12, 1 + (i % 5), i)),
      weights: DEFAULT_WEIGHTS,
    });
    expect(res.assignments).toHaveLength(8);
    const ids = res.assignments.map((a) => a.taskId);
    expect(new Set(ids).size).toBe(ids.length);
    expect(res.rounds).toBeGreaterThanOrEqual(3);
  });

  it('prefers high-priority tasks when tasks outnumber robot capacity', () => {
    const res = hungarianAllocate({
      grid,
      robots: [robot('R1', 0, 0, { capacity: 1 })],
      tasks: [task('LOW', 0, 1, 1), task('CRIT', 0, 6, 5)],
      weights: DEFAULT_WEIGHTS,
    });
    expect(res.assignments.map((a) => a.taskId)).toEqual(['CRIT']);
    expect(res.unassigned).toEqual([{ taskId: 'LOW', reason: 'no-capacity' }]);
  });

  it('first batch total cost is no worse than greedy on the same input', () => {
    const rnd = mulberry32(5);
    for (let trial = 0; trial < 25; trial++) {
      const robots = Array.from({ length: 4 }, (_, i) => robot(`R${i}`, Math.floor(rnd() * 12), Math.floor(rnd() * 12), { capacity: 1 }));
      const tasks = Array.from({ length: 4 }, (_, i) => task(`T${i}`, Math.floor(rnd() * 12), Math.floor(rnd() * 12), 3, i));
      const input = { grid, robots, tasks, weights: DEFAULT_WEIGHTS };
      const h = hungarianAllocate(input);
      const gr = greedyAllocate(input);
      expect(h.assignments.length).toBe(4);
      expect(h.totalCost).toBeLessThanOrEqual(gr.totalCost + 1e-9);
    }
  });
});
