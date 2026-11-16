import { isObstacle, samePoint } from '../models/Grid';
import type { SimState } from '../models/SimulationState';

/**
 * Consistency checks over the whole simulation state. Used by the test-suite after every
 * tick of randomised runs, and shown as the "simulation health" indicator in the UI.
 */
export function checkInvariants(s: SimState): string[] {
  const errors: string[] = [];
  const owner = new Map<string, string>();

  for (const r of s.robots) {
    if (isObstacle(s.grid, r.position)) errors.push(`${r.id} stands on an obstacle`);
    if (r.state === 'FAILED' && (r.queue.length > 0 || r.currentTaskId)) errors.push(`Failed robot ${r.id} still holds tasks`);
    if ((r.state === 'MOVING' || r.state === 'EXECUTING') && !r.currentTaskId) errors.push(`${r.id} is ${r.state} without a task`);
    const held = [...(r.currentTaskId ? [r.currentTaskId] : []), ...r.queue];
    for (const id of held) {
      if (owner.has(id)) errors.push(`${id} held by both ${owner.get(id)} and ${r.id}`);
      owner.set(id, r.id);
      const t = s.tasks.find((x) => x.id === id);
      if (!t) {
        errors.push(`${r.id} holds unknown task ${id}`);
        continue;
      }
      if (t.status === 'COMPLETED') errors.push(`${r.id} holds completed task ${id}`);
      if (t.assignedRobotId !== r.id) errors.push(`${id} assigned to ${t.assignedRobotId} but held by ${r.id}`);
    }
    if (r.currentTaskId) {
      const t = s.tasks.find((x) => x.id === r.currentTaskId);
      if (t && t.status !== 'IN_PROGRESS') errors.push(`${r.id}'s current task ${t.id} is ${t.status}`);
      if (t && r.state === 'EXECUTING' && !samePoint(r.position, t.position)) errors.push(`${r.id} executing away from ${t.id}`);
    }
  }

  for (const t of s.tasks) {
    if (t.status === 'ASSIGNED' || t.status === 'IN_PROGRESS') {
      if (!t.assignedRobotId) errors.push(`${t.id} is ${t.status} with no robot`);
      else if (owner.get(t.id) !== t.assignedRobotId) errors.push(`${t.id} not found in ${t.assignedRobotId}'s queue`);
      const r = s.robots.find((x) => x.id === t.assignedRobotId);
      if (r?.state === 'FAILED') errors.push(`${t.id} assigned to failed robot ${r.id}`);
    }
    if ((t.status === 'UNASSIGNED' || t.status === 'BLOCKED' || t.status === 'COMPLETED') && owner.has(t.id)) {
      errors.push(`${t.id} is ${t.status} but held by ${owner.get(t.id)}`);
    }
  }
  const ids = s.tasks.map((t) => t.id);
  if (new Set(ids).size !== ids.length) errors.push('Duplicate task ids');
  return errors;
}
