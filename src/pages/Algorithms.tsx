import { useState } from 'react';
import { motion } from 'framer-motion';
import { Panel } from '../components/common/ui';
import { PathLab } from '../components/simulation/PathLab';
import { AllocationLab } from '../components/analytics/AllocationLab';
import { ALGORITHM_DOCS } from '../data/algorithmDocs';
import type { AlgorithmDoc } from '../data/algorithmDocs';

function List({ items, marker = '·' }: { items: string[]; marker?: string }) {
  return (
    <ul className="space-y-1.5 text-sm text-ink-200">
      {items.map((x) => (
        <li key={x} className="flex gap-2">
          <span className="text-signal-cyan">{marker}</span>
          <span>{x}</span>
        </li>
      ))}
    </ul>
  );
}

function DocView({ doc }: { doc: AlgorithmDoc }) {
  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Problem solved">
          <p className="text-sm text-ink-200">{doc.problem}</p>
          <p className="mt-3 text-sm text-ink-400">
            <span className="text-ink-300">In this project:</span> {doc.inProject}
          </p>
          <p className="mt-2 font-mono text-xs text-ink-400">{doc.source}</p>
        </Panel>
        <Panel title="Working principle">
          <p className="text-sm text-ink-200">{doc.principle}</p>
        </Panel>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <Panel title="Step by step">
          <ol className="space-y-2.5">
            {doc.steps.map((s, i) => (
              <li key={i} className="flex gap-3 text-sm text-ink-200">
                <span className="num mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md bg-hull-800 text-[11px] text-signal-cyan">{i + 1}</span>
                {s}
              </li>
            ))}
          </ol>
        </Panel>
        <Panel title="Pseudocode" bodyClass="p-0">
          <pre className="overflow-x-auto p-4 font-mono text-[12.5px] leading-relaxed text-ink-200">{doc.pseudocode}</pre>
        </Panel>
      </div>

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        <Panel title="Complexity">
          <dl className="space-y-3 text-sm">
            {doc.time.map((t) => (
              <div key={t.label}>
                <dt className="text-xs text-ink-400">Time · {t.label}</dt>
                <dd className="mt-0.5 font-mono text-signal-cyan">{t.value}</dd>
              </div>
            ))}
            <div>
              <dt className="text-xs text-ink-400">Space</dt>
              <dd className="mt-0.5 font-mono text-signal-cyan">{doc.space}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-400">Best case</dt>
              <dd className="mt-0.5 text-ink-200">{doc.best}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-400">Worst case</dt>
              <dd className="mt-0.5 text-ink-200">{doc.worst}</dd>
            </div>
          </dl>
          <p className="mt-4 border-t border-hull-700 pt-3 text-xs text-ink-400">
            These are theoretical bounds. Measured node counts and timings for your own runs are on the Performance page.
          </p>
        </Panel>
        <Panel title="Data structures used">
          <List items={doc.dataStructures} />
        </Panel>
        <Panel title="Applications">
          <List items={doc.applications} />
        </Panel>
        <Panel title="Advantages">
          <List items={doc.advantages} marker="+" />
        </Panel>
        <Panel title="Limitations" className="xl:col-span-2">
          <List items={doc.limitations} marker="−" />
        </Panel>
      </div>
    </div>
  );
}

export default function Algorithms() {
  const [active, setActive] = useState<AlgorithmDoc['id']>('astar');
  const doc = ALGORITHM_DOCS.find((d) => d.id === active)!;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[28px] font-bold leading-tight">Algorithms</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-300">The five algorithms that run the fleet, with working labs that call the same code the simulation uses.</p>
      </div>

      <div role="tablist" aria-label="Algorithm" className="flex flex-wrap gap-1 border-b border-hull-700">
        {ALGORITHM_DOCS.map((d) => (
          <button
            key={d.id}
            role="tab"
            aria-selected={d.id === active}
            onClick={() => setActive(d.id)}
            className={`relative px-4 py-2.5 text-sm transition-colors ${d.id === active ? 'text-ink-100' : 'text-ink-400 hover:text-ink-200'}`}
          >
            {d.name}
            {d.id === active && <motion.span layoutId="algo-tab" className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-signal-cyan" />}
          </button>
        ))}
      </div>

      <div>
        <h2 className="text-xl font-semibold">{doc.name}</h2>
        <p className="text-sm text-ink-400">{doc.family}</p>
      </div>

      {(active === 'astar' || active === 'dijkstra') && (
        <Panel title="Search lab" subtitle="Draw walls, move the start and goal, then run or step through the search. Choose Inspect and click a cell to read its g, h and f values.">
          <PathLab initialAlgorithm={active} />
        </Panel>
      )}
      {(active === 'greedy' || active === 'hungarian') && (
        <Panel title="Assignment lab" subtitle="Rows are robots, columns are tasks. Amber outline = greedy choice, green ring = Hungarian (optimal) choice.">
          <AllocationLab />
        </Panel>
      )}

      <DocView doc={doc} />
    </div>
  );
}
