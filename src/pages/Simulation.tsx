import { Ban, Box, Eye, EyeOff, MousePointer2, Plus, ShieldAlert, Users } from 'lucide-react';
import { useCallback, useState } from 'react';
import type { ReactNode } from 'react';
import { Badge, Panel, Segmented, Tip } from '../components/common/ui';
import { useToast } from '../components/common/Toaster';
import { EventFeed } from '../components/dashboard/EventFeed';
import { DemoPanel } from '../components/simulation/DemoPanel';
import { FloorMap } from '../components/simulation/FloorMap';
import { Inspector } from '../components/simulation/Inspector';
import type { Selection } from '../components/simulation/Inspector';
import { WeightsPanel } from '../components/simulation/WeightsPanel';
import { useSim } from '../context/SimulationContext';
import { isObstacle, pointLabel, samePoint } from '../models/Grid';
import type { Point } from '../models/Grid';
import { PRIORITY_LABEL } from '../models/Task';
import { robotWorkload } from '../models/Robot';
import { PRIORITY_COLOR, ROBOT_STATE_COLOR, TASK_STATUS_COLOR } from '../utils/format';
import { ROBOT_STATE_LABEL, TASK_STATUS_LABEL } from '../utils/labels';

type Tool = 'inspect' | 'obstacle' | 'task' | 'block' | 'fail';

const TOOLS: { id: Tool; label: string; hint: string; icon: ReactNode }[] = [
  { id: 'inspect', label: 'Inspect', hint: 'Select robots, tasks and cells', icon: <MousePointer2 size={18} /> },
  { id: 'obstacle', label: 'Obstacle', hint: 'Click a free cell to place an obstacle, click an obstacle to remove it', icon: <Box size={18} /> },
  { id: 'task', label: 'Add task', hint: 'Click a free cell to create a task with the chosen priority', icon: <Plus size={18} /> },
  { id: 'block', label: 'Block route', hint: 'Click a moving robot to drop an obstacle on its route', icon: <Ban size={18} /> },
  { id: 'fail', label: 'Breakdown', hint: 'Click a robot to break it down, click a broken-down robot to repair it', icon: <ShieldAlert size={18} /> },
];

