# Algorithm analysis

Notation: V = walkable cells, E = edges (≤ 2V on a 4-connected grid), R = operational robots, T = open tasks, N = max(R, T), A = distinct BFS anchors (≤ R + T), d = optimal path length.

## 1. Graph model

The grid becomes an implicit undirected graph. Vertex key = `r·cols + c`. Edges join 4-adjacent walkable cells with weight 1. Obstacles and failed robots remove vertices. Neighbours are generated on demand in a fixed order (N, E, S, W), which makes every search deterministic.

## 2. Binary min-heap (`priorityQueue.ts`)

Array-backed complete binary tree. `push`: append and sift up. `pop`: move the last element to the root and sift down. Both are O(log n); `peek` is O(1). A* and Dijkstra use **lazy deletion**: when a node's key improves, a new entry is pushed and stale entries are skipped when popped. The heap holds O(E) entries, which keeps the overall bound at O((V+E) log V).

## 3. A* (`astar.ts`)

- **Ordering:** f = g + h, ties broken by smaller h, then insertion sequence.
- **Heuristic:** Manhattan distance. It is admissible because every path needs at least |Δr| + |Δc| unit moves. It is consistent because moving one cell changes h by at most 1 = edge cost.
- **Correctness:** with a consistent h, f is non-decreasing along any path, so the first time a node is popped its g is optimal. No closed node needs reopening, and the goal's g is optimal when it is popped.
- **Time:** O((V+E) log V) = O(V log V). Best case on a clear corridor ≈ O(d log d).
- **Space:** O(V).

## 4. Dijkstra (`dijkstra.ts`)

- **Invariant:** with non-negative weights, the minimum tentative distance in the queue is final.
- **Relaxation:** `dist[u] + w < dist[v] ⇒ dist[v] ← dist[u] + w`.
- **Time:** O((V+E) log V). With early exit on an open grid it explores about every cell within distance d, i.e. Θ(d²) cells.
- It is identical to A* with h = 0, which is why it serves as the uninformed baseline.

## 5. BFS (`bfs.ts`)

On unit-weight graphs BFS discovers vertices in non-decreasing distance order, so `dist[v]` is the shortest distance. Time O(V+E) per source. The allocator caches one distance field per anchor cell (`DistanceOracle`). `largestComponent` uses the same traversal to label connected regions for the scenario generator.

## 6. Cost function (`costFunction.ts`)

```
Cost(R,T) = α·Dn + β·Wn + γ·P + δ·Ln
Dn = D / (rows + cols)           D = BFS distance anchor → task
Wn = W / capacity                W = tasks already committed to R
P  = (5 − priority) / 4          0 for critical, 1 for low
Ln = L / (2·(rows + cols))       L = backlogTicks + D + duration
```

- **Anchor:** the robot's position after its committed queue (last queued task cell).
- **Backlog:** remaining route + remaining execution + Manhattan estimates between queued tasks.
- **Note:** P is identical for every robot considering the same task, so it never changes which robot is cheapest for one task. It changes which tasks win when tasks compete for robots (Hungarian batches) and the order in which Greedy processes tasks.

## 7. Greedy allocation (`greedy.ts`)

Sort tasks (priority ↓, createdAt ↑, id). For each task, evaluate every robot with spare capacity that can reach it and pick the minimum (ties: workload, then id). Then update workload, backlog and anchor.

- **Time:** O(T log T) sort + O(T·R) cost evaluations + O(A·V) BFS.
- **Space:** O(A·V).
- **Not optimal.** Counter-example: costs A–X = 1, A–Y = 2, B–X = 2, B–Y = 100. Greedy (X first) pays 1 + 100 = 101; the optimum is 2 + 2 = 4. This exact matrix is the default in the Assignment lab.

## 8. Hungarian algorithm (`hungarian.ts`)

Potentials u, v keep reduced costs `c[i][j] − u[i] − v[j] ≥ 0`. Each of N phases inserts one row by growing a shortest augmenting path over reduced costs (`minv` = slack, `way` = predecessor), adjusting potentials by the minimum slack δ, and augmenting. When every row is matched through zero-reduced-cost edges, complementary slackness proves optimality.

- **Rectangular input:** pad to N×N with zero-cost dummy rows/columns. Matches to dummies mean "unassigned".
- **Infeasible pairs** (unreachable) use BIG = 10⁷. Because BIG dominates any real cost, the solver first maximises the number of feasible pairs and then minimises cost. Any BIG pairs left in the answer are dropped.
- **Time:** O(N³), from N phases × O(N) columns added × O(N) slack updates. **Space:** O(N²).
- **Multi-task:** `hungarianAllocate` runs repeated batches (rows = robots with capacity, columns = remaining tasks), updating anchors and workloads between batches. Each batch is optimal; the sequence is a heuristic for the NP-hard ordered multi-task problem.

## 9. Engine operations

| Operation | Cost |
|---|---|
| One tick without planning | O(R + T) |
| Path invalidation scan after a new obstacle | O(Σ remaining route lengths) |
| Failure recovery | O(queue) release + one allocation + replans for affected robots |
| Invariant check | O(R·Q + T) |

## 10. Theoretical vs empirical

The Performance page reports **machine-independent counts** (nodes expanded, heap pushes, peak open-set size, cost evaluations, Hungarian inner-loop steps) separately from **wall-clock time** (`performance.now()`). On the 18×26 warehouse, A* typically expands about 90 % fewer nodes than Dijkstra for identical path lengths. On tiny inputs the millisecond figures are dominated by timer resolution and JIT effects, which is why the counts are the reliable basis for comparison.
