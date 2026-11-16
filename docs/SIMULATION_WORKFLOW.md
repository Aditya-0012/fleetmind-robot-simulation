# Simulation workflow

## The tick (`SimulationEngine.step`)

One tick = one simulated second.

1. `tick += 1`
2. **Scheduled actions** due at this tick run in order (failures, restores, obstacles, route blocks, new tasks, priority changes).
3. **Allocation** runs if anything changed since the last allocation (new or released tasks, freed capacity, failure/restore, obstacle added or removed, priority change).
4. **Robots update** in id order through their state machines:
   - `IDLE/COMPLETED` with queued work → `ASSIGNED`
   - `ASSIGNED` → pop the highest-priority queued task (task → `IN_PROGRESS`), plan the route, then `MOVING` and the first step (or `EXECUTING` if already there)
   - `MOVING` → check that the next cell is walkable, then move one cell; on arrival → `EXECUTING`
   - `EXECUTING` → progress + 1; when done, task → `COMPLETED` and the robot goes to `ASSIGNED` (more work) or `COMPLETED`
   - `WAITING` → after its wait, replan or pick the next task
   - `REPLANNING` → run the planner again
   - `FAILED` → nothing
5. A **metrics sample** is recorded and **completion** is checked: nothing in progress, and nothing more that can be assigned.

## State machines

Robot: `IDLE → ASSIGNED → MOVING ⇄ REPLANNING → EXECUTING → ASSIGNED | COMPLETED`, plus `WAITING`, and `* → FAILED → IDLE` (restore). A failed robot can only go to IDLE.

Task: `UNASSIGNED → ASSIGNED → IN_PROGRESS → COMPLETED` (terminal), with release edges back to `UNASSIGNED`, `BLOCKED ⇄ UNASSIGNED`, and `IN_PROGRESS → ASSIGNED` for pre-emption.

Illegal transitions throw `InvalidTransitionError`. Tests drive hundreds of random actions and assert that none occurs.

## Robot failure (`FailureManager.failRobot`)

1. Log the failure (critical).
2. Robot → `FAILED`; record `failedAt`.
3. Stop: clear path, queue, current task and execution.
4. Collect the unfinished tasks (current + queued). Completed tasks are untouched.
5. `releaseTask` each one → `UNASSIGNED`: progress reset, history kept, flagged `awaitingReallocation`.
6. The failed robot is now excluded from allocation, and its cell is an obstacle for others.
7. Replan any robot whose remaining route crosses the failed robot's cell.
8. Run allocation immediately over the surviving robots. Each re-assignment of a released task counts as a **reallocation**.
9. New owners plan their routes when they start the task.
10. Raise a **failure-recovery notification**: affected tasks, n/m reassigned, the new pairs, tasks still waiting, and replanned robots.

## Dynamic obstacle (`placeObstacle` → `invalidatePathsThrough`)

1. Validate the cell (in bounds, not an obstacle, no robot, no active task).
2. Mark it as an obstacle.
3. For every robot in `MOVING/WAITING/REPLANNING` whose remaining route uses the cell, log **Route blocked** → state `REPLANNING` (shown as *Rerouting*) → **Rerouting…** → run the selected planner from the current cell. The result is **New route found** with the old and new length, or, if no route exists, the task is released and the robot goes `WAITING`.
4. Mark allocation dirty. Tasks that nobody can reach become `BLOCKED` and are retried after the next environment change.

## Emergency / priority

New critical tasks are allocated first. If the chosen robot is travelling to a lower-priority task (not executing), it **pre-empts**: the old task returns to its queue and the critical one becomes current next tick. Changing a task's priority re-sorts its robot's queue.

## Determinism

The engine contains no randomness. Robots update in fixed id order, heaps break ties by insertion counter, allocators sort deterministically and break ties by id, and scenario events fire at fixed ticks. Random scenarios use a seeded Mulberry32 PRNG. A test runs the demo twice and compares the full event log.
