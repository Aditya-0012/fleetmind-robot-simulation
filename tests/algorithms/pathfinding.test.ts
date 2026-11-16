import { describe, expect, it } from 'vitest';
import { astar, dijkstra, bfsDistances, findPath, isValidPath } from '../../src/algorithms/pathfinding';
import { MinHeap } from '../../src/algorithms/pathfinding/priorityQueue';
import { manhattan } from '../../src/algorithms/pathfinding/heuristics';
import { createGrid, setObstacle, toKey } from '../../src/models/Grid';
import type { GridData } from '../../src/models/Grid';
import { mulberry32 } from '../../src/utils/random';

/** Build a grid from ASCII: '#' = obstacle, anything else walkable. */
function gridFrom(rows: string[]): GridData {
  const g = createGrid(rows.length, rows[0].length);
  rows.forEach((line, r) => [...line].forEach((ch, c) => ch === '#' && setObstacle(g, { r, c }, true)));
  return g;
}

describe('MinHeap', () => {
  it('pops items in ascending order', () => {
    const h = new MinHeap<number>((a, b) => a - b);
    const input = [5, 3, 9, 1, 1, 7, 2, 8, 0, 6];
    input.forEach((x) => h.push(x));
    const out: number[] = [];
    while (!h.isEmpty()) out.push(h.pop() as number);
    expect(out).toEqual([...input].sort((a, b) => a - b));
  });

  it('handles random workloads like a sorted array', () => {
    const rnd = mulberry32(42);
    const h = new MinHeap<number>((a, b) => a - b);
    const ref: number[] = [];
    for (let i = 0; i < 500; i++) {
      if (rnd() < 0.6 || ref.length === 0) {
        const x = Math.floor(rnd() * 1000);
        h.push(x);
        ref.push(x);
        ref.sort((a, b) => a - b);
      } else {
        expect(h.pop()).toBe(ref.shift());
      }
      expect(h.size).toBe(ref.length);
    }
  });

  it('returns undefined when empty', () => {
    expect(new MinHeap<number>((a, b) => a - b).pop()).toBeUndefined();
  });
});

describe('Manhattan heuristic', () => {
  it('computes |dr| + |dc|', () => {
    expect(manhattan({ r: 0, c: 0 }, { r: 3, c: 4 })).toBe(7);
    expect(manhattan({ r: 5, c: 2 }, { r: 1, c: 6 })).toBe(8);
  });
});

