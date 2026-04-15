import { format, parseISO, differenceInSeconds, formatDuration } from 'date-fns';

export function todayString(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

export function nowISO(): string {
  return new Date().toISOString();
}

export function formatDate(dateStr: string): string {
  return format(parseISO(dateStr), 'EEE, MMM d, yyyy');
}

export function formatTime(isoStr: string): string {
  return format(parseISO(isoStr), 'h:mm a');
}

export function formatDurationSec(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s}s`;
  return `${m}m ${s}s`;
}

export function sixHoursAgoISO(): string {
  const d = new Date();
  d.setHours(d.getHours() - 6);
  return d.toISOString();
}

export function secondsBetween(start: string, end: string): number {
  return differenceInSeconds(parseISO(end), parseISO(start));
}

export function totalToiletMinutes(sessions: { duration_seconds: number | null }[]): number {
  const total = sessions.reduce((sum, s) => sum + (s.duration_seconds ?? 0), 0);
  return Math.round(total / 60);
}
