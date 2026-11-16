import { useSim } from '../../context/SimulationContext';
import { DEFAULT_WEIGHTS } from '../../algorithms/allocation/types';
import type { CostWeights } from '../../algorithms/allocation/types';

const FIELDS: { key: keyof CostWeights; sym: string; label: string; hint: string }[] = [
  { key: 'alpha', sym: 'α', label: 'Distance', hint: 'Shortest-path distance from the robot to the task' },
  { key: 'beta', sym: 'β', label: 'Workload', hint: 'Tasks already queued on the robot' },
  { key: 'gamma', sym: 'γ', label: 'Priority', hint: 'Penalty for low-priority tasks (critical = 0)' },
  { key: 'delta', sym: 'δ', label: 'Finish time', hint: 'Estimated time until the robot could finish the task' },
];

/** Live editor for the cost function weights. Changes apply from the next allocation. */
export function WeightsPanel() {
  const { state, engine } = useSim();
  const w = state.config.weights;
  return (
    <div className="space-y-3">
      <p className="font-mono text-xs text-ink-300">
        Cost = <span className="text-signal-cyan">α</span>D + <span className="text-signal-cyan">β</span>W + <span className="text-signal-cyan">γ</span>P + <span className="text-signal-cyan">δ</span>L
      </p>
      {FIELDS.map((f) => (
        <label key={f.key} className="block" title={f.hint}>
          <span className="flex items-center justify-between text-xs">
            <span className="text-ink-300">
              <span className="font-mono text-signal-cyan">{f.sym}</span> {f.label}
            </span>
            <span className="num text-ink-100">{w[f.key].toFixed(2)}</span>
          </span>
          <input
            type="range"
            min={0}
            max={2}
            step={0.05}
            value={w[f.key]}
            onChange={(e) => engine.setWeights({ ...w, [f.key]: Number(e.target.value) })}
            className="mt-1 w-full accent-[#2BD9F2]"
            aria-label={`${f.label} weight`}
          />
        </label>
      ))}
      <div className="flex items-center justify-between gap-2 pt-1">
        <label className="flex items-center gap-2 text-xs text-ink-300">
          Capacity
          <select className="input w-auto py-1 text-xs" value={state.config.capacity} onChange={(e) => engine.setCapacity(Number(e.target.value))}>
            {[1, 2, 3, 4, 5, 6, 8, 10].map((c) => (
              <option key={c} value={c}>
                {c} tasks
              </option>
            ))}
          </select>
        </label>
        <button className="text-xs text-signal-cyan hover:underline" onClick={() => engine.setWeights({ ...DEFAULT_WEIGHTS })}>
          Restore defaults
        </button>
      </div>
    </div>
  );
}
