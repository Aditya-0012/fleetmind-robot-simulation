import { Ban, Box, CornerDownRight, MousePointer2, Plus, RotateCcw, ShieldAlert, Trash2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { useSim } from '../../context/SimulationContext';
import { isObstacle, pointLabel, samePoint } from '../../models/Grid';
import type { Point } from '../../models/Grid';
import { robotWorkload } from '../../models/Robot';
import { PRIORITY_LABEL } from '../../models/Task';
import { formatTick } from '../../models/Event';
import { PRIORITY_COLOR, ROBOT_STATE_COLOR, TASK_STATUS_COLOR } from '../../utils/format';
import { ROBOT_STATE_LABEL, TASK_STATUS_LABEL } from '../../utils/labels';
import { Badge, EmptyState, Segmented } from '../common/ui';
import { useToast } from '../common/Toaster';

export type Selection = { kind: 'robot'; id: string } | { kind: 'task'; id: string } | { kind: 'cell'; p: Point } | null;

function Row({ k, children }: { k: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1 text-sm">
      <dt className="text-ink-400">{k}</dt>
      <dd className="text-right text-ink-100">{children}</dd>
    </div>
  );
}

export function Inspector({ selection, onSelect }: { selection: Selection; onSelect: (s: Selection) => void }) {
  const { state, engine } = useSim();
  const toast = useToast();
  const report = (ok: boolean, message: string) => toast({ title: ok ? 'Done' : 'Not possible', lines: [message], severity: ok ? 'success' : 'warning', kind: ok ? 'success' : 'warning' });

  if (!selection)
    return (
      <EmptyState icon={<MousePointer2 size={22} />} title="Nothing selected">
        Click a robot, a task diamond or an empty cell on the map to inspect it. Use the tools on the left to place obstacles or tasks.
      </EmptyState>
    );

  if (selection.kind === 'robot') {
    const r = engine.robot(selection.id);
    if (!r) return null;
    const cur = r.currentTaskId ? engine.task(r.currentTaskId) : undefined;
    const remaining = r.path.length ? r.path.length - 1 - r.pathIndex : 0;
    return (
      <div>
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-lg font-display text-sm font-bold text-hull-950" style={{ backgroundColor: r.state === 'FAILED' ? '#FF5470' : r.color }}>
            {r.id}
          </span>
          <div>
            <p className="font-display text-lg font-semibold leading-none">Robot {r.id}</p>
            <div className="mt-1.5">
              <Badge color={ROBOT_STATE_COLOR[r.state]}>{ROBOT_STATE_LABEL[r.state]}</Badge>
            </div>
          </div>
        </div>
        <dl className="mt-4 divide-y divide-hull-800">
          <Row k="Position">{pointLabel(r.position)}</Row>
          <Row k="Current target">{cur ? `${cur.id} at ${pointLabel(cur.position)}` : '—'}</Row>
          <Row k="Route remaining">{remaining ? `${remaining} cells` : '—'}</Row>
          <Row k="Current load">{robotWorkload(r)} / {state.config.capacity} tasks</Row>
          <Row k="Up next">{r.queue.length ? r.queue.join(', ') : 'empty'}</Row>
          <Row k="Distance travelled">{r.distanceTravelled} cells</Row>
          <Row k="Completed">{r.completedTaskIds.length ? r.completedTaskIds.join(', ') : 'none yet'}</Row>
          <Row k="Reroutes · breakdowns">
            {r.replans} · {r.failures}
          </Row>
          {r.state === 'EXECUTING' && <Row k="Work left">{r.executionRemaining}s</Row>}
          {r.failedAt !== null && <Row k="Broke down at">{formatTick(r.failedAt)}</Row>}
        </dl>
        <div className="mt-4 flex flex-wrap gap-2">
          {r.state === 'FAILED' ? (
            <button className="btn-primary btn-sm" onClick={() => report(engine.restoreRobot(r.id), engine.robot(r.id)?.state === 'IDLE' ? `${r.id} restored` : 'Restore failed')}>
              <RotateCcw size={14} /> Repair robot
            </button>
          ) : (
            <button className="btn-danger btn-sm" onClick={() => engine.failRobot(r.id)}>
              <ShieldAlert size={14} /> Break down robot
            </button>
          )}
          <button className="btn-ghost btn-sm" disabled={r.state !== 'MOVING'} onClick={() => { const x = engine.blockActivePath(r.id); report(x.ok, x.message); }}>
            <Ban size={14} /> Block its route
          </button>
        </div>
      </div>
    );
  }

  if (selection.kind === 'task') {
    const t = engine.task(selection.id);
    if (!t) return null;
    const alloc = state.lastAllocation?.assignments.find((a) => a.taskId === t.id);
    return (
      <div>
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center">
            <span className="h-6 w-6 rotate-45 rounded-[3px] border-2" style={{ borderColor: PRIORITY_COLOR[t.priority], backgroundColor: `${PRIORITY_COLOR[t.priority]}33` }} />
          </span>
          <div>
            <p className="font-display text-lg font-semibold leading-none">Task {t.id}</p>
            <div className="mt-1.5">
              <Badge color={TASK_STATUS_COLOR[t.status]}>{TASK_STATUS_LABEL[t.status]}</Badge>
            </div>
          </div>
        </div>
        <div className="mt-4">
          <p className="label">Priority</p>
          <Segmented
            ariaLabel="Task priority"
            size="sm"
            value={t.priority}
            onChange={(p) => {
              const res = engine.setTaskPriority(t.id, p);
              if (!res.ok) report(false, res.message);
            }}
            options={[1, 2, 3, 4, 5].map((p) => ({ value: p, label: PRIORITY_LABEL[p], title: `Priority ${p}` }))}
          />
        </div>
        <dl className="mt-3 divide-y divide-hull-800">
          <Row k="Location">{pointLabel(t.position)}</Row>
          <Row k="Assigned robot">
            {t.assignedRobotId ? (
              <button className="text-signal-cyan hover:underline" onClick={() => onSelect({ kind: 'robot', id: t.assignedRobotId! })}>
                {t.assignedRobotId}
              </button>
            ) : t.completedBy ? (
              `done by ${t.completedBy}`
            ) : (
              '—'
            )}
          </Row>
          <Row k="Work">
            {t.progress} / {t.duration}s
          </Row>
          <Row k="Created">{formatTick(t.createdAt)}</Row>
          <Row k="Completed">{t.completedAt !== null ? `${formatTick(t.completedAt)} (${t.completedAt - t.createdAt}s)` : '—'}</Row>
          <Row k="Reassigned">{t.reassignCount}×</Row>
        </dl>
        {alloc && (
          <div className="panel-inset mt-3 p-3">
            <p className="text-xs font-medium text-ink-300">Why {alloc.robotId} was chosen (lower score = better fit)</p>
            <dl className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs">
              <dt className="text-ink-400">Distance</dt><dd className="text-right text-ink-200">{alloc.breakdown.D} cells</dd>
              <dt className="text-ink-400">Robot's load</dt><dd className="text-right text-ink-200">{alloc.breakdown.W} tasks</dd>
              <dt className="text-ink-400">Urgency</dt><dd className="text-right text-ink-200">{PRIORITY_LABEL[t.priority]}</dd>
              <dt className="text-ink-400">Could finish in</dt><dd className="text-right text-ink-200">{alloc.breakdown.L}s</dd>
              <dt className="text-ink-300">Score</dt><dd className="text-right font-semibold text-signal-cyan">{alloc.cost.toFixed(2)}</dd>
            </dl>
          </div>
        )}
        <div className="mt-4">
          <p className="label">History</p>
          <ol className="space-y-1">
            {t.history.map((h, i) => (
              <li key={i} className="flex items-center gap-2 text-xs">
                <CornerDownRight size={12} className="text-ink-400" />
                <span className="font-mono text-ink-400">{formatTick(h.tick)}</span>
                <span style={{ color: TASK_STATUS_COLOR[h.status] }}>{TASK_STATUS_LABEL[h.status]}</span>
                {h.robotId && <span className="text-ink-300">{h.robotId}</span>}
              </li>
            ))}
          </ol>
        </div>
      </div>
    );
  }

  // empty / obstacle cell
  const p = selection.p;
  const blocked = isObstacle(state.grid, p);
  const conflict = engine.cellConflict(p);
  const robotHere = state.robots.find((r) => samePoint(r.position, p));
  return (
    <div>
      <p className="font-display text-lg font-semibold">Cell {pointLabel(p)}</p>
      <p className="mt-1 text-sm text-ink-300">{blocked ? 'Obstacle — no robot can drive through it.' : robotHere ? `${robotHere.id} is here.` : conflict ? conflict : 'Free floor cell.'}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {blocked ? (
          <button className="btn-ghost btn-sm" onClick={() => { const x = engine.removeObstacle(p); report(x.ok, x.message); onSelect(null); }}>
            <Trash2 size={14} /> Remove obstacle
          </button>
        ) : (
          <>
            <button className="btn-ghost btn-sm" disabled={!!conflict} onClick={() => { const x = engine.addObstacle(p); report(x.ok, x.message); }}>
              <Box size={14} /> Place obstacle
            </button>
            <button
              className="btn-ghost btn-sm"
              disabled={!!conflict}
              onClick={() => {
                const x = engine.addTask(p, 3, 3);
                report(x.ok, x.message);
                if (x.ok) onSelect({ kind: 'task', id: `T${engine.state.nextTaskNumber - 1}` });
              }}
            >
              <Plus size={14} /> Add task here
            </button>
          </>
        )}
      </div>
    </div>
  );
}
