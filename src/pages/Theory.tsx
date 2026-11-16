import type { ReactNode } from 'react';

const SECTIONS: { id: string; title: string; body: ReactNode }[] = [
  {
    id: 'problem',
    title: 'Problem definition',
    body: (
      <>
        <p>
          A set of R autonomous robots shares a 2-D grid floor containing static and dynamic obstacles. T tasks appear at grid cells over time, each with a priority and an execution
          duration. Robots may fail at any moment and new obstacles may block their routes. The system must decide <em>which robot serves which task</em> and <em>how each robot reaches
          its task</em>, and keep both decisions valid as the environment changes.
        </p>
        <p>Formally this couples two optimisation problems that are solved repeatedly over time:</p>
        <ul>
          <li>a shortest-path problem on a dynamic graph (routing), and</li>
          <li>an assignment problem between robots and tasks (allocation), with capacity and reachability constraints.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'objectives',
    title: 'Objectives',
    body: (
      <ul>
        <li>Every route must be a valid shortest path that never crosses an obstacle or leaves the grid.</li>
        <li>Total assignment cost — distance, workload, priority and finish time — should be low.</li>
        <li>Urgent tasks must be served before routine ones.</li>
        <li>The fleet must recover automatically from robot failures and blocked routes, losing no task and never re-doing completed work.</li>
        <li>Every decision must be observable, measurable and reproducible.</li>
      </ul>
    ),
  },
  {
    id: 'io',
    title: 'Input and output',
    body: (
      <>
        <h3>Input</h3>
        <ul>
          <li>Grid dimensions rows × cols and the set of obstacle cells.</li>
          <li>Robot start cells; task cells with priority p ∈ {'{1,…,5}'} and duration.</li>
          <li>Weights α, β, γ, δ, robot capacity, the chosen planner (A* or Dijkstra) and allocator (Greedy or Hungarian).</li>
          <li>A timeline of events: failures, restorations, new obstacles, new tasks, priority changes.</li>
        </ul>
        <h3>Output</h3>
        <ul>
          <li>For every tick: each robot’s state, position and route; each task’s status and owner.</li>
          <li>An event log of every decision, and metrics: distance, nodes explored, replans, reallocations, completion times.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'constraints',
    title: 'Constraints',
    body: (
      <ul>
        <li>4-directional movement, one cell per tick, uniform cost 1 per move.</li>
        <li>A robot never stands on an obstacle; a failed robot never moves and is treated as an obstacle by others.</li>
        <li>A task is held by at most one robot; a failed robot holds no tasks; completed tasks are terminal.</li>
        <li>Each robot holds at most <code>capacity</code> tasks at once.</li>
        <li>A task can only be assigned to a robot that can physically reach it.</li>
      </ul>
    ),
  },
  {
    id: 'graph',
    title: 'Graph modelling',
    body: (
      <>
        <p>
          The grid becomes an implicit undirected graph G = (V, E). V is the set of walkable cells, encoded as integer keys <code>k = r·cols + c</code>. An edge joins two cells that differ
          by exactly one in row or column, with weight 1. Because every vertex has at most four neighbours, |E| ≤ 2|V|, so the graph is sparse and adjacency is generated on demand rather than
          stored.
        </p>
        <p>
          Dynamic changes are modelled as vertex deletions (new obstacle, failed robot) and insertions (obstacle removed, robot restored). Allocation is modelled as a bipartite graph between
          robots and tasks whose edge weights are the cost function.
        </p>
      </>
    ),
  },
  {
    id: 'objective',
    title: 'Optimisation objective',
    body: (
      <>
        <p>
          For routing, minimise path length g(goal). For allocation, minimise the sum of assignment costs over the chosen pairs:
        </p>
        <p>
          <code>Cost(R,T) = α·D/(rows+cols) + β·W/capacity + γ·(5 − p)/4 + δ·L/(2·(rows+cols))</code>
        </p>
        <p>
          D is the exact BFS distance from the robot’s anchor (where it will be after its queue), W the tasks already committed, p the priority and L = backlog + D + duration the estimated
          finish time. Normalisation keeps each term roughly in [0, 1], so the weights express relative importance independent of map size.
        </p>
      </>
    ),
  },
  {
    id: 'selection',
    title: 'Algorithm selection rationale',
    body: (
      <ul>
        <li>
          <strong>A*</strong> for routing: optimal with an admissible heuristic and typically expands a small fraction of the grid. Manhattan distance is the natural tight, consistent
          heuristic for 4-connected unit moves.
        </li>
        <li>
          <strong>Dijkstra</strong> as the uninformed baseline: same optimality, no heuristic, so it demonstrates exactly what the heuristic buys.
        </li>
        <li>
          <strong>BFS</strong> for cost estimation: one O(V) pass gives exact distances from a robot to every task.
        </li>
        <li>
          <strong>Greedy</strong> allocation: fast, simple, naturally multi-task, and explicit about priority order — but only locally optimal.
        </li>
        <li>
          <strong>Hungarian</strong> allocation: provably optimal for one-to-one batches in O(n³), used to measure how much Greedy gives up.
        </li>
        <li>
          <strong>Binary min-heap</strong>: O(log n) push/pop for both planners’ open sets.
        </li>
      </ul>
    ),
  },
  {
    id: 'correctness',
    title: 'Correctness considerations',
    body: (
      <ul>
        <li>A* optimality follows from the consistency of Manhattan distance; tests compare A*, Dijkstra and BFS path lengths on 60 random grids.</li>
        <li>Dijkstra’s settled distances are final because all edge weights are non-negative.</li>
        <li>Hungarian optimality follows from LP duality: potentials keep reduced costs ≥ 0 and the final matching uses only zero-reduced-cost edges. Tests compare it against brute force on 80 random matrices.</li>
        <li>Robot and task state machines reject illegal transitions; an invariant checker verifies consistency after every tick of a randomised stress test.</li>
        <li>Paths are validated cell by cell (adjacent, in bounds, walkable). A robot checks the next cell before every move.</li>
        <li>Determinism (fixed update order, tie-breaking by id and insertion order, seeded randomness) makes every run reproducible, which the tests verify by replaying the demo.</li>
      </ul>
    ),
  },
  {
    id: 'complexity',
    title: 'Complexity analysis',
    body: (
      <>
        <div className="mb-3 overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="text-left text-xs text-ink-400">
              <tr>
                <th className="py-2 pr-4 font-medium">Component</th>
                <th className="py-2 pr-4 font-medium">Time</th>
                <th className="py-2 font-medium">Space</th>
              </tr>
            </thead>
            <tbody className="font-mono text-[13px] text-ink-200">
              {[
                ['Min-heap push / pop', 'O(log n)', 'O(n)'],
                ['A* (binary heap)', 'O((V+E) log V) = O(V log V)', 'O(V)'],
                ['Dijkstra (binary heap)', 'O((V+E) log V)', 'O(V)'],
                ['BFS distance field', 'O(V+E) = O(V)', 'O(V)'],
                ['Greedy allocation', 'O(T log T + T·R + A·V)', 'O(A·V)'],
                ['Hungarian (one batch)', 'O(N³), N = max(R,T)', 'O(N²)'],
                ['Hungarian (k batches)', 'O(k·N³ + k·R·T + A·V)', 'O(N² + A·V)'],
                ['Path invalidation check', 'O(R·P), P = route length', 'O(1)'],
                ['One simulation tick', 'O(R + T) plus any planning/allocation triggered', 'O(V + R + T)'],
              ].map((r) => (
                <tr key={r[0]} className="border-t border-hull-800">
                  <td className="py-1.5 pr-4 font-sans">{r[0]}</td>
                  <td className="py-1.5 pr-4 text-signal-cyan">{r[1]}</td>
                  <td className="py-1.5">{r[2]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>
          V = walkable cells, E ≤ 2V edges, R robots, T tasks, A ≤ R + T distinct BFS anchors. Theoretical bounds describe growth; the Performance page reports observed operation counts and
          browser timings, which also depend on obstacle layout and hardware.
        </p>
      </>
    ),
  },
  {
    id: 'limitations',
    title: 'Limitations',
    body: (
      <ul>
        <li>No full multi-agent collision avoidance: moving robots may share a cell. Failed robots are the only robot-shaped obstacles.</li>
        <li>Replanning restarts the search from scratch; incremental planners such as D* Lite would reuse previous work.</li>
        <li>Hungarian is optimal per one-to-one batch only; multi-task scheduling with ordered visits is NP-hard and is approximated.</li>
        <li>Travel between queued tasks is estimated with Manhattan distance in the backlog term.</li>
        <li>Pre-emption applies only to critical (priority 5) tasks and never interrupts execution.</li>
        <li>Uniform move cost; no battery, speed differences or kinematics.</li>
        <li>Millisecond timings are browser-dependent; operation counts are the reliable comparison.</li>
      </ul>
    ),
  },
];

export default function Theory() {
  return (
    <div className="grid gap-8 lg:grid-cols-[200px_minmax(0,1fr)]">
      <nav className="hidden lg:block" aria-label="On this page">
        <div className="sticky top-24 space-y-1 text-sm">
          {SECTIONS.map((s, i) => (
            <a key={s.id} href={`#${s.id}`} className="flex gap-2 rounded-md px-2 py-1 text-ink-400 hover:bg-hull-850 hover:text-ink-100">
              <span className="num w-4 text-right text-ink-400">{i + 1}</span>
              {s.title}
            </a>
          ))}
        </div>
      </nav>
      <article className="prose-doc min-w-0">
        <h1 className="text-[28px] font-bold leading-tight">DAA theory</h1>
        <p className="mt-2 text-ink-300">How the robot-fleet problem maps onto algorithm design: the model, the objective, why each algorithm was chosen, and what can be proved about it.</p>
        {SECTIONS.map((s, i) => (
          <section key={s.id} id={s.id} className="scroll-mt-24 border-t border-hull-700/70 pt-6 mt-8 first-of-type:mt-6">
            <h2 className="mb-3 flex items-baseline gap-3 text-xl font-semibold">
              <span className="num text-sm text-signal-cyan">{String(i + 1).padStart(2, '0')}</span>
              {s.title}
            </h2>
            {s.body}
          </section>
        ))}
      </article>
    </div>
  );
}
