// Checks the plan against the actual forecast. The historical schedule says
// what's normally safe; the next two weeks of real weather say whether to go
// ahead, wait a few days, or protect what's already in the ground.

import { norm, type Climate } from './climate'
import type { Plan } from './plan'
import type { Forecast } from './weather'
import { fmtDay as dayLabel } from './format'

export interface Advice {
  level: 'go' | 'wait' | 'warn' | 'info'
  title: string
  detail: string
}

const fmt = (iso: string) =>
  new Date(iso + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })

export function forecastAdvice(plan: Plan, c: Climate, f: Forecast, coverBonusF: number): Advice[] {
  const out: Advice[] = []
  const today = plan.today
  const ahead = f.days.slice(f.todayIndex)
  const past = f.days.slice(Math.max(0, f.todayIndex - 3), f.todayIndex + 1)
  const soilReadings = past.map((d) => d.soilF).filter((v): v is number => v != null)
  const soilNow = soilReadings.length ? soilReadings.reduce((a, b) => a + b, 0) / soilReadings.length : null

  // How this stretch compares with normal.
  const next7 = ahead.slice(0, 7)
  if (next7.length) {
    const fcMean = next7.reduce((s, d) => s + (d.tmax + d.tmin) / 2, 0) / next7.length
    let normal = 0
    for (let i = 0; i < next7.length; i++) normal += norm(c.normMean, today + i)
    normal /= next7.length
    const diff = Math.round(fcMean - normal)
    if (Math.abs(diff) >= 4) {
      out.push({
        level: 'info',
        title: `Next week runs ${Math.abs(diff)}°F ${diff > 0 ? 'warmer' : 'cooler'} than normal`,
        detail:
          diff > 0
            ? 'Crops will mature a little faster; water more and watch cool-season crops for bolting.'
            : 'Growth will be slower than the calendar assumes; consider waiting a few days on warm-season plantings.',
      })
    }
  }

  // Frost threats to crops already in the ground.
  const inGround = plan.crops.filter((cp) => cp.plantings.some((p) => today >= p.plantDay && today <= p.harvestEnd))
  const frostDay = (killF: number, days = 10) => ahead.slice(0, days).find((d) => d.tmin + coverBonusF <= killF + 2)
  const threatened = inGround
    .map((cp) => ({ cp, day: frostDay(cp.crop.killTempF) }))
    .filter((x) => x.day)
  if (threatened.length) {
    const first = threatened.reduce((a, b) => (a.day!.date < b.day!.date ? a : b)).day!
    out.push({
      level: 'warn',
      title: `Cold snap ${fmt(first.date)} (low ${Math.round(first.tmin)}°F)`,
      detail: `Harvest or cover: ${threatened.map((t) => t.cp.crop.name).join(', ')}.`,
    })
  }

  // Heavy rain.
  const soaker = ahead.slice(0, 3).find((d) => d.precipIn >= 1)
  if (soaker) {
    out.push({
      level: 'info',
      title: `${soaker.precipIn.toFixed(1)}" of rain ${fmt(soaker.date)}`,
      detail: "Skip watering, and don't dig or sow into waterlogged soil until it drains.",
    })
  }

  // Plantings due in the next two weeks.
  const due: Advice[] = []
  for (const cp of plan.crops) {
    const crop = cp.crop
    for (const p of cp.plantings) {
      if (p.startIndoors != null && !p.buyTransplants && p.startIndoors >= today - 3 && p.startIndoors <= today + 14) {
        due.push({
          level: 'go',
          title: `Start ${crop.name} seeds indoors (${p.plants})`,
          detail: `Transplant outside around ${dayLabel(today, p.plantDay)}.`,
        })
      }
      if (p.plantDay < today - 3 || p.plantDay > today + 14) continue
      const label = `${crop.method === 'transplant' ? 'Transplant' : 'Sow'} ${crop.name} (${p.plants})`
      const frost = frostDay(crop.killTempF, 10)
      const heat = ahead.slice(0, 7)
      const hot = heat.length && heat.reduce((s, d) => s + d.tmax, 0) / heat.length > crop.heatMaxF + 3
      const soilNeed = crop.minSoilF - (crop.method === 'transplant' ? 3 : 0)
      if (frost) {
        due.push({
          level: 'wait',
          title: `Hold: ${label}`,
          detail: `${Math.round(frost.tmin)}°F forecast ${fmt(frost.date)} would damage it. Plant once that passes, or cover it.`,
        })
      } else if (crop.method === 'direct' && soilNow != null && soilNow + coverBonusF / 2 < soilNeed) {
        due.push({
          level: 'wait',
          title: `Hold: ${label}`,
          detail: `Soil is ${Math.round(soilNow)}°F; seeds need ${soilNeed}°F to germinate well.`,
        })
      } else if (crop.cool && hot) {
        due.push({
          level: 'warn',
          title: label,
          detail: 'A hot spell is coming - sow in shade or under shade cloth and keep the bed moist.',
        })
      } else {
        due.push({
          level: 'go',
          title: label,
          detail: `Window ${dayLabel(today, p.plantDay)}${p.buyTransplants ? ' - buy transplants (too late to start seed)' : ''}. Forecast looks good.`,
        })
      }
    }
  }
  out.push(...due)

  if (!due.length) {
    const next = plan.crops
      .flatMap((cp) => cp.plantings.map((p) => ({ cp, p })))
      .filter(({ p }) => p.plantDay > today)
      .sort((a, b) => a.p.plantDay - b.p.plantDay)[0]
    out.push({
      level: 'info',
      title: 'Nothing to plant in the next two weeks',
      detail: next ? `Next up: ${next.cp.crop.name} around ${dayLabel(today, next.p.plantDay)}.` : '',
    })
  }
  return out
}
