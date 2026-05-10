import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createDefaultSettings } from '../../src/lib/defaults';
import { SETTINGS_KEY } from '../../src/lib/settings';
import { loadSettings, saveSettings } from '../../src/lib/storage';

class MemoryArea {
  data: Record<string, unknown> = {};
  failGet = false;
  failSet = false;

  async get(key: string) {
    if (this.failGet) throw new Error('storage unavailable');
    return { [key]: this.data[key] };
  }

  async set(items: Record<string, unknown>) {
    if (this.failSet) throw new Error('storage unavailable');
    Object.assign(this.data, items);
  }
}

function createLocalStorageMock() {
  const data = new Map<string, string>();
  return {
    clear: () => data.clear(),
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => data.set(key, value),
    removeItem: (key: string) => data.delete(key)
  };
}

describe('storage helpers', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    vi.stubGlobal('localStorage', createLocalStorageMock());
    localStorage.clear();
  });

  it('loads from sync storage when available', async () => {
    const sync = new MemoryArea();
    const local = new MemoryArea();
    const settings = createDefaultSettings(new Date('2026-05-08T10:00:00'));
    sync.data[SETTINGS_KEY] = settings;
    vi.stubGlobal('chrome', { storage: { sync, local } });

    const loaded = await loadSettings();

    expect(loaded.status.area).toBe('sync');
    expect(loaded.settings.updatedAt).toBe(settings.updatedAt);
  });

  it('falls back to local storage when sync fails', async () => {
    const sync = new MemoryArea();
    const local = new MemoryArea();
    sync.failGet = true;
    local.data[SETTINGS_KEY] = createDefaultSettings(
      new Date('2026-05-08T10:00:00')
    );
    vi.stubGlobal('chrome', { storage: { sync, local } });

    const loaded = await loadSettings();

    expect(loaded.status.area).toBe('local');
    expect(loaded.status.fallbackReason).toContain('storage unavailable');
  });

  it('writes to browser local storage outside extension contexts', async () => {
    const settings = createDefaultSettings(new Date('2026-05-08T10:00:00'));

    const saved = await saveSettings(settings);

    expect(saved.status.area).toBe('browser-local');
    expect(localStorage.getItem(SETTINGS_KEY)).toContain(settings.updatedAt);
  });
});
