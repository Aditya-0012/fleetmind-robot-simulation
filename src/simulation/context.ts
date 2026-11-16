import type { EventType, Notice, Severity } from '../models/Event';
import type { Robot } from '../models/Robot';
import type { SimState } from '../models/SimulationState';
import type { Task } from '../models/Task';
import { toKey } from '../models/Grid';

/** Shared surface the manager modules use to read state and report what happened. */
export interface EngineContext {
  state: SimState;
  log(type: EventType, severity: Severity, message: string, refs?: { robotId?: string; taskId?: string }): void;
  notify(notice: Omit<Notice, 'id' | 'tick'>): void;
  markAllocationDirty(): void;
  robot(id: string): Robot | undefined;
  task(id: string): Task | undefined;
}

/** Cells occupied by failed robots act as obstacles for everyone else. */
export function failedRobotCells(state: SimState, exceptRobotId?: string): Set<number> {
  const s = new Set<number>();
  for (const r of state.robots) {
    if (r.state === 'FAILED' && r.id !== exceptRobotId) s.add(toKey(r.position, state.grid.cols));
  }
  return s;
}
