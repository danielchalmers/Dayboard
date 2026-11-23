import { getTimeZoneOptions } from "./time"

export interface ZoneOption {
  // What a clock stores: a zone name the browser knows, or nothing for the system's own.
  value: string
  label: string
  // What the search found the zone by when that wasn't its own name: a city, a country, an abbreviation.
  hint?: string
}

// The empty zone is a real option, not an absence: it means "follow the system clock", and it leads the list under its own name.
const SYSTEM_OPTION: ZoneOption = { value: "", label: "System time zone" }

// What people look a clock up by that isn't the name of its zone: the cities a zone isn't named for, the states and provinces it covers, and the abbreviations it goes by.
// Zone names only cover one city each, so "San Francisco", "Mumbai" and "Beijing" found nothing, and neither did "PST" or "GMT".
// Keyed by the zone's current IANA name. Browsers still list some zones under an older one (Asia/Calcutta, Europe/Kiev), and the key is matched to whatever this browser calls it,
// which also makes the current name a term of its own. A zone with nothing after it is here for that alone.
// Countries are not in this table: the browser knows which zones each one keeps (see `regionTerms`).
// An abbreviation that is also a word ("WEST", "EAT", "CAT") is left out, because it would lead every search for the word.
export const PLACES: Record<string, string> = {
  UTC: "GMT, Zulu, Greenwich Mean Time, Coordinated Universal Time",

  "America/New_York":
    "NYC, Washington DC, Boston, Philadelphia, Miami, Atlanta, Orlando, Tampa, Charlotte, Pittsburgh, Baltimore, Cleveland, Columbus, Cincinnati, Raleigh, Buffalo, Jacksonville, Florida, Georgia, Ohio, Pennsylvania, Virginia, North Carolina, South Carolina, New Jersey, Massachusetts, Maryland, Connecticut, Maine, Vermont, New Hampshire, Rhode Island, Delaware, West Virginia, Eastern Time, ET, EST, EDT",
  "America/Chicago":
    "Houston, Dallas, Austin, San Antonio, Fort Worth, Minneapolis, St. Louis, New Orleans, Nashville, Memphis, Kansas City, Milwaukee, Oklahoma City, Omaha, Texas, Illinois, Wisconsin, Minnesota, Iowa, Missouri, Arkansas, Louisiana, Mississippi, Alabama, Oklahoma, Kansas, Nebraska, Central Time, CT, CST, CDT",
  "America/Denver":
    "Salt Lake City, Albuquerque, Colorado Springs, El Paso, Santa Fe, Colorado, Utah, Wyoming, Montana, New Mexico, Mountain Time, MT, MST, MDT",
  "America/Phoenix": "Arizona, Tucson, Scottsdale, MST",
  "America/Los_Angeles":
    "LA, San Francisco, San Diego, San Jose, Seattle, Portland, Las Vegas, Sacramento, Oakland, Silicon Valley, California, Washington State, Oregon, Nevada, Pacific Time, PT, PST, PDT",
  "America/Anchorage": "Alaska, Fairbanks, Alaska Time, AKST, AKDT",
  "Pacific/Honolulu": "Hawaii, Maui, Oahu, Waikiki, Hawaii Time, HST",
  "America/Detroit": "Michigan",
  "America/Boise": "Idaho",

  "America/Toronto": "Ottawa, Montreal, Quebec City, Ontario, Quebec",
  "America/Vancouver": "British Columbia, Victoria, Whistler",
  "America/Edmonton": "Calgary, Alberta, Banff",
  "America/Winnipeg": "Manitoba",
  "America/Regina": "Saskatchewan, Saskatoon",
  "America/Halifax": "Nova Scotia, Atlantic Time, AST, ADT",
  "America/St_Johns": "Newfoundland, NST, NDT",

  "America/Mexico_City": "CDMX, Guadalajara, Puebla",
  "America/Cancun": "Playa del Carmen, Tulum, Cozumel",
  "America/Costa_Rica": "San José",
  "America/El_Salvador": "San Salvador",
  "America/Panama": "Panama City",
  "America/Puerto_Rico": "San Juan",
  "America/Jamaica": "Kingston, Montego Bay",
  "America/Santo_Domingo": "Punta Cana",
  "America/Bogota": "Medellín, Cali, Cartagena",
  "America/Guayaquil": "Quito",
  "America/Lima": "Cusco",
  "America/Santiago": "Valparaíso",
  "America/Sao_Paulo": "Rio de Janeiro, Rio, Brasília, Belo Horizonte, Curitiba, Porto Alegre, BRT",
  "America/Nuuk": "",

  "Europe/London":
    "England, Scotland, Wales, Northern Ireland, Manchester, Birmingham, Edinburgh, Glasgow, Liverpool, Leeds, Bristol, Cardiff, Belfast, Oxford, Cambridge, BST",
  "Europe/Dublin": "Cork, Galway, IST",
  "Europe/Paris": "Lyon, Marseille, Nice, Toulouse, Bordeaux, Strasbourg",
  "Europe/Berlin":
    "Munich, Hamburg, Frankfurt, Cologne, Stuttgart, Düsseldorf, Leipzig, Dresden, Central European Time, CET, CEST",
  "Europe/Madrid": "Barcelona, Valencia, Seville, Bilbao, Málaga, Ibiza, Mallorca",
  "Europe/Rome": "Milan, Naples, Florence, Venice, Turin, Bologna",
  "Europe/Amsterdam": "Rotterdam, The Hague, Utrecht, Eindhoven",
  "Europe/Brussels": "Antwerp, Ghent, Bruges",
  "Europe/Zurich": "Geneva, Bern, Basel, Lausanne",
  "Europe/Vienna": "Salzburg, Innsbruck, Graz",
  "Europe/Stockholm": "Gothenburg, Malmö",
  "Europe/Oslo": "Bergen",
  "Europe/Copenhagen": "Aarhus",
  "Europe/Lisbon": "Porto",
  "Europe/Athens": "Thessaloniki, Santorini, Crete, Eastern European Time, EET, EEST",
  "Europe/Istanbul": "Ankara, Izmir, Antalya",
  "Europe/Moscow": "St. Petersburg, Sochi, Kazan, MSK",
  "Europe/Kyiv": "Kharkiv, Odesa, Lviv",
  "Europe/Warsaw": "Kraków, Gdańsk, Wrocław",
  "Europe/Prague": "Brno",
  "Atlantic/Canary": "Tenerife, Gran Canaria, Las Palmas",

  "Asia/Kolkata":
    "Mumbai, Delhi, New Delhi, Bengaluru, Bangalore, Chennai, Hyderabad, Pune, Ahmedabad, Jaipur, Goa, Bombay, IST",
  "Asia/Shanghai":
    "Beijing, Shenzhen, Guangzhou, Chengdu, Hangzhou, Wuhan, Chongqing, Nanjing, Tianjin, Xi'an, CST",
  "Asia/Tokyo": "Osaka, Kyoto, Yokohama, Nagoya, Sapporo, Fukuoka, Okinawa, JST",
  "Asia/Seoul": "Busan, Incheon, Jeju, KST",
  "Asia/Hong_Kong": "HKT",
  "Asia/Singapore": "SGT",
  "Asia/Taipei": "Kaohsiung",
  "Asia/Bangkok": "Phuket, Chiang Mai, Pattaya, ICT",
  "Asia/Ho_Chi_Minh": "Ho Chi Minh City, Hanoi, Da Nang",
  "Asia/Jakarta": "Bandung, Surabaya, WIB",
  "Asia/Makassar": "Bali, Denpasar, Lombok",
  "Asia/Manila": "Cebu, Quezon City, Davao, PHT",
  "Asia/Kuala_Lumpur": "Penang, Johor Bahru",
  "Asia/Karachi": "Islamabad, Lahore, Rawalpindi, PKT",
  "Asia/Dhaka": "Chittagong",
  "Asia/Kathmandu": "",
  "Asia/Yangon": "Naypyidaw, Mandalay",
  "Asia/Dubai": "Abu Dhabi, Sharjah, GST",
  "Asia/Riyadh": "Jeddah, Mecca, Medina, AST",
  "Asia/Qatar": "Doha",
  "Asia/Bahrain": "Manama",
  "Asia/Kuwait": "Kuwait City",
  "Asia/Baghdad": "Basra, Erbil",
  "Asia/Jerusalem": "Tel Aviv, Haifa, IST",
  "Asia/Almaty": "Astana",

  "Africa/Cairo": "Alexandria, Giza",
  "Africa/Lagos": "Abuja, Kano",
  "Africa/Johannesburg": "Cape Town, Pretoria, Durban, SAST",
  "Africa/Nairobi": "Mombasa",
  "Africa/Casablanca": "Rabat, Marrakech, Tangier",
  "Africa/Accra": "Kumasi",
  "Africa/Dar_es_Salaam": "Zanzibar, Dodoma",
  "Africa/Abidjan": "Yamoussoukro",
  "Africa/Asmara": "",

  "Australia/Sydney": "Canberra, New South Wales, NSW, AEST, AEDT",
  "Australia/Melbourne": "Victoria, Geelong, AEST, AEDT",
  "Australia/Brisbane": "Queensland, Gold Coast, Cairns, AEST",
  "Australia/Hobart": "Tasmania, AEST, AEDT",
  "Australia/Adelaide": "South Australia, ACST, ACDT",
  "Australia/Darwin": "Northern Territory, Alice Springs, ACST",
  "Australia/Perth": "Western Australia, Fremantle, AWST",
  "Pacific/Auckland": "Wellington, Christchurch, Queenstown, NZ, NZST, NZDT",
  "Pacific/Fiji": "Suva, Nadi",
  "Pacific/Tahiti": "Bora Bora, Papeete"
}

