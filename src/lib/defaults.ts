import { SCHEMA_VERSION, type ClockboardSettings } from './types';

export function createDefaultSettings(now = new Date()): ClockboardSettings {
  return {
    schemaVersion: SCHEMA_VERSION,
    updatedAt: now.toISOString(),
    activeCountdownId: null,
    clock: {
      timeFormat: 'system',
      showSeconds: true,
      showDate: true,
      showGreeting: true,
      showCountdown: true,
      fontScale: 1
    },
    countdowns: []
  };
}
