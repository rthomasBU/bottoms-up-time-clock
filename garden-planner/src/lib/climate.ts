// Turns ~15 years of daily weather history into the climate facts a planting
// plan needs: smoothed day-of-year temperature normals, frost dates with
// probabilities, an approximate USDA hardiness zone, and per-year daily lows
// for "what are the odds of a killing frost in this window" questions.
//
// Days are indexed 0-364 from Jan 1 (Feb 29 is dropped so every year lines up).

export interface DailyHistory {
  dates: string[] // YYYY-MM-DD
  tmax: (number | null)[]
  tmin: (number | null)[]
  precip: (number | null)[]
}

export interface Climate {
  lat: number
  years: number[]
  /** yearMin[y][doy] - daily low, °F, for each complete historical year. */
  yearMin: number[][]
  /** Smoothed day-of-year normals, °F. */
  normMax: number[]
  normMin: number[]
  normMean: number[]
  /** Spring: last day ≤32°F. Fall: first day ≤32°F. null when frost-free in most years. */
  lastFrost: FrostDate | null
  firstFrost: FrostDate | null
  /** Fraction of years that saw any 32°F frost. */
  frostYearFraction: number
  frostFreeDays: number
  avgExtremeMinF: number
  zone: string
  monthly: { avgHigh: number; avgLow: number; precipIn: number }[]
}

export interface FrostDate {
  /** 50% chance of frost after (spring) / before (fall) this day. */
  median: number
  /** 10% chance: the "safe" date for tender plants. */
  safe: number
}

export const DAYS = 365
const MONTH_STARTS = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334]

export function doyOf(date: Date): number {
  const m = date.getMonth()
  return Math.min(MONTH_STARTS[m] + date.getDate() - 1, DAYS - 1)
}

/** Day-of-year -> Date in the given year (ignores leap days, close enough). */
export function dateFromDoy(year: number, doy: number): Date {
  const y = year + Math.floor(doy / DAYS)
  const d = ((doy % DAYS) + DAYS) % DAYS
  let m = 11
  while (MONTH_STARTS[m] > d) m--
  return new Date(y, m, d - MONTH_STARTS[m] + 1)
}

export function monthOfDoy(doy: number): number {
  const d = ((doy % DAYS) + DAYS) % DAYS
  let m = 11
  while (MONTH_STARTS[m] > d) m--
  return m
}

/** Hours of daylight at a latitude on a day of year. */
export function daylengthHours(lat: number, doy: number): number {
  const decl = 23.44 * Math.sin(((2 * Math.PI) / 365) * (doy - 80))
  const x = -Math.tan((lat * Math.PI) / 180) * Math.tan((decl * Math.PI) / 180)
  if (x >= 1) return 0
  if (x <= -1) return 24
  return (24 / Math.PI) * Math.acos(x)
}

function fillGaps(values: (number | null)[]): number[] {
  const out = values.slice()
  let last: number | null = null
  for (let i = 0; i < out.length; i++) {
    if (out[i] == null) out[i] = last
    else last = out[i]
  }
  last = null
  for (let i = out.length - 1; i >= 0; i--) {
    if (out[i] == null) out[i] = last
    else last = out[i]
  }
  return out.map((v) => v ?? 50)
}

function circularSmooth(values: number[], halfWindow: number): number[] {
  const n = values.length
  return values.map((_, i) => {
    let sum = 0
    for (let k = -halfWindow; k <= halfWindow; k++) sum += values[(i + k + n) % n]
    return sum / (2 * halfWindow + 1)
  })
}

function percentile(sorted: number[], p: number): number {
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.round(p * (sorted.length - 1))))
  return sorted[idx]
}

export function zoneFromMin(avgMinF: number): string {
  const steps = Math.floor((avgMinF + 60) / 5) // 5°F half-zones starting at -60°F
  const zone = Math.max(1, Math.min(13, Math.floor(steps / 2) + 1))
  const half = steps % 2 === 0 ? 'a' : 'b'
  return `${zone}${avgMinF < -60 ? 'a' : avgMinF >= 70 ? 'b' : half}`
}

