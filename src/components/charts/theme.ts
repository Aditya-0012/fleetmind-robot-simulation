/** Shared Recharts styling so every chart reads as one system. */
export const AXIS = {
  stroke: '#33446E',
  tick: { fill: '#94A2C2', fontSize: 11, fontFamily: 'IBM Plex Sans' },
  tickLine: false,
};

export const GRID = { stroke: '#1A2542', strokeDasharray: '3 4' };

export const TOOLTIP = {
  contentStyle: {
    background: '#0E1528',
    border: '1px solid #26355C',
    borderRadius: 8,
    fontSize: 12,
    color: '#E8EEFA',
    fontFamily: 'IBM Plex Sans',
  },
  labelStyle: { color: '#94A2C2', marginBottom: 4 },
  itemStyle: { padding: 0 },
  cursor: { fill: 'rgba(76,141,255,0.06)', stroke: '#33446E' },
};

export const SERIES = {
  cyan: '#2BD9F2',
  violet: '#9B7BFF',
  green: '#3EE6A0',
  amber: '#FFC247',
  red: '#FF5470',
  blue: '#4C8DFF',
  grey: '#6B7A9E',
};

export const LEGEND = { wrapperStyle: { fontSize: 12, color: '#C3CDE3', paddingTop: 6 }, iconType: 'circle' as const, iconSize: 8 };
