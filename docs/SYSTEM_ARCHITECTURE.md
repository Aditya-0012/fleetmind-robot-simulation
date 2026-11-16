# System architecture

## Layers

| Layer | Folder | Responsibility | Depends on |
|---|---|---|---|
| Models | `src/models` | Plain data types: `GridData`, `Robot`, `Task`, `SimEvent`, `SimState`, `ScenarioDefinition`. Robot and task transition tables live here. | — |
| Algorithms | `src/algorithms` | Pure functions: `MinHeap`, `astar`, `dijkstra`, `bfsDistances`, `largestComponent`, `computeCost`, `greedyAllocate`, `hungarian`, `hungarianAllocate`. No UI, no engine state. | models |
| Simulation | `src/simulation` | Deterministic engine and its managers, clock, scenarios, generator, demo narration, invariants, metrics. | models, algorithms |
| Services | `src/services` | `authService` (local PBKDF2 accounts), `benchmarks` (headless comparisons). | algorithms, simulation |
| Context | `src/context` | `SimulationProvider` (one engine + clock for the whole app), `AuthProvider`. | simulation, services |
| UI | `src/components`, `src/pages` | Rendering and user commands only. | context |

No layer imports from a layer above it. The algorithms can be unit-tested without a browser, and the engine can run headless (tests, Performance page).

## Engine ↔ UI contract

- The engine (`SimulationEngine`) owns all mutable state. It exposes **commands** (`step`, `failRobot`, `restoreRobot`, `addObstacle`, `removeObstacle`, `toggleObstacle`, `blockActivePath`, `addTask`, `setTaskPriority`, `setPathAlgorithm`, `setAllocationAlgorithm`, `setWeights`, `setCapacity`, `load`, `reset`, `schedule`, `clearEvents`).
- After every change the engine bumps `version` and notifies subscribers. React reads it through `useSyncExternalStore`, so components re-render with consistent snapshots.
- `SimulationClock` decides only *when* `step()` is called (speed 0.5×–5×, pause, single step). It never changes *what* a step does, which keeps runs reproducible.
- Robot motion is a CSS `transform` transition between two engine positions. Animation cannot move a robot.

## Engine internals

```
SimulationEngine (implements EngineContext: state, log, notify, markAllocationDirty, robot(), task())
 ├─ AllocationManager.runAllocation   snapshot robots → allocate() → assignTask / BLOCKED
 ├─ TaskManager                       assignTask · releaseTask · completeTask · sortQueue · pre-emption
 ├─ RobotManager.updateRobot          per-tick state machine: plan → move → execute → next
 ├─ ReplanningManager                 planRoute (A*/Dijkstra) · invalidatePathsThrough(cell)
 ├─ FailureManager                    failRobot (10-step recovery) · restoreRobot
 ├─ stateMachine                      transitionRobot / transitionTask (throw on illegal moves)
 └─ invariants.checkInvariants        consistency checks used by tests + health indicator
```

## Authentication

`AuthProvider` wraps the router. `RequireAuth` redirects signed-out users to `/login` and remembers the requested page. `GuestOnly` sends signed-in users away from login/register. `localAuthService` stores `{id, name, email, role, salt, hash}` per user and a random session token with a 12-hour expiry. A demo account is created on first load. Replacing it with a server needs one new object that implements `AuthService`.

## Routing

`/login`, `/register` (guest only) · `/` Dashboard · `/simulation` · `/algorithms` · `/performance` · `/scenarios` · `/events` · `/theory` · `/viva` · `/about`. The heavier pages are code-split with `React.lazy`.
