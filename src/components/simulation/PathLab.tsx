import { Flag, MousePointer2, Pause, Play, RotateCcw, SkipForward, Square, StepForward, Target, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent } from 'react';
import { astar, dijkstra } from '../../algorithms/pathfinding';
import type { PathAlgorithm, SearchResult } from '../../algorithms/pathfinding';
import { createGrid, fromKey, pointLabel, samePoint, toKey } from '../../models/Grid';
import type { GridData, Point } from '../../models/Grid';
import { fmtMs } from '../../utils/format';
import { Segmented } from '../common/ui';

const ROWS = 15;
const COLS = 31;
const C = 22;

type Mode = 'inspect' | 'wall' | 'start' | 'goal';

function initialGrid(): GridData {
  const g = createGrid(ROWS, COLS);
  const wall = (r0: number, r1: number, c: number) => {
    for (let r = r0; r <= r1; r++) g.obstacles[toKey({ r, c }, COLS)] = 1;
  };
  wall(0, 10, 8);
  wall(4, 14, 15);
  wall(0, 9, 22);
  for (let c = 16; c <= 20; c++) g.obstacles[toKey({ r: 11, c }, COLS)] = 1;
  return g;
}

interface Replay {
  open: Set<number>;
  closed: Set<number>;
  current: number | null;
  scores: Map<number, { g: number; h: number; f: number; parent: number }>;
}

/** Re-derives the open/closed sets and node scores as they were after `upto` trace steps. */
function replay(res: SearchResult | null, upto: number): Replay {
  const open = new Set<number>();
  const closed = new Set<number>();
  const scores = new Map<number, { g: number; h: number; f: number; parent: number }>();
  let current: number | null = null;
  if (!res?.trace) return { open, closed, current, scores };
  for (let i = 0; i < Math.min(upto, res.trace.length); i++) {
    const s = res.trace[i];
    if (s.kind === 'open') {
      open.add(s.key);
      scores.set(s.key, { g: s.g, h: s.h, f: s.f, parent: s.parent });
    } else {
      open.delete(s.key);
      closed.add(s.key);
      current = s.key;
    }
  }
  return { open, closed, current, scores };
}

