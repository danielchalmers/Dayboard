import { afterEach, describe, expect, it, vi } from "vitest"

import { playChime } from "./chime"

afterEach(() => {
  vi.unstubAllGlobals()
  vi.resetModules()
})

describe("playChime", () => {
  it("does nothing when the Web Audio API is unavailable", () => {
    // jsdom has no AudioContext, so this must no-op rather than throw.
    expect(() => playChime()).not.toThrow()
  })

  it("schedules oscillators when an audio context is available", async () => {
    const start = vi.fn()
    const stop = vi.fn()
    const connect = vi.fn(() => ({ connect: vi.fn() }))

    const createOscillator = vi.fn(() => ({
      type: "sine",
      frequency: { value: 0 },
      connect,
      start,
      stop
    }))
    const createGain = vi.fn(() => ({
      gain: {
        setValueAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn()
      },
      connect
    }))

    class FakeAudioContext {
      currentTime = 0
      state = "running"
      destination = {}
      createOscillator = createOscillator
      createGain = createGain
      resume = vi.fn()
    }

    vi.stubGlobal("AudioContext", FakeAudioContext)

    const { playChime: play } = await import("./chime")
    play()

    expect(createOscillator).toHaveBeenCalledTimes(2)
    expect(start).toHaveBeenCalledTimes(2)
    expect(stop).toHaveBeenCalledTimes(2)
  })
})
