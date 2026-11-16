# DAA viva questions and answers

47 questions (30 core, 17 follow-up). Generated from `src/data/vivaQuestions.ts`, Kept for viva preparation; it is not part of the web app.

## Core questions

### 1. Why was this problem selected?
*Topic: Project*

Warehouses, hospitals and factories increasingly use fleets of mobile robots. Coordinating them combines several classic DAA problems at once — shortest paths on graphs, the assignment problem, priority queues and dynamic re-optimisation — and every algorithm choice has a visible effect, which makes it ideal for demonstrating design and analysis trade-offs.

### 2. Why use A*?
*Topic: Pathfinding*

A* returns an optimal path when its heuristic is admissible, and the heuristic steers the search towards the goal, so it usually expands far fewer nodes than Dijkstra or BFS. Manhattan distance is admissible and consistent on our 4-connected unit grid, so A* is both optimal and never has to re-open a closed node.

### 3. Why not BFS for route planning?
*Topic: Pathfinding*

On a unit-cost grid BFS also finds shortest paths, and we do use it to build distance fields for allocation. But BFS has no sense of direction: it explores every node closer than the goal. A* reaches the same optimal path while exploring a narrow region. A* also generalises to weighted terrain, where BFS is no longer correct.

### 4. How does Dijkstra’s algorithm work?
*Topic: Pathfinding*

It keeps tentative distances, starting with 0 at the source and ∞ elsewhere. It repeatedly removes the unsettled node with the smallest distance from a min-priority queue, marks it settled — its distance is now final because weights are non-negative — and relaxes every outgoing edge. We stop as soon as the goal is settled.

### 5. What is an admissible heuristic?
*Topic: Pathfinding*

A heuristic h is admissible if it never over-estimates the true remaining cost: h(n) ≤ h*(n) for every node n. Admissibility guarantees that A* (tree search, or graph search with a consistent heuristic) returns an optimal path.

### 6. Is A* always optimal?
*Topic: Pathfinding*

Only under conditions. With an admissible heuristic A* is optimal; for graph search with a closed set we also want consistency (h(u) ≤ c(u,v) + h(v)), otherwise closed nodes may need re-opening. With an over-estimating heuristic A* can return a sub-optimal path. Our Manhattan heuristic is admissible and consistent, so our paths are optimal — the tests confirm that A*, Dijkstra and BFS always agree on length.

### 7. What is Manhattan distance?
*Topic: Pathfinding*

|r₁ − r₂| + |c₁ − c₂| — the number of horizontal plus vertical moves between two cells if there were no obstacles. With 4-directional unit-cost movement it is a lower bound on the true path length.

### 8. What is a priority queue?
*Topic: Data structures*

An abstract data type that stores items with priorities and supports insert and extract-min (or max). A* uses it as the open set ordered by f, Dijkstra by distance. We implement it as a binary min-heap.

### 9. What is a min heap?
*Topic: Data structures*

A complete binary tree stored in an array where every parent is ≤ its children, so the minimum is at index 0. Insert appends and sifts up; extract-min moves the last element to the root and sifts down. Both are O(log n); peek is O(1). Parent of i is ⌊(i − 1)/2⌋, children are 2i + 1 and 2i + 2.

### 10. What is graph traversal?
*Topic: Pathfinding*

Systematically visiting the vertices of a graph by following edges. BFS uses a queue and visits in layers of distance; DFS uses a stack and goes deep first; best-first searches such as Dijkstra and A* use a priority queue to choose the next vertex.

### 11. How is the grid converted into a graph?
*Topic: Pathfinding*

Every walkable cell is a vertex identified by key = row × cols + col. Two vertices are joined by an undirected edge of weight 1 when the cells are 4-adjacent and both are free. The graph is implicit: neighbours are generated on demand, so we never store an adjacency list (saves O(E) memory). Obstacles and failed robots simply remove vertices.

### 12. What is task allocation?
*Topic: Allocation*

