import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, Search, Shuffle } from 'lucide-react';
import { useMemo, useState } from 'react';
import { EmptyState, Segmented, Toggle } from '../components/common/ui';
import { VIVA } from '../data/vivaQuestions';
import type { VivaQA } from '../data/vivaQuestions';
import { mulberry32, shuffle } from '../utils/random';

const TOPICS: ('All' | VivaQA['topic'])[] = ['All', 'Project', 'Pathfinding', 'Data structures', 'Allocation', 'Dynamics', 'Complexity', 'Extensions'];

export default function Viva() {
  const [q, setQ] = useState('');
  const [topic, setTopic] = useState<(typeof TOPICS)[number]>('All');
  const [level, setLevel] = useState<'all' | 'core' | 'follow-up'>('all');
  const [practice, setPractice] = useState(false);
  const [open, setOpen] = useState<Set<number>>(new Set());
  const [order, setOrder] = useState<number | null>(null);

  const list = useMemo(() => {
    const items = VIVA.map((v, i) => ({ ...v, i })).filter(
      (v) =>
        (topic === 'All' || v.topic === topic) &&
        (level === 'all' || v.level === level) &&
        (!q || (v.q + ' ' + v.a).toLowerCase().includes(q.toLowerCase())),
    );
    return order === null ? items : shuffle(mulberry32(order), items);
  }, [q, topic, level, order]);

  const toggle = (i: number) => {
    const n = new Set(open);
    if (n.has(i)) n.delete(i);
    else n.add(i);
    setOpen(n);
  };

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div>
        <h1 className="text-[28px] font-bold leading-tight">DAA viva preparation</h1>
        <p className="mt-1 text-sm text-ink-300">
          {VIVA.length} questions — {VIVA.filter((v) => v.level === 'core').length} core and {VIVA.filter((v) => v.level === 'follow-up').length} harder follow-ups. Answers describe this
          project’s actual implementation.
        </p>
      </div>

      <div className="panel space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[220px] flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
            <input className="input pl-9" placeholder="Search questions and answers" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search viva questions" />
          </div>
          <Segmented
            ariaLabel="Difficulty"
            size="sm"
            value={level}
            onChange={setLevel}
            options={[
              { value: 'all', label: 'All' },
              { value: 'core', label: 'Core' },
              { value: 'follow-up', label: 'Follow-up' },
            ]}
          />
          <div className="w-44">
            <Toggle checked={practice} onChange={(v) => { setPractice(v); setOpen(new Set()); }} label="Practice mode" />
          </div>
          <button className="btn-ghost btn-sm" onClick={() => setOrder(order === null ? Date.now() % 100000 : null)}>
            <Shuffle size={14} /> {order === null ? 'Shuffle' : 'Original order'}
          </button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {TOPICS.map((t) => (
            <button
              key={t}
              onClick={() => setTopic(t)}
              aria-pressed={topic === t}
              className={`rounded-md border px-2.5 py-1 text-xs ${topic === t ? 'border-signal-cyan bg-signal-cyan/15 text-signal-cyan' : 'border-hull-600 text-ink-300 hover:text-ink-100'}`}
            >
              {t}
            </button>
          ))}
        </div>
        {practice && <p className="text-xs text-ink-400">Answers are hidden. Say your answer out loud, then click a question to check it.</p>}
      </div>

      {list.length === 0 ? (
        <EmptyState icon={<Search size={22} />} title="No questions match" />
      ) : (
        <ol className="space-y-2">
          {list.map((v, idx) => {
            // reading mode: answers visible unless collapsed · practice mode: hidden until revealed
            const shown = practice ? open.has(v.i) : !open.has(v.i);
            return (
              <li key={v.i} className="panel overflow-hidden">
                <button className="flex w-full items-start gap-4 px-4 py-3.5 text-left" onClick={() => toggle(v.i)} aria-expanded={shown}>
                  <span className="num mt-0.5 w-7 shrink-0 text-right text-sm text-ink-400">{idx + 1}</span>
                  <span className="flex-1">
                    <span className="font-medium text-ink-100">{v.q}</span>
                    <span className="mt-1 flex gap-2 text-[11px] text-ink-400">
                      {v.topic}
                      {v.level === 'follow-up' && <span className="text-signal-violet">follow-up</span>}
                    </span>
                  </span>
                  <ChevronDown size={18} className={`mt-0.5 shrink-0 text-ink-400 transition-transform ${shown ? 'rotate-180' : ''}`} />
                </button>
                <AnimatePresence initial={false}>
                  {shown && (
                    <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                      <p className="max-w-[72ch] border-t border-hull-700/70 py-3.5 pl-[60px] pr-6 text-sm leading-relaxed text-ink-200">{v.a}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
