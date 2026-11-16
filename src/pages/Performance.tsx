import { Download, FileJson, Gauge, Play } from 'lucide-react';
import { useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AXIS, GRID, LEGEND, SERIES, TOOLTIP } from '../components/charts/theme';
import { EmptyState, Panel, Segmented } from '../components/common/ui';
import { useSim } from '../context/SimulationContext';
import { benchmarkAllocation, benchmarkPathfinding, benchmarkScenarios, currentGridCopy } from '../services/benchmarks';
import type { AllocationBenchmark, PathBenchmark, ScenarioRun } from '../services/benchmarks';
import { generateScenario } from '../simulation/ScenarioGenerator';
import { createGrid, pointLabel, setObstacle } from '../models/Grid';
import { computeMetrics } from '../simulation/metrics';
import { downloadFile, fmtMs, fmtNum, toCSV } from '../utils/format';

type GridSource = 'current' | 'random30' | 'random50';

export default function Performance() {
  const { state, version } = useSim();
  const [source, setSource] = useState<GridSource>('current');
  const [seed, setSeed] = useState(7);
  const [path, setPath] = useState<PathBenchmark | null>(null);
  const [alloc, setAlloc] = useState<AllocationBenchmark | null | 'empty'>(null);
  const [runs, setRuns] = useState<ScenarioRun[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const live = computeMetrics(state);
  void version;

  const defer = (label: string, fn: () => void) => {
    setBusy(label);
    setTimeout(() => {
      fn();
      setBusy(null);
    }, 30);
  };

  const runPath = () =>
    defer('path', () => {
      if (source === 'current') {
        setPath(benchmarkPathfinding(currentGridCopy(state), `Current map (${state.grid.rows}×${state.grid.cols})`, 40, seed));
      } else {
        const size = source === 'random30' ? 30 : 50;
        const sc = generateScenario({ size, robots: 2, tasks: 5, density: 0.3, seed }).scenario;
        const g = createGrid(size, size);
        sc.obstacles.forEach((o) => setObstacle(g, o, true));
        setPath(benchmarkPathfinding(g, `Random ${size}×${size} map, 30% obstacles, seed ${seed}`, 40, seed));
      }
    });

  const runAlloc = () => defer('alloc', () => setAlloc(benchmarkAllocation(state, state.config.weights, state.config.capacity) ?? 'empty'));
  const runScenarios = () => defer('scen', () => setRuns(benchmarkScenarios(state.config.weights, state.config.capacity)));

  const exportJSON = () =>
    downloadFile(
      `fleetmind-results-${Date.now()}.json`,
      JSON.stringify(
        {
          exportedAt: new Date().toISOString(),
          note: 'Times are measured in the browser and depend on the computer. Cells searched and dispatch scores are the same on any computer.',
          liveSession: { scenario: state.scenarioName, tick: state.tick, config: state.config, metrics: live, history: state.history },
          pathfinding: path,
          allocation: alloc === 'empty' ? null : alloc,
          scenarioRuns: runs,
        },
        null,
        2,
      ),
      'application/json',
    );

  const exportCSV = () => {
    const parts: string[] = [];
    parts.push('# Live session history');
    parts.push(toCSV(state.history as unknown as Record<string, number>[]));
    if (path) {
      parts.push('\n# Pathfinding benchmark');
      parts.push(
        toCSV(
          path.pairs.map((p) => ({
            pair: p.pair,
            start: pointLabel(p.start),
            goal: pointLabel(p.goal),
            targeted_route_length: p.astar.cost,
            targeted_cells_searched: p.astar.nodesExplored,
            targeted_ms: p.astar.timeMs.toFixed(4),
            exhaustive_route_length: p.dijkstra.cost,
            exhaustive_cells_searched: p.dijkstra.nodesExplored,
            exhaustive_ms: p.dijkstra.timeMs.toFixed(4),
          })),
        ),
      );
    }
    if (runs) {
      parts.push('\n# Scenario runs');
      parts.push(toCSV(runs as unknown as Record<string, number>[]));
    }
    downloadFile(`fleetmind-results-${Date.now()}.csv`, parts.join('\n'), 'text/csv');
  };

  const allocData = alloc && alloc !== 'empty' ? alloc : null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-bold leading-tight">Performance analytics</h1>
          <p className="mt-1 max-w-3xl text-sm text-ink-300">
            Every number here comes from actually running the system. Counts such as cells searched and dispatch scores are the same on any computer; times in milliseconds depend on your machine.
          </p>
        </div>
        <div className="flex gap-2">
          <button className="btn-ghost" onClick={exportCSV}>
            <Download size={16} /> Export CSV
          </button>
          <button className="btn-ghost" onClick={exportJSON}>
            <FileJson size={16} /> Export JSON
          </button>
        </div>
      </div>

      {/* ── live session ── */}
      <Panel title="This session" subtitle={`${state.scenarioName} · t = ${state.tick}s`}>
        <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg bg-hull-800 sm:grid-cols-4 lg:grid-cols-6">
          {[
            ['Breakdowns', fmtNum(live.perf.failures)],
            ['Reassignments', fmtNum(live.perf.reallocations)],
            ['Reroutes', fmtNum(live.perf.replans)],
            ['Distance', `${fmtNum(live.perf.totalDistance)} cells`],
            ['Tasks completed', `${live.tasks.completed}/${live.tasks.total}`],
            ['Completion time', state.finished ? `${state.tick}s` : 'running'],
          ].map(([k, v]) => (
            <div key={k} className="bg-hull-900 px-4 py-3">
              <dt className="text-xs text-ink-400">{k}</dt>
              <dd className="num mt-1 text-lg font-semibold">{v}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-4 h-52">
          {state.history.length > 1 ? (
            <ResponsiveContainer>
              <LineChart data={state.history.slice()} margin={{ left: -10, right: 8, top: 6 }}>
                <CartesianGrid {...GRID} />
                <XAxis dataKey="tick" {...AXIS} />
                <YAxis yAxisId="l" {...AXIS} />
                <YAxis yAxisId="r" orientation="right" {...AXIS} />
                <Tooltip {...TOOLTIP} labelFormatter={(l) => `t = ${l}s`} />
                <Legend {...LEGEND} />
                <Line yAxisId="l" type="monotone" dataKey="distance" name="Distance travelled" stroke={SERIES.cyan} strokeWidth={2} dot={false} isAnimationActive={false} />
                <Line yAxisId="r" type="monotone" dataKey="nodesExplored" name="Cells searched (total)" stroke={SERIES.violet} strokeWidth={2} dot={false} isAnimationActive={false} />
                <Line yAxisId="l" type="stepAfter" dataKey="completed" name="Tasks completed" stroke={SERIES.green} strokeWidth={2} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState icon={<Gauge size={20} />} title="No samples yet">
              Start the simulation from the top bar to record a timeline.
            </EmptyState>
          )}
        </div>
      </Panel>

      {/* ── pathfinding ── */}
      <Panel
        title="Targeted vs exhaustive routing"
        subtitle="40 random trips on the same map, each planned with both routing methods"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Segmented
              ariaLabel="Grid source"
              size="sm"
              value={source}
              onChange={setSource}
              options={[
                { value: 'current', label: 'Current map' },
                { value: 'random30', label: 'Random 30×30' },
                { value: 'random50', label: 'Random 50×50' },
              ]}
            />
            <label className="flex items-center gap-1 text-xs text-ink-400">
              Seed
              <input type="number" className="input w-20 py-1 text-xs" value={seed} onChange={(e) => setSeed(Number(e.target.value) || 0)} />
            </label>
            <button className="btn-primary btn-sm" onClick={runPath} disabled={busy !== null}>
              <Play size={14} /> {busy === 'path' ? 'Running…' : 'Run benchmark'}
            </button>
          </div>
        }
      >
        {!path ? (
          <EmptyState icon={<Gauge size={22} />} title="No routing comparison yet">
            Run it to compare route length, cells searched and time for both methods.
          </EmptyState>
        ) : (
          <div className="space-y-5">
            <p className="text-sm text-ink-300">
              {path.gridLabel} · {path.pairs.length} trips ·{' '}
              {path.pathsEqual ? (
                <span className="text-signal-green">both methods found equally short routes on every trip</span>
              ) : (
                <span className="text-signal-red">route lengths differ — investigate</span>
              )}
            </p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="text-left text-xs text-ink-400">
                  <tr>
                    <th className="py-2 pr-3 font-medium">Method</th>
                    <th className="px-3 py-2 text-right font-medium">Avg. route length</th>
                    <th className="px-3 py-2 text-right font-medium">Avg. cells searched</th>
                    <th className="px-3 py-2 text-right font-medium" title="Most cells held in the to-check list at once — a sign of memory use">Avg. peak to-check list</th>
                    <th className="px-3 py-2 text-right font-medium">Avg. time</th>
                    <th className="py-2 pl-3 text-right font-medium">Total time</th>
                  </tr>
                </thead>
                <tbody className="num">
                  {path.summary.map((s) => (
                    <tr key={s.algorithm} className="border-t border-hull-800">
                      <td className="py-2 pr-3 font-sans font-medium">{s.algorithm === 'A*' ? 'Targeted' : 'Exhaustive'}</td>
                      <td className="px-3 py-2 text-right">{fmtNum(s.avgPath, 2)}</td>
                      <td className="px-3 py-2 text-right">{fmtNum(s.avgExplored, 1)}</td>
                      <td className="px-3 py-2 text-right">{fmtNum(s.avgMaxOpen, 1)}</td>
                      <td className="px-3 py-2 text-right">{fmtMs(s.avgTimeMs)}</td>
                      <td className="py-2 pl-3 text-right">{fmtMs(s.totalTimeMs)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-sm text-ink-300">
              Targeted routing searched{' '}
              <span className="font-semibold text-signal-cyan">
                {fmtNum((1 - path.summary[0].avgExplored / Math.max(1, path.summary[1].avgExplored)) * 100, 1)}% fewer cells
              </span>{' '}
              than exhaustive routing on average, for routes of exactly the same length.
            </p>
            <div className="grid gap-5 lg:grid-cols-2">
              <div className="h-64">
                <p className="mb-1 text-xs text-ink-400">Cells searched per trip</p>
                <ResponsiveContainer>
                  <BarChart data={path.pairs.map((p) => ({ pair: p.pair, Targeted: p.astar.nodesExplored, Exhaustive: p.dijkstra.nodesExplored }))} margin={{ left: -10, right: 4 }}>
                    <CartesianGrid {...GRID} />
                    <XAxis dataKey="pair" {...AXIS} />
                    <YAxis {...AXIS} />
                    <Tooltip {...TOOLTIP} labelFormatter={(l) => `Trip ${l}`} />
                    <Legend {...LEGEND} />
                    <Bar dataKey="Targeted" fill={SERIES.cyan} radius={[2, 2, 0, 0]} />
                    <Bar dataKey="Exhaustive" fill={SERIES.violet} radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="h-64">
                <p className="mb-1 text-xs text-ink-400">Cells searched vs route length</p>
                <ResponsiveContainer>
                  <LineChart
                    data={[...path.pairs].sort((a, b) => a.astar.cost - b.astar.cost).map((p) => ({ len: p.astar.cost, Targeted: p.astar.nodesExplored, Exhaustive: p.dijkstra.nodesExplored }))}
                    margin={{ left: -10, right: 4 }}
                  >
                    <CartesianGrid {...GRID} />
                    <XAxis dataKey="len" {...AXIS} />
                    <YAxis {...AXIS} />
                    <Tooltip {...TOOLTIP} labelFormatter={(l) => `Route length ${l}`} />
                    <Legend {...LEGEND} />
                    <Line dataKey="Targeted" stroke={SERIES.cyan} strokeWidth={2} dot={{ r: 2 }} isAnimationActive={false} />
                    <Line dataKey="Exhaustive" stroke={SERIES.violet} strokeWidth={2} dot={{ r: 2 }} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}
      </Panel>

      {/* ── allocation ── */}
      <Panel
        title="Quick vs optimized dispatch"
        subtitle="One score table built from the current fleet: every working robot where it stands, every unfinished task"
        actions={
          <button className="btn-primary btn-sm" onClick={runAlloc} disabled={busy !== null}>
            <Play size={14} /> {busy === 'alloc' ? 'Running…' : 'Compare on current state'}
          </button>
        }
      >
        {alloc === null && (
          <EmptyState icon={<Gauge size={22} />} title="No dispatch comparison yet">
            Uses whatever the simulation holds right now — load a random scenario with many tasks for a bigger comparison.
          </EmptyState>
        )}
        {alloc === 'empty' && (
          <EmptyState icon={<Gauge size={22} />} title="Nothing to assign">
            Every task is completed or every robot has broken down. Reset the scenario or add tasks, then compare again.
          </EmptyState>
        )}
        {allocData && (
          <div className="space-y-5">
            <div className="grid gap-5 lg:grid-cols-2">
              <div>
                <h3 className="text-sm font-semibold">One task per robot (same score table)</h3>
                <p className="mt-0.5 text-xs text-ink-400">
                  {allocData.robots.length} robots × {allocData.tasks.length} tasks · at most {Math.min(allocData.robots.length, allocData.tasks.length)} assignments
                </p>
                <table className="mt-3 w-full text-sm">
                  <thead className="text-left text-xs text-ink-400">
                    <tr>
                      <th className="py-1.5 font-medium" />
                      <th className="py-1.5 text-right font-medium">Total score</th>
                      <th className="py-1.5 text-right font-medium">Assigned</th>
                      <th className="py-1.5 text-right font-medium">Steps</th>
                      <th className="py-1.5 text-right font-medium">Time</th>
                    </tr>
                  </thead>
                  <tbody className="num">
                    {(['greedy', 'hungarian'] as const).map((k) => (
                      <tr key={k} className="border-t border-hull-800">
                        <td className="py-1.5 font-sans font-medium">{k === 'greedy' ? 'Quick' : 'Optimized'}</td>
                        <td className="py-1.5 text-right">{allocData.oneToOne[k].totalCost.toFixed(2)}</td>
                        <td className="py-1.5 text-right">{allocData.oneToOne[k].assigned}</td>
                        <td className="py-1.5 text-right">{fmtNum(allocData.oneToOne[k].operations)}</td>
                        <td className="py-1.5 text-right">{fmtMs(allocData.oneToOne[k].timeMs)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="mt-2 text-xs text-ink-400">
                  {allocData.oneToOne.greedy.totalCost - allocData.oneToOne.hungarian.totalCost > 1e-9
                    ? `Optimized dispatch scores ${(allocData.oneToOne.greedy.totalCost - allocData.oneToOne.hungarian.totalCost).toFixed(2)} lower (${fmtNum(((allocData.oneToOne.greedy.totalCost - allocData.oneToOne.hungarian.totalCost) / allocData.oneToOne.greedy.totalCost) * 100, 1)}%).`
                    : 'Quick dispatch happened to find the best answer here.'}
                </p>
                <div className="mt-3 overflow-x-auto">
                  <table className="text-xs">
                    <thead>
                      <tr>
                        <th />
                        {allocData.tasks.map((t) => (
                          <th key={t} className="px-1 pb-1 font-medium text-ink-400">
                            {t}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="font-mono">
                      {allocData.matrix.map((row, i) => (
                        <tr key={i}>
                          <th className="pr-2 text-right font-sans font-medium text-ink-400">{allocData.robots[i]}</th>
                          {row.map((c, j) => {
                            const g = allocData.oneToOne.greedy.rowToCol[i] === j;
                            const h = allocData.oneToOne.hungarian.rowToCol[i] === j;
                            return (
                              <td key={j} className="p-0.5">
                                <span
                                  className={`block rounded px-1.5 py-1 text-center ${h ? 'bg-signal-green/20 text-signal-green ring-1 ring-signal-green' : ''} ${g && !h ? 'text-signal-amber ring-1 ring-signal-amber' : ''} ${g && h ? 'outline outline-1 outline-signal-amber' : ''} ${!g && !h ? 'text-ink-400' : ''}`}
                                >
                                  {Number.isFinite(c) ? c.toFixed(2) : '—'}
                                </span>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="mt-1.5 text-[11px] text-ink-400">Green = optimized choice · amber outline = quick choice · — = cannot reach</p>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold">Several tasks per robot (up to {state.config.capacity} each)</h3>
                <p className="mt-0.5 text-xs text-ink-400">Quick: one task at a time · Optimized: best total in repeated rounds</p>
                <table className="mt-3 w-full text-sm">
                  <thead className="text-left text-xs text-ink-400">
                    <tr>
                      <th className="py-1.5 font-medium" />
                      <th className="py-1.5 text-right font-medium">Total score</th>
                      <th className="py-1.5 text-right font-medium">Assigned</th>
                      <th className="py-1.5 text-right font-medium">Left over</th>
                      <th className="py-1.5 text-right font-medium">Rounds</th>
                      <th className="py-1.5 text-right font-medium">Scores worked out</th>
                      <th className="py-1.5 text-right font-medium">Time</th>
                    </tr>
                  </thead>
                  <tbody className="num">
                    {(['greedy', 'hungarian'] as const).map((k) => {
                      const r = allocData.multi[k];
                      return (
                        <tr key={k} className="border-t border-hull-800">
                          <td className="py-1.5 font-sans font-medium">{k === 'greedy' ? 'Quick' : 'Optimized'}</td>
                          <td className="py-1.5 text-right">{r.totalCost.toFixed(2)}</td>
                          <td className="py-1.5 text-right">{r.assignments.length}</td>
                          <td className="py-1.5 text-right">{r.unassigned.length}</td>
                          <td className="py-1.5 text-right">{r.rounds}</td>
                          <td className="py-1.5 text-right">{r.costEvaluations}</td>
                          <td className="py-1.5 text-right">{fmtMs(r.timeMs)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <div className="mt-4 h-56">
                  <p className="mb-1 text-xs text-ink-400">Tasks per robot</p>
                  <ResponsiveContainer>
                    <BarChart data={allocData.workload.map((w) => ({ ...w }))} margin={{ left: -18, right: 4 }}>
                      <CartesianGrid {...GRID} />
                      <XAxis dataKey="robot" {...AXIS} />
                      <YAxis allowDecimals={false} {...AXIS} />
                      <Tooltip {...TOOLTIP} />
                      <Legend {...LEGEND} />
                      <Bar dataKey="greedy" name="Quick" fill={SERIES.amber} radius={[2, 2, 0, 0]} />
                      <Bar dataKey="hungarian" name="Optimized" fill={SERIES.green} radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
            <p className="text-xs text-ink-400">
              When robots take several tasks each, neither method can promise the best possible overall plan — the order of visits matters too. Optimized dispatch is guaranteed best within each round.
            </p>
          </div>
        )}
      </Panel>

      {/* ── scenario runs ── */}
      <Panel
        title="Dynamic scenarios"
        subtitle="Every built-in scenario run start to finish with three method combinations, using your current settings"
        actions={
          <button className="btn-primary btn-sm" onClick={runScenarios} disabled={busy !== null}>
            <Play size={14} /> {busy === 'scen' ? 'Running…' : 'Run all scenarios'}
          </button>
        }
      >
        {!runs ? (
          <EmptyState icon={<Gauge size={22} />} title="No scenario runs yet">
            18 complete runs — takes a moment.
          </EmptyState>
        ) : (
          <div className="space-y-5">
            <div className="grid gap-5 lg:grid-cols-2">
              <div className="h-64">
                <p className="mb-1 text-xs text-ink-400">Time to finish all tasks (seconds)</p>
                <ResponsiveContainer>
                  <BarChart data={pivot(runs, 'completionTick')} margin={{ left: -14, right: 4 }}>
                    <CartesianGrid {...GRID} />
                    <XAxis dataKey="scenario" {...AXIS} tick={{ ...AXIS.tick, fontSize: 10 }} interval={0} />
                    <YAxis {...AXIS} />
                    <Tooltip {...TOOLTIP} />
                    <Legend {...LEGEND} />
                    <Bar dataKey="Targeted + Quick" fill={SERIES.cyan} radius={[2, 2, 0, 0]} />
                    <Bar dataKey="Targeted + Optimized" fill={SERIES.green} radius={[2, 2, 0, 0]} />
                    <Bar dataKey="Exhaustive + Quick" fill={SERIES.violet} radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="h-64">
                <p className="mb-1 text-xs text-ink-400">Cells searched for routing</p>
                <ResponsiveContainer>
                  <BarChart data={pivot(runs, 'nodesExplored')} margin={{ left: -4, right: 4 }}>
                    <CartesianGrid {...GRID} />
                    <XAxis dataKey="scenario" {...AXIS} tick={{ ...AXIS.tick, fontSize: 10 }} interval={0} />
                    <YAxis {...AXIS} />
                    <Tooltip {...TOOLTIP} />
                    <Legend {...LEGEND} />
                    <Bar dataKey="Targeted + Quick" fill={SERIES.cyan} radius={[2, 2, 0, 0]} />
                    <Bar dataKey="Targeted + Optimized" fill={SERIES.green} radius={[2, 2, 0, 0]} />
                    <Bar dataKey="Exhaustive + Quick" fill={SERIES.violet} radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-sm">
                <thead className="text-left text-xs text-ink-400">
                  <tr>
                    {['Scenario', 'Methods', 'Breakdowns', 'Reassignments', 'Reroutes', 'Distance', 'Completed', 'Finish (s)', 'Cells searched', 'Decision time'].map((h, i) => (
                      <th key={h} className={`py-2 font-medium ${i > 1 ? 'text-right' : ''} px-2`}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {runs.map((r, i) => (
                    <tr key={i} className={`border-t border-hull-800 ${i % 3 === 0 ? 'border-hull-700' : ''}`}>
                      <td className="px-2 py-1.5 text-ink-200">{i % 3 === 0 ? r.scenario : ''}</td>
                      <td className="px-2 py-1.5 text-ink-300">{r.config}</td>
                      <td className="num px-2 py-1.5 text-right">{r.failures}</td>
                      <td className="num px-2 py-1.5 text-right">{r.reallocations}</td>
                      <td className="num px-2 py-1.5 text-right">{r.replans}</td>
                      <td className="num px-2 py-1.5 text-right">{r.distance}</td>
                      <td className="num px-2 py-1.5 text-right">
                        {r.completed}/{r.total}
                      </td>
                      <td className="num px-2 py-1.5 text-right">{r.completionTick}</td>
                      <td className="num px-2 py-1.5 text-right">{fmtNum(r.nodesExplored)}</td>
                      <td className="num px-2 py-1.5 text-right">{fmtMs(r.algorithmMs)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Panel>
    </div>
  );
}

function pivot(runs: ScenarioRun[], key: 'completionTick' | 'nodesExplored') {
  const by = new Map<string, Record<string, string | number>>();
  for (const r of runs) {
    const short = r.scenario.replace(' scenario', '').replace('Emergency high-priority task', 'Emergency').replace('Multiple robot failures', 'Multi-failure').replace('Single robot failure', 'Single failure');
    const row = by.get(short) ?? { scenario: short };
    row[r.config] = r[key];
    by.set(short, row);
  }
  return [...by.values()];
}