Deciding which robot performs which task so that an objective — here a weighted cost of distance, workload, priority and finish time — is minimised, subject to constraints such as robot capacity, reachability and robot availability.

### 13. How does Greedy allocation work?
*Topic: Allocation*

Tasks are sorted by priority, then for each task we compute the cost for every eligible robot and assign it to the cheapest one, updating that robot’s workload, backlog and anchor position before moving to the next task. Ties go to the lower workload, then the lower robot id.

### 14. What is the Hungarian algorithm?
*Topic: Allocation*

A polynomial-time algorithm (Kuhn 1955, Munkres 1957) that solves the assignment problem: given an n×n cost matrix, find a one-to-one matching with minimum total cost. Our version uses row/column potentials and shortest augmenting paths and runs in O(n³).

### 15. What is bipartite matching?
*Topic: Allocation*

A bipartite graph has two vertex sets (robots and tasks) with edges only between them. A matching is a set of edges with no shared vertex. The minimum-cost perfect matching is exactly the assignment problem.

### 16. What is the assignment problem?
*Topic: Allocation*

Minimise Σ c[i][σ(i)] over all one-to-one assignments σ of n agents to n jobs. As an LP its constraint matrix is totally unimodular, so the LP optimum is integral; the Hungarian algorithm is a primal-dual method for it.

### 17. What happens when a robot fails?
*Topic: Dynamics*

The engine (1) logs the failure, (2) moves the robot to FAILED, (3) stops it, (4) collects its current and queued tasks, (5) releases them to UNASSIGNED with progress reset, (6) excludes the robot from allocation, (7–8) re-runs the selected allocator over the surviving robots, (9) replans any robot whose route crossed the failed robot’s cell, and (10) carries on next tick. A notification summarises affected tasks, new assignments and replans.

### 18. How are unfinished tasks recovered?
*Topic: Dynamics*

releaseTask() returns each unfinished task to UNASSIGNED, keeps its full history, and sets awaitingReallocation. The next allocation treats it like any open task; when it is assigned again the reallocation counter and the task’s reassignCount increase. Completed tasks are never touched because COMPLETED is a terminal state.

### 19. How is a blocked path detected?
*Topic: Dynamics*

Whenever a cell becomes blocked (new obstacle or a robot failing on it) invalidatePathsThrough() scans every active robot’s remaining route, path[pathIndex+1 …], for that cell key. As a safety net, advance() also checks that the next cell is walkable before every move.

### 20. How does dynamic replanning work?
*Topic: Dynamics*

The affected robot is reported as "Route blocked" and switches to REPLANNING (shown as "Rerouting"), the selected planner runs again from its current position with failed robots as extra obstacles, and it returns to MOVING with the new route ("New route found"). If no route exists the task is released; the allocator then marks it BLOCKED if no robot can reach it and retries when the environment changes.

### 21. What is the difference between static and dynamic environments?
*Topic: Dynamics*

In a static environment the graph never changes, so a path computed once stays valid. In a dynamic one, vertices disappear (obstacles, failed robots) or appear (obstacles removed), so plans must be monitored and recomputed. Our engine handles both, and every change is timestamped in the event log.

### 22. What are the complexities of the implemented algorithms?
*Topic: Complexity*

A* and Dijkstra with a binary heap: O((V + E) log V) time, O(V) space; on the grid E ≤ 4V so O(V log V). BFS: O(V + E). Greedy: O(T log T + T·R + A·V) with A ≤ R + T BFS runs. Hungarian: O(N³) per batch with N = max(R, T), O(N²) space. Min-heap push/pop: O(log n).

### 23. Why are multiple robots useful?
*Topic: Project*

Parallelism shortens total completion time, and redundancy gives fault tolerance — when one robot fails others absorb its work. The cost is coordination: deciding who does what and keeping routes valid as the shared environment changes.

### 24. How are assignment costs calculated?
*Topic: Allocation*

