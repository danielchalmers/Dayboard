import { COLOR_PRESETS } from "./colors"
import {
  DEFAULT_SETTINGS,
  createDefaultState,
  type CountdownRepeat,
  type CountdownWidget,
  type DayboardSettings,
  type DayboardState,
  type UnknownWidget,
  type Widget
} from "./types"
import { normalizeHistory } from "./habit"
import { normalizeTasks } from "./todo"
import { DEFAULT_TIMER_DURATION_MS, widgetRegistry } from "./widgets"

// chrome.storage.sync caps one item at 8,192 bytes, and the whole board used to share one, so a long quote list or note could fill it for every card.
// The board is now kept one card to an item, each under its id, with a small item beside them for the order and the settings; sync's own limits (102,400 bytes and 512 items in all) are the ones left.
export const BOARD_KEY = "dayboard-board"
export const CARD_PREFIX = "dayboard-card:"
// The one item the whole board was kept in up to v0.9, which a board is still read from until its first save here.
export const LEGACY_KEY = "dayboard-state"
export const CACHE_KEY = "dayboard-state-cache"

type StoredItems = Record<string, unknown>

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const hasWidgets = (value: unknown): value is { widgets: unknown[] } =>
  typeof value === "object" &&
  value !== null &&
  Array.isArray((value as { widgets?: unknown }).widgets)

type StoredWidget = UnknownWidget["widget"]

// Keep only entries that look like widgets, so a hand-edited or imported file with junk rows renders the valid widgets instead of blank cards.
// A settings object has to be among them: normalization and the cards both read straight through it, so an entry missing one throws on the way in and takes the whole board with it rather than being dropped like the rest of the junk.
const isWidgetShaped = (value: unknown): value is StoredWidget =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as StoredWidget).id === "string" &&
  typeof (value as StoredWidget).kind === "string" &&
  typeof (value as StoredWidget).settings === "object" &&
  (value as StoredWidget).settings !== null

// An own key, not `in`: the registry is a plain object, so `in` also lets through kinds such as "toString" off its prototype.
const isKnownWidget = (widget: StoredWidget): widget is Widget =>
  Object.hasOwn(widgetRegistry, widget.kind)

// Options that v0.5 had and later versions took away.
// A setting this build doesn't know is carried for the newer version that wrote it, but these are known to be gone, so a board last saved by v0.5 sheds them on its first save, as it did under v0.8, rather than carrying them forever.
const RETIRED_SETTINGS = ["dragToMove", "columns", "chimeOnTimerEnd", "dockToBottom"]

// Fill any missing or malformed fields with their defaults so a partial or hand-edited imported board still loads cleanly, and carry the rest through for the version that wrote them.
const normalizeSettings = (value: unknown): DayboardSettings => {
  const stored = (
    typeof value === "object" && value !== null && !Array.isArray(value) ? value : {}
  ) as Partial<DayboardSettings>
  const current = Object.fromEntries(
    Object.entries(stored).filter(([key]) => !RETIRED_SETTINGS.includes(key))
  ) as Partial<DayboardSettings>

  return {
    ...current,
    name: typeof stored.name === "string" ? stored.name : DEFAULT_SETTINGS.name
  }
}

const REPEATS: CountdownRepeat[] = ["none", "hourly", "daily", "weekly", "monthly", "yearly"]

const text = (value: unknown): string => (typeof value === "string" ? value : "")

const span = (value: unknown, fallback: number): number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : fallback

const instant = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null

type StoredSettings = Record<string, unknown>

