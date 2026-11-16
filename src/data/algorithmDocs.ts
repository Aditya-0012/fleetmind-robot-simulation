export interface AlgorithmDoc {
  id: 'astar' | 'dijkstra' | 'greedy' | 'hungarian' | 'bfs';
  name: string;
  family: string;
  problem: string;
  principle: string;
  steps: string[];
  pseudocode: string;
  time: { label: string; value: string }[];
  space: string;
  dataStructures: string[];
  best: string;
  worst: string;
  advantages: string[];
  limitations: string[];
  applications: string[];
  inProject: string;
  source: string;
}

export const ALGORITHM_DOCS: AlgorithmDoc[] = [
  {
    id: 'astar',
    name: 'A* search',
    family: 'Informed graph search · shortest path',
    problem: 'Find a minimum-cost path from a robot’s cell to its task cell on a 4-connected grid where every move costs 1 and obstacles are impassable.',
    principle:
      'A* always expands the open node with the smallest f(n) = g(n) + h(n). g(n) is the exact cost from the start, h(n) is the Manhattan distance to the goal. Because Manhattan distance never over-estimates on a 4-connected unit grid (admissible) and satisfies h(u) ≤ 1 + h(v) for neighbours (consistent), the first time the goal is removed from the open set its path is optimal and no closed node ever needs re-opening.',
    steps: [
      'Put the start in the open set (min-heap) with g = 0 and f = h(start).',
      'Pop the node with the smallest f; break ties by smaller h, then insertion order.',
      'Skip it if it is already closed (stale heap entry from lazy deletion). Otherwise move it to the closed set.',
      'If it is the goal, rebuild the path by following parent pointers back to the start.',
      'For each walkable neighbour not closed: tentative g = g(current) + 1. If that beats the stored g, record the parent, update g and push it with f = g + h.',
      'If the open set empties first, the goal is unreachable — report it, never fake a path.',
    ],
    pseudocode: `A_STAR(grid, s, t):
  for each cell v: g[v] ← ∞ ; parent[v] ← NIL
  g[s] ← 0
  OPEN ← min-heap ordered by (f, h, seq);  PUSH(OPEN, s, f = h(s))
  CLOSED ← ∅
  while OPEN ≠ ∅:
      u ← POP-MIN(OPEN)
      if u ∈ CLOSED: continue            ▷ lazy deletion
      CLOSED ← CLOSED ∪ {u}
      if u = t: return RECONSTRUCT(parent, t)
      for each neighbour v of u (N, E, S, W) not blocked:
          if v ∈ CLOSED: continue
          if g[u] + 1 < g[v]:            ▷ relaxation
              g[v] ← g[u] + 1 ; parent[v] ← u
              PUSH(OPEN, v, f = g[v] + |v.r − t.r| + |v.c − t.c|)
  return UNREACHABLE`,
    time: [
      { label: 'Worst case (binary heap)', value: 'O((V + E) log V) = O(V log V) on a grid, since E ≤ 4V' },
      { label: 'Best case', value: 'O(d log d) when h is exact and the corridor is clear (d = path length)' },
    ],
    space: 'O(V) — g, parent and closed arrays plus at most O(E) heap entries.',
    dataStructures: ['Binary min-heap (open set)', 'Uint8Array closed set (O(1) membership)', 'Float64Array g-scores', 'Int32Array parent pointers', 'Implicit grid graph (neighbours generated on demand)'],
    best: 'With no obstacles between start and goal, every expanded node lies on an optimal path, so A* explores close to d nodes.',
    worst: 'A walled-off or maze-like layout that forces the search “around the back” degrades A* towards Dijkstra-like exploration of most of the grid.',
    advantages: ['Optimal with an admissible heuristic', 'Usually explores far fewer nodes than Dijkstra', 'Heuristic is cheap (O(1) per node)'],
    limitations: ['Needs a good, admissible heuristic', 'Memory grows with the frontier', 'Replans from scratch after every change (no incremental reuse like D* Lite)'],
    applications: ['Robot and game-character navigation', 'Route planning in maps', 'Puzzle solving (8-puzzle, Sokoban)'],
    inProject: 'Primary planner. Runs when a robot starts a task, when its route is invalidated by an obstacle or a stalled robot, and in the Algorithm lab. Failed robots are passed as extra blocked cells.',
    source: 'src/algorithms/pathfinding/astar.ts',
  },
  {
    id: 'dijkstra',
    name: "Dijkstra's algorithm",
    family: 'Single-source shortest path · greedy',
    problem: 'Same as A*: a shortest robot route on a non-negatively weighted graph — but with no knowledge of where the goal is.',
    principle:
      'Dijkstra maintains a tentative distance for every node and repeatedly settles the unsettled node with the smallest distance. With non-negative edge weights, the popped distance is final (greedy-choice property). It is exactly A* with h(n) = 0, so it grows in rings around the start instead of leaning towards the goal.',
    steps: [
      'dist[start] = 0, all others ∞. Push start into a min-priority queue.',
      'Pop the node with the smallest distance; skip if already settled.',
      'Mark it settled. If it is the goal, stop early and rebuild the path.',
      'Relax every edge (u, v): if dist[u] + 1 < dist[v], update dist[v], parent[v] and push v.',
      'Repeat until the goal is settled or the queue is empty (unreachable).',
    ],
    pseudocode: `DIJKSTRA(grid, s, t):
  for each v: dist[v] ← ∞ ; parent[v] ← NIL
  dist[s] ← 0 ; Q ← min-heap ; PUSH(Q, s, 0)
  while Q ≠ ∅:
      u ← POP-MIN(Q)
      if settled[u]: continue
      settled[u] ← true
      if u = t: return RECONSTRUCT(parent, t)
      for each neighbour v of u:
          if dist[u] + w(u,v) < dist[v]:       ▷ relaxation
              dist[v] ← dist[u] + w(u,v) ; parent[v] ← u
              PUSH(Q, v, dist[v])
  return UNREACHABLE`,
    time: [
      { label: 'Binary heap', value: 'O((V + E) log V)' },
      { label: 'Fibonacci heap (theory)', value: 'O(E + V log V)' },
      { label: 'Early exit, open grid', value: 'explores ≈ every cell within distance d of the start, i.e. O(d²) cells' },
    ],
    space: 'O(V)',
    dataStructures: ['Binary min-heap', 'Distance array', 'Settled flags', 'Parent pointers'],
    best: 'Goal adjacent to the start: one or two pops.',
    worst: 'Goal on the far side of the grid or unreachable: every reachable node is settled.',
    advantages: ['Optimal for any non-negative weights', 'No heuristic needed', 'Computes shortest distances to all settled nodes as a by-product'],
    limitations: ['Explores in all directions — usually many more nodes than A*', 'Fails with negative edge weights (use Bellman–Ford)'],
    applications: ['Network routing (OSPF)', 'GPS when no heuristic is available', 'Baseline to validate A*'],
    inProject: 'Selectable planner. The Performance page runs it against A* on identical start/goal pairs to show equal path lengths but more nodes explored.',
    source: 'src/algorithms/pathfinding/dijkstra.ts',
  },
  {
    id: 'bfs',
    name: 'Breadth-first search (distance fields)',
    family: 'Unweighted shortest path',
    problem: 'Estimate the travel distance D from each robot to every task for the allocation cost function.',
    principle:
      'On a graph where every edge costs 1, BFS visits nodes in non-decreasing distance order, so the first time a node is reached its distance is the shortest. One BFS from a robot yields exact distances to all tasks at once.',
    steps: ['Mark the source with distance 0 and enqueue it.', 'Dequeue u; for each unvisited neighbour v set dist[v] = dist[u] + 1 and enqueue v.', 'Unvisited cells keep −1 (unreachable).'],
    pseudocode: `BFS(grid, s):
  dist[·] ← −1 ; dist[s] ← 0 ; Q ← [s]
  while Q not empty:
      u ← DEQUEUE(Q)
      for each neighbour v of u:
          if dist[v] = −1: dist[v] ← dist[u] + 1 ; ENQUEUE(Q, v)
  return dist`,
    time: [{ label: 'One run', value: 'O(V + E) = O(V) on a grid' }],
    space: 'O(V)',
    dataStructures: ['FIFO queue (Int32Array with head index)', 'Int32Array distance field', 'Map cache of fields per anchor cell'],
    best: 'Isolated source: O(1).',
    worst: 'Whole grid connected: every cell visited once.',
    advantages: ['Linear time', 'Exact on unit-cost grids', 'One run serves every task'],
    limitations: ['Only correct for equal edge costs'],
    applications: ['Allocation cost estimation', 'Connectivity checks in the scenario generator (largest component)'],
    inProject: 'Used by the allocators (DistanceOracle) and by the random scenario generator to guarantee every task is reachable.',
    source: 'src/algorithms/pathfinding/bfs.ts',
  },
  {
    id: 'greedy',
    name: 'Greedy task allocation',
    family: 'Heuristic assignment · local optimisation',
    problem: 'Distribute T open tasks over R operational robots (each robot may hold up to a capacity of tasks) so that the summed assignment cost is low.',
    principle:
      'Tasks are processed in priority order. Each task goes to the robot with the lowest cost at that moment; the robot’s workload, backlog and anchor (where it will be after its queue) are updated before the next task is considered. Each decision is locally optimal, which is fast but does not guarantee the global minimum.',
    steps: [
      'Sort open tasks by priority (high first), then creation time, then id.',
      'For each task, compute Cost(R, T) for every robot with spare capacity that can reach it.',
      'Choose the minimum; break ties by lower workload, then lower robot id (deterministic).',
      'Commit: workload += 1, backlog += D + duration, anchor ← task cell.',
      'Tasks no robot can reach are reported BLOCKED; reachable tasks without capacity stay UNASSIGNED.',
    ],
    pseudocode: `GREEDY-ALLOCATE(robots, tasks, w):
  SORT tasks by (priority ↓, createdAt ↑, id)
  for each task T in tasks:
      best ← NIL
      for each robot R with R.workload < capacity:
          D ← BFS-DIST(R.anchor, T)            ▷ cached per anchor
          if D = −1: continue
          c ← α·D/(rows+cols) + β·W/cap + γ·P + δ·L/(2(rows+cols))
          if c < best.cost (ties: workload, id): best ← (R, c)
      if best = NIL: mark T unassigned (unreachable | no-capacity)
      else: assign T → best.R ; update workload, backlog, anchor`,
    time: [{ label: 'Implementation', value: 'O(T log T + T·R + A·V), A ≤ R + T distinct BFS anchors' }],
    space: 'O(A·V) for cached BFS distance fields',
    dataStructures: ['Sorted task array', 'Map<cell, Int32Array> distance cache', 'Robot snapshot array'],
    best: 'Each task has one obviously closest robot: greedy coincides with the optimum.',
    worst: 'Robots near several tasks: an early cheap choice can force a very expensive later one (no look-ahead).',
    advantages: ['Simple and fast', 'Naturally supports several tasks per robot', 'Priority order is explicit'],
    limitations: ['No optimality guarantee', 'Result depends on processing order'],
    applications: ['Dispatch systems that need instant decisions', 'Baseline for comparing optimal assignment'],
    inProject: 'Default allocator. Re-runs whenever tasks appear, robots fail or recover, capacity frees up, or the environment changes.',
    source: 'src/algorithms/allocation/greedy.ts',
  },
  {
    id: 'hungarian',
    name: 'Hungarian algorithm (Kuhn–Munkres)',
    family: 'Optimal assignment · minimum-cost bipartite matching',
    problem: 'Given an n×m cost matrix (robots × tasks), choose a one-to-one matching of minimum total cost.',
    principle:
      'The implementation keeps dual potentials u (rows) and v (columns) so every reduced cost c[i][j] − u[i] − v[j] stays ≥ 0. Rows are added one at a time; for each, a shortest augmenting path over reduced costs (Dijkstra-like, using slack array minv) is grown until it reaches a free column, potentials are adjusted by the minimum slack δ, and the matching is flipped along the path. When all rows are matched using only zero-reduced-cost edges, the matching is optimal (LP duality).',
    steps: [
      'Pad the matrix to N×N (N = max(n, m)) with zero-cost dummy rows or columns; infeasible pairs get a very large cost.',
      'For each row i: start an alternating tree from i with column 0 as the virtual root.',
      'Repeatedly scan unused columns, update slack minv[j] and the predecessor way[j]; pick the column with minimum slack δ.',
      'Add δ to u of tree rows and subtract δ from v of tree columns (keeps reduced costs ≥ 0, creates a new zero edge).',
      'When a free column is reached, augment along way[] to increase the matching size by one.',
      'Discard dummy and infeasible pairs from the final answer.',
    ],
    pseudocode: `HUNGARIAN(a[1..N][1..N]):
  u, v ← 0 ; p[0..N] ← 0 ; way[0..N] ← 0
  for i ← 1 to N:
      p[0] ← i ; j0 ← 0 ; minv[·] ← ∞ ; used[·] ← false
      repeat
          used[j0] ← true ; i0 ← p[j0] ; δ ← ∞
          for j ← 1 to N where not used[j]:
              cur ← a[i0][j] − u[i0] − v[j]
              if cur < minv[j]: minv[j] ← cur ; way[j] ← j0
              if minv[j] < δ: δ ← minv[j] ; j1 ← j
          for j ← 0 to N:
              if used[j]: u[p[j]] += δ ; v[j] −= δ
              else: minv[j] −= δ
          j0 ← j1
      until p[j0] = 0
      repeat j1 ← way[j0] ; p[j0] ← p[j1] ; j0 ← j1 until j0 = 0
  return p                                   ▷ p[j] = row matched to column j`,
    time: [
      { label: 'One batch', value: 'O(N³), N = max(robots, tasks)' },
      { label: 'Repeated batches (multi-task)', value: 'O(k·N³ + k·R·T + A·V), k ≈ ⌈T / R⌉ rounds' },
    ],
    space: 'O(N²) for the padded matrix',
    dataStructures: ['2-D cost matrix (Float64Array rows)', 'Potential arrays u, v', 'Matching array p', 'Slack array minv and predecessor array way'],
    best: 'Still O(N³) in this formulation — every row runs a full phase.',
    worst: 'O(N³).',
    advantages: ['Provably optimal for one-to-one assignment', 'Handles rectangular matrices through padding', 'Polynomial time'],
    limitations: [
      'Solves one-to-one assignment only. Multiple tasks per robot are handled by repeated batches, which are each optimal but not jointly optimal.',
      'The full multi-robot routing/scheduling problem is NP-hard (it contains TSP), so no claim of global optimality is made.',
      'Cubic time grows quickly for very large batches.',
    ],
    applications: ['Job-to-worker assignment', 'Multi-target tracking (data association)', 'Ride-hailing batch matching'],
    inProject: 'Selectable allocator. In the Performance page Greedy and Hungarian are run on the same cost matrix so totals can be compared directly; tests check Hungarian against brute force.',
    source: 'src/algorithms/allocation/hungarian.ts',
  },
];
