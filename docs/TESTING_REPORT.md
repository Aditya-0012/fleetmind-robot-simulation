# Testing report

Run with `npm test` (Vitest 5, jsdom). **Result: 6 files, 99 tests, all passing.** `npm run typecheck` reports no TypeScript errors, and `npm run build` succeeds.

| File | Tests | Covers |
|---|---|---|
| `tests/algorithms/pathfinding.test.ts` | 22 | Min-heap ordering (including 500 random ops vs a sorted array); Manhattan; for **both A\* and Dijkstra**: shortest path on an open grid, obstacle avoidance, unreachable goal, start = goal, invalid/out-of-bounds endpoints, boundaries, extra blocked cells (failed robots), state reset between runs; A\* vs Dijkstra vs BFS equal lengths on 60 random 25×25 grids, with A\* never exploring more nodes; f = g + h in traces |
| `tests/allocation/allocation.test.ts` | 21 | Cost formula exactness; priority penalty bounds; Hungarian on known 3×3 and 4×4 matrices; rectangular inputs both ways (dummy rows/columns); no duplicate columns over 50 random matrices; **optimality vs brute force on 80 random matrices**; Hungarian ≤ Greedy on 60 matrices; infeasible pairs; empty input. Greedy: cheapest robot, workload spreading, capacity and failed-robot exclusion, unreachable and no-robot reporting, priority ordering, deterministic tie-break. Hungarian batches: every reachable task assigned once, priority wins under scarcity, first batch ≤ Greedy |
| `tests/simulation/engine.test.ts` | 17 | Movement one cell per tick, arrival, execution, completion; robots follow the selected planner's path; determinism; failure releases and reallocates tasks; a failed robot never moves; no tasks to failed robots; completed tasks never reassigned; all-failed → BLOCKED, restore → completes; failed robot treated as an obstacle; obstacle on a route → "Route blocked" / "New route found" and completion; unaffected robots not replanned; no route → BLOCKED, removal → recovery; robots never on obstacles; invalid placements rejected; critical pre-emption; priority re-sorts queues; reset restores a clean state; scheduled actions fire on time; **300-tick randomised stress test** (obstacles, failures, restores, tasks, blocks, priority changes) under both allocators, with invariants checked every tick |
| `tests/simulation/stateMachine.test.ts` | 7 | Legal robot cycle; FAILED cannot move or take work; every state can fail; IDLE cannot jump to MOVING; COMPLETED is terminal (throws); illegal task jumps; release edges |
| `tests/scenarios/scenarios.test.ts` | 25 | All 6 predefined scenarios × {Greedy, Hungarian} complete with zero invariant violations; scenario entities on distinct walkable cells; **demo mode reaches all 10 narrated steps through real events**, with a monotone timeline, exactly one failure, ≥ 1 reallocation, ≥ 1 replan, the critical task completed and an identical event log on replay; generator reproducible by seed; all 9 size×density combinations produce valid, non-overlapping, fully reachable layouts with correct density; a generated scenario runs to completion |
| `tests/ui/app.test.tsx` | 7 | PBKDF2 auth (no plain-text password stored, duplicate email rejected, wrong password rejected, case-insensitive email, session); password validation; signed-out redirect to login; demo sign-in → dashboard with live counts, single step advances the clock, fail-busiest-robot updates the operational count; registration flow; viva page shows ≥ 40 questions; event-log type filter |

## Bugs found and fixed during testing

| Symptom | Cause | Fix |
|---|---|---|
| Invariant "T9 not found in R3's queue" in emergency scenarios | Pre-emption removed the critical task from the queue head | Keep the critical task at the head; only re-queue the interrupted task |
| `finished` stayed false right after the last task completed | Completion check waited for a pending re-allocation even with nothing left to allocate | Only wait when open tasks and operational robots exist |
| Browser: "Cannot add property, object is not extensible" | Recharts 3 freezes the data it receives; the engine's live history array was passed directly | Pass copies (`history.slice()`) |
| Duplicate notification toasts after restarting the demo | Notice ids restart per run, so toast keys collided | Unique toast keys; clear old toasts when the engine reloads; max 3 visible, each with its own timer |
| Map shifted when the inspector grew | Grid row stretched the map panel | `items-start` layout; map sized only by its aspect ratio |
| Edge labels clipped | viewBox had no margin | Padded viewBox with matching click hit-testing (verified in a real browser) |

## Manual / browser verification

The production build was served with `vite preview` and driven with headless Chrome (Playwright). Covered: login with demo credentials, start, demo mode end to end, every page, the Run search lab, all three Performance benchmarks, and map clicks hitting the correct cell (obstacle placed at the clicked cell, robot selected, failed from the inspector). **No console errors.**