// Countdowns used to carry a `display` setting choosing between the remaining time and a progress bar; a start date is now the only switch.
// Boards written before that still carry the key, so retire it on read, dropping the start alongside it when the card was set to text, which would otherwise come back as a bar the owner never asked for.
// A repeat this build does not know is dropped rather than stepped by, since stepping by it runs the target off into an invalid date that throws on its way to the screen.
// The zone the dates were set in is kept only as text; whether it names a real zone is asked when the dates are read (see `localizeCountdown` in time.ts).
const normalizeCountdown = ({
  display,
  startAt,
  repeat,
  timeZone,
  ...settings
}: StoredSettings): CountdownWidget["settings"] => {
  const known = REPEATS.find((option) => option === repeat)

  return {
    ...settings,
    targetAt: text(settings["targetAt"]),
    ...(typeof timeZone === "string" && timeZone ? { timeZone } : {}),
    ...(typeof startAt === "string" && (display === undefined || display === "progress")
      ? { startAt }
      : {}),
    ...(known ? { repeat: known } : {})
  }
}

// Every card reads its settings straight from render, so one field of the wrong type (a hand-edited import, or a board synced in from a different version of Dayboard) would throw there and blank the whole page.
// So each field a card reads is checked here and falls back to what a new card starts with, while fields this build doesn't know are carried through untouched for the version that wrote them.
// Habit history is pruned to the visible week: it was once stored unbounded, which after a year or two blew the sync per-item quota and made every save fail.
// Todo lists are held to the same limits the card enforces, so an imported file cannot arrive carrying more than a board can save.
// Neither rebuilds the settings around that one field, though: an older build that did would strip whatever a newer one keeps beside it the first time it saved.
const normalizeWidgetSettings = (
  kind: Widget["kind"],
  settings: StoredSettings
): Widget["settings"] => {
  switch (kind) {
    case "clock":
      return { ...settings, timeZone: text(settings["timeZone"]) }
    case "countdown":
      return normalizeCountdown(settings)
    case "note":
      return { ...settings, text: text(settings["text"]) }
    case "quote":
      return {
        ...settings,
        quotes: Array.isArray(settings["quotes"])
          ? settings["quotes"].filter((quote) => typeof quote === "string")
          : [],
        rotation: settings["rotation"] === "open" ? "open" : "daily"
      }
    case "stopwatch": {
      const startedAt = instant(settings["startedAt"])

      return {
        ...settings,
        running: settings["running"] === true && startedAt !== null,
        elapsedMs: span(settings["elapsedMs"], 0),
        startedAt
      }
    }
    case "timer": {
      const durationMs = span(settings["durationMs"], 0) || DEFAULT_TIMER_DURATION_MS
      const endsAt = instant(settings["endsAt"])

      return {
        ...settings,
        durationMs,
        running: settings["running"] === true && endsAt !== null,
        remainingMs: span(settings["remainingMs"], durationMs),
        endsAt,
        // Only a timer that has the switch gets it read back: stamping `chime: false` onto every timer saved without one made an upgraded board bigger on its first save, which a board near the sync limit can't afford.
        ...(settings["chime"] !== undefined ? { chime: settings["chime"] === true } : {})
      }
    }
    case "habit":
      return { ...settings, history: normalizeHistory(settings["history"]) }
    case "todo":
      return { ...settings, tasks: normalizeTasks(settings["tasks"]) }
  }
}

const HOUR_MS = 3_600_000

// Whether a span is one calendar year as some time zone counts it: it starts at a New Year's midnight and runs a year.
// It is judged against UTC rather than this device's zone, because a synced board is read in every zone its devices are in, a laptop travels, and a virtual machine runs in UTC.
// Every zone's New Year falls between 14 hours before UTC's (UTC+14) and 12 hours after it (UTC-12), and the year runs 365 or 366 days, with an hour's leeway for a zone that changed its offset in between (Almaty did in 2024).
const spansCalendarYear = (startAt: string, targetAt: string): boolean => {
  const start = new Date(startAt).getTime()
  const target = new Date(targetAt).getTime()

  if (Number.isNaN(start) || Number.isNaN(target)) {
    return false
  }

  const year = new Date(start + 14 * HOUR_MS).getUTCFullYear()
  const newYear = Date.UTC(year, 0, 1)
  const length = Date.UTC(year + 1, 0, 1) - newYear

  return (
    start - newYear >= -14 * HOUR_MS &&
    start - newYear <= 12 * HOUR_MS &&
    Math.abs(target - start - length) <= HOUR_MS
  )
}

