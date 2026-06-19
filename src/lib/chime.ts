// A soft two-note chime played with the Web Audio API — no bundled asset and no
// network. Used (opt-in) when a timer reaches zero.

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

// Warm up the audio context from a user gesture (e.g. pressing Start) so the
// later, gesture-less chime is allowed to play under autoplay policies.
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
