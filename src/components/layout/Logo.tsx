export function Logo({ size = 'md' }: { size?: 'md' | 'lg' }) {
  const big = size === 'lg';
  return (
    <div className="flex items-center gap-2.5">
      <svg width={big ? 40 : 30} height={big ? 40 : 30} viewBox="0 0 32 32" aria-hidden>
        <rect width="32" height="32" rx="8" fill="#0E1528" stroke="#26355C" />
        <path d="M7 22 L16 7 L25 22 Z" fill="none" stroke="#2BD9F2" strokeWidth="2.2" strokeLinejoin="round" />
        <circle cx="16" cy="17.5" r="2.8" fill="#3EE6A0" />
        <circle cx="7" cy="22" r="1.8" fill="#9B7BFF" />
        <circle cx="25" cy="22" r="1.8" fill="#9B7BFF" />
      </svg>
      <div className="leading-tight">
        <p className={`font-display font-bold tracking-wide ${big ? 'text-2xl' : 'text-[17px]'}`}>
          Fleet<span className="text-signal-cyan">Mind</span>
        </p>
        <p className={`text-ink-400 ${big ? 'text-sm' : 'text-[10.5px]'}`}>Adaptive multi-robot control</p>
      </div>
    </div>
  );
}