Cost(R,T) = α·D/(rows+cols) + β·W/capacity + γ·P + δ·L/(2·(rows+cols)). D is the BFS distance from the robot’s anchor, W is tasks already queued, P = (5 − priority)/4, and L = backlog + D + duration is the estimated finish time. Normalisation keeps each term roughly in [0, 1] so the weights are comparable across grid sizes.

### 25. How does task priority affect allocation?
*Topic: Allocation*

Three ways. Greedy processes tasks in priority order, so urgent tasks pick robots first. The penalty P is 0 for critical and 1 for low tasks, so when tasks compete for limited robots (Hungarian with more tasks than robots) urgent ones win. And a newly assigned critical task pre-empts lower-priority travel — but never interrupts a task already being executed.

### 26. How are unreachable tasks handled?
*Topic: Allocation*

The allocator checks BFS reachability. If no operational robot can reach a task it is marked BLOCKED and logged as critical. Whenever the environment changes (obstacle removed, robot restored) allocation runs again and the task returns to UNASSIGNED if it has become reachable. Unreachable paths are never silently ignored.

### 27. What are the limitations of the project?
*Topic: Project*

Robots move one cell per tick and may share a cell with another moving robot (no full multi-agent collision avoidance — failed robots are the only robot-shaped obstacles). Replanning is from scratch rather than incremental. Hungarian is optimal per batch, not for the full multi-task schedule. Queued-task travel in the cost estimate uses Manhattan distance. Timings depend on the browser and machine. Accounts are stored locally.

### 28. How do you benchmark algorithms?
*Topic: Complexity*

Run them on identical inputs (same grid and start/goal pairs, or the same cost matrix), measure machine-independent counts — nodes expanded, heap pushes, cost evaluations, inner-loop operations — plus wall-clock time with performance.now(), repeat over many inputs and report averages. Correctness is checked at the same time (equal path lengths, Hungarian ≤ Greedy).

### 29. What is the difference between theoretical and empirical complexity?
*Topic: Complexity*

Theoretical complexity is an asymptotic bound on operations as input grows, independent of hardware. Empirical complexity is what we measure on real inputs: it includes constant factors, cache effects, JIT warm-up and the shape of the specific instance. Both matter — e.g. A* and Dijkstra share the same worst-case bound but A* explores far fewer nodes in practice.

### 30. How can this system be extended?
*Topic: Extensions*

Conflict-based search or reservation tables for collision-free multi-agent paths; D* Lite for incremental replanning; weighted terrain and diagonal moves; battery models and charging tasks; auction-based or market allocation; batching tasks into routes (vehicle routing); a backend for multi-user sessions and persistent experiments.

## Follow-up questions

### 31. What is a consistent (monotone) heuristic and why does it matter?
*Topic: Pathfinding*

h is consistent if h(u) ≤ c(u, v) + h(v) for every edge and h(goal) = 0. Then f never decreases along a path, so when A* pops a node its g value is already optimal and it never needs to re-open closed nodes. Every consistent heuristic is admissible, but not vice versa.

### 32. What happens if you use Euclidean distance instead of Manhattan here?
*Topic: Pathfinding*

It stays admissible (Euclidean ≤ Manhattan), so paths remain optimal, but it is a weaker lower bound on a 4-connected grid, so A* expands more nodes. Manhattan is the tightest simple admissible heuristic for 4-directional unit moves.

### 33. Why do you use lazy deletion instead of decrease-key?
*Topic: Pathfinding*

A binary heap does not support efficient decrease-key without an index map. Pushing a duplicate entry with the better priority and skipping stale entries when popped (checking the closed/settled flag) is simpler and keeps O((V + E) log V), since the heap holds at most O(E) entries.

### 34. How do you break ties in A*, and why?
*Topic: Pathfinding*

By smaller h, then insertion order. Among equal-f nodes, preferring smaller h favours nodes closer to the goal, which reduces expansions on open grids. The insertion counter makes the whole run deterministic, which the demo and tests rely on.

### 35. Why does Dijkstra fail with negative edge weights?
*Topic: Pathfinding*

The greedy invariant “a popped node’s distance is final” breaks: a later negative edge could still lower it. Bellman–Ford (O(VE)) handles negative edges and detects negative cycles.

