<script lang="ts">
  import { onMount } from 'svelte';

  import { getChromeRuntime } from '../lib/browser';
  import ClockboardList from './ClockboardList.svelte';
  import { initializeSettings, settingsState } from './settingsStore';

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
</script>

<main class="popup-shell">
  <header>
    <strong>Clockboard</strong>
    <button type="button" on:click={openOptions}>Options</button>
  </header>

  <ClockboardList {settings} {now} compact limit={4} />

  {#if $settingsState.status.fallbackReason}
    <p class="notice">
      Using {$settingsState.status.area} storage: {$settingsState.status
        .fallbackReason}
    </p>
  {/if}
</main>
