import { largestComponent } from '../algorithms/pathfinding/bfs';
import { createGrid, fromKey } from '../models/Grid';
import type { Point } from '../models/Grid';
import type { ScenarioDefinition } from '../models/SimulationState';
import { mulberry32, randomInt, shuffle } from '../utils/random';

export interface GeneratorOptions {
  size: 20 | 30 | 50;
  robots: 2 | 3 | 5 | 10;
  tasks: 5 | 10 | 20 | 50;
  density: 0.1 | 0.2 | 0.3;
  seed: number;
}

export const GRID_SIZES = [20, 30, 50] as const;
export const ROBOT_COUNTS = [2, 3, 5, 10] as const;
export const TASK_COUNTS = [5, 10, 20, 50] as const;
export const DENSITIES = [0.1, 0.2, 0.3] as const;

export interface GeneratedScenario {
  scenario: ScenarioDefinition;
  componentSize: number;
  attempts: number;
}

/**
 * Seeded random scenario generator.
 *
 * Guarantees:
 *   - obstacles fill ≈ density × cells
 *   - robots and tasks are placed only inside the LARGEST connected open region, found with
 *     BFS, so every task is reachable from every robot at the start
 *   - robots and tasks never overlap each other or obstacles
 *   - the same seed always produces the same scenario
 * If the open region is too small for all entities the generator retries with a derived seed.
 */
export function generateScenario(opts: GeneratorOptions): GeneratedScenario {
  const need = opts.robots + opts.tasks;
  for (let attempt = 0; attempt < 25; attempt++) {
    const rnd = mulberry32(opts.seed * 7919 + attempt);
    const grid = createGrid(opts.size, opts.size);
    const cells = opts.size * opts.size;
    const target = Math.round(cells * opts.density);
    const order = shuffle(rnd, Array.from({ length: cells }, (_, i) => i));
    for (let i = 0; i < target; i++) grid.obstacles[order[i]] = 1;

    const comp = largestComponent(grid);
    if (comp.size < need + 4) continue;

    // Close off small isolated pockets so the floor reads cleanly: they are unreachable anyway.
    const obstacles: Point[] = [];
    for (let k = 0; k < cells; k++) if (grid.obstacles[k]) obstacles.push(fromKey(k, opts.size));

    const free = shuffle(rnd, [...comp]);
    const robots = free.slice(0, opts.robots).map((k) => fromKey(k, opts.size));
    const tasks = free.slice(opts.robots, need).map((k) => ({
      cell: fromKey(k, opts.size),
      priority: randomInt(rnd, 1, 5),
      duration: randomInt(rnd, 2, 5),
    }));

    return {
      scenario: {
        id: `random-${opts.size}-${opts.robots}-${opts.tasks}-${Math.round(opts.density * 100)}-${opts.seed}`,
        name: `Random ${opts.size}×${opts.size} · seed ${opts.seed}`,
        description: `${opts.robots} robots, ${opts.tasks} tasks, ${Math.round(opts.density * 100)}% obstacles. All entities placed in one connected region of ${comp.size} cells.`,
        rows: opts.size,
        cols: opts.size,
        obstacles,
        robots,
        tasks,
        events: [],
        seed: opts.seed,
      },
      componentSize: comp.size,
      attempts: attempt + 1,
    };
  }
  throw new Error('Could not generate a connected scenario — try a lower obstacle density');
}
