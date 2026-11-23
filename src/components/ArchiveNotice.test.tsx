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
    render(
      <ArchiveNotice onExpire={() => {}} onUndo={onUndo} onUndoShortcut={() => {}} title="Launch" />
    )

    expect(screen.getByText(/^Archived/)).toHaveTextContent(/^Archived Launch$/)
    fireEvent.click(screen.getByRole("button", { name: "Undo" }))

    expect(onUndo).toHaveBeenCalledOnce()
  })

  it("sets the title apart from the line, so a right-to-left one keeps its punctuation", () => {
    render(
      <ArchiveNotice
        onExpire={() => {}}
        onUndo={() => {}}
        onUndoShortcut={() => {}}
        title="مذكرات!"
      />
    )

    expect(screen.getByText("مذكرات!").tagName).toBe("BDI")
  })

  it("lets itself go after a few seconds", () => {
    const onExpire = vi.fn()
    render(
      <ArchiveNotice
        onExpire={onExpire}
        onUndo={() => {}}
        onUndoShortcut={() => {}}
        title="Launch"
      />
    )

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
      <ArchiveNotice
        onExpire={() => {}}
        onUndo={() => {}}
        onUndoShortcut={() => {}}
        title="Launch"
      />
    )

    act(() => {
      vi.advanceTimersByTime(ARCHIVE_NOTICE_MS - 1000)
    })
    rerender(
      <ArchiveNotice
        onExpire={onExpire}
        onUndo={() => {}}
        onUndoShortcut={() => {}}
        title="Launch"
      />
    )
    act(() => {
      vi.advanceTimersByTime(1000)
    })

    expect(onExpire).toHaveBeenCalledOnce()
  })

  // Vanishing just as the pointer or the keyboard reaches Undo would turn the one way back into a race.
  it("waits while a pointer rests on it or its button has focus", () => {
    const onExpire = vi.fn()
    render(
      <ArchiveNotice
        onExpire={onExpire}
        onUndo={() => {}}
        onUndoShortcut={() => {}}
        title="Launch"
      />
    )

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

  // From the keyboard the button is a whole board of Tabs away, and the notice does not wait that long.
  describe("the undo key", () => {
    const renderNotice = (onUndoShortcut: () => void) =>
      render(
        <ArchiveNotice
          onExpire={() => {}}
          onUndo={() => {}}
          onUndoShortcut={onUndoShortcut}
          title="Launch"
        />
      )

    it("undoes on Ctrl+Z or Cmd+Z from anywhere on the board", () => {
      const onUndoShortcut = vi.fn()
      renderNotice(onUndoShortcut)

      fireEvent.keyDown(document.body, { key: "z", ctrlKey: true })
      fireEvent.keyDown(document.body, { key: "Z", metaKey: true })

      expect(onUndoShortcut).toHaveBeenCalledTimes(2)
      expect(screen.getByRole("button", { name: "Undo" })).toHaveAttribute(
        "aria-keyshortcuts",
        "Control+Z Meta+Z"
      )
    })

    it("leaves the key alone where it already means something", () => {
      const onUndoShortcut = vi.fn()
      renderNotice(onUndoShortcut)
      const field = document.body.appendChild(document.createElement("textarea"))
      const dialog = document.body.appendChild(document.createElement("dialog"))
      const inDialog = dialog.appendChild(document.createElement("button"))

      // A note has typing of its own to take back, and a dialog open over the board is not where the board is changed from.
      fireEvent.keyDown(field, { key: "z", ctrlKey: true })
      fireEvent.keyDown(inDialog, { key: "z", ctrlKey: true })
      // Redo, a plain z, and a key held down are not the key.
      fireEvent.keyDown(document.body, { key: "z", ctrlKey: true, shiftKey: true })
      fireEvent.keyDown(document.body, { key: "z" })
      fireEvent.keyDown(document.body, { key: "z", ctrlKey: true, repeat: true })

      expect(onUndoShortcut).not.toHaveBeenCalled()

      field.remove()
      dialog.remove()
    })

    // A refused save takes the notice's place, and there is then no Undo on screen to press either.
    it("does nothing while the notice is hidden", () => {
      const onUndoShortcut = vi.fn()
      render(
        <div hidden>
          <ArchiveNotice
            onExpire={() => {}}
            onUndo={() => {}}
            onUndoShortcut={onUndoShortcut}
            title="Launch"
          />
        </div>
      )

      fireEvent.keyDown(document.body, { key: "z", ctrlKey: true })

      expect(onUndoShortcut).not.toHaveBeenCalled()
    })

    it("stops listening once the notice has gone", () => {
      const onUndoShortcut = vi.fn()
      const { unmount } = renderNotice(onUndoShortcut)

      unmount()
      fireEvent.keyDown(document.body, { key: "z", ctrlKey: true })

      expect(onUndoShortcut).not.toHaveBeenCalled()
    })
  })
})
