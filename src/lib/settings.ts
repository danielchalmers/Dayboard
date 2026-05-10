import {
  CLOCK_ITEM_ID,
  COUNTDOWN_PLACEHOLDER_ITEM_ID,
  DATE_ITEM_ID,
  createDefaultSettings
} from './defaults';
import { isFutureTarget } from './time';
import {
  MAX_COUNTDOWNS,
  SCHEMA_VERSION,
  type ClockboardItem,
  type ClockboardSettings,
  type Countdown,
  type CountdownDraft
} from './types';

export const SETTINGS_KEY = 'clockboard.settings.v1';

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function clampFontScale(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(1.5, Math.max(0.8, value))
    : 1;
}

function createId(): string {
  if (
    'crypto' in globalThis &&
    typeof globalThis.crypto.randomUUID === 'function'
  ) {
    return globalThis.crypto.randomUUID();
  }
  return `countdown-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function createCountdownItem(countdown: Countdown): ClockboardItem {
  return {
    id: `countdown-${countdown.id}`,
    type: 'countdown',
    countdownId: countdown.id,
    visible: true,
    createdAt: countdown.createdAt,
    updatedAt: countdown.updatedAt
  };
}

function normalizeClockboardItems(
  value: unknown,
  countdowns: Countdown[],
  now = new Date()
): ClockboardItem[] {
  const timestamp = now.toISOString();
  const countdownIds = new Set(countdowns.map((countdown) => countdown.id));
  const rawItems =
    isRecord(value) && Array.isArray(value.items) ? value.items : [];
  const seen = new Set<string>();
  const items: ClockboardItem[] = [];

  for (const rawItem of rawItems) {
    if (!isRecord(rawItem)) continue;
    const id = asString(rawItem.id);
    const type = rawItem.type;
    const countdownId = asString(rawItem.countdownId);
    if (!id || seen.has(id)) continue;
    if (type !== 'clock' && type !== 'date' && type !== 'countdown') continue;
    if (type === 'countdown' && countdownId && !countdownIds.has(countdownId)) {
      continue;
    }

    seen.add(id);
    items.push({
      id,
      type,
      countdownId: type === 'countdown' ? countdownId : null,
      visible: typeof rawItem.visible === 'boolean' ? rawItem.visible : true,
      createdAt: asString(rawItem.createdAt) ?? timestamp,
      updatedAt: asString(rawItem.updatedAt) ?? timestamp
    });
  }

  if (!seen.has(CLOCK_ITEM_ID)) {
    items.unshift({
      id: CLOCK_ITEM_ID,
      type: 'clock',
      countdownId: null,
      visible: true,
      createdAt: timestamp,
      updatedAt: timestamp
    });
  }

  if (!seen.has(DATE_ITEM_ID)) {
    const clockIndex = items.findIndex((item) => item.id === CLOCK_ITEM_ID);
    items.splice(clockIndex + 1, 0, {
      id: DATE_ITEM_ID,
      type: 'date',
      countdownId: null,
      visible: true,
      createdAt: timestamp,
      updatedAt: timestamp
    });
  }

  for (const countdown of countdowns) {
    if (!items.some((item) => item.countdownId === countdown.id)) {
      items.push(createCountdownItem(countdown));
    }
  }

  if (countdowns.length === 0) {
    if (!items.some((item) => item.id === COUNTDOWN_PLACEHOLDER_ITEM_ID)) {
      items.push({
        id: COUNTDOWN_PLACEHOLDER_ITEM_ID,
        type: 'countdown',
        countdownId: null,
        visible: true,
        createdAt: timestamp,
        updatedAt: timestamp
      });
    }
  } else {
    return items.filter((item) => item.id !== COUNTDOWN_PLACEHOLDER_ITEM_ID);
  }

  return items;
}

function syncClockboardItems(
  settings: ClockboardSettings,
  now = new Date()
): ClockboardSettings {
  return {
    ...settings,
    clockboard: {
      items: normalizeClockboardItems(
        settings.clockboard,
        settings.countdowns,
        now
      )
    }
  };
}

export function normalizeSettings(
  value: unknown,
  now = new Date()
): ClockboardSettings {
  const defaults = createDefaultSettings(now);
  if (!isRecord(value)) return defaults;

  const clock = isRecord(value.clock) ? value.clock : {};
  const rawCountdowns = Array.isArray(value.countdowns) ? value.countdowns : [];
  const countdowns = rawCountdowns
    .filter(isRecord)
    .map((item): Countdown | null => {
      const id = asString(item.id);
      const name = asString(item.name)?.trim();
      const targetLocal = asString(item.targetLocal);
      const createdAt = asString(item.createdAt);
      const updatedAt = asString(item.updatedAt);
      if (!id || !name || !targetLocal || !createdAt || !updatedAt) return null;
      return { id, name, targetLocal, createdAt, updatedAt };
    })
    .filter((item): item is Countdown => item !== null)
    .slice(0, MAX_COUNTDOWNS);

  const normalized: ClockboardSettings = {
    schemaVersion: SCHEMA_VERSION,
    updatedAt: asString(value.updatedAt) ?? defaults.updatedAt,
    clock: {
      timeFormat:
        clock.timeFormat === '12' ||
        clock.timeFormat === '24' ||
        clock.timeFormat === 'system'
          ? clock.timeFormat
          : defaults.clock.timeFormat,
      showSeconds:
        typeof clock.showSeconds === 'boolean'
          ? clock.showSeconds
          : defaults.clock.showSeconds,
      fontScale: clampFontScale(clock.fontScale)
    },
    clockboard: {
      items: normalizeClockboardItems(value.clockboard, countdowns, now)
    },
    countdowns
  };

  return syncClockboardItems(normalized, now);
}

export function addCountdown(
  settings: ClockboardSettings,
  draft: CountdownDraft,
  now = new Date()
): ClockboardSettings {
  if (settings.countdowns.length >= MAX_COUNTDOWNS) {
    throw new Error(`Clockboard supports up to ${MAX_COUNTDOWNS} countdowns.`);
  }
  if (!draft.name.trim()) {
    throw new Error('Countdown name is required.');
  }
  if (!isFutureTarget(draft.targetLocal, now)) {
    throw new Error('Countdown target must be in the future.');
  }

  const timestamp = now.toISOString();
  const countdown: Countdown = {
    id: createId(),
    name: draft.name.trim(),
    targetLocal: draft.targetLocal,
    createdAt: timestamp,
    updatedAt: timestamp
  };

  return {
    ...settings,
    updatedAt: timestamp,
    countdowns: [...settings.countdowns, countdown],
    clockboard: {
      items: [
        ...settings.clockboard.items.filter(
          (item) => item.id !== COUNTDOWN_PLACEHOLDER_ITEM_ID
        ),
        createCountdownItem(countdown)
      ]
    }
  };
}

export function updateCountdown(
  settings: ClockboardSettings,
  countdownId: string,
  draft: CountdownDraft,
  now = new Date()
): ClockboardSettings {
  if (!draft.name.trim()) {
    throw new Error('Countdown name is required.');
  }
  if (!isFutureTarget(draft.targetLocal, now)) {
    throw new Error('Countdown target must be in the future.');
  }

  const timestamp = now.toISOString();
  return syncClockboardItems({
    ...settings,
    updatedAt: timestamp,
    countdowns: settings.countdowns.map((countdown) =>
      countdown.id === countdownId
        ? {
            ...countdown,
            name: draft.name.trim(),
            targetLocal: draft.targetLocal,
            updatedAt: timestamp
          }
        : countdown
    )
  });
}

export function removeCountdown(
  settings: ClockboardSettings,
  countdownId: string,
  now = new Date()
): ClockboardSettings {
  const countdowns = settings.countdowns.filter(
    (countdown) => countdown.id !== countdownId
  );
  return syncClockboardItems(
    {
      ...settings,
      updatedAt: now.toISOString(),
      countdowns,
      clockboard: {
        items: settings.clockboard.items.filter(
          (item) => item.countdownId !== countdownId
        )
      }
    },
    now
  );
}

export function setClockboardItemVisibility(
  settings: ClockboardSettings,
  itemId: string,
  visible: boolean,
  now = new Date()
) {
  const timestamp = now.toISOString();
  return {
    ...settings,
    updatedAt: timestamp,
    clockboard: {
      items: settings.clockboard.items.map((item) =>
        item.id === itemId ? { ...item, visible, updatedAt: timestamp } : item
      )
    }
  };
}

export function moveClockboardItemBefore(
  settings: ClockboardSettings,
  sourceId: string,
  targetId: string,
  now = new Date()
): ClockboardSettings {
  if (sourceId === targetId) return settings;
  const source = settings.clockboard.items.find((item) => item.id === sourceId);
  if (!source) return settings;

  const remaining = settings.clockboard.items.filter(
    (item) => item.id !== sourceId
  );
  const targetIndex = remaining.findIndex((item) => item.id === targetId);
  if (targetIndex < 0) return settings;

  const items = [...remaining];
  items.splice(targetIndex, 0, { ...source, updatedAt: now.toISOString() });
  return {
    ...settings,
    updatedAt: now.toISOString(),
    clockboard: { items }
  };
}

export function moveClockboardItemBy(
  settings: ClockboardSettings,
  itemId: string,
  offset: -1 | 1,
  now = new Date()
): ClockboardSettings {
  const index = settings.clockboard.items.findIndex(
    (item) => item.id === itemId
  );
  const nextIndex = index + offset;
  if (
    index < 0 ||
    nextIndex < 0 ||
    nextIndex >= settings.clockboard.items.length
  ) {
    return settings;
  }

  const items = [...settings.clockboard.items];
  const [item] = items.splice(index, 1);
  if (!item) return settings;
  items.splice(nextIndex, 0, { ...item, updatedAt: now.toISOString() });
  return {
    ...settings,
    updatedAt: now.toISOString(),
    clockboard: { items }
  };
}
