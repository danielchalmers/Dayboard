import type { TimeFormat } from './types';

export interface CountdownDisplay {
  completed: boolean;
  label: string;
  units: Array<{ label: string; value: number }>;
}

const minute = 60_000;
const hour = 60 * minute;
const day = 24 * hour;

function localInputToDate(value: string): Date {
  return new Date(value);
}

export function isFutureTarget(targetLocal: string, now = new Date()): boolean {
  const target = localInputToDate(targetLocal);
  return Number.isFinite(target.getTime()) && target.getTime() > now.getTime();
}

export function formatClock(
  date: Date,
  timeFormat: TimeFormat,
  showSeconds: boolean
): string {
  const hour12 = timeFormat === 'system' ? undefined : timeFormat === '12';
  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    second: showSeconds ? '2-digit' : undefined,
    hour12
  }).format(date);
}

export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  }).format(date);
}

export function greetingFor(date: Date): string {
  const hourValue = date.getHours();
  if (hourValue < 12) return 'Good morning';
  if (hourValue < 18) return 'Good afternoon';
  return 'Good evening';
}

export function formatCountdown(
  targetLocal: string,
  now = new Date()
): CountdownDisplay {
  const target = localInputToDate(targetLocal);
  const remaining = target.getTime() - now.getTime();

  if (!Number.isFinite(remaining) || remaining <= 0) {
    return {
      completed: true,
      label: 'Completed',
      units: [
        { label: 'days', value: 0 },
        { label: 'hours', value: 0 },
        { label: 'minutes', value: 0 }
      ]
    };
  }

  const days = Math.floor(remaining / day);
  const hours = Math.floor((remaining % day) / hour);
  const minutes = Math.floor((remaining % hour) / minute);
  const seconds = Math.floor((remaining % minute) / 1000);

  if (remaining >= 30 * day) {
    return {
      completed: false,
      label: `${days} day${days === 1 ? '' : 's'}`,
      units: [{ label: 'days', value: days }]
    };
  }

  if (remaining >= day) {
    return {
      completed: false,
      label: `${days}d ${hours}h`,
      units: [
        { label: 'days', value: days },
        { label: 'hours', value: hours }
      ]
    };
  }

  return {
    completed: false,
    label: `${hours}h ${minutes}m ${seconds}s`,
    units: [
      { label: 'hours', value: hours },
      { label: 'minutes', value: minutes },
      { label: 'seconds', value: seconds }
    ]
  };
}
