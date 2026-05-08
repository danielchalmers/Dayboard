import { writable } from 'svelte/store';

import { createDefaultSettings } from '../lib/defaults';
import { loadSettings, saveSettings } from '../lib/storage';
import type { ClockboardSettings, SettingsEnvelope, StorageStatus } from '../lib/types';

interface SettingsState {
  ready: boolean;
  settings: ClockboardSettings;
  status: StorageStatus;
  error: string | null;
}

const initialState: SettingsState = {
  ready: false,
  settings: createDefaultSettings(),
  status: { area: 'browser-local', fallbackReason: null },
  error: null
};

export const settingsState = writable<SettingsState>(initialState);

let currentEnvelope: SettingsEnvelope | null = null;

export async function initializeSettings() {
  try {
    currentEnvelope = await loadSettings();
    settingsState.set({
      ready: true,
      settings: currentEnvelope.settings,
      status: currentEnvelope.status,
      error: null
    });
  } catch (error) {
    settingsState.update((state) => ({
      ...state,
      ready: true,
      error: error instanceof Error ? error.message : 'Clockboard settings could not be loaded.'
    }));
  }
}

export async function persistSettings(settings: ClockboardSettings) {
  try {
    currentEnvelope = await saveSettings(settings, currentEnvelope?.status);
    settingsState.set({
      ready: true,
      settings: currentEnvelope.settings,
      status: currentEnvelope.status,
      error: null
    });
  } catch (error) {
    settingsState.update((state) => ({
      ...state,
      error: error instanceof Error ? error.message : 'Clockboard settings could not be saved.'
    }));
  }
}

export async function updateSettings(mutator: (settings: ClockboardSettings) => ClockboardSettings) {
  const base = currentEnvelope?.settings ?? createDefaultSettings();
  await persistSettings(mutator(base));
}
