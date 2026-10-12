// Works out when each crop can go in the ground over the next 12 months.
//
// Every candidate planting day is tested against the location's climate:
//   - growth is simulated with growing degree days (slowed by short winter
//     days), so a fall planting correctly takes longer than a spring one;
//   - the odds of a killing frost between planting and early harvest come
//     from the actual historical daily lows, not a single average date;
//   - cool crops are rejected if they would mature into heat that makes them
//     bolt, warm crops if the soil is too cold to sow or the season too cool.

import { DAYS, daylengthHours, norm, windowRisk, type Climate } from './climate'
import type { Crop } from './crops'

export type SeasonExtension = 'none' | 'rowCover' | 'coldFrame' | 'hoopHouse'

export const SEASON_EXTENSIONS: Record<SeasonExtension, { label: string; minBonusF: number; meanBonusF: number }> = {
  none: { label: 'None (open garden)', minBonusF: 0, meanBonusF: 0 },
  rowCover: { label: 'Frost cloth / row covers', minBonusF: 4, meanBonusF: 2 },
  coldFrame: { label: 'Cold frames / low tunnels', minBonusF: 6, meanBonusF: 4 },
  hoopHouse: { label: 'Unheated greenhouse / hoop house', minBonusF: 8, meanBonusF: 6 },
}

/** Max acceptable chance (across historical years) of a killing frost. */
export const FROST_RISK_LIMIT = 0.15

export interface Planting {
  cropId: string
  /** Day index counted from Jan 1 of the plan's start year (may exceed 365). */
  startIndoors?: number
  plantDay: number
  maturityDay: number
  harvestEnd: number
  /** Too late to start seed indoors - buy transplants. */
  buyTransplants: boolean
  frostRisk: number
}

export interface ScheduleOptions {
  /** Day index of "today" (from Jan 1 of the start year). */
  today: number
  extension: SeasonExtension
}

const NOMINAL_MEAN = { cool: 60, warm: 72 }
const UPPER_CAP_F = 86

function gddPerDay(c: Climate, crop: Crop, day: number, meanBonus: number): number {
  const mean = Math.min(norm(c.normMean, day) + meanBonus, UPPER_CAP_F)
  const light = Math.min(1, Math.max(0.15, (daylengthHours(c.lat, ((day % DAYS) + DAYS) % DAYS) - 8) / 3))
  return Math.max(0, mean - crop.baseTempF) * light
}

/** Day the crop reaches maturity if planted on `day`, or null if it never gets there. */
export function maturityDay(c: Climate, crop: Crop, day: number, meanBonus = 0): number | null {
  const target = crop.dtm * (NOMINAL_MEAN[crop.cool ? 'cool' : 'warm'] - crop.baseTempF)
  const minDays = Math.round(crop.dtm * 0.75)
  const maxDays = Math.round(crop.dtm * 2.2)
  let sum = 0
  for (let i = 0; i < maxDays; i++) {
    sum += gddPerDay(c, crop, day + i, meanBonus)
    if (sum >= target) return day + Math.max(i + 1, minDays)
  }
  return null
}

function avgNorm(series: number[], from: number, to: number): number {
  let s = 0
  let n = 0
  for (let d = from; d <= to; d++) {
    s += norm(series, d)
    n++
  }
  return n ? s / n : norm(series, from)
}

export interface Feasibility {
  ok: boolean
  reason?: 'frost' | 'cold-soil' | 'heat' | 'too-cool' | 'too-slow'
  maturity?: number
  harvestEnd?: number
  risk?: number
}

export function evaluate(c: Climate, crop: Crop, day: number, extension: SeasonExtension): Feasibility {
  const { minBonusF, meanBonusF } = SEASON_EXTENSIONS[extension]
  const soil = avgNorm(c.normMean, day - 7, day) + meanBonusF
  const soilNeed = crop.minSoilF - (crop.method === 'transplant' ? 3 : 0)
  if (soil < soilNeed) return { ok: false, reason: 'cold-soil' }

  const mat = maturityDay(c, crop, day, meanBonusF)
  if (mat == null) return { ok: false, reason: 'too-slow' }

  const window = mat - day + Math.min(14, crop.harvestDays)
  const risk = windowRisk(c, day, window, crop.killTempF - minBonusF)
  if (risk > FROST_RISK_LIMIT) return { ok: false, reason: 'frost', risk }

  if (avgNorm(c.normMax, mat - 14, mat + 7) > crop.heatMaxF) return { ok: false, reason: 'heat' }
  if (!crop.cool && avgNorm(c.normMean, day, mat) + meanBonusF < crop.baseTempF + 10) {
    return { ok: false, reason: 'too-cool' }
  }

  // Harvest runs its course, or until the typical first killing cold.
  let harvestEnd = mat + crop.harvestDays
  for (let d = mat; d < mat + crop.harvestDays; d++) {
    if (norm(c.normMin, d) + minBonusF <= crop.killTempF) {
      harvestEnd = Math.max(d, mat + 7)
      break
    }
  }
  return { ok: true, maturity: mat, harvestEnd, risk }
}

function garlicPlanting(c: Climate, crop: Crop, today: number): Planting {
  // Plant cloves when fall soil cools to ~55°F (a few weeks before the ground
  // freezes); in climates that never cool that far, mid-November.
  const yearStart = Math.floor(today / DAYS) * DAYS
  const pick = (base: number) => {
    for (let d = base + 243; d < base + DAYS; d++) if (norm(c.normMean, d) <= 55) return d
    return base + 318
  }
  let plantDay = pick(yearStart)
  // A few weeks late is fine as long as the ground hasn't frozen yet.
  if (plantDay < today) plantDay = today - plantDay <= 21 && norm(c.normMean, today) > 38 ? today : pick(yearStart + DAYS)
  const coldWinter = Math.min(...c.normMean) < 40
  const maturity = plantDay + (coldWinter ? 250 : 200)
  return {
    cropId: crop.id,
    plantDay,
    maturityDay: maturity,
    harvestEnd: maturity + crop.harvestDays,
    buyTransplants: false,
    frostRisk: 0,
  }
}

/** All plantings for one crop across the 12 months starting `today`. */
export function scheduleCrop(c: Climate, crop: Crop, opts: ScheduleOptions): Planting[] {
  if (crop.special === 'garlic') return [garlicPlanting(c, crop, opts.today)]

  const plantings: Planting[] = []
  const gap = crop.successionDays ?? crop.dtm + Math.round(crop.harvestDays / 2)
  let d = opts.today
  while (d < opts.today + DAYS && plantings.length < crop.maxPlantings) {
    const f = evaluate(c, crop, d, opts.extension)
    if (!f.ok) {
      d++
      continue
    }
    const startIndoors = crop.method === 'transplant' ? d - crop.weeksIndoors * 7 : undefined
    plantings.push({
      cropId: crop.id,
      startIndoors,
      plantDay: d,
      maturityDay: f.maturity!,
      harvestEnd: f.harvestEnd!,
      buyTransplants: startIndoors != null && startIndoors < opts.today,
      frostRisk: f.risk ?? 0,
    })
    d += gap
  }
  return plantings
}
