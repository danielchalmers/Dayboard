import { describe, expect, it } from 'vitest';

import { formatCountdown, formatClock, greetingFor, isFutureTarget } from '../../src/lib/time';

describe('time helpers', () => {
  it('formats countdowns with calm smart units for distant targets', () => {
    const now = new Date('2026-05-08T10:00:00');
    const display = formatCountdown('2026-07-10T10:00', now);

    expect(display.completed).toBe(false);
    expect(display.units).toEqual([{ label: 'days', value: 63 }]);
  });

  it('includes seconds for countdowns under one day', () => {
    const now = new Date('2026-05-08T10:00:00');
    const display = formatCountdown('2026-05-08T11:02:03', now);

    expect(display.units).toEqual([
      { label: 'hours', value: 1 },
      { label: 'minutes', value: 2 },
      { label: 'seconds', value: 3 }
    ]);
  });

  it('stops completed countdowns at zero', () => {
    const display = formatCountdown('2026-05-08T09:00:00', new Date('2026-05-08T10:00:00'));

    expect(display.completed).toBe(true);
    expect(display.label).toBe('Completed');
  });

  it('validates future targets only', () => {
    const now = new Date('2026-05-08T10:00:00');

    expect(isFutureTarget('2026-05-08T10:01', now)).toBe(true);
    expect(isFutureTarget('2026-05-08T09:59', now)).toBe(false);
  });

  it('uses explicit 24-hour formatting when requested', () => {
    const formatted = formatClock(new Date('2026-05-08T15:04:05'), '24', true);

    expect(formatted).toContain('15');
    expect(formatted).toContain('04');
  });

  it('chooses greeting by local hour', () => {
    expect(greetingFor(new Date('2026-05-08T08:00:00'))).toBe('Good morning');
    expect(greetingFor(new Date('2026-05-08T13:00:00'))).toBe('Good afternoon');
    expect(greetingFor(new Date('2026-05-08T19:00:00'))).toBe('Good evening');
  });
});
