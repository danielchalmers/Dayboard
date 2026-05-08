import { describe, expect, it } from 'vitest';

import { createDefaultSettings } from '../../src/lib/defaults';
import { addCountdown, removeCountdown, updateCountdown, normalizeSettings } from '../../src/lib/settings';
import { MAX_COUNTDOWNS } from '../../src/lib/types';

describe('settings helpers', () => {
  it('normalizes unknown settings to defaults', () => {
    const normalized = normalizeSettings({ clock: { fontScale: 20 }, countdowns: 'bad' });

    expect(normalized.clock.fontScale).toBe(1.5);
    expect(normalized.countdowns).toEqual([]);
  });

  it('adds a valid future countdown and makes it active', () => {
    const settings = addCountdown(
      createDefaultSettings(new Date('2026-05-08T10:00:00')),
      { name: 'Launch', targetLocal: '2026-05-09T10:00' },
      new Date('2026-05-08T10:00:00')
    );

    expect(settings.countdowns).toHaveLength(1);
    expect(settings.activeCountdownId).toBe(settings.countdowns[0]?.id);
  });

  it('rejects past countdown targets', () => {
    expect(() =>
      addCountdown(
        createDefaultSettings(new Date('2026-05-08T10:00:00')),
        { name: 'Past', targetLocal: '2026-05-08T09:00' },
        new Date('2026-05-08T10:00:00')
      )
    ).toThrow('future');
  });

  it('enforces the countdown limit', () => {
    const now = new Date('2026-05-08T10:00:00');
    let settings = createDefaultSettings(now);

    for (let index = 0; index < MAX_COUNTDOWNS; index += 1) {
      settings = addCountdown(settings, { name: `Event ${index}`, targetLocal: '2026-05-09T10:00' }, now);
    }

    expect(() => addCountdown(settings, { name: 'Overflow', targetLocal: '2026-05-10T10:00' }, now)).toThrow(
      `${MAX_COUNTDOWNS}`
    );
  });

  it('updates and removes countdowns without leaving a stale active id', () => {
    const now = new Date('2026-05-08T10:00:00');
    const created = addCountdown(createDefaultSettings(now), { name: 'Launch', targetLocal: '2026-05-09T10:00' }, now);
    const id = created.countdowns[0]?.id ?? '';
    const updated = updateCountdown(created, id, { name: 'Release', targetLocal: '2026-05-10T10:00' }, now);
    const removed = removeCountdown(updated, id, now);

    expect(updated.countdowns[0]?.name).toBe('Release');
    expect(removed.countdowns).toEqual([]);
    expect(removed.activeCountdownId).toBeNull();
  });
});
