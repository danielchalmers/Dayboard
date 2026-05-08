import { createDefaultSettings } from './defaults';
import { isFutureTarget } from './time';
import { MAX_COUNTDOWNS, SCHEMA_VERSION, type ClockboardSettings, type Countdown, type CountdownDraft } from './types';

export const SETTINGS_KEY = 'clockboard.settings.v1';

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function clampFontScale(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.min(1.5, Math.max(0.8, value)) : 1;
}

function createId(): string {
  if ('crypto' in globalThis && typeof globalThis.crypto.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return `countdown-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function normalizeSettings(value: unknown, now = new Date()): ClockboardSettings {
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

  const activeCountdownId = asString(value.activeCountdownId);
  const activeExists = countdowns.some((countdown) => countdown.id === activeCountdownId);

  return {
    schemaVersion: SCHEMA_VERSION,
    updatedAt: asString(value.updatedAt) ?? defaults.updatedAt,
    activeCountdownId: activeExists ? activeCountdownId : countdowns[0]?.id ?? null,
    clock: {
      timeFormat:
        clock.timeFormat === '12' || clock.timeFormat === '24' || clock.timeFormat === 'system'
          ? clock.timeFormat
          : defaults.clock.timeFormat,
      showSeconds: typeof clock.showSeconds === 'boolean' ? clock.showSeconds : defaults.clock.showSeconds,
      showDate: typeof clock.showDate === 'boolean' ? clock.showDate : defaults.clock.showDate,
      showGreeting: typeof clock.showGreeting === 'boolean' ? clock.showGreeting : defaults.clock.showGreeting,
      showCountdown:
        typeof clock.showCountdown === 'boolean' ? clock.showCountdown : defaults.clock.showCountdown,
      fontScale: clampFontScale(clock.fontScale)
    },
    countdowns
  };
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
    activeCountdownId: settings.activeCountdownId ?? countdown.id,
    countdowns: [...settings.countdowns, countdown]
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
  return {
    ...settings,
    updatedAt: timestamp,
    countdowns: settings.countdowns.map((countdown) =>
      countdown.id === countdownId
        ? { ...countdown, name: draft.name.trim(), targetLocal: draft.targetLocal, updatedAt: timestamp }
        : countdown
    )
  };
}

export function removeCountdown(settings: ClockboardSettings, countdownId: string, now = new Date()): ClockboardSettings {
  const countdowns = settings.countdowns.filter((countdown) => countdown.id !== countdownId);
  const activeCountdownId =
    settings.activeCountdownId === countdownId ? countdowns[0]?.id ?? null : settings.activeCountdownId;
  return {
    ...settings,
    updatedAt: now.toISOString(),
    activeCountdownId,
    countdowns
  };
}

export function setActiveCountdown(settings: ClockboardSettings, countdownId: string | null, now = new Date()) {
  const activeCountdownId =
    countdownId && settings.countdowns.some((countdown) => countdown.id === countdownId) ? countdownId : null;
  return {
    ...settings,
    updatedAt: now.toISOString(),
    activeCountdownId
  };
}
