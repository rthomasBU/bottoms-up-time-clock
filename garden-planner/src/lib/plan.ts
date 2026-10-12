// Turns "feed N people" into plant counts.
//
// Need: USDA weekly cup-equivalents per person for each vegetable subgroup,
// split across the crops that can actually grow at this location, converted
// to harvested pounds, plus a buffer for pests, spoilage and bad weeks.
// Supply: plants per planting = need / yield per plant / number of plantings.
// Space: the plan is checked against the garden at its busiest day of the year
// and scaled down proportionally if it doesn't fit.

import { DAYS, type Climate } from './climate'
import { CROPS, DIET_GROUPS, type Crop, type DietGroup } from './crops'
import { evaluate, scheduleCrop, type Planting, type SeasonExtension } from './schedule'

export type GrowStyle = 'inGround' | 'raisedBed' | 'squareFoot' | 'vertical' | 'container'

export const GROW_STYLES: Record<GrowStyle, { label: string; usableFraction: number; blurb: string }> = {
  inGround: {
    label: 'In-ground rows',
    usableFraction: 0.9,
    blurb: 'Traditional rows; walking space is built into the row spacing, plus row-end turnarounds.',
  },
  raisedBed: {
    label: 'Raised beds',
    usableFraction: 0.65,
    blurb: 'Intensive offset spacing in beds, ~35% of the area left for paths.',
  },
  squareFoot: {
    label: 'Square-foot gardening',
    usableFraction: 0.65,
    blurb: 'Beds gridded into 1 ft squares with a set plant count per square.',
  },
  vertical: {
    label: 'Raised beds + trellises',
    usableFraction: 0.65,
    blurb: 'Raised beds with vining crops trained up trellises on the north edge.',
  },
  container: {
    label: 'Containers / patio',
    usableFraction: 0.75,
    blurb: 'Pots and grow bags; small crops share 5-gallon containers. Aisle every 4 rows.',
  },
}

/** Pounds bought in excess of the diet target to cover losses. */
export const BUFFER = 0.15

export interface PlanInput {
  people: number
  /** Share of the household's vegetable needs to grow, 0-1. */
  coverage: number
  zip: string
  lengthFt: number
  widthFt: number
  style: GrowStyle
  extension: SeasonExtension
  excluded: string[]
}

export interface CropPlan {
  crop: Crop
  plantings: (Planting & { plants: number })[]
  annualNeedLb: number
  totalPlants: number
  expectedYieldLb: number
  areaPerPlantSqFt: number
  /** Plants that share one container (container style only). */
  plantsPerContainer: number
  containerGal: number
}

export interface Plan {
  input: PlanInput
  today: number
  crops: CropPlan[]
  unsuitable: { crop: Crop; reason: string }[]
  /** Crops that would grow here but didn't fit the space. */
  droppedForSpace: Crop[]
  usableAreaSqFt: number
  peakAreaSqFt: number
  /** Space the full (unscaled) plan would need at its busiest. */
  fullPeakAreaSqFt: number
  peakDay: number
  /** Fraction of the diet target the plan delivers after fitting to the space (≤ 1). */
  spaceScale: number
  /** Per month of the plan year: cups per person per day. */
  monthlySupply: { month: number; fresh: number; stored: number }[]
  targetCupsPerDay: number
}

/** Gap left between neighboring containers, feet. */
export const POT_GAP_FT = 0.25

/** Width of one container of `gal` gallons, feet (a 5-gal bucket is ~1 ft). */
export function containerSize(gal: number): number {
  return Math.sqrt(0.4 * Math.pow(gal, 0.67))
}

/** Floor space one container takes including the gap around it, square feet. */
export function containerFootprint(gal: number): number {
  return (containerSize(gal) + POT_GAP_FT) ** 2
}

export function containerSetup(crop: Crop): { gal: number; perContainer: number } {
  if (crop.containerGal >= 3) return { gal: crop.containerGal, perContainer: 1 }
  return { gal: 5, perContainer: Math.max(1, Math.floor(5 / crop.containerGal)) }
}

