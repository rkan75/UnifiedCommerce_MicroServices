/** US state / territory two-letter codes → name for geocoding (avoids "CA, US" → Canada ambiguity). */
const US_STATE_NAMES: Record<string, string> = {
  AL: "Alabama",
  AK: "Alaska",
  AZ: "Arizona",
  AR: "Arkansas",
  CA: "California",
  CO: "Colorado",
  CT: "Connecticut",
  DE: "Delaware",
  DC: "District of Columbia",
  FL: "Florida",
  GA: "Georgia",
  HI: "Hawaii",
  ID: "Idaho",
  IL: "Illinois",
  IN: "Indiana",
  IA: "Iowa",
  KS: "Kansas",
  KY: "Kentucky",
  LA: "Louisiana",
  ME: "Maine",
  MD: "Maryland",
  MA: "Massachusetts",
  MI: "Michigan",
  MN: "Minnesota",
  MS: "Mississippi",
  MO: "Missouri",
  MT: "Montana",
  NE: "Nebraska",
  NV: "Nevada",
  NH: "New Hampshire",
  NJ: "New Jersey",
  NM: "New Mexico",
  NY: "New York",
  NC: "North Carolina",
  ND: "North Dakota",
  OH: "Ohio",
  OK: "Oklahoma",
  OR: "Oregon",
  PA: "Pennsylvania",
  RI: "Rhode Island",
  SC: "South Carolina",
  SD: "South Dakota",
  TN: "Tennessee",
  TX: "Texas",
  UT: "Utah",
  VT: "Vermont",
  VA: "Virginia",
  WA: "Washington",
  WV: "West Virginia",
  WI: "Wisconsin",
  WY: "Wyoming",
  AS: "American Samoa",
  GU: "Guam",
  MP: "Northern Mariana Islands",
  PR: "Puerto Rico",
  VI: "U.S. Virgin Islands",
}

const US_ZIP = /^\d{5}(-\d{4})?$/

/**
 * Expand a lone 2-letter US state/territory code so Nominatim resolves to the correct US region
 * (e.g. "CA" → "California", not Canada).
 */
export function expandUsLocationQuery(raw: string): string {
  const t = raw.trim()
  if (!t) return t
  if (US_ZIP.test(t)) return t
  if (/^[A-Za-z]{2}$/.test(t)) {
    const name = US_STATE_NAMES[t.toUpperCase()]
    if (name) return name
  }
  return t
}

/** Build a Nominatim-friendly query for US searches. */
export function toNominatimQuery(expanded: string, countryCode: string): string {
  const e = expanded.trim()
  if (!e) return e
  if (/united states|usa\b/i.test(e)) return e
  const c = countryCode.toLowerCase()
  if (c === "us" || c === "usa") return `${e}, United States`
  return `${e}, ${countryCode.toUpperCase()}`
}

/**
 * If the user typed a US state as a 2-letter code or full name, return the canonical abbrev (e.g. CA).
 * Used to match `store_location.state` in the DB.
 */
export function normalizeUsStateSearchToken(raw: string): string | null {
  const t = raw.trim()
  if (!t) return null
  const upper = t.toUpperCase()
  if (/^[A-Z]{2}$/.test(upper) && US_STATE_NAMES[upper]) return upper
  const lower = t.toLowerCase()
  for (const [abbr, name] of Object.entries(US_STATE_NAMES)) {
    if (name.toLowerCase() === lower) return abbr
  }
  return null
}
