import { createDefaultSettings } from './defaults';
import { normalizeSettings, SETTINGS_KEY } from './settings';
import type { ClockboardSettings, SettingsEnvelope, StorageStatus } from './types';

interface StorageArea {
  get(key: string): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
}

const browserLocalArea: StorageArea = {
  async get(key) {
    const raw = localStorage.getItem(key);
    return { [key]: raw ? JSON.parse(raw) : undefined };
  },
  async set(items) {
    for (const [key, value] of Object.entries(items)) {
      localStorage.setItem(key, JSON.stringify(value));
    }
  }
};

function wrapChromeArea(area: chrome.storage.StorageArea | undefined): StorageArea | null {
  if (!area) return null;
  return {
    get: (key) => area.get(key),
    set: (items) => area.set(items)
  };
}

function getExtensionStorage(): { sync: StorageArea | null; local: StorageArea | null } {
  const storage = globalThis.chrome?.storage;
  return {
    sync: wrapChromeArea(storage?.sync),
    local: wrapChromeArea(storage?.local)
  };
}

async function readFrom(area: StorageArea): Promise<ClockboardSettings> {
  const result = await area.get(SETTINGS_KEY);
  return normalizeSettings(result[SETTINGS_KEY]);
}

async function writeTo(area: StorageArea, settings: ClockboardSettings): Promise<void> {
  await area.set({ [SETTINGS_KEY]: settings });
}

export async function loadSettings(): Promise<SettingsEnvelope> {
  const { sync, local } = getExtensionStorage();

  if (sync) {
    try {
      return {
        settings: await readFrom(sync),
        status: { area: 'sync', fallbackReason: null }
      };
    } catch (error) {
      if (local) {
        return {
          settings: await readFrom(local),
          status: { area: 'local', fallbackReason: error instanceof Error ? error.message : 'Sync storage failed.' }
        };
      }
    }
  }

  if (local) {
    return {
      settings: await readFrom(local),
      status: { area: 'local', fallbackReason: 'Sync storage is unavailable.' }
    };
  }

  return {
    settings: await readFrom(browserLocalArea),
    status: { area: 'browser-local', fallbackReason: 'Extension storage is unavailable in this context.' }
  };
}

export async function saveSettings(settings: ClockboardSettings, status?: StorageStatus): Promise<SettingsEnvelope> {
  const normalized = normalizeSettings(settings);
  const { sync, local } = getExtensionStorage();

  if (status?.area === 'local' && local) {
    await writeTo(local, normalized);
    return { settings: normalized, status };
  }

  if (sync) {
    try {
      await writeTo(sync, normalized);
      return { settings: normalized, status: { area: 'sync', fallbackReason: null } };
    } catch (error) {
      if (local) {
        const fallbackStatus: StorageStatus = {
          area: 'local',
          fallbackReason: error instanceof Error ? error.message : 'Sync storage failed.'
        };
        await writeTo(local, normalized);
        return { settings: normalized, status: fallbackStatus };
      }
    }
  }

  if (local) {
    const fallbackStatus: StorageStatus = { area: 'local', fallbackReason: 'Sync storage is unavailable.' };
    await writeTo(local, normalized);
    return { settings: normalized, status: fallbackStatus };
  }

  await writeTo(browserLocalArea, normalized);
  return {
    settings: normalized,
    status: { area: 'browser-local', fallbackReason: 'Extension storage is unavailable in this context.' }
  };
}

export async function resetSettings(): Promise<SettingsEnvelope> {
  return saveSettings(createDefaultSettings());
}
