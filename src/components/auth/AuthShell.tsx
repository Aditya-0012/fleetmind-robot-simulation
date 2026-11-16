import { useEffect, useRef, useState, useSyncExternalStore, useCallback } from 'react';
import type { ReactNode } from 'react';
import { SimulationEngine } from '../../simulation/SimulationEngine';
import { getScenario } from '../../simulation/scenarios';
import { FloorMap } from '../simulation/FloorMap';
import { Logo } from '../layout/Logo';
import { formatTick } from '../../models/Event';

const TICK = 420;

/**
 * Sign-in / sign-up frame. The left side runs a real, private engine instance on the
 * combined scenario and loops it — the first thing a visitor sees is the system working.
 */
export function AuthShell({ children }: { children: ReactNode }) {
  const engineRef = useRef<SimulationEngine | null>(null);
  if (!engineRef.current) engineRef.current = new SimulationEngine(getScenario('combined'), { showSearch: true });
  const engine = engineRef.current;
  const version = useSyncExternalStore(
    useCallback((cb) => engine.subscribe(cb), [engine]),
    () => engine.version,
  );
  const [reduced] = useState(() => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);

  useEffect(() => {
    if (reduced) {
      for (let i = 0; i < 12; i++) engine.step();
      return;
    }
    const id = setInterval(() => {
      if (engine.state.finished) engine.reset();
      else engine.step();
    }, TICK);
    return () => clearInterval(id);
  }, [engine, reduced]);

  const s = engine.state;
  const done = s.tasks.filter((t) => t.status === 'COMPLETED').length;
  const last = [...s.events].reverse().find((e) => e.type !== 'MOVEMENT');

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.25fr_1fr]">
      <div className="relative hidden flex-col overflow-hidden border-r border-hull-700/70 bg-hull-950/60 p-8 lg:flex">
        <Logo size="lg" />
        <div className="mt-10 max-w-xl">
          <h1 className="text-4xl font-bold leading-[1.1] xl:text-5xl">
            Robots fail. Aisles get blocked.
            <br />
            The work still gets done.
          </h1>
          <p className="mt-4 max-w-md text-ink-300">
            Watch a live run below: tasks are allocated, one robot breaks down, a route is blocked and replanned, and an emergency job jumps the queue.
          </p>
        </div>
        <div className="relative mt-8 flex-1">
          <div className="absolute inset-0">
            <FloorMap state={s} version={version} tickMs={TICK} showSearch label="Live demonstration of the robot fleet" />
          </div>
        </div>
        <div className="mt-4 flex items-center gap-6 font-mono text-xs text-ink-300">
          <span>
            t = <span className="text-ink-100">{formatTick(s.tick)}</span>
          </span>
          <span>
            tasks <span className="text-signal-green">{done}</span>/{s.tasks.length}
          </span>
          <span>
            replans <span className="text-signal-amber">{s.metrics.replans}</span>
          </span>
          <span className="truncate text-ink-400">{last?.message}</span>
        </div>
      </div>
      <div className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <Logo />
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
