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
    window.location.href = 'options.html';
  }

  $: settings = $settingsState.settings;
</script>

<main class="newtab-shell" aria-busy={!$settingsState.ready}>
  <button
    class="icon-button settings-button"
    type="button"
    aria-label="Open options"
    on:click={openOptions}
  >
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path
        d="M12 8.25a3.75 3.75 0 1 0 0 7.5 3.75 3.75 0 0 0 0-7.5Zm0-6 1.2 2.35c.55.16 1.07.38 1.56.65l2.5-.82 2.25 3.9-1.94 1.58c.07.34.1.7.1 1.09s-.03.75-.1 1.09l1.94 1.58-2.25 3.9-2.5-.82c-.49.27-1.01.49-1.56.65L12 21.75 10.8 19.4a7.72 7.72 0 0 1-1.56-.65l-2.5.82-2.25-3.9 1.94-1.58a7.2 7.2 0 0 1-.1-1.09c0-.39.03-.75.1-1.09L4.49 8.33l2.25-3.9 2.5.82c.49-.27 1.01-.49 1.56-.65L12 2.25Z"
      />
    </svg>
  </button>

  <ClockboardList {settings} {now} />
</main>
