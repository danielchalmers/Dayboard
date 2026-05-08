<script lang="ts">
  import { onMount } from 'svelte';

  import { getChromeRuntime } from '../lib/browser';
  import { getActiveCountdown } from '../lib/time';
  import ClockFace from './ClockFace.svelte';
  import CountdownView from './CountdownView.svelte';
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
    window.location.href = 'options.html';
  }

  $: settings = $settingsState.settings;
  $: activeCountdown = getActiveCountdown(settings.countdowns, settings.activeCountdownId);
</script>

<main class="newtab-shell" aria-busy={!$settingsState.ready}>
  <button class="icon-button settings-button" type="button" aria-label="Open options" on:click={openOptions}>
    <span aria-hidden="true">Options</span>
  </button>

  <ClockFace {now} clock={settings.clock} />

  {#if settings.clock.showCountdown}
    <CountdownView countdown={activeCountdown} {now} />
  {/if}
</main>
