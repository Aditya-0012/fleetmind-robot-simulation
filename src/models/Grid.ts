/**
 * Grid model.
 *
 * The 2D warehouse floor is modelled as an implicit, unweighted, undirected graph:
 *   - every walkable cell is a vertex
 *   - two vertices share an edge when they are 4-directionally adjacent (N, E, S, W)
 *   - every edge has cost 1
 *
 * Cells are addressed either as {r, c} points or as a flat integer key = r * cols + c.
 * Flat keys let the algorithms use typed arrays and Sets keyed by numbers, which is
 * both faster and easier to explain than string keys like "3,4".
 */

export interface Point {
  r: number;
  c: number;
}

export interface GridData {
  rows: number;
  cols: number;
  /** obstacles[key] === 1 when the cell is blocked. Uint8Array keeps memory at 1 byte/cell. */
  obstacles: Uint8Array;
}

/** Four-directional movement: up, right, down, left. Order is fixed so searches are deterministic. */
export const DIRECTIONS: ReadonlyArray<Point> = [
  { r: -1, c: 0 },
  { r: 0, c: 1 },
  { r: 1, c: 0 },
  { r: 0, c: -1 },
];

export function createGrid(rows: number, cols: number): GridData {
  if (rows <= 0 || cols <= 0) throw new Error(`Invalid grid size ${rows}x${cols}`);
  return { rows, cols, obstacles: new Uint8Array(rows * cols) };
}

export function cloneGrid(g: GridData): GridData {
  return { rows: g.rows, cols: g.cols, obstacles: new Uint8Array(g.obstacles) };
}

export const toKey = (p: Point, cols: number): number => p.r * cols + p.c;
export const fromKey = (key: number, cols: number): Point => ({ r: Math.floor(key / cols), c: key % cols });
export const samePoint = (a: Point, b: Point): boolean => a.r === b.r && a.c === b.c;
export const pointLabel = (p: Point): string => `(${p.r}, ${p.c})`;

export function inBounds(g: GridData, p: Point): boolean {
  return p.r >= 0 && p.r < g.rows && p.c >= 0 && p.c < g.cols;
}

export function isObstacle(g: GridData, p: Point): boolean {
  return g.obstacles[toKey(p, g.cols)] === 1;
}

export function isWalkable(g: GridData, p: Point, extraBlocked?: ReadonlySet<number>): boolean {
  if (!inBounds(g, p)) return false;
  const k = toKey(p, g.cols);
  return g.obstacles[k] === 0 && !(extraBlocked?.has(k) ?? false);
}

export function setObstacle(g: GridData, p: Point, blocked: boolean): void {
  if (!inBounds(g, p)) throw new Error(`Cell ${pointLabel(p)} is outside the grid`);
  g.obstacles[toKey(p, g.cols)] = blocked ? 1 : 0;
}

/** Adjacency list generated on demand — the graph is never materialised, saving O(E) memory. */
export function neighbors(g: GridData, key: number, extraBlocked?: ReadonlySet<number>): number[] {
  const r = Math.floor(key / g.cols);
  const c = key % g.cols;
  const out: number[] = [];
  for (const d of DIRECTIONS) {
    const nr = r + d.r;
    const nc = c + d.c;
    if (nr < 0 || nr >= g.rows || nc < 0 || nc >= g.cols) continue;
    const nk = nr * g.cols + nc;
    if (g.obstacles[nk] === 1) continue;
    if (extraBlocked && extraBlocked.has(nk)) continue;
    out.push(nk);
  }
  return out;
}

export function countObstacles(g: GridData): number {
  let n = 0;
  for (let i = 0; i < g.obstacles.length; i++) n += g.obstacles[i];
  return n;
}
