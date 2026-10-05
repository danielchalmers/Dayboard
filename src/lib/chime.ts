// A soft two-note chime played with the Web Audio API, so there is no bundled asset and no network.
// Used (opt-in) when a timer reaches zero.

type AudioContextCtor = typeof AudioContext

let context: AudioContext | null = null

const getContext = (): AudioContext | null => {
  if (typeof window === "undefined") {
    return null
  }

  const Ctor: AudioContextCtor | undefined =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: AudioContextCtor })
      .webkitAudioContext

  if (!Ctor) {
    return null
  }

  if (!context) {
    context = new Ctor()
  }

  return context
}

// Make the audio context ready from the Start press.
// Chromium and Edge let an extension page play sound with no gesture at all, so the chime does not depend on this; it stays as a cheap hedge for a browser that holds audio back until the page is used.
export const primeChime = (): void => {
  const ctx = getContext()
  if (ctx && ctx.state === "suspended") {
    void ctx.resume()
  }
}

export const playChime = (): void => {
  const ctx = getContext()
  if (!ctx) {
    return
  }

  if (ctx.state === "suspended") {
    void ctx.resume()
  }

  const start = ctx.currentTime
  // A gentle rising two-note motif (A5 → E6).
  ;[880, 1318.51].forEach((frequency, index) => {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    const at = start + index * 0.18

    osc.type = "sine"
    osc.frequency.value = frequency
    gain.gain.setValueAtTime(0, at)
    gain.gain.linearRampToValueAtTime(0.14, at + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.5)

    osc.connect(gain).connect(ctx.destination)
    osc.start(at)
    osc.stop(at + 0.55)
  })
}

// Play the chime for one event (`key`) once, however many Dayboard tabs reach it.
// Every open board keeps its own watch on a running timer, and an extension page may play sound without a gesture, so a board left open in three tabs would sound one finish three times over.
// A lock shared by the extension's tabs lets the first one there chime and the rest stand down; it is held for `holdMs` after, so a tab that background throttling wakes a little later still finds it taken.
export const playChimeOnce = (key: string, holdMs: number): void => {
  const locks = typeof navigator === "undefined" ? undefined : navigator.locks

  if (!locks) {
    playChime()
    return
  }

  void locks.request(`dayboard-chime:${key}`, { ifAvailable: true }, (lock) => {
    if (!lock) {
      return
    }

    playChime()

    return new Promise<void>((resolve) => setTimeout(resolve, holdMs))
  })
}
