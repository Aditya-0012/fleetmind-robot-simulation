import { Activity, Ban, Maximize2, Pause, Play, ShieldAlert, Siren, Sparkles } from 'lucide-react';
import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Area, AreaChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Badge, Panel, StackBar, Tip } from '../components/common/ui';
import { useToast } from '../components/common/Toaster';
import { EventFeed } from '../components/dashboard/EventFeed';
import { FloorMap } from '../components/simulation/FloorMap';
import { AXIS, GRID, LEGEND, SERIES, TOOLTIP } from '../components/charts/theme';
import { useSim } from '../context/SimulationContext';
import { useAuth } from '../context/AuthContext';
import { computeMetrics, pickFreeReachableCell } from '../simulation/metrics';
import { robotWorkload } from '../models/Robot';
import { ALLOCATION_ALGORITHM_LABEL } from '../algorithms/allocation/types';
import { PATH_ALGORITHM_LABEL } from '../algorithms/pathfinding/types';
import { ROBOT_STATE_COLOR, TASK_STATUS_COLOR, fmtMs, fmtNum, titleCase } from '../utils/format';

export default function Dashboard() {
  const sim = useSim();
  const { state, version, running, tickMs, engine } = sim;
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const m = useMemo(() => computeMetrics(state), [state, version]); // eslint-disable-line react-hooks/exhaustive-deps
  const history = state.history;

  const failBusiest = () => {
    const live = state.robots.filter((r) => r.state !== 'FAILED');
    if (!live.length) return toast({ title: 'No robot to fail', lines: ['Every robot has already failed'], severity: 'warning', kind: 'warning' });
    const target = [...live].sort((a, b) => robotWorkload(b) - robotWorkload(a) || a.id.localeCompare(b.id))[0];
    engine.failRobot(target.id);
  };
  const addEmergency = () => {
    const cell = pickFreeReachableCell(state);
    if (!cell) return toast({ title: 'No free reachable cell', lines: [], severity: 'warning', kind: 'warning' });
    const r = engine.addTask(cell, 5, 2);
    if (!r.ok) toast({ title: 'Task not created', lines: [r.message], severity: 'warning', kind: 'warning' });
  };
  const blockRoute = () => {
    const r = engine.blockActivePath();
    if (!r.ok) toast({ title: 'Nothing to block', lines: [r.message, 'Start the simulation so robots are moving'], severity: 'info', kind: 'info' });
  };

  const perf: { label: string; value: string; hint: string }[] = [
    { label: 'Distance travelled', value: `${fmtNum(m.perf.totalDistance)} cells`, hint: 'Sum of cells moved by every robot' },
    { label: 'Planned path length', value: `${fmtNum(m.perf.totalPathLength)} cells`, hint: 'Sum of every route the planner produced, including replans' },
    { label: 'Average path length', value: `${fmtNum(m.perf.avgPathLength, 1)} cells`, hint: `Over ${m.perf.pathPlans} route plans` },
    { label: 'Nodes explored', value: fmtNum(m.perf.nodesExplored), hint: 'Nodes expanded by the path planner — machine-independent work' },
    { label: 'Replanning operations', value: fmtNum(m.perf.replans), hint: 'Routes invalidated and recomputed' },
    { label: 'Task reallocations', value: fmtNum(m.perf.reallocations), hint: 'Released tasks that were handed to another robot' },
    { label: 'Robot failures', value: fmtNum(m.perf.failures), hint: 'Failures injected so far' },
    { label: 'Completion rate', value: `${fmtNum(m.perf.completionRate * 100, 0)}%`, hint: `${m.tasks.completed} of ${m.tasks.total} tasks` },
    { label: 'Avg. completion time', value: m.tasks.completed ? `${fmtNum(m.perf.avgCompletionTime, 1)} s` : '—', hint: 'From task creation to completion, simulated seconds' },
    { label: 'Algorithm time', value: fmtMs(m.perf.algorithmTimeMs), hint: `Path planning ${fmtMs(m.perf.pathTimeMs)} + allocation ${fmtMs(m.perf.allocationTimeMs)} — browser-measured` },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-ink-400">Welcome back, {user?.name.split(' ')[0]}</p>
          <h1 className="text-[28px] font-bold leading-tight">Fleet overview</h1>
          <p className="mt-1 text-sm text-ink-300">
            {PATH_ALGORITHM_LABEL[state.config.pathAlgorithm]} routing · {ALLOCATION_ALGORITHM_LABEL[state.config.allocationAlgorithm]} allocation · capacity {state.config.capacity} tasks per robot
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className={running ? 'btn-ghost' : 'btn-primary'} onClick={sim.toggle}>
            {running ? <Pause size={16} /> : <Play size={16} />}
            {running ? 'Pause' : state.tick === 0 ? 'Start simulation' : 'Resume'}
          </button>
          <button
            className="btn-ghost"
            onClick={() => {
              sim.startDemo();
              navigate('/simulation');
            }}
          >
            <Sparkles size={16} className="text-signal-violet" /> Run demo
          </button>
          <Tip text="Fails the robot carrying the most work">
            <button className="btn-danger" onClick={failBusiest}>
              <ShieldAlert size={16} /> Fail busiest robot
            </button>
          </Tip>
          <Tip text="Critical-priority task on a random free cell">
            <button className="btn-ghost" onClick={addEmergency}>
              <Siren size={16} className="text-signal-red" /> Emergency task
            </button>
          </Tip>
          <Tip text="Drops an obstacle ahead of a moving robot">
            <button className="btn-ghost" onClick={blockRoute}>
              <Ban size={16} className="text-signal-amber" /> Block a route
            </button>
          </Tip>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-12">
        <Panel
          className="xl:col-span-7"
          title="Live floor"
          subtitle={`${state.grid.rows}×${state.grid.cols} grid · ${state.scenarioName}`}
          actions={
            <Link to="/simulation" className="btn-ghost btn-sm">
              <Maximize2 size={14} /> Open control room
            </Link>
          }
          bodyClass="p-3"
        >
          <div className="w-full" style={{ aspectRatio: `${state.grid.cols} / ${state.grid.rows}` }}>
            <FloorMap state={state} version={version} tickMs={tickMs} showSearch={state.config.showSearch} />
          </div>
        </Panel>

        <div className="flex flex-col gap-5 xl:col-span-5">
          <Panel title="Robots" subtitle={`${m.robots.active} of ${m.robots.total} operational`}>
            <StackBar
              total={m.robots.total}
              parts={[
                { label: 'Moving', value: m.robots.moving, color: ROBOT_STATE_COLOR.MOVING },
                { label: 'Executing', value: m.robots.executing, color: ROBOT_STATE_COLOR.EXECUTING },
                { label: 'Assigned', value: m.robots.assigned + m.robots.waiting, color: ROBOT_STATE_COLOR.ASSIGNED },
                { label: 'Idle', value: m.robots.idle, color: ROBOT_STATE_COLOR.IDLE },
                { label: 'Done', value: m.robots.completed, color: ROBOT_STATE_COLOR.COMPLETED },
                { label: 'Failed', value: m.robots.failed, color: ROBOT_STATE_COLOR.FAILED },
              ]}
            />
            <ul className="mt-4 divide-y divide-hull-800 text-sm">
              {state.robots.map((r) => (
                <li key={r.id} className="flex items-center gap-3 py-1.5">
                  <span className="h-3 w-3 rounded" style={{ backgroundColor: r.color }} />
                  <span className="w-8 font-display font-semibold">{r.id}</span>
                  <Badge color={ROBOT_STATE_COLOR[r.state]}>{titleCase(r.state)}</Badge>
                  <span className="ml-auto text-xs text-ink-400">
                    {r.currentTaskId ? `→ ${r.currentTaskId}` : '—'} · {robotWorkload(r)} queued · {r.distanceTravelled} cells
                  </span>
                </li>
              ))}
            </ul>
          </Panel>
          <Panel title="Tasks" subtitle={`${m.tasks.completed} of ${m.tasks.total} completed`}>
            <StackBar
              total={m.tasks.total}
              parts={[
                { label: 'Pending', value: m.tasks.unassigned, color: TASK_STATUS_COLOR.UNASSIGNED },
                { label: 'Assigned', value: m.tasks.assigned, color: TASK_STATUS_COLOR.ASSIGNED },
                { label: 'In progress', value: m.tasks.inProgress, color: TASK_STATUS_COLOR.IN_PROGRESS },
                { label: 'Completed', value: m.tasks.completed, color: TASK_STATUS_COLOR.COMPLETED },
                { label: 'Blocked', value: m.tasks.blocked, color: TASK_STATUS_COLOR.BLOCKED },
              ]}
            />
          </Panel>
        </div>
      </div>

      <Panel title="Performance" subtitle="Derived from the running simulation. Times are measured in your browser and vary by machine.">
        <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg bg-hull-800 sm:grid-cols-3 lg:grid-cols-5">
          {perf.map((p) => (
            <div key={p.label} className="bg-hull-900 px-4 py-3" title={p.hint}>
              <dt className="text-xs text-ink-400">{p.label}</dt>
              <dd className="num mt-1 text-xl font-semibold text-ink-100">{p.value}</dd>
            </div>
          ))}
        </dl>
      </Panel>

      <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
        <Panel title="Task progress" subtitle="Task states per simulated second">
          <div className="h-56">
            {history.length > 1 ? (
              <ResponsiveContainer>
                <AreaChart data={history.slice()} margin={{ left: -18, right: 6, top: 6 }}>
                  <CartesianGrid {...GRID} />
                  <XAxis dataKey="tick" {...AXIS} />
                  <YAxis allowDecimals={false} {...AXIS} />
                  <Tooltip {...TOOLTIP} labelFormatter={(l) => `t = ${l}s`} />
                  <Legend {...LEGEND} />
                  <Area type="stepAfter" dataKey="completed" name="Completed" stackId="1" stroke={SERIES.green} fill={SERIES.green} fillOpacity={0.25} isAnimationActive={false} />
                  <Area type="stepAfter" dataKey="inProgress" name="In progress" stackId="1" stroke={SERIES.cyan} fill={SERIES.cyan} fillOpacity={0.2} isAnimationActive={false} />
                  <Area type="stepAfter" dataKey="pending" name="Pending" stackId="1" stroke={SERIES.blue} fill={SERIES.blue} fillOpacity={0.15} isAnimationActive={false} />
                  <Area type="stepAfter" dataKey="blocked" name="Blocked" stackId="1" stroke={SERIES.red} fill={SERIES.red} fillOpacity={0.2} isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <ChartEmpty />
            )}
          </div>
        </Panel>
        <Panel title="Adaptation" subtitle="Cumulative replans and reallocations">
          <div className="h-56">
            {history.length > 1 ? (
              <ResponsiveContainer>
                <LineChart data={history.slice()} margin={{ left: -18, right: 6, top: 6 }}>
                  <CartesianGrid {...GRID} />
                  <XAxis dataKey="tick" {...AXIS} />
                  <YAxis allowDecimals={false} {...AXIS} />
                  <Tooltip {...TOOLTIP} labelFormatter={(l) => `t = ${l}s`} />
                  <Legend {...LEGEND} />
                  <Line type="stepAfter" dataKey="replans" name="Replans" stroke={SERIES.amber} strokeWidth={2} dot={false} isAnimationActive={false} />
                  <Line type="stepAfter" dataKey="reallocations" name="Reallocations" stroke={SERIES.violet} strokeWidth={2} dot={false} isAnimationActive={false} />
                  <Line type="stepAfter" dataKey="failedRobots" name="Failed robots" stroke={SERIES.red} strokeWidth={2} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <ChartEmpty />
            )}
          </div>
        </Panel>
        <Panel
          title="Recent events"
          actions={
            <Link to="/events" className="text-xs text-signal-cyan hover:underline">
              Full history
            </Link>
          }
          className="lg:col-span-2 xl:col-span-1"
          bodyClass="max-h-64 overflow-y-auto px-4 py-1"
        >
          <EventFeed events={state.events} limit={14} dense />
        </Panel>
      </div>
    </div>
  );
}

function ChartEmpty() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-sm text-ink-400">
      <Activity size={20} />
      Start the simulation to record data.
    </div>
  );
}