export function buildClimate(history: DailyHistory, lat: number): Climate {
  const byYear = new Map<number, { min: (number | null)[]; max: (number | null)[]; pr: (number | null)[] }>()
  history.dates.forEach((iso, i) => {
    const [y, m, d] = iso.split('-').map(Number)
    if (m === 2 && d === 29) return
    let rec = byYear.get(y)
    if (!rec) {
      rec = { min: Array(DAYS).fill(null), max: Array(DAYS).fill(null), pr: Array(DAYS).fill(null) }
      byYear.set(y, rec)
    }
    const doy = MONTH_STARTS[m - 1] + d - 1
    rec.min[doy] = history.tmin[i]
    rec.max[doy] = history.tmax[i]
    rec.pr[doy] = history.precip[i]
  })

  // Keep years with at least 90% of days present.
  const years = [...byYear.keys()]
    .filter((y) => byYear.get(y)!.min.filter((v) => v != null).length > DAYS * 0.9)
    .sort((a, b) => a - b)
  if (years.length < 2) throw new Error('Not enough weather history for this location.')

  const yearMin = years.map((y) => fillGaps(byYear.get(y)!.min))
  const yearMax = years.map((y) => fillGaps(byYear.get(y)!.max))
  const yearPr = years.map((y) => byYear.get(y)!.pr.map((v) => v ?? 0))

  const avg = (rows: number[][], doy: number) => rows.reduce((s, r) => s + r[doy], 0) / rows.length
  const rawMax = Array.from({ length: DAYS }, (_, d) => avg(yearMax, d))
  const rawMin = Array.from({ length: DAYS }, (_, d) => avg(yearMin, d))
  const normMax = circularSmooth(rawMax, 7)
  const normMin = circularSmooth(rawMin, 7)
  const normMean = normMax.map((v, i) => (v + normMin[i]) / 2)

  // Frost dates per year. Spring = Jan 1 - Jun 30, fall = Jul 1 - Dec 31.
  const springLast: number[] = []
  const fallFirst: number[] = []
  let frostYears = 0
  for (const mins of yearMin) {
    let last = -1
    for (let d = 0; d < 181; d++) if (mins[d] <= 32) last = d
    let first = DAYS
    for (let d = 181; d < DAYS; d++) {
      if (mins[d] <= 32) {
        first = d
        break
      }
    }
    springLast.push(last)
    fallFirst.push(first)
    if (last >= 0 || first < DAYS) frostYears++
  }
  springLast.sort((a, b) => a - b)
  fallFirst.sort((a, b) => a - b)
  const springMedian = percentile(springLast, 0.5)
  const fallMedian = percentile(fallFirst, 0.5)
  const lastFrost = springMedian < 0 ? null : { median: springMedian, safe: percentile(springLast, 0.9) }
  const firstFrost = fallMedian >= DAYS ? null : { median: fallMedian, safe: percentile(fallFirst, 0.1) }
  const frostFreeDays =
    lastFrost && firstFrost ? firstFrost.median - lastFrost.median : lastFrost || firstFrost ? 300 : DAYS

  const avgExtremeMinF = yearMin.reduce((s, r) => s + Math.min(...r), 0) / yearMin.length

  const monthly = MONTH_STARTS.map((start, m) => {
    const end = m === 11 ? DAYS : MONTH_STARTS[m + 1]
    let hi = 0
    let lo = 0
    for (let d = start; d < end; d++) {
      hi += rawMax[d]
      lo += rawMin[d]
    }
    const precipIn = yearPr.reduce((s, r) => s + r.slice(start, end).reduce((a, b) => a + b, 0), 0) / yearPr.length
    return { avgHigh: hi / (end - start), avgLow: lo / (end - start), precipIn }
  })

  return {
    lat,
    years,
    yearMin,
    normMax,
    normMin,
    normMean,
    lastFrost,
    firstFrost,
    frostYearFraction: frostYears / years.length,
    frostFreeDays,
    avgExtremeMinF,
    zone: zoneFromMin(avgExtremeMinF),
    monthly,
  }
}

/**
 * Fraction of historical years in which the daily low dropped to `thresholdF`
 * or below at any point in a `length`-day window starting on `startDoy`.
 * Windows may run past Dec 31 into the following year.
 */
export function windowRisk(c: Climate, startDoy: number, length: number, thresholdF: number): number {
  const start = ((startDoy % DAYS) + DAYS) % DAYS
  let hit = 0
  let seen = 0
  for (let y = 0; y < c.yearMin.length; y++) {
    const endAbs = start + length
    if (endAbs > DAYS && y === c.yearMin.length - 1) continue
    seen++
    for (let i = start; i < endAbs; i++) {
      const row = c.yearMin[y + Math.floor(i / DAYS)]
      if (row[i % DAYS] <= thresholdF) {
        hit++
        break
      }
    }
  }
  return seen ? hit / seen : 0
}

/** Normal value for any (possibly >365 or negative) day index. */
export function norm(series: number[], day: number): number {
  return series[((Math.round(day) % DAYS) + DAYS) % DAYS]
}
