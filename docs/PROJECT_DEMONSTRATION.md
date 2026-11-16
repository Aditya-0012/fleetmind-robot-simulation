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
| **00:09** | **Pallet drops on a live route** | Event log: *PATH INVALIDATED → REPLANNING → NEW PATH GENERATED* |
| **00:13** | **Emergency task T9 (critical)** | Priority penalty P = 0. R3 pre-empts its lower-priority job (log: "R3 pre-empted T6 …") |
| ~00:16 | Emergency handled | T9 completed first |
| 00:20 | Second blockage | Another replan |
| ~00:43 | Mission complete | 9/9 tasks done despite 1 failure and 2 blockages |

Use **Pause** in the demo panel to stop at any step and click a robot or task to show the inspector (cost breakdown, task history).

## 3. Algorithms (2 min)

- **A\* tab → Search lab:** click *Run search*, then *Pause*. Choose *Inspect* and click a frontier cell to show g, h, f. Switch to Dijkstra and run again: same path, much larger explored region. Click *Compare*.
- **Hungarian tab → Assignment lab:** the default 2×2 "greedy trap" shows Greedy = 101 vs Hungarian = 4. Edit a cell to show both re-run live.

## 4. Performance (2 min)

Click all three *Run* buttons:
- A* vs Dijkstra on 40 identical pairs: equal path lengths, about 90 % fewer nodes for A*.
- Greedy vs Hungarian on one matrix: Hungarian total ≤ Greedy (green vs amber cells).
- 18 headless scenario runs.

Mention that timings vary by machine; node counts don't. Export CSV/JSON if asked.

## 5. Interactive robustness (1 min)

On **Live simulation** (Scenarios → load *Normal operation*, press Start):
- *Obstacle* tool on a robot's dashed route → immediate replan.
- *Fail / restore* on two robots, or **Multiple failures**.
- *Add task* with priority 5 → pre-emption.
- Switch to **Hungarian** and **Dijkstra** mid-run.

## Likely questions

See `VIVA_QUESTIONS.md`, especially: why A* is optimal here (admissible and consistent heuristic), why Greedy isn't optimal (counter-example), why Hungarian is O(n³), how multi-task allocation is modelled (repeated batches, not globally optimal), and how failures are handled (the 10-step pipeline).
