import { Pause, Play, RotateCcw, Sparkles, StepForward } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSim } from '../../context/SimulationContext';
import { formatTick } from '../../models/Event';
import { SPEEDS } from '../../simulation/SimulationClock';
import { checkInvariants } from '../../simulation/invariants';
import { ConfirmDialog, Segmented, Tip } from '../common/ui';

/** Global transport controls — visible on every page because the simulation runs app-wide. */
export function SimControls() {
  const sim = useSim();
  const { state, running, speed } = sim;
  const navigate = useNavigate();
  const [confirmReset, setConfirmReset] = useState(false);
  const violations = checkInvariants(state);
  const failed = state.robots.filter((r) => r.state === 'FAILED').length;
  const health = violations.length > 0 ? 'Inconsistent' : failed === 0 ? 'Nominal' : failed < state.robots.length ? 'Degraded' : 'Offline';
  const healthColor = { Nominal: '#3EE6A0', Degraded: '#FFC247', Offline: '#FF5470', Inconsistent: '#FF5470' }[health];
  const status = state.finished ? 'Complete' : running ? 'Running' : state.tick === 0 ? 'Ready' : 'Paused';

  return (
    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-2">
      <div className="flex items-center gap-1.5">
        <button
          className={running ? 'btn-ghost' : 'btn-primary'}
          onClick={sim.toggle}
          aria-label={running ? 'Pause simulation' : state.tick === 0 ? 'Start simulation' : 'Resume simulation'}
        >
          {running ? <Pause size={16} /> : <Play size={16} />}
          <span className="hidden sm:inline">{running ? 'Pause' : state.tick === 0 ? 'Start' : 'Resume'}</span>
        </button>
        <Tip text="Advance exactly one tick">
          <button className="btn-ghost px-2.5" onClick={sim.step} aria-label="Single step">
            <StepForward size={16} />
          </button>
        </Tip>
        <Tip text="Restore the scenario's initial state">
          <button className="btn-ghost px-2.5" onClick={() => setConfirmReset(true)} aria-label="Reset simulation">
            <RotateCcw size={16} />
          </button>
        </Tip>
      </div>

      <Segmented ariaLabel="Simulation speed" size="sm" value={speed} onChange={sim.setSpeed} options={SPEEDS.map((s) => ({ value: s, label: `${s}×` }))} />

      <div className="flex items-baseline gap-2">
        <span className="font-mono text-lg font-medium tabular-nums text-ink-100">{formatTick(state.tick)}</span>
        <span className="text-xs text-ink-400">{status}</span>
      </div>

      <div className="hidden min-w-0 items-center gap-2 text-sm md:flex">
        <span className="truncate text-ink-300" title={state.scenarioName}>
          {state.scenarioName}
        </span>
      </div>

      <div className="ml-auto flex items-center gap-3">
        <Tip text={violations.length ? violations[0] : `${state.robots.length - failed}/${state.robots.length} robots operational, all state invariants hold`}>
          <span className="flex items-center gap-2 text-xs text-ink-300">
            <span className="relative flex h-2.5 w-2.5">
              {running && <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" style={{ backgroundColor: healthColor }} />}
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full" style={{ backgroundColor: healthColor }} />
            </span>
            {health}
          </span>
        </Tip>
        <button
          className="btn border border-signal-violet/50 bg-signal-violet/15 text-[#C9B8FF] hover:bg-signal-violet/25"
          onClick={() => {
            sim.startDemo();
            navigate('/simulation');
          }}
        >
          <Sparkles size={16} />
          <span className="hidden sm:inline">Demo mode</span>
        </button>
      </div>

      <ConfirmDialog
        open={confirmReset}
        title="Reset the simulation?"
        message={`"${state.scenarioName}" returns to tick 0. Robot positions, tasks, obstacles you added, metrics and the event log are cleared.`}
        confirmLabel="Reset"
        danger
        onConfirm={() => {
          sim.reset();
          sim.exitDemo();
        }}
        onCancel={() => setConfirmReset(false)}
      />
    </div>
  );
}
