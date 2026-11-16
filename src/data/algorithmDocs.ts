/**
 * Plain-language descriptions of each method, shown on the "How it works" page.
 * The technical name of each method is kept in `id` and in the source files only.
 */
export interface MethodDoc {
  id: 'astar' | 'dijkstra' | 'greedy' | 'hungarian';
  name: string;
  summary: string;
  steps: string[];
  goodAt: string[];
  tradeOffs: string[];
  usedIn: string[];
}

export const ROUTING_METHODS: MethodDoc[] = [
  {
    id: 'astar',
    name: 'Targeted routing',
    summary:
      'Finds the shortest drive by always checking the cells that look closest to the destination first. Like a driver who heads roughly towards the destination and only detours when a wall forces it.',
    steps: [
      'Start at the robot’s cell.',
      'For every neighbouring cell, add the distance already driven to a straight-line style estimate of the distance still left.',
      'Always continue from the cell with the smallest total — the most promising one.',
      'Skip walls, racks and broken-down robots.',
      'When the destination is reached, trace back the cells to get the route.',
    ],
    goodAt: ['Always returns a shortest route', 'Searches far fewer cells than checking everywhere', 'Very quick to rerun when something changes'],
    tradeOffs: ['Needs a sensible estimate of the remaining distance', 'Plans from scratch each time instead of patching the old route'],
    usedIn: ['Warehouse and hospital delivery robots', 'Sat-nav and map apps', 'Characters finding their way in video games'],
  },
  {
    id: 'dijkstra',
    name: 'Exhaustive routing',
    summary:
      'Finds the shortest drive by spreading out evenly in every direction, one ring of distance at a time, until it reaches the destination. No guessing — it simply checks everything closer first.',
    steps: [
      'Start at the robot’s cell with distance 0.',
      'Repeatedly take the nearest cell not yet finished and mark its distance as final.',
      'Update its neighbours if going through it is shorter.',
      'Stop once the destination is finished, then trace back the route.',
    ],
    goodAt: ['Always returns a shortest route', 'Needs no estimate, so it works in any layout', 'Useful as a reference to check the faster method'],
    tradeOffs: ['Searches many more cells, including ones in the wrong direction', 'Slower on large floors'],
    usedIn: ['Internet traffic routing between servers', 'Network and utility planning', 'Benchmarking other route finders'],
  },
];

export const DISPATCH_METHODS: MethodDoc[] = [
  {
    id: 'greedy',
    name: 'Quick dispatch',
    summary:
      'Hands out tasks one at a time, most urgent first. Each task goes to the robot with the best score at that moment, and that robot’s load is updated before the next task is considered.',
    steps: [
      'Put the tasks in order: most urgent first, then oldest first.',
      'For the next task, score every working robot that has room and can reach it.',
      'Give the task to the lowest score. On a tie, the less busy robot wins.',
      'Update that robot’s load and expected position, then move to the next task.',
      'Tasks nobody can reach are flagged as unreachable.',
    ],
    goodAt: ['Instant decisions', 'Gives robots several tasks each without extra effort', 'Easy to explain and audit'],
    tradeOffs: ['Each choice only looks at the current task, so the overall total can be worse than necessary'],
    usedIn: ['Taxi and delivery dispatch that must answer immediately', 'Help-desk ticket routing', 'Baseline for comparing smarter dispatch'],
  },
  {
    id: 'hungarian',
    name: 'Optimized dispatch',
    summary:
      'Looks at all robots and all waiting tasks together and finds the pairing with the lowest total score — no robot gets two tasks in the same round. For bigger task lists it repeats in rounds.',
    steps: [
      'Build a score table: one row per robot, one column per task.',
      'Find the one-robot-one-task pairing whose scores add up to the smallest total.',
      'Commit those pairs and update each robot’s load and expected position.',
      'Repeat with the remaining tasks until they are all assigned or every robot is full.',
    ],
    goodAt: ['Best possible total for each round', 'Never lets one early choice spoil the rest of the round', 'Fair spread of work'],
    tradeOffs: ['More calculation than quick dispatch', 'Rounds are each the best possible, but the full multi-task plan is not guaranteed to be'],
    usedIn: ['Matching drivers to riders in batches', 'Assigning staff to shifts or jobs', 'Matching radar tracks to targets'],
  },
];

export const RECOVERY_FLOWS = [
  {
    title: 'When a robot breaks down',
    steps: [
      'The robot stops immediately and is marked as broken down.',
      'Tasks it had not finished go back into the pool. Finished tasks stay finished.',
      'It receives no new work, and other robots treat it as an obstacle.',
      'The selected dispatch method reassigns its tasks to the remaining robots.',
      'Any robot whose route ran through it plans a new route.',
      'A notification lists what was affected and where each task went.',
    ],
  },
  {
    title: 'When an aisle gets blocked',
    steps: [
      'Every planned route is checked for the blocked cell.',
      'Affected robots show “Route blocked” and switch to rerouting.',
      'Each one plans again from where it stands with the selected routing method.',
      'If a new route exists it carries on (“New route found”).',
      'If not, the task is handed back and marked unreachable until the aisle is cleared.',
    ],
  },
  {
    title: 'When an urgent task arrives',
    steps: [
      'Critical tasks are dispatched before anything else.',
      'The chosen robot pauses travel to a less urgent task and goes to the critical one first.',
      'A robot already working at a task always finishes it first.',
      'The paused task goes back to the top of that robot’s list.',
    ],
  },
];
