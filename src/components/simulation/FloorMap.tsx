import { memo, useMemo, useRef, useState } from 'react';
import type { MouseEvent } from 'react';
import { fromKey, samePoint } from '../../models/Grid';
import type { Point } from '../../models/Grid';
import type { SimState } from '../../models/SimulationState';
import { PRIORITY_COLOR, ROBOT_STATE_COLOR } from '../../utils/format';

export const CELL = 24;
/** Margin around the grid so labels on edge cells are not clipped. */
const PAD_X = 4;
const PAD_TOP = 12;
const PAD_BOTTOM = 14;

interface Props {
  state: SimState;
  version: number;
  tickMs: number;
  interactive?: boolean;
  showSearch?: boolean;
  showPaths?: boolean;
  selectedRobotId?: string | null;
  selectedTaskId?: string | null;
  onCellClick?: (p: Point) => void;
  onSelectRobot?: (id: string) => void;
  onSelectTask?: (id: string) => void;
  onHover?: (p: Point | null) => void;
  className?: string;
  label?: string;
}

/** Obstacles only change on user/scenario actions, so they are memoised by a cheap signature. */
const ObstacleLayer = memo(function ObstacleLayer({ obstacles, cols }: { obstacles: number[]; cols: number; sig: string }) {
  return (
    <g>
      {obstacles.map((k) => {
        const p = fromKey(k, cols);
        return (
          <g key={k} transform={`translate(${p.c * CELL},${p.r * CELL})`}>
            <rect x={1} y={1} width={CELL - 2} height={CELL - 2} rx={3} fill="#1F2B4A" stroke="#33446E" strokeWidth={1} />
            <path d={`M5 ${CELL - 5} L${CELL - 5} 5`} stroke="#2A3A62" strokeWidth={1.5} />
          </g>
        );
      })}
    </g>
  );
});

