import { Dices, Play, RefreshCw, Sparkles, Upload } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ConfirmDialog, Panel, Segmented } from '../components/common/ui';
import { FloorMap } from '../components/simulation/FloorMap';
import { useSim } from '../context/SimulationContext';
import type { ScenarioDefinition } from '../models/SimulationState';
import { SimulationEngine } from '../simulation/SimulationEngine';
import { SCENARIOS } from '../simulation/scenarios';
import { DENSITIES, GRID_SIZES, ROBOT_COUNTS, TASK_COUNTS, generateScenario } from '../simulation/ScenarioGenerator';
import type { GeneratorOptions } from '../simulation/ScenarioGenerator';
import { formatTick } from '../models/Event';

function Preview({ scenario }: { scenario: ScenarioDefinition }) {
  const state = useMemo(() => new SimulationEngine(scenario).state, [scenario]);
  return (
    <div className="w-full" style={{ aspectRatio: `${scenario.cols} / ${scenario.rows}` }}>
      <FloorMap state={state} version={0} tickMs={0} showPaths={false} showSearch={false} label={`Preview of ${scenario.name}`} />
    </div>
  );
}

const EVENT_TEXT: Record<string, string> = { fail: 'robot breakdown', restore: 'robot repaired', obstacle: 'obstacle', blockPath: 'aisle blocked', task: 'new task', priority: 'priority change' };

export default function Scenarios() {
  const sim = useSim();
  const navigate = useNavigate();
  const [pending, setPending] = useState<ScenarioDefinition | null>(null);
  const [opts, setOpts] = useState<GeneratorOptions>({ size: 30, robots: 5, tasks: 20, density: 0.2, seed: 2026 });
  const generated = useMemo(() => {
    try {
      return { ok: true as const, ...generateScenario(opts) };
    } catch (e) {
      return { ok: false as const, error: e instanceof Error ? e.message : 'Generation failed' };
    }
  }, [opts]);

  const load = (s: ScenarioDefinition) => {
    if (sim.state.tick > 0 && !sim.state.finished) setPending(s);
    else {
      sim.loadScenario(s);
      navigate('/simulation');
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[28px] font-bold leading-tight">Scenarios</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-300">Six deterministic scenarios that replay identically every time, plus a seeded generator for random warehouses.</p>
      </div>

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {SCENARIOS.map((s) => {
          const active = sim.state.scenarioId === s.id;
          const isDemo = s.id === 'combined';
          return (
            <article key={s.id} className={`panel flex flex-col overflow-hidden ${isDemo ? 'border-signal-violet/50' : ''} ${active ? 'ring-1 ring-signal-cyan/60' : ''}`}>
              <div className="border-b border-hull-700/70 bg-hull-950/50 p-2">
                <Preview scenario={s} />
              </div>
              <div className="flex flex-1 flex-col p-4">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="text-base font-semibold">{s.name}</h2>
                  {active && <span className="text-[11px] text-signal-cyan">Loaded</span>}
                </div>
                <p className="mt-1 text-sm text-ink-300">{s.description}</p>
                <p className="mt-3 text-xs text-ink-400">
                  {s.robots.length} robots · {s.tasks.length} tasks · {s.rows}×{s.cols}
                </p>
                {s.events.length > 0 && (
                  <ul className="mt-2 space-y-0.5 font-mono text-[11px] text-ink-300">
                    {s.events.map((e, i) => (
                      <li key={i}>
                        <span className="text-ink-400">[{formatTick(e.at)}]</span> {EVENT_TEXT[e.type]}
                        {'robotId' in e && e.robotId ? ` ${e.robotId}` : ''}
                        {e.type === 'task' ? ` (priority ${e.priority})` : ''}
                      </li>
                    ))}
                  </ul>
                )}
                <div className="mt-auto flex gap-2 pt-4">
                  <button className="btn-primary btn-sm" onClick={() => load(s)}>
                    <Upload size={14} /> Load
                  </button>
                  {isDemo && (
                    <button
                      className="btn btn-sm border border-signal-violet/50 bg-signal-violet/15 text-[#C9B8FF] hover:bg-signal-violet/25"
                      onClick={() => {
                        sim.startDemo();
                        navigate('/simulation');
                      }}
                    >
                      <Sparkles size={14} /> Run as demo
                    </button>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>

      <Panel title="Random scenario generator" subtitle="Robots and tasks are placed only inside the largest connected region, so every task starts reachable">
        <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
          <div className="space-y-4">
            <div>
              <p className="label">Grid size</p>
              <Segmented ariaLabel="Grid size" value={opts.size} onChange={(v) => setOpts({ ...opts, size: v })} options={GRID_SIZES.map((s) => ({ value: s, label: `${s}×${s}` }))} />
            </div>
            <div>
              <p className="label">Robots</p>
              <Segmented ariaLabel="Robots" value={opts.robots} onChange={(v) => setOpts({ ...opts, robots: v })} options={ROBOT_COUNTS.map((s) => ({ value: s, label: String(s) }))} />
            </div>
            <div>
              <p className="label">Tasks</p>
              <Segmented ariaLabel="Tasks" value={opts.tasks} onChange={(v) => setOpts({ ...opts, tasks: v })} options={TASK_COUNTS.map((s) => ({ value: s, label: String(s) }))} />
            </div>
            <div>
              <p className="label">Obstacle density</p>
              <Segmented ariaLabel="Obstacle density" value={opts.density} onChange={(v) => setOpts({ ...opts, density: v })} options={DENSITIES.map((s) => ({ value: s, label: `${Math.round(s * 100)}%` }))} />
            </div>
            <div>
              <label htmlFor="seed" className="label">
                Seed
              </label>
              <div className="flex gap-2">
                <input id="seed" type="number" className="input" value={opts.seed} onChange={(e) => setOpts({ ...opts, seed: Math.abs(Math.floor(Number(e.target.value) || 0)) })} />
                <button className="btn-ghost shrink-0" onClick={() => setOpts({ ...opts, seed: Math.floor(Math.random() * 100000) })}>
                  <Dices size={16} /> Regenerate
                </button>
              </div>
              <p className="mt-1 text-xs text-ink-400">The same seed and settings always produce the same warehouse.</p>
            </div>
            {generated.ok ? (
              <>
                <p className="text-xs text-ink-300">
                  Connected region: <span className="num text-ink-100">{generated.componentSize}</span> cells · obstacles:{' '}
                  <span className="num text-ink-100">{generated.scenario.obstacles.length}</span>
                  {generated.attempts > 1 && ` · ${generated.attempts} attempts`}
                </p>
                <div className="flex gap-2">
                  <button className="btn-primary" onClick={() => load(generated.scenario)}>
                    <Play size={16} /> Load into simulation
                  </button>
                  <button className="btn-ghost" onClick={() => setOpts({ ...opts, seed: opts.seed + 1 })}>
                    <RefreshCw size={16} /> Next seed
                  </button>
                </div>
              </>
            ) : (
              <p className="text-sm text-signal-red">{generated.error}</p>
            )}
          </div>
          <div className="panel-inset p-2">{generated.ok && <Preview scenario={generated.scenario} />}</div>
        </div>
      </Panel>

      <ConfirmDialog
        open={pending !== null}
        title="Replace the running simulation?"
        message={`The current run "${sim.state.scenarioName}" is at ${formatTick(sim.state.tick)}. Loading "${pending?.name}" discards its state and event log.`}
        confirmLabel="Load scenario"
        onConfirm={() => {
          if (pending) {
            sim.loadScenario(pending);
            navigate('/simulation');
          }
        }}
        onCancel={() => setPending(null)}
      />
    </div>
  );
}
