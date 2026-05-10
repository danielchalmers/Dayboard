export const SCHEMA_VERSION = 1;
export const MAX_COUNTDOWNS = 20;

export type TimeFormat = 'system' | '12' | '24';
export type ClockboardItemType = 'clock' | 'date' | 'countdown';

export interface ClockPreferences {
  timeFormat: TimeFormat;
  showSeconds: boolean;
  fontScale: number;
}

export interface Countdown {
  id: string;
  name: string;
  targetLocal: string;
  createdAt: string;
  updatedAt: string;
}

export interface ClockboardItem {
  id: string;
  type: ClockboardItemType;
  countdownId: string | null;
  visible: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ClockboardLayout {
  items: ClockboardItem[];
}

export interface ClockboardSettings {
  schemaVersion: typeof SCHEMA_VERSION;
  updatedAt: string;
  clock: ClockPreferences;
  clockboard: ClockboardLayout;
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
