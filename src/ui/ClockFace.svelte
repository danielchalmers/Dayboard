<script lang="ts">
  import { formatClock, formatDate, greetingFor } from '../lib/time';
  import type { ClockPreferences } from '../lib/types';

  export let now: Date;
  export let clock: ClockPreferences;
</script>

<section class="clock-face" style={`--clock-scale: ${clock.fontScale}`}>
  {#if clock.showGreeting}
    <p class="eyebrow">{greetingFor(now)}</p>
  {/if}
  <h1>{formatClock(now, clock.timeFormat, clock.showSeconds)}</h1>
  {#if clock.showDate}
    <p class="date-line">{formatDate(now)}</p>
  {/if}
</section>
