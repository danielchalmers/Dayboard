// @vitest-environment jsdom

import { act, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { ARCHIVE_NOTICE_MS, ArchiveNotice } from "./ArchiveNotice"

describe("ArchiveNotice", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("names the archived card and undoes from its button", () => {
    const onUndo = vi.fn()
    render(<ArchiveNotice onExpire={() => {}} onUndo={onUndo} title="Launch" />)

    expect(screen.getByText("Archived Launch")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Undo" }))

    expect(onUndo).toHaveBeenCalledOnce()
  })

  it("lets itself go after a few seconds", () => {
    const onExpire = vi.fn()
    render(<ArchiveNotice onExpire={onExpire} onUndo={() => {}} title="Launch" />)

    act(() => {
      vi.advanceTimersByTime(ARCHIVE_NOTICE_MS - 1)
    })
    expect(onExpire).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(onExpire).toHaveBeenCalledOnce()
  })

  // The board re-renders around the notice for reasons of its own (a sync from another tab), and each render hands over a new callback.
  it("keeps counting from the archive when the page hands it a new callback", () => {
    const onExpire = vi.fn()
    const { rerender } = render(
      <ArchiveNotice onExpire={() => {}} onUndo={() => {}} title="Launch" />
    )

    act(() => {
      vi.advanceTimersByTime(ARCHIVE_NOTICE_MS - 1000)
    })
    rerender(<ArchiveNotice onExpire={onExpire} onUndo={() => {}} title="Launch" />)
    act(() => {
      vi.advanceTimersByTime(1000)
    })

    expect(onExpire).toHaveBeenCalledOnce()
  })

  // Vanishing just as the pointer or the keyboard reaches Undo would turn the one way back into a race.
  it("waits while a pointer rests on it or its button has focus", () => {
    const onExpire = vi.fn()
    render(<ArchiveNotice onExpire={onExpire} onUndo={() => {}} title="Launch" />)

    const undo = screen.getByRole("button", { name: "Undo" })
    const notice = undo.parentElement!

    fireEvent.pointerEnter(notice)
    act(() => {
      vi.advanceTimersByTime(ARCHIVE_NOTICE_MS * 2)
    })
    expect(onExpire).not.toHaveBeenCalled()

    // Focus still holds it once the pointer has gone.
    act(() => {
      undo.focus()
    })
    fireEvent.pointerLeave(notice)
    act(() => {
      vi.advanceTimersByTime(ARCHIVE_NOTICE_MS * 2)
    })
    expect(onExpire).not.toHaveBeenCalled()

    // Let go of both, and it gets a full few seconds again rather than whatever was left.
    act(() => {
      undo.blur()
    })
    act(() => {
      vi.advanceTimersByTime(ARCHIVE_NOTICE_MS - 1)
    })
    expect(onExpire).not.toHaveBeenCalled()
    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(onExpire).toHaveBeenCalledOnce()
  })
})
