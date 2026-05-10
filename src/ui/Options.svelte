<script lang="ts">
  import { onMount } from 'svelte';

  import { createDefaultSettings } from '../lib/defaults';
  import {
    addCountdown,
    moveClockboardItemBefore,
    moveClockboardItemBy,
    removeCountdown,
    setClockboardItemVisibility,
    updateCountdown,
    normalizeSettings
  } from '../lib/settings';
  import {
    MAX_COUNTDOWNS,
    type ClockboardItem,
    type Countdown
  } from '../lib/types';
  import {
    initializeSettings,
    persistSettings,
    updateSettings,
    settingsState
  } from './settingsStore';

  let message = '';
  let editingId: string | null = null;
  let draftName = '';
  let draftTarget = '';
  let draggingId: string | null = null;

  onMount(() => {
    initializeSettings();
  });

  $: settings = $settingsState.settings;
  $: editing =
    settings.countdowns.find((countdown) => countdown.id === editingId) ?? null;

  function countdownFor(item: ClockboardItem): Countdown | null {
    if (!item.countdownId) return null;
    return (
      settings.countdowns.find(
        (countdown) => countdown.id === item.countdownId
      ) ?? null
    );
  }

  function itemTitle(item: ClockboardItem): string {
    if (item.type === 'clock') return 'Current time';
    if (item.type === 'date') return 'Date and greeting';
    return countdownFor(item)?.name ?? 'Empty countdown';
  }

  function itemMeta(item: ClockboardItem): string {
    if (item.type === 'clock') return 'Digital clock display';
    if (item.type === 'date') return 'Localized date with time-of-day greeting';
    const countdown = countdownFor(item);
    return countdown
      ? countdown.targetLocal.replace('T', ' ')
      : 'Shown until a countdown is added';
  }

  function typeLabel(item: ClockboardItem): string {
    if (item.type === 'clock') return 'Clock';
    if (item.type === 'date') return 'Date';
    return 'Countdown';
  }

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
          ? updateCountdown(current, editingId, {
              name: draftName,
              targetLocal: draftTarget
            })
          : addCountdown(current, { name: draftName, targetLocal: draftTarget })
      );
      clearDraft();
      message = 'Countdown saved.';
    } catch (error) {
      message =
        error instanceof Error
          ? error.message
          : 'Countdown could not be saved.';
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
    const blob = new Blob([JSON.stringify(settings, null, 2)], {
      type: 'application/json'
    });
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
      message =
        error instanceof Error ? error.message : 'Settings import failed.';
    }
  }

  function dragStart(event: DragEvent, itemId: string) {
    draggingId = itemId;
    event.dataTransfer?.setData('text/plain', itemId);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
  }

  function dragOver(event: DragEvent) {
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
  }

  async function dropBefore(event: DragEvent, targetId: string) {
    event.preventDefault();
    const sourceId = event.dataTransfer?.getData('text/plain') || draggingId;
    draggingId = null;
    if (!sourceId) return;
    await updateSettings((current) =>
      moveClockboardItemBefore(current, sourceId, targetId)
    );
    message = 'Clockboard order updated.';
  }

  async function moveItemBy(itemId: string, offset: -1 | 1) {
    await updateSettings((current) =>
      moveClockboardItemBy(current, itemId, offset)
    );
    message = 'Clockboard order updated.';
  }

  async function setItemVisibility(itemId: string, visible: boolean) {
    await updateSettings((current) =>
      setClockboardItemVisibility(current, itemId, visible)
    );
    message = 'Clockboard visibility updated.';
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
          on:change={(event) =>
            importSettings(event.currentTarget.files?.[0] ?? null)}
        />
      </label>
      <button type="button" class="danger" on:click={resetAll}>Reset</button>
    </div>
  </header>

  {#if $settingsState.status.fallbackReason}
    <p class="notice">
      Using {$settingsState.status.area} storage: {$settingsState.status
        .fallbackReason}
    </p>
  {/if}
  {#if message}
    <p class="notice">{message}</p>
  {/if}

  <section class="builder-panel" aria-label="Clockboard builder">
    <div class="builder-header">
      <div>
        <h2>Clockboard items</h2>
        <p class="muted">Drag rows to set the new tab and popup order.</p>
      </div>
      <p class="item-count">{settings.clockboard.items.length} items</p>
    </div>

    <div class="item-builder" role="list">
      {#each settings.clockboard.items as item, index (item.id)}
        <div
          class:dragging={draggingId === item.id}
          class="builder-row"
          role="listitem"
          on:dragover={dragOver}
          on:drop={(event) => dropBefore(event, item.id)}
        >
          <span
            class="drag-handle"
            draggable="true"
            role="button"
            tabindex="0"
            aria-label={`Drag ${itemTitle(item)}`}
            on:dragstart={(event) => dragStart(event, item.id)}
            on:dragend={() => (draggingId = null)}
          >
            <span aria-hidden="true">::</span>
          </span>
          <div class="row-main">
            <div class="row-title-line">
              <strong>{itemTitle(item)}</strong>
              <span>{typeLabel(item)}</span>
            </div>
            <p class="muted">{itemMeta(item)}</p>
          </div>
          <label class="visibility-toggle">
            <input
              type="checkbox"
              checked={item.visible}
              on:change={(event) =>
                setItemVisibility(item.id, event.currentTarget.checked)}
            />
            Visible
          </label>
          <div class="row-actions">
            <button
              type="button"
              aria-label={`Move ${itemTitle(item)} up`}
              disabled={index === 0}
              on:click={() => moveItemBy(item.id, -1)}
            >
              Up
            </button>
            <button
              type="button"
              aria-label={`Move ${itemTitle(item)} down`}
              disabled={index === settings.clockboard.items.length - 1}
              on:click={() => moveItemBy(item.id, 1)}
            >
              Down
            </button>
          </div>
        </div>
      {/each}
    </div>

    <div class="builder-grid">
      <section class="settings-group">
        <h2>Clock</h2>
        <label class="field-row">
          <span>Time format</span>
          <select
            value={settings.clock.timeFormat}
            on:change={(event) =>
              updateSettings((current) => ({
                ...current,
                clock: {
                  ...current.clock,
                  timeFormat: event.currentTarget.value as
                    | 'system'
                    | '12'
                    | '24'
                },
                updatedAt: new Date().toISOString()
              }))}
          >
            <option value="system">System default</option>
            <option value="12">12-hour</option>
            <option value="24">24-hour</option>
          </select>
        </label>

        <label class="field-row">
          <span>Clock scale</span>
          <input
            type="range"
            min="0.8"
            max="1.5"
            step="0.05"
            value={settings.clock.fontScale}
            on:input={(event) =>
              updateSettings((current) => ({
                ...current,
                clock: {
                  ...current.clock,
                  fontScale: Number(event.currentTarget.value)
                },
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
                clock: {
                  ...current.clock,
                  showSeconds: event.currentTarget.checked
                },
                updatedAt: new Date().toISOString()
              }))}
          />
          Show seconds
        </label>
      </section>

      <section class="settings-group">
        <h2>Countdowns</h2>
        <p class="muted">
          {settings.countdowns.length} of {MAX_COUNTDOWNS} saved
        </p>

        <div class="countdown-list">
          {#each settings.countdowns as countdown}
            <div class="countdown-row">
              <div>
                <strong>{countdown.name}</strong>
                <p class="muted">{countdown.targetLocal.replace('T', ' ')}</p>
              </div>
              <div>
                <button type="button" on:click={() => beginEdit(countdown)}>
                  Edit
                </button>
                <button
                  type="button"
                  class="danger"
                  on:click={() => deleteCountdown(countdown.id)}
                >
                  Remove
                </button>
              </div>
            </div>
          {:else}
            <p class="empty-copy">
              No countdowns yet. Add a future event below.
            </p>
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
            <input
              bind:value={draftName}
              maxlength="80"
              placeholder="Launch day"
            />
          </label>
          <label class="field-row">
            <span>Date and time</span>
            <input type="datetime-local" bind:value={draftTarget} />
          </label>
          <div class="form-actions">
            <button type="submit">
              {editing ? 'Save changes' : 'Add countdown'}
            </button>
            {#if editing}
              <button type="button" on:click={clearDraft}>Cancel</button>
            {/if}
          </div>
        </form>
      </section>
    </div>
  </section>
</main>
