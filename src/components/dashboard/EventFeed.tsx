import type { SimEvent } from '../../models/Event';
import { formatTick } from '../../models/Event';
import { SEVERITY_COLOR } from '../../utils/format';

/** Compact live event list. Newest first. */
export function EventFeed({ events, limit = 12, dense = false }: { events: SimEvent[]; limit?: number; dense?: boolean }) {
  const items = events.slice(-limit).reverse();
  return (
    <ol className={`font-mono ${dense ? 'text-[11.5px]' : 'text-xs'} leading-relaxed`}>
      {items.map((e) => (
        <li key={e.id} className="flex gap-2.5 border-b border-hull-800/80 py-1.5 last:border-0">
          <span className="shrink-0 text-ink-400">[{formatTick(e.tick)}]</span>
          <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: SEVERITY_COLOR[e.severity] }} />
          <span className={e.severity === 'critical' ? 'text-[#FF8FA3]' : e.severity === 'warning' ? 'text-[#FFD47A]' : e.severity === 'success' ? 'text-[#8BF0C4]' : 'text-ink-200'}>
            {e.message}
          </span>
        </li>
      ))}
    </ol>
  );
}
