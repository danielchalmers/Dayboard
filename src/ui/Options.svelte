<script lang="ts">
  import { onMount } from 'svelte';

  import { createDefaultSettings } from '../lib/defaults';
  import {
    addCountdown,
    removeCountdown,
    setActiveCountdown,
    updateCountdown,
    normalizeSettings
  } from '../lib/settings';
  import { MAX_COUNTDOWNS, type Countdown } from '../lib/types';
  import { initializeSettings, persistSettings, updateSettings, settingsState } from './settingsStore';

  let message = '';
  let editingId: string | null = null;
  let draftName = '';
  let draftTarget = '';

  onMount(() => {
    initializeSettings();
  });

  $: settings = $settingsState.settings;
  $: editing = settings.countdowns.find((countdown) => countdown.id === editingId) ?? null;

  function beginEdit(countdown: Countdown) {
    editingId = countdown.id;
    draftName = countdown.name;
    draftTarget = countdown.targetLocal;
    message = '';
  }

  function clearDraft() {
    editingId = null;
    draftName = '';
    draftTarget = '';
  }

  async function saveCountdown() {
    try {
      await updateSettings((current) =>
        editingId
          ? updateCountdown(current, editingId, { name: draftName, targetLocal: draftTarget })
          : addCountdown(current, { name: draftName, targetLocal: draftTarget })
      );
      clearDraft();
      message = 'Countdown saved.';
    } catch (error) {
      message = error instanceof Error ? error.message : 'Countdown could not be saved.';
    }
  }

  async function deleteCountdown(countdownId: string) {
    await updateSettings((current) => removeCountdown(current, countdownId));
    if (editingId === countdownId) clearDraft();
    message = 'Countdown removed.';
  }

  async function resetAll() {
    await persistSettings(createDefaultSettings());
    clearDraft();
    message = 'Settings reset.';
  }

  function exportSettings() {
    const blob = new Blob([JSON.stringify(settings, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'clockboard-settings.json';
    link.click();
    URL.revokeObjectURL(url);
  }

  async function importSettings(file: File | null) {
    if (!file) return;
    try {
      const imported = normalizeSettings(JSON.parse(await file.text()));
      await persistSettings(imported);
      clearDraft();
      message = 'Settings imported.';
    } catch (error) {
      message = error instanceof Error ? error.message : 'Settings import failed.';
    }
  }
</script>

<main class="options-shell">
  <header class="page-header">
    <div>
      <p class="eyebrow">Clockboard</p>
      <h1>Options</h1>
    </div>
    <div class="header-actions">
      <button type="button" on:click={exportSettings}>Export</button>
      <label class="file-button">
        Import
        <input
          type="file"
          accept="application/json"
          on:change={(event) => importSettings(event.currentTarget.files?.[0] ?? null)}
        />
      </label>
      <button type="button" class="danger" on:click={resetAll}>Reset</button>
    </div>
  </header>

  {#if $settingsState.status.fallbackReason}
    <p class="notice">Using {$settingsState.status.area} storage: {$settingsState.status.fallbackReason}</p>
  {/if}
  {#if message}
    <p class="notice">{message}</p>
  {/if}

  <section class="settings-grid">
    <div class="panel">
      <h2>Clock</h2>
      <label class="field-row">
        <span>Time format</span>
        <select
          value={settings.clock.timeFormat}
          on:change={(event) =>
            updateSettings((current) => ({
              ...current,
              clock: { ...current.clock, timeFormat: event.currentTarget.value as 'system' | '12' | '24' },
              updatedAt: new Date().toISOString()
            }))}
        >
          <option value="system">System default</option>
          <option value="12">12-hour</option>
          <option value="24">24-hour</option>
        </select>
      </label>

      <label class="field-row">
        <span>Font scale</span>
        <input
          type="range"
          min="0.8"
          max="1.5"
          step="0.05"
          value={settings.clock.fontScale}
          on:input={(event) =>
            updateSettings((current) => ({
              ...current,
              clock: { ...current.clock, fontScale: Number(event.currentTarget.value) },
              updatedAt: new Date().toISOString()
            }))}
        />
      </label>

      <label class="switch-row">
        <input
          type="checkbox"
          checked={settings.clock.showSeconds}
          on:change={(event) =>
            updateSettings((current) => ({
              ...current,
              clock: { ...current.clock, showSeconds: event.currentTarget.checked },
              updatedAt: new Date().toISOString()
            }))}
        />
        Show seconds
      </label>
      <label class="switch-row">
        <input
          type="checkbox"
          checked={settings.clock.showDate}
          on:change={(event) =>
            updateSettings((current) => ({
              ...current,
              clock: { ...current.clock, showDate: event.currentTarget.checked },
              updatedAt: new Date().toISOString()
            }))}
        />
        Show date
      </label>
      <label class="switch-row">
        <input
          type="checkbox"
          checked={settings.clock.showGreeting}
          on:change={(event) =>
            updateSettings((current) => ({
              ...current,
              clock: { ...current.clock, showGreeting: event.currentTarget.checked },
              updatedAt: new Date().toISOString()
            }))}
        />
        Show greeting
      </label>
      <label class="switch-row">
        <input
          type="checkbox"
          checked={settings.clock.showCountdown}
          on:change={(event) =>
            updateSettings((current) => ({
              ...current,
              clock: { ...current.clock, showCountdown: event.currentTarget.checked },
              updatedAt: new Date().toISOString()
            }))}
        />
        Show countdown
      </label>
    </div>

    <div class="panel">
      <h2>Countdowns</h2>
      <p class="muted">{settings.countdowns.length} of {MAX_COUNTDOWNS} saved</p>
      <div class="countdown-list">
        {#each settings.countdowns as countdown}
          <div class="countdown-row">
            <label>
              <input
                type="radio"
                name="active-countdown"
                checked={settings.activeCountdownId === countdown.id}
                on:change={() => updateSettings((current) => setActiveCountdown(current, countdown.id))}
              />
              <span>{countdown.name}</span>
            </label>
            <div>
              <button type="button" on:click={() => beginEdit(countdown)}>Edit</button>
              <button type="button" class="danger" on:click={() => deleteCountdown(countdown.id)}>Remove</button>
            </div>
          </div>
        {:else}
          <p class="empty-copy">No countdowns yet. Add a future event below.</p>
        {/each}
      </div>

      <form
        class="countdown-form"
        on:submit|preventDefault={() => {
          saveCountdown();
        }}
      >
        <h3>{editing ? 'Edit countdown' : 'Add countdown'}</h3>
        <label class="field-row">
          <span>Name</span>
          <input bind:value={draftName} maxlength="80" placeholder="Launch day" />
        </label>
        <label class="field-row">
          <span>Date and time</span>
          <input type="datetime-local" bind:value={draftTarget} />
        </label>
        <div class="form-actions">
          <button type="submit">{editing ? 'Save changes' : 'Add countdown'}</button>
          {#if editing}
            <button type="button" on:click={clearDraft}>Cancel</button>
          {/if}
        </div>
      </form>
    </div>
  </section>
</main>
