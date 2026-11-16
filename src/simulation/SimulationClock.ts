import type { SimulationEngine } from './SimulationEngine';

export type Speed = 0.5 | 1 | 2 | 5;
export const SPEEDS: Speed[] = [0.5, 1, 2, 5];

/** Milliseconds per tick at 1× speed. */
export const BASE_TICK_MS = 550;

/**
 * Drives the engine at a fixed real-time rate. The clock only decides *when* step() is
 * called — it never changes what step() does — so pausing, resuming, changing speed or
 * single-stepping all produce exactly the same simulation.
 */
export class SimulationClock {
  private timer: ReturnType<typeof setInterval> | null = null;
  private listeners = new Set<() => void>();
  speed: Speed = 1;
  private readonly engine: SimulationEngine;

  constructor(engine: SimulationEngine) {
    this.engine = engine;
  }

  get running(): boolean {
    return this.timer !== null;
  }

  get tickMs(): number {
    return BASE_TICK_MS / this.speed;
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(): void {
    for (const fn of this.listeners) fn();
  }

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => this.tick(), this.tickMs);
    this.emit();
  }

  pause(): void {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = null;
    this.emit();
  }

  toggle(): void {
    if (this.running) this.pause();
    else this.start();
  }

  stepOnce(): void {
    this.pause();
    this.engine.step();
  }

  setSpeed(s: Speed): void {
    this.speed = s;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = setInterval(() => this.tick(), this.tickMs);
    }
    this.emit();
  }

  private tick(): void {
    this.engine.step();
    const st = this.engine.state;
    if (st.finished && st.scheduled.length === 0) this.pause(); // auto-stop when the mission is over
  }

  dispose(): void {
    this.pause();
    this.listeners.clear();
  }
}
