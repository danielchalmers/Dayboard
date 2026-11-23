import { describe, expect, it } from "vitest"

import { isKnownTimeZone } from "./time"
import { listTimeZones, PLACES, REGION_NAMES, searchTimeZones } from "./zoneSearch"

// Browsers list some zones under an older name (Asia/Calcutta for Asia/Kolkata) and which ones is theirs to change,
// so a found zone is compared by what the runtime resolves both names to rather than by its spelling.
const resolved = (zone: string) =>
  new Intl.DateTimeFormat("en", { timeZone: zone }).resolvedOptions().timeZone

// What a search found, as [what it was found by, the zone under its current name].
const found = (query: string) =>
  searchTimeZones(query).map(({ hint, value }) => [hint, value === "" ? "" : resolved(value)])

const zone = (hint: string | undefined, name: string) => [hint, resolved(name)]

const terms = (list: string) =>
  list
    .split(",")
    .map((term) => term.trim())
    .filter((term) => term !== "")

describe("listTimeZones", () => {
  it("leads with the system's own zone, then UTC, then every zone the browser has", () => {
    const options = listTimeZones()

    expect(options[0]).toEqual({ value: "", label: "System time zone" })
    // The browser's list is of places and has no UTC in it, which is the zone a team most often shares.
    expect(options[1]).toEqual({ value: "UTC", label: "UTC" })
    expect(options.filter(({ value }) => value === "UTC")).toHaveLength(1)
    expect(options).toContainEqual({ value: "Asia/Tokyo", label: "Asia/Tokyo" })
    expect(options.every(({ value }) => value === "" || isKnownTimeZone(value))).toBe(true)
  })
})