/** Ground each plant needs, square feet, in the given growing style. */
export function areaPerPlant(crop: Crop, style: GrowStyle): number {
  switch (style) {
    case 'inGround':
      return (crop.spacingIn * crop.rowSpacingIn) / 144
    case 'raisedBed':
      return (crop.spacingIn * crop.spacingIn * 0.866) / 144
    case 'squareFoot':
      return 1 / crop.sfgPerSqFt
    case 'vertical':
      return ((crop.spacingIn * crop.spacingIn * 0.866) / 144) * (crop.vining ? 0.5 : 1)
    case 'container': {
      const { gal, perContainer } = containerSetup(crop)
      return containerFootprint(gal) / perContainer
    }
  }
}

function minPerPlanting(crop: Crop): number {
  return crop.id === 'corn' ? 16 : 1
}

const REASONS: Record<string, string> = {
  frost: 'Season is too short - frost hits before it matures.',
  'cold-soil': 'Soil never warms enough to sow it.',
  heat: 'Too hot when it would mature (bolts or drops flowers).',
  'too-cool': 'Summers are too cool for a good crop.',
  'too-slow': 'Not enough warmth to reach maturity.',
  container: 'Not practical in containers.',
}

export function buildPlan(c: Climate, input: PlanInput, today: number): Plan {
  const style = input.style
  const unsuitable: Plan['unsuitable'] = []
  const scheduled: { crop: Crop; plantings: Planting[] }[] = []

  for (const crop of CROPS) {
    if (input.excluded.includes(crop.id)) continue
    if (style === 'container' && crop.containerGal === 0) {
      unsuitable.push({ crop, reason: REASONS.container })
      continue
    }
    const plantings = scheduleCrop(c, crop, { today, extension: input.extension })
    if (plantings.length === 0) {
      unsuitable.push({ crop, reason: whyNot(c, crop, input.extension) })
      continue
    }
    scheduled.push({ crop, plantings })
  }

  // Split each subgroup's need across the crops that can grow here.
  const groupShare = new Map<DietGroup, number>()
  for (const s of scheduled) groupShare.set(s.crop.group, (groupShare.get(s.crop.group) ?? 0) + s.crop.share)

  const usableAreaSqFt = input.lengthFt * input.widthFt * GROW_STYLES[style].usableFraction
  const crops: CropPlan[] = scheduled.map(({ crop, plantings }) => {
    const cups = DIET_GROUPS[crop.group].cupsPerWeek * 52 * (crop.share / groupShare.get(crop.group)!)
    const annualNeedLb = input.people * input.coverage * cups * crop.lbPerCup * (1 + BUFFER)
    const totalPlants = Math.ceil(annualNeedLb / crop.yieldLbPerPlant)
    const per = Math.max(minPerPlanting(crop), Math.ceil(totalPlants / plantings.length))
    const { gal, perContainer } = containerSetup(crop)
    return {
      crop,
      plantings: plantings.map((p) => ({ ...p, plants: per })),
      annualNeedLb,
      totalPlants: per * plantings.length,
      expectedYieldLb: per * plantings.length * crop.yieldLbPerPlant,
      areaPerPlantSqFt: areaPerPlant(crop, style),
      plantsPerContainer: style === 'container' ? perContainer : 1,
      containerGal: gal,
    }
  })

  // Fit to the space available at the busiest point of the year. Scale every
  // planting down together; if keeping at least one plant per planting still
  // overshoots (tiny gardens), allow plantings to drop out entirely.
  let { peak, peakDay } = peakOccupancy(crops, today)
  const fullPeakAreaSqFt = peak
  for (let pass = 0; pass < 8 && peak > usableAreaSqFt * 1.001 && peak > 0; pass++) {
    const scale = usableAreaSqFt / peak
    const keepOne = pass === 0
    for (const cp of crops) {
      for (const p of cp.plantings) p.plants = Math.max(keepOne ? 1 : 0, Math.floor(p.plants * scale))
      cp.plantings = cp.plantings.filter((p) => p.plants > 0)
    }
    ;({ peak, peakDay } = peakOccupancy(crops, today))
  }
  for (const cp of crops) {
    cp.totalPlants = cp.plantings.reduce((s, p) => s + p.plants, 0)
    cp.expectedYieldLb = cp.totalPlants * cp.crop.yieldLbPerPlant
  }
  // Share of the diet target (in cup-equivalents) the fitted plan delivers.
  const cups = (cp: CropPlan, lb: number) => lb / cp.crop.lbPerCup
  const needCups = crops.reduce((s, cp) => s + cups(cp, cp.annualNeedLb), 0)
  const gotCups = crops.reduce((s, cp) => s + cups(cp, Math.min(cp.expectedYieldLb, cp.annualNeedLb)), 0)
  const spaceScale = needCups > 0 ? Math.min(1, gotCups / needCups) : 1

  const targetCupsPerDay =
    (input.coverage * Object.values(DIET_GROUPS).reduce((s, g) => s + g.cupsPerWeek, 0)) / 7

  return {
    input,
    today,
    crops: crops.filter((cp) => cp.totalPlants > 0),
    droppedForSpace: crops.filter((cp) => cp.totalPlants === 0).map((cp) => cp.crop),
    unsuitable,
    usableAreaSqFt,
    peakAreaSqFt: peak,
    fullPeakAreaSqFt,
    peakDay,
    spaceScale,
    monthlySupply: monthlySupply(crops, today, input.people),
    targetCupsPerDay,
  }
}