// The settings that renewFirstRunYear filled in, as against ones read from storage or made by an edit since.
const renewedYears = new WeakSet<object>()

// The first-run "This year" card used to be saved as that one year's span with no repeat, so from New Year's Day it sat at Complete for good.
// It starts out repeating yearly now; a board saved with the old card, its span still the calendar year it was made in, reads as that too.
const renewFirstRunYear = (widget: Widget): Widget => {
  if (
    widget.id !== "year-progress" ||
    widget.kind !== "countdown" ||
    widget.settings.repeat !== undefined ||
    !widget.settings.startAt ||
    !spansCalendarYear(widget.settings.startAt, widget.settings.targetAt)
  ) {
    return widget
  }

  const settings = { ...widget.settings, repeat: "yearly" as const }
  renewedYears.add(settings)

  return { ...widget, settings }
}

// The other half: a repeat filled in on reading is left out of what is written, since every read fills it in again.
// Writing it would add 18 bytes to nearly every board the first time this release saved it, and a board at the sync limit would then refuse every save until something was trimmed.
// Only the settings the read made count, so a Yearly someone picked, on this card or any other, is written as it is.
const withoutRenewedYear = (widget: Widget): Widget => {
  if (widget.kind !== "countdown" || !renewedYears.has(widget.settings)) {
    return widget
  }

  const { repeat: _renewed, ...settings } = widget.settings

  return { ...widget, settings }
}

const normalizeWidget = ({ archived, ...widget }: Widget): Widget =>
  ({
    ...widget,
    title: text(widget.title),
    colorPreset: COLOR_PRESETS.some((preset) => preset.id === widget.colorPreset)
      ? widget.colorPreset
      : COLOR_PRESETS[0]!.id,
    ...(archived === true ? { archived } : {}),
    settings: normalizeWidgetSettings(widget.kind, widget.settings as unknown as StoredSettings)
  }) as Widget

// A widget whose id repeats one already seen is dropped: the board keys cards and routes edits by id, so a second card under the same one would render twice and take the first one's edits.
const uniqueIds = (widgets: StoredWidget[]): StoredWidget[] => {
  const seen = new Set<string>()

  return widgets.filter((widget) => {
    if (seen.has(widget.id)) {
      return false
    }

    seen.add(widget.id)
    return true
  })
}

// A kind this build doesn't know is a card a newer Dayboard made on another synced device, not junk.
// It stays off the board, since there is nothing here that can draw it, but it is set aside with its place in the list rather than dropped: the order is written back whole, and so is the board on its first save out of the old item, and a card left out of either would lose its place or be lost outright.
const normalizeState = (value: unknown): DayboardState => {
  if (!hasWidgets(value)) {
    return createDefaultState()
  }

  const widgets: Widget[] = []
  const unknownWidgets: UnknownWidget[] = []

  uniqueIds(value.widgets.filter(isWidgetShaped)).forEach((widget, index) => {
    if (isKnownWidget(widget)) {
      widgets.push(renewFirstRunYear(normalizeWidget(widget)))
    } else {
      unknownWidgets.push({ index, widget })
    }
  })

  return {
    widgets,
    settings: normalizeSettings((value as { settings?: unknown }).settings),
    ...(unknownWidgets.length > 0 ? { unknownWidgets } : {})
  }
}

// The board as an exported file and the mirror hold it, and as storage does between its items: one list of cards, with any this build can't show put back where they were.
// The places are where they stood when last read, so once the board around them has changed they are near where they were rather than exact, which is all a card this build never shows needs.
const toStoredState = ({ unknownWidgets, ...state }: DayboardState) => {
  const widgets: (Widget | StoredWidget)[] = state.widgets.map(withoutRenewedYear)
  unknownWidgets?.forEach(({ index, widget }) => widgets.splice(index, 0, widget))

  return { ...state, widgets }
}