describe("searchTimeZones", () => {
  // Every one of these read "No matching time zone" while the list only knew zone names.
  it("finds a zone by a city it isn't named for", () => {
    expect(found("San Francisco")).toEqual([zone("San Francisco", "America/Los_Angeles")])
    expect(found("Mumbai")).toEqual([zone("Mumbai", "Asia/Kolkata")])
    expect(found("Beijing")).toEqual([zone("Beijing", "Asia/Shanghai")])
    expect(found("Hawaii")).toEqual([zone("Hawaii", "Pacific/Honolulu")])
  })

  it("finds a zone by its current name where the browser lists it under an older one", () => {
    for (const [typed, name] of [
      ["Kolkata", "Asia/Kolkata"],
      ["Kyiv", "Europe/Kyiv"],
      ["Ho Chi Minh", "Asia/Ho_Chi_Minh"],
      ["Kathmandu", "Asia/Kathmandu"],
      ["Nuuk", "America/Nuuk"]
    ] as const) {
      const [match, ...others] = searchTimeZones(typed)

      expect(others).toEqual([])
      expect(resolved(match!.value)).toBe(resolved(name))
      // The row says why it is there only when the zone's own name doesn't.
      expect(match!.hint).toBe(match!.value === name ? undefined : typed)
    }
  })

  it("finds a zone by an abbreviation, and UTC by either of its names", () => {
    expect(found("PST")).toEqual([zone("PST", "America/Los_Angeles")])
    expect(found("GMT")).toEqual([zone("GMT", "UTC")])
    expect(found("UTC")).toEqual([zone(undefined, "UTC")])
  })

  it("lists every zone an abbreviation stands for", () => {
    expect(found("IST").slice(0, 3)).toEqual([
      zone("IST", "Asia/Kolkata"),
      zone("IST", "Asia/Jerusalem"),
      zone("IST", "Europe/Dublin")
    ])
    expect(found("CST").slice(0, 2)).toEqual([
      zone("CST", "America/Chicago"),
      zone("CST", "Asia/Shanghai")
    ])
  })

  // "India" used to list only America/Indiana/* and Indian/*.
  it("puts a country ahead of the zones that only start with its name", () => {
    const matches = searchTimeZones("India")

    expect(found("India")[0]).toEqual(zone("India", "Asia/Kolkata"))
    expect(matches.some(({ label }) => label.startsWith("America/Indiana/"))).toBe(true)
    expect(matches.some(({ label }) => label.startsWith("Indian/"))).toBe(true)
  })

  it("finds a country by the browser's name for it and by what people call it", () => {
    expect(found("Germany")).toContainEqual(zone("Germany", "Europe/Berlin"))
    expect(found("Japan")).toEqual([zone("Japan", "Asia/Tokyo")])
    expect(found("UK")[0]).toEqual(zone("UK", "Europe/London"))
    expect(found("Turkey")).toEqual([zone("Turkey", "Europe/Istanbul")])
    expect(found("Czech Republic")).toEqual([zone("Czech Republic", "Europe/Prague")])
  })

  it("lists every zone a country keeps", () => {
    const states = found("United States")

    expect(states.every(([hint]) => hint === "United States")).toBe(true)
    expect(states).toContainEqual(zone("United States", "America/New_York"))
    expect(states).toContainEqual(zone("United States", "America/Los_Angeles"))
    expect(states).toContainEqual(zone("United States", "Pacific/Honolulu"))
    expect(found("USA").slice(0, states.length)).toEqual(states.map(([, value]) => ["USA", value]))
  })

  it("still finds a zone by its own name, with nothing said about why", () => {
    expect(searchTimeZones("tokyo")).toEqual([{ value: "Asia/Tokyo", label: "Asia/Tokyo" }])
    expect(searchTimeZones("new york")).toEqual([
      { value: "America/New_York", label: "America/New_York" }
    ])
    expect(searchTimeZones("Lond")).toEqual([{ value: "Europe/London", label: "Europe/London" }])
    expect(searchTimeZones("america/los")).toEqual([
      { value: "America/Los_Angeles", label: "America/Los_Angeles" }
    ])
    // Inside a word too, the way the list was always searched.
    expect(searchTimeZones("ngele")).toEqual([
      { value: "America/Los_Angeles", label: "America/Los_Angeles" }
    ])
  })

  it("keeps to a zone's own name when the search finds it both ways", () => {
    // Singapore is a country, a city and a zone.
    expect(searchTimeZones("Singapore")).toEqual([
      { value: "Asia/Singapore", label: "Asia/Singapore" }
    ])
  })

  it("puts what was typed whole ahead of what only starts with it", () => {
    expect(found("LA")[0]).toEqual(zone("LA", "America/Los_Angeles"))
    expect(searchTimeZones("LA").map(({ label }) => label)).toContain("America/La_Paz")
    // Every zone in the Pacific starts with the word, and none of them is what Pacific Time means.
    expect(found("pacific")[0]).toEqual(zone("Pacific Time", "America/Los_Angeles"))
    expect(searchTimeZones("pacific")[1]!.label).toMatch(/^Pacific\//)
  })

  it("does not turn on accents, punctuation, or how a saint is written", () => {
    expect(found("malaga")).toEqual([zone("Málaga", "Europe/Madrid")])
    expect(found("xian")).toEqual([zone("Xi'an", "Asia/Shanghai")])
    expect(found("st louis")).toEqual([zone("St. Louis", "America/Chicago")])
    expect(found("Saint Petersburg")).toEqual([zone("St. Petersburg", "Europe/Moscow")])
    expect(found("trinidad and tobago")).toEqual([
      zone("Trinidad & Tobago", "America/Port_of_Spain")
    ])
    expect(found("port au prince")).toEqual([zone(undefined, "America/Port-au-Prince")])
  })

  it("finds the system's own zone by its label, behind anything that matches better", () => {
    expect(searchTimeZones("sys")).toEqual([{ value: "", label: "System time zone" }])
    // "st" is in "System", and used to put that row first for a search after St. Louis.
    expect(found("st")[0]).toEqual(zone("St. Louis", "America/Chicago"))
  })

  it("finds nothing for a typo", () => {
    expect(searchTimeZones("Lodnon")).toEqual([])
  })

  it("is the whole list for a search of nothing", () => {
    expect(searchTimeZones("")).toEqual(listTimeZones())
    expect(searchTimeZones("  ")).toEqual(listTimeZones())
  })
})

describe("the search terms", () => {
  // A zone name with a typo in it would drop its cities without a word.
  it("are all kept against a zone this runtime knows", () => {
    expect(Object.keys(PLACES).filter((name) => !isKnownTimeZone(name))).toEqual([])
  })

  it("each find the zone they are kept against", () => {
    const lost = Object.entries(PLACES).flatMap(([name, places]) =>
      terms(places)
        .filter((place) => !found(place).some(([, value]) => value === resolved(name)))
        .map((place) => `${place} (${name})`)
    )

    expect(lost).toEqual([])
  })

  it("for a country each find a zone", () => {
    const lost = Object.entries(REGION_NAMES).flatMap(([region, names]) =>
      terms(names)
        .filter((name) => !searchTimeZones(name).some(({ hint }) => hint === name))
        .map((name) => `${name} (${region})`)
    )

    expect(lost).toEqual([])
  })
})
