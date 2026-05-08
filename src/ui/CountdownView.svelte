<script lang="ts">
  import { formatCountdown } from '../lib/time';
  import type { Countdown } from '../lib/types';

  export let countdown: Countdown | null;
  export let now: Date;
  export let compact = false;

  $: display = countdown ? formatCountdown(countdown.targetLocal, now) : null;
</script>

<section class:compact class="countdown-view">
  {#if countdown && display}
    <p class="eyebrow">
      {display.completed ? 'Countdown complete' : 'Next countdown'}
    </p>
    <h2>{countdown.name}</h2>
    <div class="unit-grid" aria-label={display.label}>
      {#each display.units as unit}
        <div class="unit">
          <strong>{unit.value}</strong>
          <span>{unit.label}</span>
        </div>
      {/each}
    </div>
    <p class="target-line">
      {display.completed ? 'Completed' : 'Target'}:
      {new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short'
      }).format(new Date(countdown.targetLocal))}
    </p>
  {:else}
    <p class="eyebrow">Countdowns</p>
    <h2>No countdown yet</h2>
    <p class="empty-copy">Add a future event in options to show it here.</p>
  {/if}
</section>