/** Area (sq ft) in use on a given day, and which plantings occupy it. */
export function inGroundOn(crops: CropPlan[], day: number) {
  const rows: { cp: CropPlan; plants: number }[] = []
  for (const cp of crops) {
    let plants = 0
    for (const p of cp.plantings) {
      // Plantings repeat yearly, so one that runs past the plan year also covers its start.
      const on = (d: number) => d >= p.plantDay && d <= p.harvestEnd
      if (on(day) || on(day + DAYS)) plants += p.plants
    }
    if (plants > 0) rows.push({ cp, plants })
  }
  return rows
}

export function peakOccupancy(crops: CropPlan[], today: number) {
  // Look at a full steady-state year: plantings in the plan repeat annually,
  // so a planting that runs past day today+365 also occupies the start.
  const occ = new Float64Array(DAYS)
  for (const cp of crops) {
    for (const p of cp.plantings) {
      const area = p.plants * cp.areaPerPlantSqFt
      for (let d = p.plantDay; d <= p.harvestEnd; d++) occ[(d - today) % DAYS] += area
    }
  }
  let peak = 0
  let idx = 0
  occ.forEach((v, i) => {
    if (v > peak) {
      peak = v
      idx = i
    }
  })
  return { peak, peakDay: today + idx }
}

function monthlySupply(crops: CropPlan[], today: number, people: number) {
  // Steady-state year: daily cup-equivalents available, fresh vs from storage.
  const fresh = new Float64Array(DAYS)
  const stored = new Float64Array(DAYS)
  for (const cp of crops) {
    for (const p of cp.plantings) {
      const cups = (p.plants * cp.crop.yieldLbPerPlant) / cp.crop.lbPerCup
      const storeCups = cups * cp.crop.storeFraction
      const freshCups = cups - storeCups
      const hDays = Math.max(1, p.harvestEnd - p.maturityDay)
      for (let d = p.maturityDay; d < p.harvestEnd; d++) fresh[(d - today) % DAYS] += freshCups / hDays
      const sDays = Math.round(cp.crop.storageMonths * 30.4)
      for (let d = p.harvestEnd; d < p.harvestEnd + sDays; d++) stored[(d - today) % DAYS] += storeCups / sDays
    }
  }
  const out: { month: number; fresh: number; stored: number }[] = []
  for (let m = 0; m < 12; m++) {
    const from = Math.round((m * DAYS) / 12)
    const to = Math.round(((m + 1) * DAYS) / 12)
    let f = 0
    let s = 0
    for (let d = from; d < to; d++) {
      f += fresh[d]
      s += stored[d]
    }
    const n = (to - from) * Math.max(1, people)
    out.push({ month: m, fresh: f / n, stored: s / n })
  }
  return out
}

/** Why a crop has no planting window: what goes wrong at the warmest time of year. */
function whyNot(c: Climate, crop: Crop, extension: SeasonExtension): string {
  const warmest = c.normMean.indexOf(Math.max(...c.normMean))
  const tries = [warmest - 60, warmest - 30, warmest].map((d) => evaluate(c, crop, d, extension))
  const reason = tries.find((t) => t.reason && t.reason !== 'cold-soil')?.reason ?? tries[0].reason
  return (reason && REASONS[reason]) || 'No safe planting window here.'
}