describe.each([
  ['A*', astar],
  ['Dijkstra', dijkstra],
] as const)('%s', (_name, search) => {
  it('finds the shortest path on an open grid', () => {
    const g = createGrid(10, 10);
    const res = search(g, { r: 0, c: 0 }, { r: 6, c: 7 });
    expect(res.found).toBe(true);
    expect(res.cost).toBe(13);
    expect(res.path).toHaveLength(14);
    expect(res.path[0]).toEqual({ r: 0, c: 0 });
    expect(res.path.at(-1)).toEqual({ r: 6, c: 7 });
    expect(isValidPath(g, res.path)).toBe(true);
  });

  it('routes around obstacles and never crosses them', () => {
    const g = gridFrom([
      '.....',
      '.###.',
      '.#...',
      '.#.#.',
      '...#.',
    ]);
    const res = search(g, { r: 2, c: 2 }, { r: 4, c: 0 });
    expect(res.found).toBe(true);
    for (const p of res.path) expect(g.obstacles[toKey(p, g.cols)]).toBe(0);
    expect(isValidPath(g, res.path)).toBe(true);
    expect(res.cost).toBe(4); // (2,2)->(3,2)->(4,2)->(4,1)->(4,0)
  });

  it('reports unreachable goals', () => {
    const g = gridFrom(['..#..', '..#..', '..#..']);
    const res = search(g, { r: 0, c: 0 }, { r: 0, c: 4 });
    expect(res.found).toBe(false);
    expect(res.path).toEqual([]);
    expect(res.cost).toBe(Infinity);
    expect(res.error).toMatch(/unreachable/i);
  });

  it('handles start equal to goal', () => {
    const g = createGrid(4, 4);
    const res = search(g, { r: 2, c: 2 }, { r: 2, c: 2 });
    expect(res.found).toBe(true);
    expect(res.cost).toBe(0);
    expect(res.path).toEqual([{ r: 2, c: 2 }]);
  });

  it('rejects out-of-bounds or blocked endpoints', () => {
    const g = gridFrom(['..', '.#']);
    expect(search(g, { r: -1, c: 0 }, { r: 0, c: 0 }).error).toMatch(/outside/);
    expect(search(g, { r: 0, c: 0 }, { r: 5, c: 5 }).error).toMatch(/outside/);
    expect(search(g, { r: 0, c: 0 }, { r: 1, c: 1 }).error).toMatch(/blocked/);
  });

  it('keeps paths inside grid boundaries', () => {
    const g = createGrid(3, 8);
    const res = search(g, { r: 0, c: 0 }, { r: 2, c: 7 });
    for (const p of res.path) {
      expect(p.r).toBeGreaterThanOrEqual(0);
      expect(p.r).toBeLessThan(3);
      expect(p.c).toBeGreaterThanOrEqual(0);
      expect(p.c).toBeLessThan(8);
    }
  });

  it('respects extra blocked cells (failed robots)', () => {
    const g = gridFrom(['...', '.#.', '...']);
    const blocked = new Set([toKey({ r: 0, c: 1 }, 3)]);
    const res = search(g, { r: 0, c: 0 }, { r: 0, c: 2 }, { extraBlocked: blocked });
    expect(res.found).toBe(true);
    expect(res.cost).toBe(6);
    expect(res.path.some((p) => p.r === 0 && p.c === 1)).toBe(false);
  });

  it('resets state between executions', () => {
    const g = createGrid(8, 8);
    const a = search(g, { r: 0, c: 0 }, { r: 7, c: 7 }, { recordTrace: true });
    const b = search(g, { r: 0, c: 0 }, { r: 7, c: 7 }, { recordTrace: true });
    expect(a.cost).toBe(b.cost);
    expect(a.nodesExplored).toBe(b.nodesExplored);
    expect(a.trace?.length).toBe(b.trace?.length);
  });
});

describe('A* vs Dijkstra on uniform-cost grids', () => {
  it('return equal path lengths, A* explores no more nodes', () => {
    const rnd = mulberry32(7);
    for (let trial = 0; trial < 60; trial++) {
      const g = createGrid(25, 25);
      for (let k = 0; k < g.obstacles.length; k++) g.obstacles[k] = rnd() < 0.28 ? 1 : 0;
      const s = { r: 0, c: 0 };
      const t = { r: 24, c: 24 };
      g.obstacles[0] = 0;
      g.obstacles[g.obstacles.length - 1] = 0;
      const a = astar(g, s, t);
      const d = dijkstra(g, s, t);
      const bfs = bfsDistances(g, s)[toKey(t, 25)];
      expect(a.found).toBe(d.found);
      if (a.found) {
        expect(a.cost).toBe(d.cost);
        expect(a.cost).toBe(bfs); // BFS is ground truth on unit-cost graphs
        expect(a.nodesExplored).toBeLessThanOrEqual(d.nodesExplored);
        expect(isValidPath(g, a.path)).toBe(true);
        expect(isValidPath(g, d.path)).toBe(true);
      } else {
        expect(bfs).toBe(-1);
      }
    }
  });

  it('records g, h and f = g + h in the trace', () => {
    const g = createGrid(6, 6);
    const res = findPath('astar', g, { r: 0, c: 0 }, { r: 5, c: 5 }, { recordTrace: true });
    expect(res.scores?.size).toBeGreaterThan(0);
    for (const s of res.scores!.values()) expect(s.f).toBe(s.g + s.h);
    const dj = findPath('dijkstra', g, { r: 0, c: 0 }, { r: 5, c: 5 }, { recordTrace: true });
    for (const s of dj.scores!.values()) expect(s.h).toBe(0);
  });
});
