import { AnimatePresence, motion } from 'framer-motion';
import { Check, Pause, Play, RotateCcw, X } from 'lucide-react';
import { useSim } from '../../context/SimulationContext';
import { DEMO_STEPS, currentDemoStep } from '../../simulation/DemoController';
import { COMBINED_EVENTS } from '../../simulation/scenarios';
import { formatTick } from '../../models/Event';

/** Narrated timeline for demo mode. Steps light up only when the engine state proves them. */
export function DemoPanel() {
  const sim = useSim();
  const { state, running } = sim;
  const idx = currentDemoStep(state);
  const step = DEMO_STEPS[idx];
  const next = COMBINED_EVENTS.find((e) => e.at > state.tick);

  return (
    <section className="panel overflow-hidden border-signal-violet/40" aria-label="Demo mode">
      <header className="flex items-center justify-between gap-2 border-b border-signal-violet/30 bg-signal-violet/10 px-4 py-2.5">
        <div>
          <h2 className="text-sm font-semibold text-[#D6CBFF]">Demo · combined failure scenario</h2>
          <p className="text-[11px] text-ink-300">
            Step {idx + 1} of {DEMO_STEPS.length}
            {next && !state.finished ? ` · next scripted event at ${formatTick(next.at)}` : ''}
          </p>
        </div>
        <div className="flex gap-1">
          <button className="btn-ghost btn-sm" onClick={sim.toggle} aria-label={running ? 'Pause demo' : 'Resume demo'}>
            {running ? <Pause size={14} /> : <Play size={14} />}
          </button>
          <button className="btn-ghost btn-sm" onClick={sim.startDemo} aria-label="Restart demo" title="Restart demo">
            <RotateCcw size={14} />
          </button>
          <button className="btn-ghost btn-sm" onClick={sim.exitDemo} aria-label="Exit demo" title="Exit demo">
            <X size={14} />
          </button>
        </div>
      </header>

      <div className="p-4">
        <AnimatePresence mode="wait">
          <motion.div key={step.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.22 }}>
            <p className="font-display text-lg font-semibold">{step.title}</p>
            <p className="mt-0.5 font-mono text-[11px] text-signal-violet">{step.algorithm}</p>
            <p className="mt-2 text-sm text-ink-200">{step.explanation}</p>
          </motion.div>
        </AnimatePresence>

        <ol className="mt-4 space-y-0">
          {DEMO_STEPS.map((s, i) => {
            const done = s.reached(state);
            const current = i === idx;
            return (
              <li key={s.id} className="relative flex gap-3 pb-2.5 last:pb-0">
                {i < DEMO_STEPS.length - 1 && <span className={`absolute left-[9px] top-5 h-full w-px ${done ? 'bg-signal-violet/60' : 'bg-hull-700'}`} />}
                <span
                  className={`relative z-10 mt-0.5 grid h-[19px] w-[19px] shrink-0 place-items-center rounded-full border text-[10px] ${
                    current ? 'border-signal-violet bg-signal-violet text-hull-950' : done ? 'border-signal-violet/70 bg-hull-900 text-signal-violet' : 'border-hull-600 bg-hull-900 text-ink-400'
                  }`}
                >
                  {done && !current ? <Check size={11} /> : i + 1}
                </span>
                <span className={`text-[13px] ${current ? 'font-medium text-ink-100' : done ? 'text-ink-300' : 'text-ink-400'}`}>{s.title}</span>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