export function PathLab({ initialAlgorithm = 'astar' }: { initialAlgorithm?: PathAlgorithm }) {
  const [grid, setGrid] = useState<GridData>(initialGrid);
  const [start, setStart] = useState<Point>({ r: 7, c: 2 });
  const [goal, setGoal] = useState<Point>({ r: 7, c: 28 });
  const [alg, setAlg] = useState<PathAlgorithm>(initialAlgorithm);
  const [mode, setMode] = useState<Mode>('wall');
  const [result, setResult] = useState<SearchResult | null>(null);
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(30);
  const [inspect, setInspect] = useState<number | null>(null);
  const [compare, setCompare] = useState<SearchResult[] | null>(null);
  const dragging = useRef<null | 0 | 1>(null);

  useEffect(() => setAlg(initialAlgorithm), [initialAlgorithm]);

  const total = result?.trace?.length ?? 0;
  const finished = result !== null && step >= total;
  const view = useMemo(() => replay(result, step), [result, step]);

  useEffect(() => {
    if (!playing || !result) return;
    if (step >= total) {
      setPlaying(false);
      return;
    }
    const id = setTimeout(() => setStep((s) => Math.min(total, s + Math.max(1, Math.round(speed / 15)))), Math.max(8, 60 - speed));
    return () => clearTimeout(id);
  }, [playing, step, total, result, speed]);

  const invalidate = () => {
    setResult(null);
    setStep(0);
    setPlaying(false);
    setInspect(null);
    setCompare(null);
  };

  const run = (auto: boolean) => {
    const res = (alg === 'astar' ? astar : dijkstra)(grid, start, goal, { recordTrace: true });
    setResult(res);
    setStep(auto ? 0 : 1);
    setPlaying(auto);
    setInspect(null);
  };

  const ensureRun = () => {
    if (!result) {
      const res = (alg === 'astar' ? astar : dijkstra)(grid, start, goal, { recordTrace: true });
      setResult(res);
      setStep(1);
    } else setStep((s) => Math.min(total, s + 1));
    setPlaying(false);
  };

  const applyCell = (p: Point, value?: 0 | 1) => {
    if (mode === 'inspect') {
      setInspect(toKey(p, COLS));
      return;
    }
    if (mode === 'start' || mode === 'goal') {
      if (grid.obstacles[toKey(p, COLS)]) return;
      if (mode === 'start' && !samePoint(p, goal)) setStart(p);
      if (mode === 'goal' && !samePoint(p, start)) setGoal(p);
      invalidate();
      return;
    }
    if (samePoint(p, start) || samePoint(p, goal)) return;
    const k = toKey(p, COLS);
    const next = value ?? (grid.obstacles[k] ? 0 : 1);
    if (grid.obstacles[k] === next) return;
    const g = { ...grid, obstacles: new Uint8Array(grid.obstacles) };
    g.obstacles[k] = next;
    setGrid(g);
    invalidate();
  };

  const cellAt = (e: PointerEvent<SVGSVGElement>): Point | null => {
    const rect = e.currentTarget.getBoundingClientRect();
    const c = Math.floor(((e.clientX - rect.left) / rect.width) * COLS);
    const r = Math.floor(((e.clientY - rect.top) / rect.height) * ROWS);
    return r >= 0 && r < ROWS && c >= 0 && c < COLS ? { r, c } : null;
  };

  const pathKeys = useMemo(() => new Set(finished && result?.found ? result.path.map((p) => toKey(p, COLS)) : []), [finished, result]);
  const ins = inspect !== null ? view.scores.get(inspect) : undefined;
  const insStatus = inspect === null ? '' : view.closed.has(inspect) ? 'already checked' : view.open.has(inspect) ? 'next to check' : grid.obstacles[inspect] ? 'wall' : 'not reached yet';

  const runCompare = () => {
    setCompare([astar(grid, start, goal), dijkstra(grid, start, goal)]);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Segmented
          ariaLabel="Routing method"
          size="sm"
          value={alg}
          onChange={(v) => {
            setAlg(v);
            invalidate();
          }}
          options={[
            { value: 'astar', label: 'Targeted' },
            { value: 'dijkstra', label: 'Exhaustive' },
          ]}
        />
        <Segmented
          ariaLabel="Edit mode"
          size="sm"
          value={mode}
          onChange={setMode}
          options={[
            { value: 'wall', label: <span className="flex items-center gap-1"><Square size={12} /> Walls</span> },
            { value: 'start', label: <span className="flex items-center gap-1"><Flag size={12} /> Start</span> },
            { value: 'goal', label: <span className="flex items-center gap-1"><Target size={12} /> Goal</span> },
            { value: 'inspect', label: <span className="flex items-center gap-1"><MousePointer2 size={12} /> Inspect</span> },
          ]}
        />
        <div className="ml-auto flex flex-wrap gap-1.5">
          <button className="btn-primary btn-sm" onClick={() => (result && !finished ? setPlaying(!playing) : run(true))}>
            {playing ? <Pause size={14} /> : <Play size={14} />}
            {playing ? 'Pause' : result && !finished ? 'Resume' : 'Find route'}
          </button>
          <button className="btn-ghost btn-sm" onClick={ensureRun} disabled={finished}>
            <StepForward size={14} /> Step
          </button>
          <button className="btn-ghost btn-sm" onClick={() => { if (!result) run(false); setStep(Number.MAX_SAFE_INTEGER); setPlaying(false); }}>
            <SkipForward size={14} /> Finish
          </button>
          <button className="btn-ghost btn-sm" onClick={invalidate} title="Clear the search">
            <RotateCcw size={14} />
          </button>
          <button className="btn-ghost btn-sm" onClick={() => { setGrid(createGrid(ROWS, COLS)); invalidate(); }} title="Remove all walls">
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div className="panel-inset overflow-hidden p-1.5">
          <svg
            viewBox={`0 0 ${COLS * C} ${ROWS * C}`}
            className="block w-full touch-none select-none"
            role="img"
            aria-label="Route explorer grid"
            onPointerDown={(e) => {
              const p = cellAt(e);
              if (!p) return;
              const k = toKey(p, COLS);
              dragging.current = mode === 'wall' ? (grid.obstacles[k] ? 0 : 1) : null;
              applyCell(p, dragging.current ?? undefined);
            }}
            onPointerMove={(e) => {
              if (dragging.current === null || e.buttons !== 1) return;
              const p = cellAt(e);
              if (p) applyCell(p, dragging.current);
            }}
            onPointerUp={() => (dragging.current = null)}
            onPointerLeave={() => (dragging.current = null)}
          >
            {Array.from({ length: ROWS * COLS }, (_, k) => {
              const p = fromKey(k, COLS);
              let fill = '#0A1020';
              if (grid.obstacles[k]) fill = '#26355C';
              else if (pathKeys.has(k)) fill = '#3EE6A0';
              else if (k === view.current && !finished) fill = '#FFC247';
              else if (view.closed.has(k)) fill = alg === 'astar' ? '#164257' : '#1B3A5C';
              else if (view.open.has(k)) fill = '#3B2F73';
              return (
                <rect key={k} x={p.c * C + 0.5} y={p.r * C + 0.5} width={C - 1} height={C - 1} rx={2.5} fill={fill} stroke={inspect === k ? '#E8EEFA' : 'none'} strokeWidth={1.5} />
              );
            })}
            {[
              { p: start, color: '#2BD9F2', label: 'S' },
              { p: goal, color: '#FF5470', label: 'G' },
            ].map(({ p, color, label }) => (
              <g key={label}>
                <rect x={p.c * C + 2} y={p.r * C + 2} width={C - 4} height={C - 4} rx={4} fill={color} />
                <text x={p.c * C + C / 2} y={p.r * C + C / 2 + 4} textAnchor="middle" fontSize={11} fontWeight={700} fontFamily="Chakra Petch" fill="#060A14">
                  {label}
                </text>
              </g>
            ))}
          </svg>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 px-1 text-[11px] text-ink-400">
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-[#3B2F73]" /> next to check</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-[#164257]" /> already checked</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-signal-amber" /> checking now</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-signal-green" /> route found</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-[#26355C]" /> wall</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-[#0A1020] ring-1 ring-hull-600" /> unvisited</span>
          </div>
        </div>

        <div className="space-y-3">
          <div className="panel-inset p-3">
            <p className="text-xs text-ink-400">Progress</p>
            <p className="num mt-0.5 text-lg font-semibold">
              {Math.min(step, total)} / {total || '—'} <span className="text-xs font-normal text-ink-400">search steps</span>
            </p>
            <label className="mt-2 block text-xs text-ink-400">
              Playback speed
              <input type="range" min={1} max={58} value={speed} onChange={(e) => setSpeed(Number(e.target.value))} className="mt-1 w-full accent-[#2BD9F2]" />
            </label>
            {result && (
              <dl className="mt-2 space-y-1 text-sm">
                <div className="flex justify-between"><dt className="text-ink-400">Next to check</dt><dd className="num">{view.open.size}</dd></div>
                <div className="flex justify-between"><dt className="text-ink-400">Already checked</dt><dd className="num">{view.closed.size}</dd></div>
                {finished && (
                  <>
                    <div className="flex justify-between"><dt className="text-ink-400">Route length</dt><dd className="num">{result.found ? `${result.cost} cells` : 'no route'}</dd></div>
                    <div className="flex justify-between"><dt className="text-ink-400">Cells searched</dt><dd className="num">{result.nodesExplored}</dd></div>
                                      </>
                )}
              </dl>
            )}
            {result && !result.found && finished && <p className="mt-2 text-xs text-signal-red">The goal cannot be reached — walls block every way in.</p>}
          </div>

          <div className="panel-inset p-3">
            <p className="text-xs text-ink-400">Cell details {mode !== 'inspect' && <span>(choose Inspect, then click a cell)</span>}</p>
            {inspect === null ? (
              <p className="mt-1 text-sm text-ink-300">No cell selected.</p>
            ) : (
              <div className="mt-1 text-sm">
                <p className="font-mono">
                  {pointLabel(fromKey(inspect, COLS))} · <span className="text-ink-300">{insStatus}</span>
                </p>
                {ins ? (
                  <dl className="mt-2 grid grid-cols-3 gap-2 text-center">
                    {(['g', 'h', 'f'] as const).map((k) => (
                      <div key={k} className="rounded-md bg-hull-800 px-1 py-1.5">
                        <dt className="text-[10.5px] leading-tight text-ink-400">{{ g: 'Driven so far', h: 'Estimate left', f: 'Total estimate' }[k]}</dt>
                        <dd className="num text-lg font-semibold text-signal-cyan">{ins[k]}</dd>
                      </div>
                    ))}
                  </dl>
                ) : (
                  <p className="mt-1 text-xs text-ink-400">The search has not reached this cell yet.</p>
                )}
                {ins && ins.parent >= 0 && <p className="mt-2 text-xs text-ink-400">Reached from {pointLabel(fromKey(ins.parent, COLS))}</p>}
                {alg === 'dijkstra' && ins && <p className="mt-1 text-xs text-ink-400">Exhaustive routing makes no estimate of the distance left, so it is always 0.</p>}
              </div>
            )}
          </div>

          <div className="panel-inset p-3">
            <div className="flex items-center justify-between">
              <p className="text-xs text-ink-400">Same map, both methods</p>
              <button className="text-xs text-signal-cyan hover:underline" onClick={runCompare}>
                Compare
              </button>
            </div>
            {compare && (
              <table className="mt-2 w-full text-xs">
                <thead className="text-ink-400">
                  <tr>
                    <th className="text-left font-normal"></th>
                    <th className="text-right font-normal">Targeted</th>
                    <th className="text-right font-normal">Exhaustive</th>
                  </tr>
                </thead>
                <tbody className="num">
                  <tr><td className="text-ink-300">Route</td><td className="text-right">{compare[0].found ? compare[0].cost : '—'}</td><td className="text-right">{compare[1].found ? compare[1].cost : '—'}</td></tr>
                  <tr><td className="text-ink-300">Cells searched</td><td className="text-right text-signal-cyan">{compare[0].nodesExplored}</td><td className="text-right">{compare[1].nodesExplored}</td></tr>
                  <tr><td className="text-ink-300">Time</td><td className="text-right">{fmtMs(compare[0].timeMs)}</td><td className="text-right">{fmtMs(compare[1].timeMs)}</td></tr>
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
