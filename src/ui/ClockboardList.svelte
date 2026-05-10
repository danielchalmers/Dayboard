<script lang="ts">
  import {
    formatClock,
    formatCountdown,
    formatDate,
    greetingFor
  } from '../lib/time';
  import type {
    ClockboardItem,
    ClockboardSettings,
    Countdown
  } from '../lib/types';

  export let settings: ClockboardSettings;
  export let now: Date;
  export let compact = false;
  export let limit: number | null = null;

  $: visibleItems = settings.clockboard.items.filter((item) => item.visible);
  $: displayItems =
    limit === null ? visibleItems : visibleItems.slice(0, Math.max(0, limit));

  function countdownFor(item: ClockboardItem): Countdown | null {
    if (!item.countdownId) return null;
    return (
      settings.countdowns.find(
        (countdown) => countdown.id === item.countdownId
      ) ?? null
    );
  }
</script>

<div
  class:compact
  class="clockboard-list"
  style={`--clock-scale: ${settings.clock.fontScale}`}
>
  {#each displayItems as item (item.id)}
    <section class="clockboard-item" data-type={item.type}>
      {#if item.type === 'clock'}
        <p class="item-label">Now</p>
        <h1 class="clock-value">
          {formatClock(
            now,
            settings.clock.timeFormat,
            settings.clock.showSeconds
          )}
        </h1>
      {:else if item.type === 'date'}
        <p class="item-label">{greetingFor(now)}</p>
        <p class="date-value">{formatDate(now)}</p>
      {:else}
        {@const countdown = countdownFor(item)}
        {#if countdown}
          {@const display = formatCountdown(countdown.targetLocal, now)}
          <p class="item-label">
            {display.completed
              ? `${countdown.name} completed`
              : `${display.label} until ${countdown.name}`}
          </p>
          <h2 class="countdown-title">{countdown.name}</h2>
          <div
            class="unit-list"
            aria-label={`Time remaining for ${countdown.name}`}
          >
            {#each display.units as unit}
              <span class="unit-pill">
                <strong>{unit.value}</strong>
                <span>{unit.label}</span>
              </span>
            {/each}
          </div>
        {:else}
          <p class="item-label">Countdown</p>
          <h2 class="countdown-title">No countdown yet</h2>
          <p class="item-note">Add a future event in Options.</p>
        {/if}
      {/if}
    </section>
  {/each}
</div>
