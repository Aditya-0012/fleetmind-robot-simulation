import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';
import { SimulationEngine } from '../simulation/SimulationEngine';
import { SimulationClock } from '../simulation/SimulationClock';
import type { Speed } from '../simulation/SimulationClock';
import { DEMO_SCENARIO } from '../simulation/DemoController';
import { getScenario } from '../simulation/scenarios';
import type { ScenarioDefinition, SimState } from '../models/SimulationState';

interface SimValue {
  engine: SimulationEngine;
  clock: SimulationClock;
  state: SimState;
  version: number;
  running: boolean;
  speed: Speed;
  tickMs: number;
  demoActive: boolean;
  start(): void;
  pause(): void;
  toggle(): void;
  step(): void;
  reset(): void;
  setSpeed(s: Speed): void;
  loadScenario(s: ScenarioDefinition): void;
  startDemo(): void;
  exitDemo(): void;
}

const SimContext = createContext<SimValue | null>(null);

/**
 * Owns the single engine + clock for the whole app, so the simulation keeps running while
 * the user moves between pages. React subscribes through useSyncExternalStore and never
 * mutates engine state directly.
 */
export function SimulationProvider({ children }: { children: ReactNode }) {
  const engineRef = useRef<SimulationEngine | null>(null);
  const clockRef = useRef<SimulationClock | null>(null);
  if (!engineRef.current) {
    engineRef.current = new SimulationEngine(getScenario('combined'));
    clockRef.current = new SimulationClock(engineRef.current);
  }
  const engine = engineRef.current;
  const clock = clockRef.current!;
  const [demoActive, setDemoActive] = useState(false);

  const version = useSyncExternalStore(
    useCallback((cb) => engine.subscribe(cb), [engine]),
    () => engine.version,
  );
  const clockKey = useSyncExternalStore(
    useCallback((cb) => clock.subscribe(cb), [clock]),
    () => `${clock.running}|${clock.speed}`,
  );

  useEffect(() => () => clock.pause(), [clock]);

  const loadScenario = useCallback(
    (s: ScenarioDefinition) => {
      clock.pause();
      setDemoActive(false);
      engine.load(s);
    },
    [clock, engine],
  );

  const startDemo = useCallback(() => {
    clock.pause();
    engine.load(DEMO_SCENARIO, { pathAlgorithm: 'astar', showSearch: true });
    engine.log('DEMO', 'info', 'Demo mode started — combined failure scenario');
    setDemoActive(true);
    clock.setSpeed(1);
    clock.start();
  }, [clock, engine]);

  const value = useMemo<SimValue>(
    () => ({
      engine,
      clock,
      state: engine.state,
      version,
      running: clock.running,
      speed: clock.speed,
      tickMs: clock.tickMs,
      demoActive,
      start: () => clock.start(),
      pause: () => clock.pause(),
      toggle: () => clock.toggle(),
      step: () => clock.stepOnce(),
      reset: () => {
        clock.pause();
        engine.reset();
      },
      setSpeed: (s) => clock.setSpeed(s),
      loadScenario,
      startDemo,
      exitDemo: () => setDemoActive(false),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [engine, clock, version, clockKey, demoActive, loadScenario, startDemo],
  );

  return <SimContext.Provider value={value}>{children}</SimContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSim(): SimValue {
  const ctx = useContext(SimContext);
  if (!ctx) throw new Error('useSim must be used inside SimulationProvider');
  return ctx;
}