const isCardKey = (key: string): boolean => key.startsWith(CARD_PREFIX)

// Whether storage holds the board one card to an item.
// A card with no board item beside it counts: sync carries each item on its own, so a device can be handed some of the cards before the item that orders them.
const isSplit = (items: StoredItems): boolean =>
  Object.hasOwn(items, BOARD_KEY) || Object.keys(items).some(isCardKey)

const MOVED_ID = "dayboard-moved"

// What the old item is left holding once the board has moved out of it, for a device whose Dayboard still reads only that item.
// Every release since v0.5 shows the first-run board when the item is missing, which looks like a board lost, so it holds one note saying where the board went instead.
// A later release can remove the item once those builds are gone, which is why a board that has no old item is never given one.
const movedNotice = () => ({
  widgets: [
    {
      id: MOVED_ID,
      kind: "note",
      title: "👋 Update on the way",
      colorPreset: "slate",
      settings: {
        text: "Your board is safe. A newer Dayboard on another device saved it, and it will be back here once this browser updates Dayboard too, which it does on its own."
      }
    }
  ]
})

// The note stays the sign of it however the build that shows it has added to or rearranged the item since.
const isMoved = (value: unknown): boolean =>
  hasWidgets(value) && value.widgets.some((widget) => isRecord(widget) && widget["id"] === MOVED_ID)

// The stored items as one board, in the shape the old item had and an exported file still has.
// A card is on the board when its own item is there, and the board item only says where it goes.
// Sync carries each item separately, so a device can hold any part of a change made elsewhere, and read this way every part is still a board: a card the order doesn't list yet goes at the end, and a card it lists that hasn't arrived, or has since been deleted, is passed over.
const boardFrom = (items: StoredItems): unknown => {
  if (!isSplit(items)) {
    const legacy = items[LEGACY_KEY]

    // The note with nothing beside it is a device the rest of the board hasn't reached yet, which has nothing of its own to show.
    return isMoved(legacy) ? undefined : legacy
  }

  const board = items[BOARD_KEY]
  const { order, settings } = (isRecord(board) ? board : {}) as StoredItems
  const listed: unknown[] = Array.isArray(order) ? order : []
  const places = new Map(listed.map((id, index) => [id, index]))
  const place = (id: string) => places.get(id) ?? listed.length

  // Unlisted cards fall in by id, so every device puts them in the same order.
  const widgets = Object.entries(items)
    .filter(([key, value]) => isCardKey(key) && isRecord(value))
    .map(([key, value]) => ({ ...(value as StoredItems), id: key.slice(CARD_PREFIX.length) }))
    .sort((a, b) => place(a.id) - place(b.id) || (a.id < b.id ? -1 : 1))

  return { widgets, settings }
}

// The board a set of stored items adds up to.
export const toDayboardState = (items: StoredItems): DayboardState =>
  normalizeState(boardFrom(items))

// A value to set for each item changed, or undefined for one removed, laid over what storage held.
const withChanges = (items: StoredItems, changes: StoredItems): StoredItems => {
  const next = { ...items, ...changes }

  for (const [key, value] of Object.entries(changes)) {
    if (value === undefined) {
      delete next[key]
    }
  }

  return next
}

// What storage held at the last read, kept current by the watch below and by this tab's own writes.
// It is what a change from elsewhere is laid over, since a change only carries the items it touched, and what says whether the board has left the old item yet.
let held: StoredItems | null = null

// Every item, since a card can sit under any id.
const readItems = (): Promise<StoredItems> => chrome.storage.sync.get(null)

