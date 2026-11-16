import { Panel } from '../components/common/ui';
import { Logo } from '../components/layout/Logo';

const LAYERS = [
  { name: 'Screens', detail: 'Everything you see and click — dashboard, live map, charts', color: '#4C8DFF' },
  { name: 'Live connection', detail: 'Keeps every screen in sync with the running simulation and your sign-in', color: '#9B7BFF' },
  { name: 'Simulation engine', detail: 'Moves robots second by second, handles breakdowns, blocked aisles and urgent tasks', color: '#2BD9F2' },
  { name: 'Decision logic', detail: 'Route planning and task dispatch, written from scratch', color: '#3EE6A0' },
  { name: 'Data', detail: 'The floor map, robots, tasks and the event log', color: '#FFC247' },
];

const TEAM: { name: string; roll: string; role: string }[] = [
  { name: 'Aditya Raj Tripathi', roll: '23', role: 'Simulation engine, breakdown recovery and rerouting; project lead' },
  { name: 'Aarhan Goswami', roll: '03', role: 'Route planning: targeted and exhaustive routing, route explorer' },
  { name: 'Anay Abhyankar', roll: '11', role: 'Task dispatch: scoring, quick and optimized dispatch, performance analysis' },
  { name: 'Anvay Bahadur', roll: '51', role: 'Dashboard, scenarios and demo mode' },
];

const COURSE = {
  course: 'Design and Analysis of Algorithms',
  guide: 'Prof. Vikas Maral',
  institution: 'Vishwakarma Institute of Technology',
  semester: 'Semester 5 · Third year',
};

export default function About() {
  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Logo size="lg" />
        <p className="text-sm text-ink-400">{COURSE.course} · course project</p>
      </div>

      <Panel>
        <h1 className="text-2xl font-bold leading-tight">Adaptive Multi-Robot Task Allocation and Path Planning Under Dynamic Failures</h1>
        <p className="mt-3 max-w-[72ch] text-ink-200">
          A software model of a warehouse robot fleet. Robots are handed tasks, plan the shortest drive to each one, do the work, and keep going when a robot breaks down, an aisle gets
          blocked or an urgent job comes in. Everything you see is calculated live — nothing is pre-recorded — and it runs entirely in the browser with no hardware or server.
        </p>
      </Panel>

      <div className="grid gap-5 md:grid-cols-2">
        <Panel title="How it is built" subtitle="Each part only relies on the parts below it">
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
                <th className="whitespace-nowrap px-3 py-1.5 font-medium">Roll no.</th>
                <th className="py-1.5 font-medium">Contribution</th>
              </tr>
            </thead>
            <tbody>
              {TEAM.map((m) => (
                <tr key={m.name} className="border-t border-hull-800 text-ink-200">
                  <td className="py-2">{m.name}</td>
                  <td className="px-3 py-2">{m.roll}</td>
                  <td className="py-2">{m.role}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-xs text-ink-400">Course</dt>
              <dd>{COURSE.course}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-400">Guide</dt>
              <dd className="text-ink-200">{COURSE.guide}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-400">Institution</dt>
              <dd className="text-ink-200">{COURSE.institution}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-400">Semester</dt>
              <dd className="text-ink-200">{COURSE.semester}</dd>
            </div>
          </dl>
        </Panel>
      </div>

      <div className="grid gap-5 md:grid-cols-3">
        <Panel title="Built with">
          <ul className="space-y-1 text-sm text-ink-200">
            {['React and TypeScript', 'Vite', 'Tailwind CSS', 'Framer Motion animations', 'Recharts charts', 'Lucide icons', 'Automated tests (99 checks)', 'Secure local sign-in'].map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </Panel>
        <Panel title="What it shows">
          <ul className="space-y-1 text-sm text-ink-200">
            {[
              'Shortest-route planning around obstacles',
              'Smart vs exhaustive route search',
              'Quick vs optimized task dispatch',
              'Urgent work handled first',
              'Automatic recovery from breakdowns',
              'Live rerouting when aisles are blocked',
            ].map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </Panel>
        <Panel title="Possible next steps">
          <ul className="space-y-1 text-sm text-ink-200">
            {['Robots that avoid each other in narrow aisles', 'Faster rerouting by reusing the old route', 'Battery levels and charging trips', 'Robots bidding for tasks', 'Slower zones and diagonal moves', 'Shared online sessions and saved results'].map(
              (t) => (
                <li key={t}>{t}</li>
              ),
            )}
          </ul>
        </Panel>
      </div>
    </div>
  );
}
