# Project demonstration guide (≈ 10 minutes)

## Before the viva

```bash
npm install
npm run build && npm run preview   # or: npm run dev
```

Open the URL, sign in with **demo@fleetmind.dev / demo1234**, and keep the browser at full screen. Optionally run `npm test` beforehand and leave the terminal visible (99 passing tests).

## 1. Login and dashboard (1 min)

- On the login page, point out that the left side is the real engine running live, not a video.
- Dashboard: robot and task breakdowns and the 10 performance metrics, all derived from engine state. Click **Single step** twice to show the clock and metrics changing.

## 2. Combined failure scenario: Demo mode (4 min)

Click **Demo mode** (top right). Narrate the right-hand timeline as each step lights up:

| Time | What happens | What to say |
|---|---|---|
| 00:00 | Warehouse loaded | Grid → graph: free cells are vertices, 4-neighbour edges cost 1 |
| 00:01 | Initial allocation | BFS distance fields + `Cost = αD + βW + γP + δL`; Greedy gives each task to the cheapest robot |
| 00:01+ | Robots move | A*, f = g + h, Manhattan heuristic. The overlay shows explored nodes; the dashed line is the path |
| **00:05** | **R2 fails** | The toast shows affected tasks T3, T5, *2/2 reassigned*, and the new owners. R2 becomes an obstacle |
| 00:05 | Reassignment | Allocation re-ran over the surviving robots only. Completed work is untouched |
| **00:09** | **Pallet drops on a live route** | Event log: *Route blocked → Rerouting → New route found* (dynamic replanning) |
| **00:13** | **Emergency task T9 (critical)** | Priority penalty P = 0. R3 pre-empts its lower-priority job (log: "R3 pre-empted T6 …") |
| ~00:16 | Emergency handled | T9 completed first |
| 00:20 | Second blockage | Another replan |
| ~00:43 | Mission complete | 9/9 tasks done despite 1 failure and 2 blockages |

Use **Pause** in the demo panel to stop at any step and click a robot or task to show the inspector (cost breakdown, task history).

## 3. How it works (2 min)

The app uses plain names; say the technical name as you point: *Targeted routing = A\**, *Exhaustive routing = Dijkstra*, *Quick dispatch = Greedy*, *Optimized dispatch = Hungarian*.

- **Route planning tab → Route explorer:** click *Find route*, then *Pause*. Choose *Inspect* and click a purple cell: *Driven so far* = g(n), *Estimate left* = h(n), *Total estimate* = f(n). Switch to *Exhaustive* and run again: same route, much larger searched area. Click *Compare*.
- **Task dispatch tab → Dispatch lab:** the default 2×2 example shows Quick = 101 vs Optimized = 4. Edit a cell to show both re-run live.

## 4. Performance (2 min)

Click all three *Run* buttons:
- Targeted vs exhaustive routing on 40 identical trips: equal route lengths, about 90 % fewer cells searched by targeted (A\*).
- Quick vs optimized dispatch on one score table: optimized (Hungarian) total ≤ quick (Greedy).
- 18 headless scenario runs.

Mention that timings vary by machine; node counts don't. Export CSV/JSON if asked.

## 5. Interactive robustness (1 min)

On **Live simulation** (Scenarios → load *Normal operation*, press Start):
- *Obstacle* tool on a robot's dashed route → immediate replan.
- *Breakdown* on two robots, or **Multiple breakdowns**.
- *Add task* with priority 5 → pre-emption.
- Switch to **Optimized** dispatch and **Exhaustive** routing mid-run.

## Likely questions

See `VIVA_QUESTIONS.md`, especially: why A* is optimal here (admissible and consistent heuristic), why Greedy isn't optimal (counter-example), why Hungarian is O(n³), how multi-task allocation is modelled (repeated batches, not globally optimal), and how failures are handled (the 10-step pipeline).
