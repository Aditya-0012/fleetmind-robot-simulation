import { describe, expect, it } from 'vitest';
import { SimulationEngine } from '../../src/simulation/SimulationEngine';
import { SCENARIOS } from '../../src/simulation/scenarios';
import { DEMO_SCENARIO, DEMO_STEPS, currentDemoStep } from '../../src/simulation/DemoController';
import { generateScenario, GRID_SIZES, DENSITIES } from '../../src/simulation/ScenarioGenerator';
import { checkInvariants } from '../../src/simulation/invariants';
import { bfsDistances } from '../../src/algorithms/pathfinding';
import { createGrid, setObstacle, toKey } from '../../src/models/Grid';

describe('Predefined scenarios', () => {
  it.each(SCENARIOS.flatMap((s) => (['greedy', 'hungarian'] as const).map((a) => [s.id, a] as const)))(
    '%s with %s completes every task without invariant violations',
    (id, alloc) => {
      const sc = SCENARIOS.find((s) => s.id === id)!;
      const e = new SimulationEngine(sc, { allocationAlgorithm: alloc, showSearch: false });
      for (let i = 0; i < 400 && !e.state.finished; i++) {
        e.step();
        expect(checkInvariants(e.state)).toEqual([]);
      }
      expect(e.state.finished).toBe(true);
      expect(e.state.tasks.every((t) => t.status === 'COMPLETED')).toBe(true);
    },
  );

  it('scenario entities are on walkable, distinct cells', () => {
    for (const sc of SCENARIOS) {
      const g = createGrid(sc.rows, sc.cols);
      sc.obstacles.forEach((o) => setObstacle(g, o, true));
      const cells = [...sc.robots, ...sc.tasks.map((t) => t.cell)].map((p) => toKey(p, sc.cols));
      expect(new Set(cells).size).toBe(cells.length);
      for (const k of cells) expect(g.obstacles[k]).toBe(0);
    }
  });
});

describe('Demo mode (combined scenario)', () => {
  it('reaches every narrated step through real engine events, deterministically', () => {
    const run = () => {
      const e = new SimulationEngine(DEMO_SCENARIO, { allocationAlgorithm: 'greedy', pathAlgorithm: 'astar' });
      const seen: number[] = [];
      for (let i = 0; i < 300 && !e.state.finished; i++) {
        e.step();
        expect(checkInvariants(e.state)).toEqual([]);
        seen.push(currentDemoStep(e.state));
      }
      return { e, seen };
    };
    const { e, seen } = run();
    const s = e.state;
    expect(s.finished).toBe(true);
    for (const step of DEMO_STEPS) expect(step.reached(s), step.id).toBe(true);
    expect(s.metrics.failures).toBe(1);
    expect(s.metrics.reallocations).toBeGreaterThan(0);
    expect(s.metrics.replans).toBeGreaterThan(0);
    expect(s.tasks.find((t) => t.priority === 5)?.status).toBe('COMPLETED');
    expect(seen.at(-1)).toBe(DEMO_STEPS.length - 1);
    // monotone timeline: never jumps backwards
    for (let i = 1; i < seen.length; i++) expect(seen[i]).toBeGreaterThanOrEqual(seen[i - 1]);
    // reproducible
    expect(run().e.state.events.map((x) => x.message)).toEqual(s.events.map((x) => x.message));
  });
});

describe('Random scenario generator', () => {
  it('is reproducible for the same seed and differs for another seed', () => {
    const a = generateScenario({ size: 20, robots: 3, tasks: 10, density: 0.2, seed: 42 }).scenario;
    const b = generateScenario({ size: 20, robots: 3, tasks: 10, density: 0.2, seed: 42 }).scenario;
    const c = generateScenario({ size: 20, robots: 3, tasks: 10, density: 0.2, seed: 43 }).scenario;
    expect(JSON.stringify(a)).toEqual(JSON.stringify(b));
    expect(JSON.stringify(a)).not.toEqual(JSON.stringify(c));
  });

  it.each(GRID_SIZES.flatMap((size) => DENSITIES.map((d) => [size, d] as const)))(
    'size %i density %f: valid, non-overlapping, fully reachable',
    (size, density) => {
      const { scenario } = generateScenario({ size, robots: 10, tasks: 50, density, seed: 7 });
      const g = createGrid(size, size);
      scenario.obstacles.forEach((o) => setObstacle(g, o, true));
      const actual = scenario.obstacles.length / (size * size);
      expect(Math.abs(actual - density)).toBeLessThan(0.01);
      const keys = [...scenario.robots, ...scenario.tasks.map((t) => t.cell)].map((p) => toKey(p, size));
      expect(new Set(keys).size).toBe(keys.length);
      for (const k of keys) expect(g.obstacles[k]).toBe(0);
      const dist = bfsDistances(g, scenario.robots[0]);
      for (const k of keys) expect(dist[k]).toBeGreaterThanOrEqual(0);
    },
  );

  it('generated scenarios run to completion', () => {
    const { scenario } = generateScenario({ size: 30, robots: 5, tasks: 20, density: 0.3, seed: 2024 });
    const e = new SimulationEngine(scenario, { showSearch: false });
    e.runUntilFinished(2000);
    expect(e.state.tasks.every((t) => t.status === 'COMPLETED')).toBe(true);
  });
});
