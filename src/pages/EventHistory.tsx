import { Download, ScrollText, Search, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Badge, ConfirmDialog, EmptyState, Panel } from '../components/common/ui';
import { useSim } from '../context/SimulationContext';
import { EVENT_TYPES, formatTick } from '../models/Event';
import type { EventType, Severity } from '../models/Event';
import { SEVERITY_COLOR, downloadFile, titleCase, toCSV } from '../utils/format';

const SEVERITIES: Severity[] = ['info', 'success', 'warning', 'critical'];

export default function EventHistory() {
  const { state, engine } = useSim();
  const [types, setTypes] = useState<Set<EventType>>(new Set());
  const [sev, setSev] = useState<Set<Severity>>(new Set());
  const [robot, setRobot] = useState('');
  const [task, setTask] = useState('');
  const [q, setQ] = useState('');
  const [confirm, setConfirm] = useState(false);

  const filtered = useMemo(
    () =>
      state.events
        .filter(
          (e) =>
            (types.size === 0 || types.has(e.type)) &&
            (sev.size === 0 || sev.has(e.severity)) &&
            (!robot || e.robotId === robot) &&
            (!task || e.taskId === task) &&
            (!q || e.message.toLowerCase().includes(q.toLowerCase())),
        )
        .reverse(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.events, state.events.length, types, sev, robot, task, q],
  );

  const toggle = <T,>(set: Set<T>, v: T, fn: (s: Set<T>) => void) => {
    const n = new Set(set);
    if (n.has(v)) n.delete(v);
    else n.add(v);
    fn(n);
  };

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const e of state.events) c[e.type] = (c[e.type] ?? 0) + 1;
    return c;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.events, state.events.length]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-bold leading-tight">Event history</h1>
          <p className="mt-1 text-sm text-ink-300">
            {state.events.length} events recorded in this session · showing {filtered.length}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            className="btn-ghost"
            disabled={filtered.length === 0}
            onClick={() =>
              downloadFile(
                `fleetmind-events-${Date.now()}.csv`,
                toCSV(filtered.map((e) => ({ time: formatTick(e.tick), tick: e.tick, type: e.type, severity: e.severity, robot: e.robotId ?? '', task: e.taskId ?? '', message: e.message }))),
                'text/csv',
              )
            }
          >
            <Download size={16} /> Export CSV
          </button>
          <button className="btn-danger" disabled={state.events.length === 0} onClick={() => setConfirm(true)}>
            <Trash2 size={16} /> Clear log
          </button>
        </div>
      </div>

      <Panel bodyClass="p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
            <input className="input pl-9" placeholder="Search messages" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search events" />
          </div>
          <select className="input w-auto" value={robot} onChange={(e) => setRobot(e.target.value)} aria-label="Filter by robot">
            <option value="">All robots</option>
            {state.robots.map((r) => (
              <option key={r.id}>{r.id}</option>
            ))}
          </select>
          <select className="input w-auto" value={task} onChange={(e) => setTask(e.target.value)} aria-label="Filter by task">
            <option value="">All tasks</option>
            {state.tasks.map((t) => (
              <option key={t.id}>{t.id}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {EVENT_TYPES.map((t) => (
            <button
              key={t}
              onClick={() => toggle(types, t, setTypes)}
              aria-pressed={types.has(t)}
              className={`rounded-md border px-2 py-1 text-xs transition-colors ${types.has(t) ? 'border-signal-cyan bg-signal-cyan/15 text-signal-cyan' : 'border-hull-600 text-ink-300 hover:text-ink-100'}`}
            >
              {titleCase(t)} <span className="text-ink-400">{counts[t] ?? 0}</span>
            </button>
          ))}
          <span className="mx-1 w-px bg-hull-700" />
          {SEVERITIES.map((s) => (
            <button
              key={s}
              onClick={() => toggle(sev, s, setSev)}
              aria-pressed={sev.has(s)}
              className="rounded-md border px-2 py-1 text-xs"
              style={sev.has(s) ? { borderColor: SEVERITY_COLOR[s], color: SEVERITY_COLOR[s], backgroundColor: `${SEVERITY_COLOR[s]}1F` } : { borderColor: '#26355C', color: '#94A2C2' }}
            >
              {titleCase(s)}
            </button>
          ))}
          {(types.size > 0 || sev.size > 0 || robot || task || q) && (
            <button
              className="ml-auto text-xs text-signal-cyan hover:underline"
              onClick={() => {
                setTypes(new Set());
                setSev(new Set());
                setRobot('');
                setTask('');
                setQ('');
              }}
            >
              Clear filters
            </button>
          )}
        </div>
      </Panel>

      <Panel bodyClass="overflow-x-auto">
        {filtered.length === 0 ? (
          <EmptyState icon={<ScrollText size={22} />} title={state.events.length ? 'No events match these filters' : 'The log is empty'}>
            {state.events.length ? 'Loosen a filter to see more.' : 'Start the simulation — every assignment, move, failure and replan is recorded here.'}
          </EmptyState>
        ) : (
          <table className="w-full min-w-[760px] text-sm">
            <thead className="text-left text-xs text-ink-400">
              <tr>
                <th className="px-4 py-2.5 font-medium">Time</th>
                <th className="px-2 py-2.5 font-medium">Type</th>
                <th className="px-2 py-2.5 font-medium">Severity</th>
                <th className="px-2 py-2.5 font-medium">Robot</th>
                <th className="px-2 py-2.5 font-medium">Task</th>
                <th className="px-4 py-2.5 font-medium">Description</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 600).map((e) => (
                <tr key={e.id} className="border-t border-hull-800 align-top">
                  <td className="px-4 py-1.5 font-mono text-xs text-ink-400">{formatTick(e.tick)}</td>
                  <td className="px-2 py-1.5 text-xs text-ink-300">{titleCase(e.type)}</td>
                  <td className="px-2 py-1.5">
                    <Badge color={SEVERITY_COLOR[e.severity]}>{titleCase(e.severity)}</Badge>
                  </td>
                  <td className="px-2 py-1.5 text-ink-200">{e.robotId ?? ''}</td>
                  <td className="px-2 py-1.5 text-ink-200">{e.taskId ?? ''}</td>
                  <td className="px-4 py-1.5 text-ink-100">{e.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {filtered.length > 600 && <p className="px-4 py-3 text-xs text-ink-400">Showing the latest 600 — export CSV for the full set.</p>}
      </Panel>

      <ConfirmDialog
        open={confirm}
        title="Clear the event log?"
        message="All recorded events are removed. The simulation itself keeps running and metrics are not affected."
        confirmLabel="Clear log"
        danger
        onConfirm={() => engine.clearEvents()}
        onCancel={() => setConfirm(false)}
      />
    </div>
  );
}
