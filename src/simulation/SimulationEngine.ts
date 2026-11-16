import { DEFAULT_WEIGHTS } from '../algorithms/allocation/types';
import type { AllocationAlgorithm, CostWeights } from '../algorithms/allocation/types';
import type { PathAlgorithm } from '../algorithms/pathfinding/types';
import { clampPriority } from '../algorithms/allocation/costFunction';
import { createGrid, inBounds, isObstacle, pointLabel, samePoint, setObstacle, toKey } from '../models/Grid';
import type { Point } from '../models/Grid';
import type { EventType, Notice, Severity, SimEvent } from '../models/Event';
import { createRobot } from '../models/Robot';
import type { Robot } from '../models/Robot';
import { PRIORITY_LABEL, createTask } from '../models/Task';
import type { Task } from '../models/Task';
import { emptyMetrics } from '../models/SimulationState';
import type { MetricSample, ScenarioDefinition, ScheduledAction, SimConfig, SimState } from '../models/SimulationState';
import type { EngineContext } from './context';
import { runAllocation } from './AllocationManager';
import { failRobot, restoreRobot } from './FailureManager';
import type { FailureReport } from './FailureManager';
import { invalidatePathsThrough } from './ReplanningManager';
import { updateRobot } from './RobotManager';
import { sortQueue } from './TaskManager';

export const DEFAULT_CONFIG: SimConfig = {
  pathAlgorithm: 'astar',
  allocationAlgorithm: 'greedy',
  weights: { ...DEFAULT_WEIGHTS },
  capacity: 4,
  showSearch: true,
};

const MAX_EVENTS = 3000;
const MAX_HISTORY = 3000;

export interface CommandResult {
  ok: boolean;
  message: string;
}

/**
 * Deterministic, tick-based simulation engine.
 *
 * The engine owns ALL simulation state. React never mutates it; the UI only calls the public
 * command methods and re-renders when `subscribe` fires. Animation is purely cosmetic and
 * interpolates between engine positions — it can never move a robot by itself.
 *
 * One call to step() = one tick = one simulated second:
 *   1. run scheduled scenario actions due this tick
 *   2. run task allocation if anything changed (new tasks, freed capacity, failures…)
 *   3. update every robot in id order (plan / move one cell / execute / wait)
 *   4. record a metrics sample and detect completion
 * Given the same scenario and the same commands at the same ticks, the run is identical.
 */
export class SimulationEngine implements EngineContext {
  state!: SimState;
  private scenario!: ScenarioDefinition;
  private listeners = new Set<() => void>();
  private eventSeq = 0;
  private noticeSeq = 0;
  private allocationDirty = true;
  private robotIndex = new Map<string, Robot>();
  private taskIndex = new Map<string, Task>();
  /** Incremented on every change; used as the React external-store snapshot. */
  version = 0;
  private userConfig: Partial<SimConfig> = {};

  constructor(scenario: ScenarioDefinition, config: Partial<SimConfig> = {}) {
    this.userConfig = { ...config };
    this.load(scenario);
  }

  // ───────────────────────────── lifecycle ─────────────────────────────

  /** Loads a scenario from scratch. User-chosen algorithms/weights survive scenario changes. */
  load(scenario: ScenarioDefinition, configOverride?: Partial<SimConfig>): void {
    this.scenario = scenario;
    if (configOverride) this.userConfig = { ...this.userConfig, ...configOverride };
    const grid = createGrid(scenario.rows, scenario.cols);
    for (const o of scenario.obstacles) if (inBounds(grid, o)) setObstacle(grid, o, true);
    const robots = scenario.robots.map((p, i) => createRobot(i, p));
    const tasks = scenario.tasks.map((t, i) => createTask(`T${i + 1}`, t.cell, clampPriority(t.priority), t.duration, 0));
    const config: SimConfig = {
      ...DEFAULT_CONFIG,
      ...scenario.config,
      ...this.userConfig,
      weights: { ...DEFAULT_CONFIG.weights, ...scenario.config?.weights, ...this.userConfig.weights },
    };
    this.state = {
      scenarioId: scenario.id,
      scenarioName: scenario.name,
      tick: 0,
      finished: false,
      grid,
      robots,
      tasks,
      events: [],
      notices: [],
      config,
      metrics: emptyMetrics(),
      history: [],
      scheduled: [...scenario.events].sort((a, b) => a.at - b.at),
      lastAllocation: null,
      lastSearch: null,
      nextTaskNumber: tasks.length + 1,
    };
    this.reindex();
    this.eventSeq = 0;
    this.noticeSeq = 0;
    this.allocationDirty = true;
    this.log('SIMULATION', 'info', `Scenario "${scenario.name}" loaded: ${scenario.rows}×${scenario.cols} grid, ${robots.length} robots, ${tasks.length} tasks`);
    this.sample();
    this.emit();
  }

