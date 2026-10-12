import { describe, expect, it } from 'vitest'
import { syntheticHistory } from '../test/synthetic'
import { buildClimate, windowRisk, zoneFromMin } from './climate'
import { CROPS_BY_ID } from './crops'
import { buildLayout } from './layout'
import { buildPlan, inGroundOn, type PlanInput } from './plan'
import { FROST_RISK_LIMIT, scheduleCrop } from './schedule'
import { parseForecast } from './weather'

const temperate = buildClimate(syntheticHistory(55, 22), 40)
const tropical = buildClimate(syntheticHistory(77, 7), 25.8)
const OCT_12 = 284

const input: PlanInput = {
  people: 4,
  coverage: 1,
  zip: '00000',
  lengthFt: 40,
  widthFt: 30,
  style: 'raisedBed',
  extension: 'none',
  excluded: [],
}

describe('climate', () => {
  it('maps the average coldest night to a USDA zone', () => {
    expect(zoneFromMin(0)).toBe('7a')
    expect(zoneFromMin(-5)).toBe('6b')
    expect(zoneFromMin(-22)).toBe('4b')
    expect(zoneFromMin(42)).toBe('11a')
  })

  it('finds spring and fall frost dates in a temperate climate', () => {
    expect(temperate.lastFrost).not.toBeNull()
    expect(temperate.firstFrost).not.toBeNull()
    expect(temperate.lastFrost!.safe).toBeGreaterThanOrEqual(temperate.lastFrost!.median)
    expect(temperate.firstFrost!.safe).toBeLessThanOrEqual(temperate.firstFrost!.median)
    expect(temperate.monthly[6].avgHigh).toBeGreaterThan(temperate.monthly[0].avgHigh + 30)
  })

  it('reports no frost dates for a frost-free climate', () => {
    expect(tropical.lastFrost).toBeNull()
    expect(tropical.firstFrost).toBeNull()
    expect(windowRisk(tropical, 0, 90, 32)).toBe(0)
  })
})

describe('schedule', () => {
  it('never schedules a tender crop into likely frost', () => {
    const tomato = CROPS_BY_ID.tomato
    const plantings = scheduleCrop(temperate, tomato, { today: OCT_12, extension: 'none' })
    expect(plantings.length).toBeGreaterThan(0)
    for (const p of plantings) {
      expect(p.frostRisk).toBeLessThanOrEqual(FROST_RISK_LIMIT)
      expect(p.plantDay % 365).toBeGreaterThan(temperate.lastFrost!.median)
    }
  })

  it('splits cool-season crops into spring and fall plantings around summer heat', () => {
    const lettuce = scheduleCrop(temperate, CROPS_BY_ID.lettuce, { today: OCT_12, extension: 'none' })
    const days = lettuce.map((p) => p.plantDay % 365)
    expect(days.some((d) => d < 150)).toBe(true)
    expect(days.some((d) => d > 200)).toBe(true)
  })

  it('grows cool-season crops through winter where it never freezes', () => {
    const lettuce = scheduleCrop(tropical, CROPS_BY_ID.lettuce, { today: OCT_12, extension: 'none' })
    expect(lettuce.some((p) => p.plantDay % 365 > 300 || p.plantDay % 365 < 60)).toBe(true)
  })

  it('season extension opens up more planting dates', () => {
    const plain = scheduleCrop(temperate, CROPS_BY_ID.spinach, { today: OCT_12, extension: 'none' })
    const hoop = scheduleCrop(temperate, CROPS_BY_ID.spinach, { today: OCT_12, extension: 'hoopHouse' })
    expect(hoop[0].plantDay).toBeLessThanOrEqual(plain[0].plantDay)
  })
})