// Structural equality over plain JSON data, blind to key order, which differs between a widget built in the page and the same widget read back out of storage.
export const isSameData = (a: unknown, b: unknown): boolean => {
  if (a === b) {
    return true
  }

  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) {
    return false
  }

  if (Array.isArray(a) !== Array.isArray(b)) {
    return false
  }

  const aKeys = Object.keys(a).filter((key) => (a as StoredSettings)[key] !== undefined)
  const bKeys = Object.keys(b).filter((key) => (b as StoredSettings)[key] !== undefined)

  return (
    aKeys.length === bKeys.length &&
    aKeys.every((key) => isSameData((a as StoredSettings)[key], (b as StoredSettings)[key]))
  )
}

// Every read and every storage change arrives as a freshly parsed board, so taken as-is it hands each card a new widget object and every memoized card re-renders, including on the echo of a write this tab just made.
// Keep the objects that did not change, and the whole previous board when nothing did, so a change only renders the cards it touched and an echo renders nothing.
export const shareUnchanged = (
  previous: DayboardState | null,
  next: DayboardState
): DayboardState => {
  if (!previous) {
    return next
  }

  const byId = new Map(previous.widgets.map((widget) => [widget.id, widget]))
  const widgets = next.widgets.map((widget) => {
    const existing = byId.get(widget.id)

    return existing && isSameData(existing, widget) ? existing : widget
  })
  const settings = isSameData(previous.settings, next.settings) ? previous.settings : next.settings
  // A card only a newer build can show still changes when that build edits it, and this tab has to take the change, or its next save would put the old card back.
  const unknownWidgets = isSameData(previous.unknownWidgets, next.unknownWidgets)
    ? previous.unknownWidgets
    : next.unknownWidgets

  const isUnchanged =
    settings === previous.settings &&
    unknownWidgets === previous.unknownWidgets &&
    widgets.length === previous.widgets.length &&
    widgets.every((widget, index) => widget === previous.widgets[index])

  return isUnchanged
    ? previous
    : { widgets, settings, ...(unknownWidgets ? { unknownWidgets } : {}) }
}

// chrome.storage.sync reads are async IPC, so every new tab would open blank for a few frames while waiting on them.
// Mirroring the last-known board into localStorage lets the first render hydrate synchronously; the authoritative sync read then reconciles anything that changed on another device.
const cacheDayboardState = (state: DayboardState) => {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(toStoredState(state)))
  } catch {
    // Best effort: an unavailable or full localStorage only costs speed.
  }
}

export const readCachedDayboardState = (): DayboardState | null => {
  try {
    const cached = localStorage.getItem(CACHE_KEY)

    return cached === null ? null : normalizeState(JSON.parse(cached))
  } catch {
    return null
  }
}

export const readDayboardState = async (): Promise<DayboardState> => {
  const items = await readItems()
  held = items
  const state = toDayboardState(items)

  cacheDayboardState(state)

  return state
}

// Pretty-printed JSON for the Export option.
export const serializeDayboardState = (state: DayboardState): string =>
  JSON.stringify(toStoredState(state), null, 2)

const NOT_A_BOARD = "That file is not a Dayboard board."

// Parse an exported file back into state for the Import option.
// Throws on invalid JSON or a payload that is not a board, so callers can reject the file rather than silently replacing the board with defaults.
export const parseDayboardState = (text: string): DayboardState => {
  // The Options dialog shows this message as it is, so a file that isn't even JSON gets the same plain answer rather than the parser's position report.
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error(NOT_A_BOARD)
  }

  if (!hasWidgets(parsed)) {
    throw new Error(NOT_A_BOARD)
  }

  // A file is one the user chose to bring in, often by hand, so a kind this build doesn't know there is likelier a typo than a card from a newer build.
  // It is dropped as junk, as it always was, rather than kept somewhere nobody could see or remove it; only a synced board carries such cards, since there a newer device is still using them.
  const { unknownWidgets: _unshown, ...board } = normalizeState(parsed)

  return board
}

