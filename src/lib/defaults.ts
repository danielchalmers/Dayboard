import {
  SCHEMA_VERSION,
  type ClockboardItem,
  type ClockboardSettings
} from './types';

export const CLOCK_ITEM_ID = 'clock';
export const DATE_ITEM_ID = 'date';
export const COUNTDOWN_PLACEHOLDER_ITEM_ID = 'countdown-placeholder';

export function createDefaultClockboardItems(
  now = new Date()
): ClockboardItem[] {
  const timestamp = now.toISOString();
  return [
    {
      id: CLOCK_ITEM_ID,
      type: 'clock',
      countdownId: null,
      visible: true,
      createdAt: timestamp,
      updatedAt: timestamp
    },
    {
      id: DATE_ITEM_ID,
      type: 'date',
      countdownId: null,
      visible: true,
      createdAt: timestamp,
      updatedAt: timestamp
    },
    {
      id: COUNTDOWN_PLACEHOLDER_ITEM_ID,
      type: 'countdown',
      countdownId: null,
      visible: true,
      createdAt: timestamp,
      updatedAt: timestamp
    }
  ];
}

export function createDefaultSettings(now = new Date()): ClockboardSettings {
  return {
    schemaVersion: SCHEMA_VERSION,
    updatedAt: now.toISOString(),
    clock: {
      timeFormat: 'system',
      showSeconds: true,
      fontScale: 1
    },
    clockboard: {
      items: createDefaultClockboardItems(now)
    },
    countdowns: []
  };
}