// What a country is called besides the name the browser has for it, by region code.
// These reach every zone the country keeps, which is why they are not in the table above.
export const REGION_NAMES: Record<string, string> = {
  US: "USA, US, United States of America",
  GB: "UK, Britain, Great Britain",
  AE: "UAE, Emirates",
  NL: "Holland",
  TR: "Turkey",
  CZ: "Czech Republic",
  MM: "Burma",
  CI: "Ivory Coast",
  CD: "DR Congo, DRC",
  PS: "Palestine",
  SZ: "Swaziland",
  TL: "East Timor"
}

const listed = (terms: string): string[] =>
  terms
    .split(",")
    .map((term) => term.trim())
    .filter((term) => term !== "")

// What both sides of a match are reduced to, so a search doesn't turn on how something was typed:
// no case and no accents ("malaga" finds Málaga), the underscores and hyphens of a zone name read as spaces ("new york"),
// no periods or apostrophes ("st louis", "xian"), "&" as "and", and "saint" as the "St" the browser and the zone names both write.
const fold = (text: string): string =>
  text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[_-]/g, " ")
    .replace(/[.'’(),]/g, "")
    .replace(/&/g, " and ")
    .replace(/\bsaint\b/g, "st")
    .replace(/\s+/g, " ")
    .trim()

// How well a text answers a search, lower being better: it is the search, it starts with the search as whole words, it starts with it, a later word starts with it, or it only holds it somewhere.
// Telling those apart is what puts India ahead of Indiana and Indian/Chagos, and "LA" ahead of La Paz.
// Only a zone's own name is searched inside its words, as it always was ("land" still finds Auckland): done to the terms too, it would also find every country ending in "land".
const NO_MATCH = 5

const rank = (text: string, wanted: string, inside: boolean): number =>
  text === wanted
    ? 0
    : text.startsWith(`${wanted} `)
      ? 1
      : text.startsWith(wanted)
        ? 2
        : text.includes(` ${wanted}`)
          ? 3
          : inside && text.includes(wanted)
            ? 4
            : NO_MATCH

interface Term {
  text: string
  folded: string
}

interface Entry {
  option: ZoneOption
  // The zone's own name, whole and by the parts after its area, so "los angeles" and "america/los" both find it by name.
  // The area is not a part of its own: every zone in the Pacific would then answer "pacific" better than Pacific Time does.
  own: string[]
  terms: Term[]
}

let options: ZoneOption[] | undefined

// The whole list as it opens on a click: the system's own zone, then every zone the browser has.
export const listTimeZones = (): ZoneOption[] =>
  (options ??= [
    SYSTEM_OPTION,
    ...getTimeZoneOptions().map((zone) => ({ value: zone, label: zone }))
  ])

// The name this browser gives a zone, which is how a current name finds the older one it is listed under.
const resolveZone = (zone: string): string | undefined => {
  try {
    return new Intl.DateTimeFormat("en", { timeZone: zone }).resolvedOptions().timeZone
  } catch {
    return undefined
  }
}

// `getTimeZones` replaced the `timeZones` getter, and Chrome has shipped each without the other.
type RegionLocale = Intl.Locale & {
  getTimeZones?: () => string[] | undefined
  timeZones?: string[] | undefined
}

const zonesOfRegion = (region: string): string[] => {
  try {
    const locale: RegionLocale = new Intl.Locale(`und-${region}`)

    return locale.getTimeZones?.() ?? locale.timeZones ?? []
  } catch {
    return []
  }
}

// Every country the browser has a name for, with the zones it keeps: "India" is Asia/Calcutta, "United States" is twenty-nine of them.
// Both come from the browser's own locale data, so there is no table of countries here to fall behind the zones, and nothing is fetched.
// The names are English, and the browser's own language as well where that is another one.
const regionTerms = (): { zones: string[]; names: string[] }[] => {
  if (typeof Intl.DisplayNames !== "function") {
    return []
  }

  const english = new Intl.DisplayNames(["en"], { type: "region", fallback: "none" })
  const local = new Intl.DisplayNames(undefined, { type: "region", fallback: "none" })
  const speaksEnglish = local.resolvedOptions().locale.startsWith("en")
  const regions: { zones: string[]; names: string[] }[] = []

  // There is no asking for the list of regions, so every two-letter code is tried; the few hundred that are regions have names.
  for (let first = 0; first < 26; first += 1) {
    for (let second = 0; second < 26; second += 1) {
      const region = String.fromCharCode(65 + first, 65 + second)
      const name = english.of(region)

      if (name === undefined) {
        continue
      }

      const zones = zonesOfRegion(region)

      if (zones.length > 0) {
        const localName = speaksEnglish ? undefined : local.of(region)

        regions.push({
          zones,
          names: [name, ...(localName ? [localName] : []), ...listed(REGION_NAMES[region] ?? "")]
        })
      }
    }
  }

  return regions
}

const buildIndex = (): Entry[] => {
  const entries: Entry[] = listTimeZones().map((option) => {
    const name = fold(option.label)

    return { option, own: [name, ...name.split("/").slice(1)], terms: [] }
  })
  const byZone = new Map(
    entries.filter((entry) => entry.option.value !== "").map((entry) => [entry.option.value, entry])
  )

  const find = (zone: string): Entry | undefined => {
    const resolved = byZone.has(zone) ? zone : resolveZone(zone)

    return resolved === undefined ? undefined : byZone.get(resolved)
  }

  const add = (entry: Entry | undefined, text: string) => {
    const folded = fold(text)

    if (entry && folded !== "" && entry.terms.every((term) => term.folded !== folded)) {
      entry.terms.push({ text, folded })
    }
  }

  for (const [zone, places] of Object.entries(PLACES)) {
    const entry = find(zone)

    // Listed under an older name, the zone is still looked for by its current one: "Kolkata" for Asia/Calcutta, "Kyiv" for Europe/Kiev.
    if (entry && entry.option.value !== zone) {
      add(entry, zone.slice(zone.lastIndexOf("/") + 1).replaceAll("_", " "))
    }

    for (const place of listed(places)) {
      add(entry, place)
    }
  }

  for (const { zones, names } of regionTerms()) {
    for (const zone of zones) {
      const entry = find(zone)

      for (const name of names) {
        add(entry, name)
      }
    }
  }

  return entries
}

let index: Entry[] | undefined

// The zones a search finds, best first: by zone name as before, and by the cities, countries and abbreviations each zone is known by.
// A zone found by one of those says which in `hint`, so the row can read "San Francisco · America/Los_Angeles" and the choice is clear.
// A zone found as well by its own name keeps to that, since the name already says why it is there. Equal matches stay in the list's order.
// The index is built on the first search rather than as the page loads: a board is opened far more often than a clock is added.
export const searchTimeZones = (query: string): ZoneOption[] => {
  const wanted = fold(query)

  if (wanted === "") {
    return listTimeZones()
  }

  index ??= buildIndex()

  const found: { score: number; position: number; option: ZoneOption }[] = []

  index.forEach(({ option, own, terms }, position) => {
    let score = Math.min(...own.map((name) => rank(name, wanted, true)))
    let hint: string | undefined

    for (const term of terms) {
      const termScore = rank(term.folded, wanted, false)

      if (termScore < score) {
        score = termScore
        hint = term.text
      }
    }

    if (score < NO_MATCH) {
      found.push({ score, position, option: hint === undefined ? option : { ...option, hint } })
    }
  })

  return found
    .sort((a, b) => a.score - b.score || a.position - b.position)
    .map(({ option }) => option)
}
