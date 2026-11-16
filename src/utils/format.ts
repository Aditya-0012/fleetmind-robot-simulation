import type { RobotState } from '../models/Robot';
import type { TaskStatus } from '../models/Task';
import type { Severity } from '../models/Event';

export const ROBOT_STATE_COLOR: Record<RobotState, string> = {
  IDLE: '#6B7A9E',
  ASSIGNED: '#4C8DFF',
  MOVING: '#2BD9F2',
  EXECUTING: '#9B7BFF',
  WAITING: '#FFC247',
  REPLANNING: '#FF9A5A',
  FAILED: '#FF5470',
  COMPLETED: '#3EE6A0',
};

export const TASK_STATUS_COLOR: Record<TaskStatus, string> = {
  UNASSIGNED: '#94A2C2',
  ASSIGNED: '#4C8DFF',
  IN_PROGRESS: '#2BD9F2',
  COMPLETED: '#3EE6A0',
  BLOCKED: '#FF5470',
};

export const SEVERITY_COLOR: Record<Severity, string> = {
  info: '#94A2C2',
  success: '#3EE6A0',
  warning: '#FFC247',
  critical: '#FF5470',
};

export const PRIORITY_COLOR: Record<number, string> = {
  1: '#6B7A9E',
  2: '#4C8DFF',
  3: '#2BD9F2',
  4: '#FFC247',
  5: '#FF5470',
};

export const titleCase = (s: string): string => s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, ' ');

export function fmtMs(ms: number): string {
  if (ms < 1) return `${(ms * 1000).toFixed(0)} µs`;
  if (ms < 100) return `${ms.toFixed(2)} ms`;
  return `${ms.toFixed(0)} ms`;
}

export function fmtNum(n: number, digits = 0): string {
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('en-IN', { maximumFractionDigits: digits, minimumFractionDigits: digits });
}

export function downloadFile(name: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}

export function toCSV(rows: Record<string, string | number | boolean | null | undefined>[]): string {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.join(','), ...rows.map((r) => headers.map((h) => esc(r[h])).join(','))].join('\n');
}
