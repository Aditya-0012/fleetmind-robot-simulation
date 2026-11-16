import { Panel } from '../components/common/ui';
import { Logo } from '../components/layout/Logo';

const LAYERS = [
  { name: 'Pages & components', detail: 'React, Tailwind, Framer Motion, Recharts — render state, send commands', color: '#4C8DFF' },
  { name: 'Context (state bridge)', detail: 'useSyncExternalStore subscription, auth session, toasts', color: '#9B7BFF' },
  { name: 'Simulation engine', detail: 'Tick loop, state machines, failure, replanning, allocation managers, clock, demo', color: '#2BD9F2' },
  { name: 'Algorithms', detail: 'Min-heap, A*, Dijkstra, BFS, cost function, Greedy, Hungarian — pure TypeScript', color: '#3EE6A0' },
  { name: 'Models', detail: 'Grid, Robot, Task, Event, SimulationState types', color: '#FFC247' },
];

export default function About() {
  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Logo size="lg" />
        <p className="text-sm text-ink-400">Design and Analysis of Algorithms · course project</p>
      </div>

      <Panel>
        <h1 className="text-2xl font-bold leading-tight">Adaptive Multi-Robot Task Allocation and Path Planning Under Dynamic Failures</h1>
        <p className="mt-3 max-w-[72ch] text-ink-200">
          A software simulation of a robot fleet on a warehouse grid. Robots receive tasks, compute shortest routes, carry out work and adapt when robots fail or aisles are blocked. Every
          behaviour is produced by real implementations of A*, Dijkstra, BFS, greedy allocation and the Hungarian algorithm, running inside a deterministic tick-based engine with no hardware
          and no backend.
        </p>
      </Panel>

      <div className="grid gap-5 md:grid-cols-2">
        <Panel title="Architecture" subtitle="Each layer only depends on the layers below it">
          <ol className="space-y-2">
            {LAYERS.map((l) => (
              <li key={l.name} className="rounded-lg border border-hull-700 bg-hull-950/50 px-3 py-2.5" style={{ borderLeft: `3px solid ${l.color}` }}>
                <p className="text-sm font-medium">{l.name}</p>
                <p className="text-xs text-ink-400">{l.detail}</p>
              </li>
            ))}
          </ol>
        </Panel>
        <Panel title="Team">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-ink-400">
              <tr>
                <th className="py-1.5 font-medium">Name</th>
                <th className="py-1.5 font-medium">Roll no.</th>
                <th className="py-1.5 font-medium">Contribution</th>
              </tr>
            </thead>
            <tbody>
              {[1, 2, 3, 4].map((i) => (
                <tr key={i} className="border-t border-hull-800 text-ink-300">
                  <td className="py-2">[Team member {i}]</td>
                  <td className="py-2">[Roll no.]</td>
                  <td className="py-2">[Module]</td>
                </tr>
              ))}
            </tbody>
          </table>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-xs text-ink-400">Course</dt>
              <dd>Design and Analysis of Algorithms</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-400">Guide</dt>
              <dd className="text-ink-300">[Faculty name]</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-400">Institution</dt>
              <dd className="text-ink-300">[College name]</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-400">Semester</dt>
              <dd className="text-ink-300">[Semester / year]</dd>
            </div>
          </dl>
        </Panel>
      </div>

      <div className="grid gap-5 md:grid-cols-3">
        <Panel title="Technology">
          <ul className="space-y-1 text-sm text-ink-200">
            {['React 19 + TypeScript', 'Vite', 'Tailwind CSS', 'Framer Motion', 'Recharts', 'Lucide icons', 'React Router', 'Vitest + Testing Library', 'Web Crypto (PBKDF2) for local sign-in'].map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </Panel>
        <Panel title="What it demonstrates">
          <ul className="space-y-1 text-sm text-ink-200">
            {['Graph modelling of a grid', 'Informed vs uninformed search', 'Greedy vs optimal assignment', 'Priority queues in practice', 'Dynamic re-optimisation', 'Empirical vs theoretical complexity'].map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </Panel>
        <Panel title="Future scope">
          <ul className="space-y-1 text-sm text-ink-200">
            {['Collision-free multi-agent paths (CBS)', 'Incremental replanning (D* Lite)', 'Battery and charging models', 'Auction-based allocation', 'Weighted terrain and diagonal moves', 'Server-side accounts and saved experiments'].map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  );
}
