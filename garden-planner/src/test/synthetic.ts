import type { DailyHistory } from '../lib/climate'

/**
 * Deterministic synthetic weather history: a seasonal sine wave with
 * day-to-day and year-to-year noise. Coldest around Jan 20.
 */
export function syntheticHistory(meanF: number, amplitudeF: number, years = 15, startYear = 2011): DailyHistory {
  let seed = 42
  const rand = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648
    return seed / 2147483648
  }
  const dates: string[] = []
  const tmax: number[] = []
  const tmin: number[] = []
  const precip: number[] = []
  for (let y = startYear; y < startYear + years; y++) {
    const yearShift = (rand() - 0.5) * 6
    const d = new Date(Date.UTC(y, 0, 1))
    while (d.getUTCFullYear() === y) {
      const doy = Math.floor((d.getTime() - Date.UTC(y, 0, 1)) / 86400000)
      const mean = meanF - amplitudeF * Math.cos((2 * Math.PI * (doy - 20)) / 365) + yearShift + (rand() - 0.5) * 14
      dates.push(d.toISOString().slice(0, 10))
      tmax.push(mean + 9)
      tmin.push(mean - 9)
      precip.push(rand() < 0.3 ? rand() * 0.8 : 0)
      d.setUTCDate(d.getUTCDate() + 1)
    }
  }
  return { dates, tmax, tmin, precip }
}
