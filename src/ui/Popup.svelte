<script lang="ts">
  import { onMount } from 'svelte';

  import { getChromeRuntime } from '../lib/browser';
  import { getActiveCountdown } from '../lib/time';
  import CountdownView from './CountdownView.svelte';
  import { initializeSettings, updateSettings, settingsState } from './settingsStore';

  let now = new Date();

  onMount(() => {
    initializeSettings();
    const timer = window.setInterval(() => {
      now = new Date();
    }, 1000);
    return () => window.clearInterval(timer);
  });

  function openOptions() {
    const runtime = getChromeRuntime();
    if (runtime?.openOptionsPage) {
      runtime.openOptionsPage();
      return;
    }
    window.open('options.html', '_blank', 'noopener,noreferrer');
  }

  $: settings = $settingsState.settings;
  $: activeCountdown = getActiveCountdown(settings.countdowns, settings.activeCountdownId);
</script>

<main class="popup-shell">
  <header>
    <strong>Clockboard</strong>
    <button type="button" on:click={openOptions}>Options</button>
  </header>

  <CountdownView countdown={settings.clock.showCountdown ? activeCountdown : null} {now} compact />

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
    Show countdown on new tab
  </label>

  {#if settings.countdowns.length > 0}
    <label class="field-row">
      <span>Active countdown</span>
      <select
        value={settings.activeCountdownId ?? ''}
        on:change={(event) =>
          updateSettings((current) => ({
            ...current,
            activeCountdownId: event.currentTarget.value || null,
            updatedAt: new Date().toISOString()
          }))}
      >
        {#each settings.countdowns as countdown}
          <option value={countdown.id}>{countdown.name}</option>
        {/each}
      </select>
    </label>
  {/if}

  {#if $settingsState.status.fallbackReason}
    <p class="notice">Using {$settingsState.status.area} storage: {$settingsState.status.fallbackReason}</p>
  {/if}
</main>
