export const SCHEMA_VERSION = 1;
export const MAX_COUNTDOWNS = 20;

export type TimeFormat = 'system' | '12' | '24';

export interface ClockPreferences {
  timeFormat: TimeFormat;
  showSeconds: boolean;
  showDate: boolean;
  showGreeting: boolean;
  showCountdown: boolean;
  fontScale: number;
}

export interface Countdown {
  id: string;
  name: string;
  targetLocal: string;
  createdAt: string;
  updatedAt: string;
}

export interface ClockboardSettings {
  schemaVersion: typeof SCHEMA_VERSION;
  updatedAt: string;
  activeCountdownId: string | null;
  clock: ClockPreferences;
  countdowns: Countdown[];
}

export interface StorageStatus {
  area: 'sync' | 'local' | 'browser-local';
  fallbackReason: string | null;
}

export interface SettingsEnvelope {
  settings: ClockboardSettings;
  status: StorageStatus;
}

export type CountdownDraft = Pick<Countdown, 'name' | 'targetLocal'>;
