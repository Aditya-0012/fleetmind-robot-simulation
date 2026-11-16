import { useState } from 'react';
import { motion } from 'framer-motion';
import { Panel } from '../components/common/ui';
import { PathLab } from '../components/simulation/PathLab';
import { AllocationLab } from '../components/analytics/AllocationLab';
import { DISPATCH_METHODS, RECOVERY_FLOWS, ROUTING_METHODS } from '../data/algorithmDocs';
import type { MethodDoc } from '../data/algorithmDocs';

type Tab = 'routing' | 'dispatch' | 'recovery';

function Bullets({ items, marker }: { items: string[]; marker: string }) {
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

function MethodCard({ m }: { m: MethodDoc }) {
  return (
    <Panel title={m.name}>
      <p className="text-sm text-ink-200">{m.summary}</p>
      <h3 className="mb-2 mt-4 text-sm font-semibold">How it works</h3>
      <ol className="space-y-2">
        {m.steps.map((s, i) => (
          <li key={i} className="flex gap-3 text-sm text-ink-200">
            <span className="num mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md bg-hull-800 text-[11px] text-signal-cyan">{i + 1}</span>
            {s}
          </li>
        ))}
      </ol>
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <div>
          <h3 className="mb-1.5 text-xs font-medium text-ink-400">Strengths</h3>
          <Bullets items={m.goodAt} marker="+" />
        </div>
        <div>
          <h3 className="mb-1.5 text-xs font-medium text-ink-400">Trade-offs</h3>
          <Bullets items={m.tradeOffs} marker="−" />
        </div>
        <div>
          <h3 className="mb-1.5 text-xs font-medium text-ink-400">Used in industry for</h3>
          <Bullets items={m.usedIn} marker="·" />
        </div>
      </div>
    </Panel>
  );
}

const TABS: { id: Tab; label: string }[] = [
  { id: 'routing', label: 'Route planning' },
  { id: 'dispatch', label: 'Task dispatch' },
  { id: 'recovery', label: 'Handling disruptions' },
];

export default function Algorithms() {
  const [tab, setTab] = useState<Tab>('routing');

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[28px] font-bold leading-tight">How it works</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-300">
          How robots find their way, how tasks are handed out, and what happens when something goes wrong. The try-it panels run exactly the same code as the live simulation.
        </p>
      </div>

      <div role="tablist" aria-label="Topic" className="flex flex-wrap gap-1 border-b border-hull-700">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={t.id === tab}
            onClick={() => setTab(t.id)}
            className={`relative px-4 py-2.5 text-sm transition-colors ${t.id === tab ? 'text-ink-100' : 'text-ink-400 hover:text-ink-200'}`}
          >
            {t.label}
            {t.id === tab && <motion.span layoutId="algo-tab" className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-signal-cyan" />}
          </button>
        ))}
      </div>

      {tab === 'routing' && (
        <>
          <Panel
            title="Try it: route explorer"
            subtitle="Draw walls, move the start (S) and goal (G), then find a route or step through the search. Choose Inspect and click a cell to see its distance estimates."
          >
            <PathLab />
          </Panel>
          <div className="grid gap-5 xl:grid-cols-2">
            {ROUTING_METHODS.map((m) => (
              <MethodCard key={m.id} m={m} />
            ))}
          </div>
        </>
      )}

      {tab === 'dispatch' && (
        <>
          <Panel title="How a robot is scored for a task" subtitle="The lowest score wins. You can change how much each factor counts on the Live simulation page.">
            <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                ['Travel distance', 'How many cells the robot must drive to reach the task, around every obstacle.'],
                ['Current load', 'How many tasks the robot already has lined up.'],
                ['Task urgency', 'Critical tasks get no penalty, low-priority tasks the largest.'],
                ['Finish time', 'When the robot could realistically finish, counting the work it already has.'],
              ].map(([k, v]) => (
                <div key={k} className="panel-inset p-3">
                  <dt className="text-sm font-semibold">{k}</dt>
                  <dd className="mt-1 text-sm text-ink-300">{v}</dd>
                </div>
              ))}
            </dl>
          </Panel>
          <Panel title="Try it: quick vs optimized dispatch" subtitle="Rows are robots, columns are tasks, numbers are scores. Amber outline = quick dispatch’s choice, green ring = optimized dispatch’s choice.">
            <AllocationLab />
          </Panel>
          <div className="grid gap-5 xl:grid-cols-2">
            {DISPATCH_METHODS.map((m) => (
              <MethodCard key={m.id} m={m} />
            ))}
          </div>
        </>
      )}

      {tab === 'recovery' && (
        <div className="grid gap-5 lg:grid-cols-3">
          {RECOVERY_FLOWS.map((f) => (
            <Panel key={f.title} title={f.title}>
              <ol className="space-y-2.5">
                {f.steps.map((s, i) => (
                  <li key={i} className="flex gap-3 text-sm text-ink-200">
                    <span className="num mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md bg-hull-800 text-[11px] text-signal-cyan">{i + 1}</span>
                    {s}
                  </li>
                ))}
              </ol>
            </Panel>
          ))}
        </div>
      )}
    </div>
  );
}