describe('plan', () => {
  it('scales plant counts with the number of people', () => {
    const big = { ...input, lengthFt: 400, widthFt: 400 }
    const two = buildPlan(temperate, { ...big, people: 2 }, OCT_12)
    const eight = buildPlan(temperate, { ...big, people: 8 }, OCT_12)
    const plants = (p: typeof two, id: string) => p.crops.find((c) => c.crop.id === id)!.totalPlants
    expect(plants(eight, 'carrot')).toBeGreaterThanOrEqual(plants(two, 'carrot') * 3.5)
    expect(two.spaceScale).toBe(1)
  })

  it('meets each crop’s need when space allows', () => {
    const plan = buildPlan(temperate, { ...input, lengthFt: 400, widthFt: 400 }, OCT_12)
    for (const cp of plan.crops) expect(cp.expectedYieldLb).toBeGreaterThanOrEqual(cp.annualNeedLb * 0.99)
  })

  it('shrinks the plan to fit a small garden', () => {
    const plan = buildPlan(temperate, { ...input, lengthFt: 10, widthFt: 10 }, OCT_12)
    expect(plan.spaceScale).toBeLessThan(1)
    expect(plan.peakAreaSqFt).toBeLessThanOrEqual(plan.usableAreaSqFt * 1.15)
  })

  it('drops crops that cannot grow and reports why', () => {
    const plan = buildPlan(tropical, input, OCT_12)
    const spinach = plan.unsuitable.find((u) => u.crop.id === 'spinach')
    expect(spinach?.reason).toMatch(/hot/i)
    expect(plan.crops.some((c) => c.crop.group === 'darkGreen')).toBe(true)
  })

  it('respects excluded crops', () => {
    const plan = buildPlan(temperate, { ...input, excluded: ['okra', 'eggplant'] }, OCT_12)
    expect(plan.crops.find((c) => c.crop.id === 'okra')).toBeUndefined()
  })
})

describe('layout', () => {
  const plan = buildPlan(temperate, input, OCT_12)
  const items = inGroundOn(plan.crops, plan.peakDay)

  it('fits the busiest day into raised beds without overflow', () => {
    const layout = buildLayout(items, 'raisedBed', 40, 30, { arrangement: 'rotation', bedWidthFt: 4, bedLengthFt: 8 })
    expect(layout.kind).toBe('beds')
    if (layout.kind !== 'beds') return
    expect(layout.overflow).toEqual([])
    const dots = layout.beds.reduce((s, b) => s + b.dots.length, 0)
    expect(dots).toBe(items.reduce((s, i) => s + i.plants, 0))
  })

  it('keeps antagonists apart in companion mode', () => {
    const layout = buildLayout(items, 'raisedBed', 40, 30, { arrangement: 'companion', bedWidthFt: 4, bedLengthFt: 8 })
    expect(layout.kind).toBe('beds')
  })

  it('lays out in-ground rows within the plot', () => {
    const p = buildPlan(temperate, { ...input, style: 'inGround', lengthFt: 60, widthFt: 60 }, OCT_12)
    const l = buildLayout(inGroundOn(p.crops, p.peakDay), 'inGround', 60, 60, {
      arrangement: 'rotation',
      bedWidthFt: 4,
      bedLengthFt: 8,
    })
    if (l.kind !== 'rows') throw new Error('expected rows')
    for (const r of l.rows) expect(r.y + r.pitchFt).toBeLessThanOrEqual(60 + 1e-6)
  })
})

describe('forecast parsing', () => {
  it('averages hourly soil temperature into days', () => {
    const hours = Array.from({ length: 48 }, (_, i) => `2026-10-${12 + Math.floor(i / 24)}T${String(i % 24).padStart(2, '0')}:00`)
    const f = parseForecast({
      current: { time: '2026-10-12T10:00', temperature_2m: 60, relative_humidity_2m: 50, precipitation: 0, weather_code: 1, wind_speed_10m: 5 },
      daily: {
        time: ['2026-10-12', '2026-10-13'],
        temperature_2m_max: [65, 62],
        temperature_2m_min: [45, 30],
        precipitation_sum: [0, 0.4],
        precipitation_probability_max: [5, 70],
        weather_code: [1, 61],
      },
      hourly: { time: hours, soil_temperature_6cm: hours.map((_, i) => (i < 24 ? 55 : 50)) },
    })
    expect(f.todayIndex).toBe(0)
    expect(f.days[0].soilF).toBe(55)
    expect(f.days[1].soilF).toBe(50)
  })
})
