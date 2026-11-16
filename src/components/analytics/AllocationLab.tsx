import { Dices, Play } from 'lucide-react';
import { useMemo, useState } from 'react';
import { greedyMatrix, hungarian } from '../../algorithms/allocation';
import { mulberry32 } from '../../utils/random';

const PRESET = [
  [1, 2],
  [2, 100],
];

/** Editable cost matrix: runs Greedy and Hungarian on exactly the same numbers. */
export function AllocationLab() {
  const [matrix, setMatrix] = useState<number[][]>(PRESET);
  const [seed, setSeed] = useState(1);

  const res = useMemo(() => {
    const g = greedyMatrix(matrix);
    const h = hungarian(matrix);
    return { g, h };
  }, [matrix]);

  const randomise = (n: number, m: number) => {
    const rnd = mulberry32(seed * 977 + n * 31 + m);
    setSeed(seed + 1);
    setMatrix(Array.from({ length: n }, () => Array.from({ length: m }, () => 1 + Math.floor(rnd() * 20))));
  };

  const set = (i: number, j: number, v: string) => {
    const x = Number(v);
    if (!Number.isFinite(x) || x < 0) return;
    setMatrix(matrix.map((row, a) => row.map((c, b) => (a === i && b === j ? x : c))));
  };

  const cell = (i: number, j: number) => {
    const gh = res.g.rowToCol[i] === j;
    const hh = res.h.rowToCol[i] === j;
    return (
      <td key={j} className="p-1">
        <div className={`relative rounded-md ${hh ? 'ring-2 ring-signal-green' : ''}`}>
          <input
            aria-label={`Cost robot ${i + 1} task ${j + 1}`}
            value={matrix[i][j]}
            onChange={(e) => set(i, j, e.target.value)}
            className={`w-14 rounded-md border bg-hull-950 px-2 py-1.5 text-center font-mono text-sm ${gh ? 'border-signal-amber text-signal-amber' : 'border-hull-600 text-ink-100'}`}
          />
        </div>
      </td>
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <button className="btn-ghost btn-sm" onClick={() => setMatrix(PRESET)}>
          <Play size={14} /> Greedy trap (2×2)
        </button>
        <button className="btn-ghost btn-sm" onClick={() => randomise(4, 4)}>
          <Dices size={14} /> Random 4×4
        </button>
        <button className="btn-ghost btn-sm" onClick={() => randomise(3, 5)}>
          <Dices size={14} /> 3 robots × 5 tasks
        </button>
        <button className="btn-ghost btn-sm" onClick={() => randomise(5, 3)}>
          <Dices size={14} /> 5 robots × 3 tasks
        </button>
      </div>
      <div className="flex flex-wrap items-start gap-6">
        <table className="text-xs">
          <thead>
            <tr>
              <th />
              {matrix[0].map((_, j) => (
                <th key={j} className="pb-1 font-medium text-ink-400">
                  T{j + 1}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.map((row, i) => (
              <tr key={i}>
                <th className="pr-2 text-right font-medium text-ink-400">R{i + 1}</th>
                {row.map((_, j) => cell(i, j))}
              </tr>
            ))}
          </tbody>
        </table>
        <dl className="space-y-2 text-sm">
          <div>
            <dt className="flex items-center gap-2 text-ink-300">
              <span className="h-3 w-3 rounded-sm border-2 border-signal-amber" /> Greedy (task order T1, T2, …)
            </dt>
            <dd className="num text-xl font-semibold text-signal-amber">{res.g.totalCost.toFixed(2)}</dd>
          </div>
          <div>
            <dt className="flex items-center gap-2 text-ink-300">
              <span className="h-3 w-3 rounded-sm ring-2 ring-signal-green" /> Hungarian (optimal)
            </dt>
            <dd className="num text-xl font-semibold text-signal-green">{res.h.totalCost.toFixed(2)}</dd>
          </div>
          <dd className="max-w-[260px] text-xs text-ink-400">
            {res.g.totalCost - res.h.totalCost > 1e-9
              ? `Greedy pays ${(res.g.totalCost - res.h.totalCost).toFixed(2)} more because an early cheap choice blocked a better pairing.`
              : 'Both found the same total here — greedy is optimal on this instance.'}{' '}
            Hungarian solved a padded {res.h.size}×{res.h.size} matrix in {res.h.operations} inner-loop steps.
          </dd>
        </dl>
      </div>
      <p className="text-xs text-ink-400">Edit any cost to re-run both algorithms instantly.</p>
    </div>
  );
}