export default function Simulation() {
  const sim = useSim();
  const { state, version, tickMs, engine, demoActive } = sim;
  const toast = useToast();
  const [tool, setTool] = useState<Tool>('inspect');
  const [selection, setSelection] = useState<Selection>(null);
  const [hover, setHover] = useState<Point | null>(null);
  const [newPriority, setNewPriority] = useState(3);
  const [multiOpen, setMultiOpen] = useState(false);
  const [multiPick, setMultiPick] = useState<string[]>([]);

  const warn = useCallback((title: string, line: string) => toast({ title, lines: [line], severity: 'warning', kind: 'warning' }), [toast]);

  const onCellClick = useCallback(
    (p: Point) => {
      const s = engine.state;
      const robot = s.robots.find((r) => samePoint(r.position, p));
      const task = s.tasks.find((t) => samePoint(t.position, p) && t.status !== 'COMPLETED') ?? s.tasks.find((t) => samePoint(t.position, p));
      switch (tool) {
        case 'inspect':
          if (robot) setSelection({ kind: 'robot', id: robot.id });
          else if (task) setSelection({ kind: 'task', id: task.id });
          else setSelection({ kind: 'cell', p });
          return;
        case 'obstacle': {
          const r = engine.toggleObstacle(p);
          if (!r.ok) warn('Cannot place obstacle', r.message);
          return;
        }
        case 'task': {
          const r = engine.addTask(p, newPriority, 3);
          if (!r.ok) warn('Cannot add task', r.message);
          else setSelection({ kind: 'task', id: `T${engine.state.nextTaskNumber - 1}` });
          return;
        }
        case 'block': {
          if (!robot) return warn('Pick a robot', 'Click a robot that is currently moving');
          const r = engine.blockActivePath(robot.id);
          if (!r.ok) warn('Route not blocked', r.message);
          return;
        }
        case 'fail': {
          if (!robot) return warn('Pick a robot', `No robot at ${pointLabel(p)}`);
          if (robot.state === 'FAILED') engine.restoreRobot(robot.id);
          else engine.failRobot(robot.id);
          setSelection({ kind: 'robot', id: robot.id });
          return;
        }
      }
    },
    [engine, tool, newPriority, warn],
  );

  const selRobot = selection?.kind === 'robot' ? selection.id : null;
  const selTask = selection?.kind === 'task' ? selection.id : null;
  const hoverInfo = hover
    ? (() => {
        const r = state.robots.find((x) => samePoint(x.position, hover));
        const t = state.tasks.find((x) => samePoint(x.position, hover) && x.status !== 'COMPLETED');
        return r ? `${r.id} · ${ROBOT_STATE_LABEL[r.state]}` : t ? `${t.id} · ${PRIORITY_LABEL[t.priority]}` : isObstacle(state.grid, hover) ? 'Obstacle' : 'Free';
      })()
    : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-bold leading-tight">Live simulation</h1>
          <p className="text-sm text-ink-300">{state.scenarioName}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-ink-400">Routing</span>
            <Segmented
              ariaLabel="Routing method"
              size="sm"
              value={state.config.pathAlgorithm}
              onChange={(v) => engine.setPathAlgorithm(v)}
              options={[
                { value: 'astar', label: 'Targeted', title: 'Searches towards the destination first — fastest' },
                { value: 'dijkstra', label: 'Exhaustive', title: 'Searches evenly in every direction — slower, same route' },
              ]}
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-ink-400">Dispatch</span>
            <Segmented
              ariaLabel="Dispatch method"
              size="sm"
              value={state.config.allocationAlgorithm}
              onChange={(v) => engine.setAllocationAlgorithm(v)}
              options={[
                { value: 'greedy', label: 'Quick', title: 'Hands each task to the best robot one by one' },
                { value: 'hungarian', label: 'Optimized', title: 'Finds the lowest total score for the whole batch' },
              ]}
            />
          </div>
          <button className="btn-ghost btn-sm" onClick={() => engine.setShowSearch(!state.config.showSearch)} aria-pressed={state.config.showSearch}>
            {state.config.showSearch ? <Eye size={14} /> : <EyeOff size={14} />} Show search area
          </button>
          <button className="btn-danger btn-sm" onClick={() => { setMultiPick([]); setMultiOpen(!multiOpen); }}>
            <Users size={14} /> Multiple breakdowns
          </button>
        </div>
      </div>

      {multiOpen && (
        <div className="panel flex flex-wrap items-center gap-2 p-3">
          <span className="mr-2 text-sm text-ink-300">Break down these robots at the same moment:</span>
          {state.robots.map((r) => (
            <label key={r.id} className={`flex items-center gap-1.5 rounded-md border px-2 py-1 text-sm ${r.state === 'FAILED' ? 'opacity-40' : ''} border-hull-600`}>
              <input
                type="checkbox"
                disabled={r.state === 'FAILED'}
                checked={multiPick.includes(r.id)}
                onChange={(e) => setMultiPick(e.target.checked ? [...multiPick, r.id] : multiPick.filter((x) => x !== r.id))}
                className="accent-[#FF5470]"
              />
              {r.id}
            </label>
          ))}
          <button
            className="btn-danger btn-sm ml-auto"
            disabled={multiPick.length === 0}
            onClick={() => {
              engine.failRobots(multiPick);
              setMultiOpen(false);
            }}
          >
            Break down {multiPick.length || ''} selected
          </button>
        </div>
      )}

      <div className="grid items-start gap-4 xl:grid-cols-[auto_minmax(0,1fr)_340px]">
        {/* tool palette */}
        <div className="panel flex gap-1 p-1.5 xl:flex-col" role="toolbar" aria-label="Map tools">
          {TOOLS.map((t) => (
            <Tip key={t.id} text={t.hint}>
              <button
                onClick={() => setTool(t.id)}
                aria-pressed={tool === t.id}
                className={`flex flex-col items-center gap-1 rounded-lg px-2.5 py-2 text-[10.5px] transition-colors xl:w-[68px] ${
                  tool === t.id ? 'bg-hull-700 text-signal-cyan' : 'text-ink-300 hover:bg-hull-800 hover:text-ink-100'
                }`}
              >
                {t.icon}
                {t.label}
              </button>
            </Tip>
          ))}
          {tool === 'task' && (
            <div className="ml-2 flex items-center gap-1 border-l border-hull-700 pl-2 xl:ml-0 xl:mt-2 xl:flex-col xl:border-l-0 xl:border-t xl:pl-0 xl:pt-2">
              <span className="text-[10px] text-ink-400">Priority</span>
              {[5, 4, 3, 2, 1].map((p) => (
                <button
                  key={p}
                  onClick={() => setNewPriority(p)}
                  title={PRIORITY_LABEL[p]}
                  aria-pressed={newPriority === p}
                  className={`h-7 w-full min-w-[28px] rounded-md text-xs font-semibold ${newPriority === p ? 'text-hull-950' : 'text-ink-200 hover:bg-hull-800'}`}
                  style={newPriority === p ? { backgroundColor: PRIORITY_COLOR[p] } : undefined}
                >
                  {p}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* map */}
        <div className="panel relative flex flex-col p-2">
          <div className="relative w-full" style={{ aspectRatio: `${state.grid.cols} / ${state.grid.rows}` }}>
            <FloorMap
              state={state}
              version={version}
              tickMs={tickMs}
              interactive
              showSearch={state.config.showSearch}
              selectedRobotId={selRobot}
              selectedTaskId={selTask}
              onCellClick={onCellClick}
              onHover={setHover}
            />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 px-1 text-[11px] text-ink-400">
            <span className="font-mono text-ink-200">{hover ? `${pointLabel(hover)} · ${hoverInfo}` : 'Hover the map for coordinates'}</span>
            <span className="ml-auto flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-[#1F2B4A] ring-1 ring-[#33446E]" /> obstacle</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 bg-signal-cyan/30" /> cells searched</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-signal-violet/60" /> search edge</span>
            <span className="flex items-center gap-1.5"><span className="h-0 w-4 border-t-2 border-dashed border-ink-300" /> route</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rotate-45 border border-signal-red" /> critical</span>
          </div>
        </div>

        {/* right column */}
        <div className="flex flex-col gap-4">
          {demoActive && <DemoPanel />}
          <Panel title="Inspector">
            <Inspector selection={selection} onSelect={setSelection} />
          </Panel>
          {!demoActive && (
            <Panel title="What matters when assigning" subtitle="Applies to the next assignment">
              <WeightsPanel />
            </Panel>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Fleet" bodyClass="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-ink-400">
              <tr>
                <th className="px-4 py-2 font-medium">Robot</th>
                <th className="px-2 py-2 font-medium">State</th>
                <th className="px-2 py-2 font-medium">Target</th>
                <th className="px-2 py-2 font-medium">Queue</th>
                <th className="px-2 py-2 text-right font-medium">Distance</th>
                <th className="px-4 py-2 text-right font-medium">Done</th>
              </tr>
            </thead>
            <tbody>
              {state.robots.map((r) => (
                <tr
                  key={r.id}
                  onClick={() => setSelection({ kind: 'robot', id: r.id })}
                  className={`cursor-pointer border-t border-hull-800 hover:bg-hull-850 ${selRobot === r.id ? 'bg-hull-850' : ''}`}
                >
                  <td className="px-4 py-1.5">
                    <span className="flex items-center gap-2 font-display font-semibold">
                      <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: r.color }} />
                      {r.id}
                    </span>
                  </td>
                  <td className="px-2 py-1.5"><Badge color={ROBOT_STATE_COLOR[r.state]}>{ROBOT_STATE_LABEL[r.state]}</Badge></td>
                  <td className="px-2 py-1.5 text-ink-200">{r.currentTaskId ?? '—'}</td>
                  <td className="px-2 py-1.5 text-ink-300">{robotWorkload(r)}</td>
                  <td className="num px-2 py-1.5 text-right">{r.distanceTravelled}</td>
                  <td className="num px-4 py-1.5 text-right">{r.completedTaskIds.length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>

        <Panel title="Tasks" subtitle="Click a row to inspect" bodyClass="max-h-72 overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-hull-900 text-left text-xs text-ink-400">
              <tr>
                <th className="px-4 py-2 font-medium">Task</th>
                <th className="px-2 py-2 font-medium">Status</th>
                <th className="px-2 py-2 font-medium">Priority</th>
                <th className="px-2 py-2 font-medium">Robot</th>
                <th className="px-4 py-2 text-right font-medium">Cell</th>
              </tr>
            </thead>
            <tbody>
              {[...state.tasks]
                .sort((a, b) => Number(a.status === 'COMPLETED') - Number(b.status === 'COMPLETED') || b.priority - a.priority)
                .map((t) => (
                  <tr
                    key={t.id}
                    onClick={() => setSelection({ kind: 'task', id: t.id })}
                    className={`cursor-pointer border-t border-hull-800 hover:bg-hull-850 ${selTask === t.id ? 'bg-hull-850' : ''}`}
                  >
                    <td className="px-4 py-1.5 font-display font-semibold">{t.id}</td>
                    <td className="px-2 py-1.5"><Badge color={TASK_STATUS_COLOR[t.status]}>{TASK_STATUS_LABEL[t.status]}</Badge></td>
                    <td className="px-2 py-1.5" style={{ color: PRIORITY_COLOR[t.priority] }}>{PRIORITY_LABEL[t.priority]}</td>
                    <td className="px-2 py-1.5 text-ink-200">{t.assignedRobotId ?? t.completedBy ?? '—'}</td>
                    <td className="px-4 py-1.5 text-right font-mono text-xs text-ink-300">{pointLabel(t.position)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </Panel>
      </div>

      <Panel title="Event stream" bodyClass="max-h-64 overflow-y-auto px-4 py-1">
        <EventFeed events={state.events} limit={40} />
      </Panel>
    </div>
  );
}