// The id is the item's key, so the card is stored without it.
const toCardItem = ({ id: _key, ...card }: Widget | StoredWidget) => card

// Saves what a change did to the board rather than the board: the cards it added or altered, the board item when the order or the settings moved, and the removal of the cards it took away.
// `previous` is the board the change was made to, or null to save every card with nothing to compare against, and a card the same on both is left alone, so a save can't put back a card another tab or device has changed since, and two devices changing different cards both keep their change.
// A board still in the old item moves out of it here, on its first save: every card is written, and the old item is left saying where the board went.
// Everything set goes in one call, which sync counts as one write however many items it carries and refuses whole if any of them is too big, so a refused save leaves storage as it was.
// Removals follow in a call of their own, after the set has landed, so an import refused for its size has taken nothing away; a tab closed between the two leaves a card that was to go back at the end of the board, which is the lesser loss.
export const writeDayboardState = async (
  state: DayboardState,
  previous: DayboardState | null
): Promise<void> => {
  const items = held ?? (await readItems())
  held = items
  const split = isSplit(items)

  const next = toStoredState(state)
  const last = split && previous ? toStoredState(previous) : { widgets: [], settings: undefined }
  const lastCards = new Map(last.widgets.map((widget) => [widget.id, widget]))
  const kept = new Set(next.widgets.map((widget) => widget.id))

  const changed: StoredItems = {}

  for (const widget of next.widgets) {
    if (!isSameData(lastCards.get(widget.id), widget)) {
      changed[CARD_PREFIX + widget.id] = toCardItem(widget)
    }
  }

  // Taking a card away leaves the order of the rest as it was, and its place in the stored order is passed over from then on, so a delete is the one removal and nothing more.
  const order = next.widgets.map((widget) => widget.id)
  const lastOrder = last.widgets.map((widget) => widget.id).filter((id) => kept.has(id))

  if (!split || !isSameData(order, lastOrder) || !isSameData(next.settings, last.settings)) {
    changed[BOARD_KEY] = { order, settings: next.settings }
  }

  // The old item says where the board went from the first save out of it, and again if a build that still reads it has written a board of its own there since.
  const legacy = items[LEGACY_KEY]

  if (!isMoved(legacy) && (!split || legacy !== undefined)) {
    changed[LEGACY_KEY] = movedNotice()
  }

  const removed = last.widgets
    .filter((widget) => !kept.has(widget.id))
    .map((widget) => CARD_PREFIX + widget.id)

  if (Object.keys(changed).length > 0) {
    await chrome.storage.sync.set(changed)
    held = withChanges(held ?? items, changed)
  }

  if (removed.length > 0) {
    await chrome.storage.sync.remove(removed)
    held = withChanges(held ?? items, Object.fromEntries(removed.map((key) => [key, undefined])))
  }

  cacheDayboardState(state)
}

const isBoardKey = (key: string): boolean =>
  key === BOARD_KEY || key === LEGACY_KEY || isCardKey(key)

export const watchDayboardState = (listener: (state: DayboardState) => void): (() => void) => {
  const handleStorageChange = (
    changes: Record<string, chrome.storage.StorageChange>,
    areaName: string
  ) => {
    if (areaName !== "sync") {
      return
    }

    const keys = Object.keys(changes).filter(isBoardKey)
    if (keys.length === 0) {
      return
    }

    // A change carries only the items it touched, so with nothing read yet to lay it over, the board is read whole instead.
    if (!held) {
      void readDayboardState().then(listener, () => {})
      return
    }

    // A removed item arrives with no new value.
    const items = withChanges(
      held,
      Object.fromEntries(keys.map((key) => [key, changes[key]!.newValue]))
    )
    held = items
    const state = toDayboardState(items)

    cacheDayboardState(state)
    listener(state)
  }

  chrome.storage.onChanged.addListener(handleStorageChange)

  return () => chrome.storage.onChanged.removeListener(handleStorageChange)
}