  /** Restores the current scenario's clean initial state (clears search overlays, logs, metrics). */
  reset(): void {
    this.load(this.scenario);
  }

  getScenario(): ScenarioDefinition {
    return this.scenario;
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(): void {
    this.version++;
    for (const fn of this.listeners) fn();
  }

  // ───────────────────────────── EngineContext ─────────────────────────────

  log(type: EventType, severity: Severity, message: string, refs: { robotId?: string; taskId?: string } = {}): void {
    const ev: SimEvent = { id: ++this.eventSeq, tick: this.state.tick, type, severity, message, ...refs };
    this.state.events.push(ev);
    if (this.state.events.length > MAX_EVENTS) this.state.events.splice(0, this.state.events.length - MAX_EVENTS);
  }

  notify(n: Omit<Notice, 'id' | 'tick'>): void {
    this.state.notices.push({ ...n, id: ++this.noticeSeq, tick: this.state.tick });
    if (this.state.notices.length > 100) this.state.notices.shift();
  }

  markAllocationDirty(): void {
    this.allocationDirty = true;
  }

  robot(id: string): Robot | undefined {
    return this.robotIndex.get(id);
  }

  task(id: string): Task | undefined {
    return this.taskIndex.get(id);
  }

  private reindex(): void {
    this.robotIndex = new Map(this.state.robots.map((r) => [r.id, r]));
    this.taskIndex = new Map(this.state.tasks.map((t) => [t.id, t]));
  }

  // ───────────────────────────── the tick ─────────────────────────────

  step(): void {
    const s = this.state;
    s.tick++;
    if (s.tick === 1) this.log('SIMULATION', 'info', 'Simulation started');

    // 1. scheduled scenario actions
    while (s.scheduled.length > 0 && s.scheduled[0].at <= s.tick) {
      this.execute(s.scheduled.shift() as ScheduledAction);
    }

    // 2. allocation when something changed
    if (this.allocationDirty) {
      this.allocationDirty = false;
      runAllocation(this, s.tick === 1 ? 'initial' : 'update');
    }

    // 3. robots, in deterministic id order
    for (const robot of s.robots) updateRobot(this, robot);

    // 4. bookkeeping
    this.sample();
    const done = this.computeFinished();
    if (done && !s.finished) {
      const completed = s.tasks.filter((t) => t.status === 'COMPLETED').length;
      this.log('SIMULATION', 'success', `Mission complete: ${completed}/${s.tasks.length} tasks completed`);
      this.notify({
        kind: 'success',
        severity: 'success',
        title: 'Mission complete',
        lines: [`${completed} of ${s.tasks.length} tasks completed at ${s.tick}s`],
      });
    }
    s.finished = done;
    this.emit();
  }

  /** Runs up to `maxTicks` ticks or until finished. Used by tests and analytics. */
  runUntilFinished(maxTicks = 5000): number {
    let n = 0;
    while (n < maxTicks && !(this.state.finished && this.state.scheduled.length === 0)) {
      this.step();
      n++;
    }
    return n;
  }

  /** Finished = nothing in progress and nothing more can be assigned. */
  private computeFinished(): boolean {
    const s = this.state;
    if (s.scheduled.length > 0) return false;
    if (s.tasks.length === 0) return false;
    const operational = s.robots.some((r) => r.state !== 'FAILED');
    const open = s.tasks.some((t) => t.status === 'UNASSIGNED' || t.status === 'BLOCKED');
    if (this.allocationDirty && operational && open) return false; // a pending re-allocation could still help
    const anyActive = s.tasks.some((t) => t.status === 'ASSIGNED' || t.status === 'IN_PROGRESS');
    if (anyActive) return false;
    const anyBusyRobot = s.robots.some((r) => r.state === 'MOVING' || r.state === 'EXECUTING' || r.state === 'REPLANNING');
    if (anyBusyRobot) return false;
    const assignable = s.tasks.some((t) => t.status === 'UNASSIGNED');
    return !(operational && assignable);
  }

  private sample(): void {
    const s = this.state;
    const count = (st: Task['status']) => s.tasks.filter((t) => t.status === st).length;
    const sample: MetricSample = {
      tick: s.tick,
      completed: count('COMPLETED'),
      inProgress: count('IN_PROGRESS'),
      pending: count('UNASSIGNED') + count('ASSIGNED'),
      blocked: count('BLOCKED'),
      distance: s.robots.reduce((a, r) => a + r.distanceTravelled, 0),
      activeRobots: s.robots.filter((r) => r.state !== 'FAILED').length,
      failedRobots: s.robots.filter((r) => r.state === 'FAILED').length,
      replans: s.metrics.replans,
      reallocations: s.metrics.reallocations,
      nodesExplored: s.metrics.nodesExplored,
    };
    const last = s.history[s.history.length - 1];
    if (last && last.tick === sample.tick) s.history[s.history.length - 1] = sample;
    else s.history.push(sample);
    if (s.history.length > MAX_HISTORY) s.history.shift();
  }

  // ───────────────────────────── scheduling ─────────────────────────────

  schedule(action: ScheduledAction): void {
    this.state.scheduled.push(action);
    this.state.scheduled.sort((a, b) => a.at - b.at);
    this.emit();
  }

  private execute(a: ScheduledAction): void {
    const src = 'scheduled';
    switch (a.type) {
      case 'fail':
        failRobot(this, a.robotId, a.label ?? src);
        break;
      case 'restore':
        restoreRobot(this, a.robotId, a.label ?? src);
        break;
      case 'obstacle':
        this.placeObstacle(a.cell, a.label ?? src);
        break;
      case 'blockPath':
        this.blockActivePathInternal(a.robotId, a.label ?? src);
        break;
      case 'task':
        this.addTaskInternal(a.cell, a.priority, a.duration, a.label ?? src);
        break;
      case 'priority':
        this.setPriorityInternal(a.taskId, a.priority);
        break;
    }
  }

  // ───────────────────────────── commands (UI) ─────────────────────────────

  setPathAlgorithm(alg: PathAlgorithm): void {
    this.state.config.pathAlgorithm = alg;
    this.userConfig.pathAlgorithm = alg;
    this.log('SIMULATION', 'info', `Routing method set to ${alg === 'astar' ? 'targeted routing' : 'exhaustive routing'}`);
    this.emit();
  }

  setAllocationAlgorithm(alg: AllocationAlgorithm): void {
    this.state.config.allocationAlgorithm = alg;
    this.userConfig.allocationAlgorithm = alg;
    this.log('SIMULATION', 'info', `Dispatch method set to ${alg === 'greedy' ? 'quick dispatch' : 'optimized dispatch'}`);
    this.emit();
  }

  setWeights(w: CostWeights): void {
    this.state.config.weights = { ...w };
    this.userConfig.weights = { ...w };
    this.emit();
  }

  setCapacity(c: number): void {
    this.state.config.capacity = Math.max(1, Math.round(c));
    this.userConfig.capacity = this.state.config.capacity;
    this.allocationDirty = true;
    this.emit();
  }

  setShowSearch(v: boolean): void {
    this.state.config.showSearch = v;
    this.userConfig.showSearch = v;
    if (!v) this.state.lastSearch = null;
    this.emit();
  }

  /** Why a cell cannot take a new obstacle or task, or null when it is free. */
  cellConflict(p: Point): string | null {
    const s = this.state;
    if (!inBounds(s.grid, p)) return 'Cell is outside the grid';
    if (isObstacle(s.grid, p)) return 'Cell is an obstacle';
    const robot = s.robots.find((r) => samePoint(r.position, p));
    if (robot) return `${robot.id} is standing on this cell`;
    const task = s.tasks.find((t) => t.status !== 'COMPLETED' && samePoint(t.position, p));
    if (task) return `${task.id} is located on this cell`;
    return null;
  }

  toggleObstacle(p: Point): CommandResult {
    if (inBounds(this.state.grid, p) && isObstacle(this.state.grid, p)) return this.removeObstacle(p);
    return this.addObstacle(p);
  }

  addObstacle(p: Point): CommandResult {
    const r = this.placeObstacle(p, 'operator');
    this.emit();
    return r;
  }

  private placeObstacle(p: Point, source: string): CommandResult {
    const conflict = this.cellConflict(p);
    if (conflict) {
      if (source !== 'operator') this.log('OBSTACLE', 'warning', `Obstacle at ${pointLabel(p)} skipped — ${conflict}`);
      return { ok: false, message: conflict };
    }
    setObstacle(this.state.grid, p, true);
    this.state.metrics.obstaclesAdded++;
    this.log('OBSTACLE', 'warning', `Dynamic obstacle placed at ${pointLabel(p)} (${source})`);
    const affected = invalidatePathsThrough(this, toKey(p, this.state.grid.cols), 'obstacle');
    this.allocationDirty = true;
    return {
      ok: true,
      message: affected.length ? `Obstacle placed — rerouted ${affected.join(', ')}` : `Obstacle placed at ${pointLabel(p)}`,
    };
  }

  removeObstacle(p: Point): CommandResult {
    const s = this.state;
    if (!inBounds(s.grid, p) || !isObstacle(s.grid, p)) return { ok: false, message: 'No obstacle on this cell' };
    setObstacle(s.grid, p, false);
    this.log('OBSTACLE', 'info', `Obstacle removed at ${pointLabel(p)}`);
    this.allocationDirty = true; // blocked tasks may be reachable again
    this.emit();
    return { ok: true, message: `Obstacle removed at ${pointLabel(p)}` };
  }

  /** Drops an obstacle a few cells ahead on a moving robot's route to force replanning. */
  blockActivePath(robotId?: string): CommandResult {
    const r = this.blockActivePathInternal(robotId, 'operator');
    this.emit();
    return r;
  }

  private blockActivePathInternal(robotId: string | undefined, source: string): CommandResult {
    const s = this.state;
    const candidates = s.robots.filter(
      (r) => r.state === 'MOVING' && r.path.length - 1 - r.pathIndex >= 3 && (!robotId || r.id === robotId),
    );
    for (const robot of candidates) {
      for (let i = robot.pathIndex + 2; i < robot.path.length - 1; i++) {
        const cell = robot.path[i];
        if (this.cellConflict(cell)) continue;
        const res = this.placeObstacle(cell, source);
        if (res.ok) return { ok: true, message: `Blocked ${robot.id}'s route at ${pointLabel(cell)}` };
      }
    }
    const msg = robotId ? `${robotId} has no blockable route right now` : 'No moving robot with a long enough route';
    this.log('OBSTACLE', 'info', `Route block skipped — ${msg}`);
    return { ok: false, message: msg };
  }

  addTask(p: Point, priority: number, duration = 3): CommandResult {
    const r = this.addTaskInternal(p, priority, duration, 'operator');
    this.emit();
    return r;
  }

  private addTaskInternal(p: Point, priority: number, duration: number, source: string): CommandResult {
    const conflict = this.cellConflict(p);
    if (conflict) {
      if (source !== 'operator') this.log('TASK', 'warning', `Task at ${pointLabel(p)} skipped — ${conflict}`);
      return { ok: false, message: conflict };
    }
    const s = this.state;
    const id = `T${s.nextTaskNumber++}`;
    const task = createTask(id, p, clampPriority(priority), Math.max(1, Math.round(duration)), s.tick);
    s.tasks.push(task);
    this.taskIndex.set(id, task);
    const sev: Severity = task.priority >= 5 ? 'critical' : 'info';
    this.log('TASK', sev, `${task.priority >= 5 ? 'EMERGENCY task' : 'New task'} ${id} at ${pointLabel(p)} — ${PRIORITY_LABEL[task.priority]} priority (${source})`, { taskId: id });
    if (task.priority >= 5) {
      this.notify({ kind: 'warning', severity: 'warning', title: `Emergency task ${id}`, lines: [`Critical priority at ${pointLabel(p)}`, 'The nearest suitable robot will handle it before lower-priority work'] });
    }
    this.allocationDirty = true;
    s.finished = false;
    return { ok: true, message: `${id} created at ${pointLabel(p)}` };
  }

  setTaskPriority(taskId: string, priority: number): CommandResult {
    const r = this.setPriorityInternal(taskId, priority);
    this.emit();
    return r;
  }

  private setPriorityInternal(taskId: string, priority: number): CommandResult {
    const task = this.task(taskId);
    if (!task) return { ok: false, message: `Unknown task ${taskId}` };
    if (task.status === 'COMPLETED') return { ok: false, message: `${taskId} is already completed` };
    const p = clampPriority(priority);
    if (p === task.priority) return { ok: true, message: 'Priority unchanged' };
    const old = task.priority;
    task.priority = p;
    this.log('PRIORITY', 'info', `${task.id} priority ${PRIORITY_LABEL[old]} → ${PRIORITY_LABEL[p]}`, { taskId: task.id, robotId: task.assignedRobotId ?? undefined });
    if (task.assignedRobotId) {
      const robot = this.robot(task.assignedRobotId);
      if (robot) sortQueue(this, robot);
    }
    this.allocationDirty = true;
    return { ok: true, message: `${task.id} is now ${PRIORITY_LABEL[p]}` };
  }

  failRobot(robotId: string): FailureReport | null {
    const r = failRobot(this, robotId, 'operator');
    this.emit();
    return r;
  }

  restoreRobot(robotId: string): boolean {
    const ok = restoreRobot(this, robotId, 'operator');
    if (ok) this.state.finished = false;
    this.emit();
    return ok;
  }

  /** Fails several robots in the same tick. */
  failRobots(ids: string[]): (FailureReport | null)[] {
    const out = ids.map((id) => failRobot(this, id, 'multi-failure'));
    this.emit();
    return out;
  }

  clearEvents(): void {
    this.state.events = [];
    this.log('SIMULATION', 'info', 'Event log cleared');
    this.emit();
  }

  dismissNotice(id: number): void {
    this.state.notices = this.state.notices.filter((n) => n.id !== id);
    this.emit();
  }
}
