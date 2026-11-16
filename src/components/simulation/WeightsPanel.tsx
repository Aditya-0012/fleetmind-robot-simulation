import { useSim } from '../../context/SimulationContext';
import { DEFAULT_WEIGHTS } from '../../algorithms/allocation/types';
import type { CostWeights } from '../../algorithms/allocation/types';

const FIELDS: { key: keyof CostWeights; label: string; hint: string }[] = [
  { key: 'alpha', label: 'Travel distance', hint: 'Prefer robots that are closer to the task' },
  { key: 'beta', label: 'Current load', hint: 'Prefer robots with fewer tasks already lined up' },
  { key: 'gamma', label: 'Task urgency', hint: 'Push urgent tasks ahead of routine ones' },
  { key: 'delta', label: 'Finish time', hint: 'Prefer robots that could finish the task sooner' },
];

/** Sliders for how much each factor counts when choosing a robot. Applied to the next assignment. */
export function WeightsPanel() {
  const { state, engine } = useSim();
  const w = state.config.weights;
  return (
    <div className="space-y-3">
      <p className="text-xs text-ink-400">Each robot gets a score for each task. Move a slider right to make that factor count more.</p>
      {FIELDS.map((f) => (
        <label key={f.key} className="block" title={f.hint}>
          <span className="flex items-center justify-between text-xs">
            <span className="text-ink-300">{f.label}</span>
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
            aria-label={`${f.label} importance`}
          />
        </label>
      ))}
      <div className="flex items-center justify-between gap-2 pt-1">
        <label className="flex items-center gap-2 text-xs text-ink-300">
          Max tasks per robot
          <select className="input w-auto py-1 text-xs" value={state.config.capacity} onChange={(e) => engine.setCapacity(Number(e.target.value))}>
            {[1, 2, 3, 4, 5, 6, 8, 10].map((c) => (
              <option key={c} value={c}>
                {c} tasks
              </option>
            ))}
          </select>
        </label>
        <button className="text-xs text-signal-cyan hover:underline" onClick={() => engine.setWeights({ ...DEFAULT_WEIGHTS })}>
          Reset to defaults
        </button>
      </div>
    </div>
  );
}