function FloorMapInner({
  state,
  tickMs,
  interactive = false,
  showSearch = true,
  showPaths = true,
  selectedRobotId,
  selectedTaskId,
  onCellClick,
  onSelectRobot,
  onSelectTask,
  onHover,
  className = '',
  label = 'Warehouse floor map',
}: Props) {
  const { grid, robots, tasks } = state;
  const W = grid.cols * CELL;
  const H = grid.rows * CELL;
  const svgRef = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<Point | null>(null);

  const obstacles: number[] = [];
  for (let k = 0; k < grid.obstacles.length; k++) if (grid.obstacles[k]) obstacles.push(k);
  const sig = `${grid.rows}x${grid.cols}:${obstacles.length}:${obstacles[0] ?? ''}:${obstacles[obstacles.length - 1] ?? ''}:${obstacles.reduce((a, b) => (a * 31 + b) % 1000003, 7)}`;

  const search = showSearch && state.lastSearch && state.tick - state.lastSearch.tick <= 2 ? state.lastSearch : null;

  // Robots sharing a cell are fanned out slightly so both stay visible.
  const offsets = useMemo(() => {
    const seen = new Map<string, number>();
    return robots.map((r) => {
      const key = `${r.position.r},${r.position.c}`;
      const n = seen.get(key) ?? 0;
      seen.set(key, n + 1);
      return n === 0 ? { x: 0, y: 0 } : { x: (n % 2 ? 1 : -1) * 4 * Math.ceil(n / 2), y: (n % 2 ? -1 : 1) * 3 };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [robots.map((r) => `${r.position.r},${r.position.c}`).join('|')]);

  const cellFromEvent = (e: MouseEvent<SVGSVGElement>): Point | null => {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    const VW = W + 2 * PAD_X;
    const VH = H + PAD_TOP + PAD_BOTTOM;
    const scale = Math.min(rect.width / VW, rect.height / VH);
    const ox = (rect.width - VW * scale) / 2;
    const oy = (rect.height - VH * scale) / 2;
    const c = Math.floor(((e.clientX - rect.left - ox) / scale - PAD_X) / CELL);
    const r = Math.floor(((e.clientY - rect.top - oy) / scale - PAD_TOP) / CELL);
    if (r < 0 || r >= grid.rows || c < 0 || c >= grid.cols) return null;
    return { r, c };
  };

  const handleClick = (e: MouseEvent<SVGSVGElement>) => {
    if (!interactive) return;
    const p = cellFromEvent(e);
    if (!p) return;
    if (onCellClick) return onCellClick(p); // the page decides what a click means (tool modes)
    const robot = robots.find((r) => samePoint(r.position, p));
    if (robot && onSelectRobot) return onSelectRobot(robot.id);
    const task = tasks.find((t) => samePoint(t.position, p) && t.status !== 'COMPLETED') ?? tasks.find((t) => samePoint(t.position, p));
    if (task && onSelectTask) onSelectTask(task.id);
  };

  const handleMove = (e: MouseEvent<SVGSVGElement>) => {
    if (!interactive) return;
    const p = cellFromEvent(e);
    if (p?.r !== hover?.r || p?.c !== hover?.c) {
      setHover(p);
      onHover?.(p);
    }
  };

  const ease = `transform ${Math.max(60, tickMs * 0.92)}ms linear`;

  return (
    <svg
      ref={svgRef}
      viewBox={`${-PAD_X} ${-PAD_TOP} ${W + 2 * PAD_X} ${H + PAD_TOP + PAD_BOTTOM}`}
      className={`block h-full w-full select-none ${interactive ? 'cursor-crosshair' : ''} ${className}`}
      role="img"
      aria-label={label}
      onClick={handleClick}
      onMouseMove={handleMove}
      onMouseLeave={() => {
        setHover(null);
        onHover?.(null);
      }}
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <pattern id="cellgrid" width={CELL} height={CELL} patternUnits="userSpaceOnUse">
          <path d={`M ${CELL} 0 L 0 0 0 ${CELL}`} fill="none" stroke="#1A2542" strokeWidth={1} />
        </pattern>
        <pattern id="majorgrid" width={CELL * 5} height={CELL * 5} patternUnits="userSpaceOnUse">
          <path d={`M ${CELL * 5} 0 L 0 0 0 ${CELL * 5}`} fill="none" stroke="#223055" strokeWidth={1} />
        </pattern>
        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2.4" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <rect x={0} y={0} width={W} height={H} fill="#080D1A" rx={4} />
      <rect x={0} y={0} width={W} height={H} fill="url(#cellgrid)" />
      <rect x={0} y={0} width={W} height={H} fill="url(#majorgrid)" />

      {/* search visualisation: closed set (expanded) and open set (frontier) */}
      {search && (
        <g opacity={0.9}>
          {search.expanded.map((k) => {
            const p = fromKey(k, grid.cols);
            return <rect key={`e${k}`} x={p.c * CELL + 1} y={p.r * CELL + 1} width={CELL - 2} height={CELL - 2} fill="#2BD9F2" opacity={0.07} />;
          })}
          {search.opened.map((k) => {
            const p = fromKey(k, grid.cols);
            return <rect key={`o${k}`} x={p.c * CELL + 8} y={p.r * CELL + 8} width={CELL - 16} height={CELL - 16} rx={2} fill="#9B7BFF" opacity={0.28} />;
          })}
        </g>
      )}

      <ObstacleLayer obstacles={obstacles} cols={grid.cols} sig={sig} />

      {/* planned routes */}
      {showPaths &&
        robots.map((r) => {
          if (r.state === 'FAILED' || r.path.length < 2 || r.pathIndex >= r.path.length - 1) return null;
          const pts = r.path.slice(r.pathIndex).map((p) => `${p.c * CELL + CELL / 2},${p.r * CELL + CELL / 2}`).join(' ');
          const sel = selectedRobotId === r.id;
          return (
            <polyline
              key={`p${r.id}`}
              points={pts}
              fill="none"
              stroke={r.color}
              strokeWidth={sel ? 3 : 2}
              strokeOpacity={selectedRobotId && !sel ? 0.25 : 0.8}
              strokeDasharray="5 3"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="path-flow"
            />
          );
        })}

      {/* tasks */}
      {tasks.map((t) => {
        const cx = t.position.c * CELL + CELL / 2;
        const cy = t.position.r * CELL + CELL / 2;
        const color = PRIORITY_COLOR[t.priority];
        const done = t.status === 'COMPLETED';
        const sel = selectedTaskId === t.id;
        const owner = t.assignedRobotId ? robots.find((r) => r.id === t.assignedRobotId) : undefined;
        return (
          <g key={t.id} opacity={done ? 0.35 : 1}>
            {sel && <rect x={cx - 12} y={cy - 12} width={24} height={24} rx={4} fill="none" stroke="#E8EEFA" strokeWidth={1.5} strokeDasharray="3 2" />}
            <rect
              x={cx - 6.5}
              y={cy - 6.5}
              width={13}
              height={13}
              rx={2}
              transform={`rotate(45 ${cx} ${cy})`}
              fill={done ? '#3EE6A0' : `${color}33`}
              stroke={t.status === 'BLOCKED' ? '#FF5470' : done ? '#3EE6A0' : color}
              strokeWidth={1.8}
            />
            {t.priority === 5 && !done && <circle cx={cx} cy={cy} r={9} fill="none" stroke="#FF5470" strokeWidth={1.2} className="pulse-ring" />}
            {t.status === 'IN_PROGRESS' && t.progress > 0 && (
              <circle
                cx={cx}
                cy={cy}
                r={10.5}
                fill="none"
                stroke={owner?.color ?? '#9B7BFF'}
                strokeWidth={2}
                strokeDasharray={`${(t.progress / t.duration) * 66} 66`}
                transform={`rotate(-90 ${cx} ${cy})`}
              />
            )}
            {t.status === 'BLOCKED' && <path d={`M${cx - 4} ${cy - 4} L${cx + 4} ${cy + 4} M${cx + 4} ${cy - 4} L${cx - 4} ${cy + 4}`} stroke="#FF5470" strokeWidth={2} />}
            <text x={cx} y={cy - 10} textAnchor="middle" fontSize={7.5} fontFamily="IBM Plex Mono" fill={done ? '#6B7A9E' : '#C3CDE3'}>
              {t.id}
            </text>
          </g>
        );
      })}

      {/* robots */}
      {robots.map((r, i) => {
        const x = r.position.c * CELL + offsets[i].x;
        const y = r.position.r * CELL + offsets[i].y;
        const failed = r.state === 'FAILED';
        const sel = selectedRobotId === r.id;
        const stateColor = ROBOT_STATE_COLOR[r.state];
        return (
          <g key={r.id} style={{ transform: `translate(${x}px, ${y}px)`, transition: ease }}>
            <g transform={`translate(${CELL / 2},${CELL / 2})`}>
              {failed && <circle r={9} fill="none" stroke="#FF5470" strokeWidth={1.5} className="pulse-ring" />}
              {sel && <circle r={13} fill="none" stroke="#E8EEFA" strokeWidth={1.2} strokeDasharray="2 2" />}
              <rect x={-9} y={-9} width={18} height={18} rx={5} fill={failed ? '#3A1420' : '#0A1020'} stroke={failed ? '#FF5470' : r.color} strokeWidth={2} filter={failed ? undefined : 'url(#glow)'} />
              <rect x={-5} y={-5} width={10} height={10} rx={2.5} fill={failed ? '#FF5470' : r.color} opacity={failed ? 0.6 : 0.9} />
              {failed && <path d="M-4 -4 L4 4 M4 -4 L-4 4" stroke="#0A1020" strokeWidth={2} />}
              <circle cx={7.5} cy={-7.5} r={3} fill={stateColor} stroke="#0A1020" strokeWidth={1} />
              <text y={20} textAnchor="middle" fontSize={8} fontWeight={600} fontFamily="Chakra Petch" fill={failed ? '#FF5470' : r.color}>
                {r.id}
              </text>
            </g>
          </g>
        );
      })}

      {interactive && hover && (
        <rect x={hover.c * CELL + 0.5} y={hover.r * CELL + 0.5} width={CELL - 1} height={CELL - 1} rx={3} fill="none" stroke="#2BD9F2" strokeWidth={1.2} opacity={0.8} pointerEvents="none" />
      )}
    </svg>
  );
}

export const FloorMap = memo(FloorMapInner, (a, b) => {
  return (
    a.version === b.version &&
    a.state === b.state &&
    a.tickMs === b.tickMs &&
    a.selectedRobotId === b.selectedRobotId &&
    a.selectedTaskId === b.selectedTaskId &&
    a.showSearch === b.showSearch &&
    a.showPaths === b.showPaths &&
    a.interactive === b.interactive &&
    a.onCellClick === b.onCellClick
  );
});
