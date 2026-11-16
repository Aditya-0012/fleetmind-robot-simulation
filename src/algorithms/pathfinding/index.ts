import type { GridData, Point } from '../../models/Grid';
import { astar } from './astar';
import { dijkstra } from './dijkstra';
import type { PathAlgorithm, SearchOptions, SearchResult } from './types';

export * from './types';
export { astar } from './astar';
export { dijkstra } from './dijkstra';
export { bfsDistances, largestComponent } from './bfs';
export { isValidPath } from './common';

/** Single dispatch point so the selected algorithm genuinely drives the simulation. */
export function findPath(
  algorithm: PathAlgorithm,
  grid: GridData,
  start: Point,
  goal: Point,
  options?: SearchOptions,
): SearchResult {
  return algorithm === 'astar' ? astar(grid, start, goal, options) : dijkstra(grid, start, goal, options);
}