### 36. Why is Greedy not optimal? Give an example.
*Topic: Allocation*

Robots A and B, tasks X and Y with costs A–X = 1, A–Y = 2, B–X = 2, B–Y = 100. Greedy processing X first gives X→A (1), then Y→B (100): total 101. The optimum is A–Y (2) + B–X (2) = 4. The Hungarian algorithm finds 4.

### 37. How do you handle more tasks than robots in the Hungarian algorithm?
*Topic: Allocation*

The R×T matrix is padded with zero-cost dummy rows to make it square. A task matched to a dummy row is not assigned in that batch. We then run further batches with updated robot anchors and workloads until tasks or capacity run out.

### 38. Is your Hungarian-based allocation globally optimal for multiple tasks per robot?
*Topic: Allocation*

No, and the project does not claim that. Each batch is an optimal one-to-one assignment for the costs at that moment. Giving several tasks to one robot creates routing interactions (the order of visits matters), which makes the full problem a vehicle-routing problem — NP-hard. Repeated batches are a principled approximation.

### 39. How are infeasible robot-task pairs represented in the matrix?
*Topic: Allocation*

They get a very large cost (BIG = 10⁷). Since a BIG pair is only chosen if no perfect matching avoids it, the solver first maximises the number of feasible pairs and then minimises real cost. Any BIG pair in the result is discarded as unassigned.

### 40. Why does the priority term never change which robot wins for a single task?
*Topic: Allocation*

P depends only on the task, so γP adds the same amount to every robot’s cost for that task. It changes which tasks are served first when tasks compete (Hungarian batches, Greedy order), not which robot is cheapest for one task.

### 41. How do you guarantee the simulation is deterministic?
*Topic: Dynamics*

There is no randomness inside the engine: robots update in fixed id order, the heaps use insertion counters for tie-breaking, allocation sorts tasks deterministically and breaks ties by id, and scenario events are scheduled at fixed ticks. Random scenarios use a seeded PRNG (Mulberry32). A test runs the demo twice and compares the full event logs.

### 42. Why separate the simulation engine from React?
*Topic: Dynamics*

So the algorithms and state transitions are testable without a browser, and so animation can never change state. The engine advances only in step(); React subscribes through useSyncExternalStore and redraws. Robot motion is a CSS transform interpolating between engine positions.

### 43. How do you prevent inconsistent states?
*Topic: Dynamics*

Explicit transition tables for robots and tasks (transitionRobot / transitionTask throw on illegal moves, e.g. FAILED → MOVING or COMPLETED → ASSIGNED), plus an invariant checker that verifies no task is held by two robots, failed robots hold nothing, and so on. A randomised stress test applies hundreds of random actions and checks every invariant after every tick.

### 44. Why is Hungarian O(n³)?
*Topic: Complexity*

There are n phases, one per row. Each phase adds at most n columns to the alternating tree; each addition scans O(n) columns to update slacks and adjust potentials. That is O(n²) per phase and O(n³) in total.

### 45. What is the space complexity of the whole simulation per tick?
*Topic: Complexity*

O(V) for the grid, O(R + T) for robots and tasks, O(V) per path search, and O(A·V) for cached BFS fields during allocation (A ≤ R + T), plus O(N²) for a Hungarian matrix. The event log and history are capped (3 000 entries each).

### 46. Why might A* be slower in milliseconds than Dijkstra on a tiny grid even though it explores fewer nodes?
*Topic: Complexity*

Per-node work is higher (heuristic evaluation, larger heap entries), and at microsecond scale timer resolution, JIT warm-up and garbage collection dominate. That is why we report node counts separately from machine-dependent time.

### 47. How would you add collision avoidance between moving robots?
*Topic: Extensions*

Use a space-time reservation table (cooperative A* over (cell, time) states) or Conflict-Based Search, which plans robots independently and resolves conflicts by adding constraints in a high-level search tree. Both are well-studied multi-agent path finding (MAPF) methods.
