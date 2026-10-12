// Location + weather data. All free, keyless, browser-friendly APIs:
//   - Zippopotam.us: ZIP code -> place name and coordinates
//   - Open-Meteo historical archive (ERA5 reanalysis): daily highs/lows/rain
//   - Open-Meteo forecast: current conditions, 16-day forecast, soil temps

import { buildClimate, type Climate, type DailyHistory } from './climate'

export interface Place {
  zip: string
  name: string
  state: string
  lat: number
  lon: number
}

export interface ForecastDay {
  date: string
  tmax: number
  tmin: number
  precipIn: number
  precipProb: number | null
  code: number
  soilF: number | null
}

export interface Forecast {
  current: { tempF: number; humidity: number; precipIn: number; code: number; windMph: number; time: string }
  /** Includes the past 7 days (for recent soil temps) followed by the forecast. */
  days: ForecastDay[]
  todayIndex: number
}

const HISTORY_YEARS = 15

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Request failed (${res.status}) for ${new URL(url).host}`)
  return res.json() as Promise<T>
}

export async function lookupZip(zip: string): Promise<Place> {
  const clean = zip.trim().slice(0, 5)
  if (!/^\d{5}$/.test(clean)) throw new Error('Enter a 5-digit US ZIP code.')
  try {
    const data = await getJson<{
      places: { 'place name': string; 'state abbreviation': string; latitude: string; longitude: string }[]
    }>(`https://api.zippopotam.us/us/${clean}`)
    const p = data.places[0]
    return { zip: clean, name: p['place name'], state: p['state abbreviation'], lat: +p.latitude, lon: +p.longitude }
  } catch {
    // Fallback: Open-Meteo's geocoder also indexes postal codes.
    const data = await getJson<{
      results?: { name: string; admin1?: string; latitude: number; longitude: number; postcodes?: string[] }[]
    }>(`https://geocoding-api.open-meteo.com/v1/search?name=${clean}&count=10&countryCode=US`)
    const r = data.results?.find((x) => x.postcodes?.includes(clean)) ?? data.results?.[0]
    if (!r) throw new Error(`Couldn't find ZIP code ${clean}.`)
    return { zip: clean, name: r.name, state: r.admin1 ?? '', lat: r.latitude, lon: r.longitude }
  }
}

function cacheGet<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

function cacheSet(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Storage full or blocked - the app still works, it just refetches.
  }
}

export async function loadClimate(place: Place, now = new Date()): Promise<Climate> {
  const endYear = now.getFullYear() - 1
  const startYear = endYear - HISTORY_YEARS + 1
  const key = `garden:climate:v1:${place.lat.toFixed(2)},${place.lon.toFixed(2)}:${startYear}-${endYear}`
  const cached = cacheGet<Climate>(key)
  if (cached) return cached

  const url =
    'https://archive-api.open-meteo.com/v1/archive' +
    `?latitude=${place.lat}&longitude=${place.lon}` +
    `&start_date=${startYear}-01-01&end_date=${endYear}-12-31` +
    '&daily=temperature_2m_max,temperature_2m_min,precipitation_sum' +
    '&temperature_unit=fahrenheit&precipitation_unit=inch&timezone=auto'
  const data = await getJson<{
    daily: {
      time: string[]
      temperature_2m_max: (number | null)[]
      temperature_2m_min: (number | null)[]
      precipitation_sum: (number | null)[]
    }
  }>(url)
  const history: DailyHistory = {
    dates: data.daily.time,
    tmax: data.daily.temperature_2m_max,
    tmin: data.daily.temperature_2m_min,
    precip: data.daily.precipitation_sum,
  }
  const climate = buildClimate(history, place.lat)
  // Round the per-year lows so the cache entry stays small.
  climate.yearMin = climate.yearMin.map((r) => r.map((v) => Math.round(v)))
  cacheSet(key, climate)
  return climate
}

export async function loadForecast(place: Place): Promise<Forecast> {
  const url =
    'https://api.open-meteo.com/v1/forecast' +
    `?latitude=${place.lat}&longitude=${place.lon}` +
    '&current=temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m' +
    '&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,weather_code' +
    '&hourly=soil_temperature_6cm' +
    '&past_days=7&forecast_days=16' +
    '&temperature_unit=fahrenheit&precipitation_unit=inch&wind_speed_unit=mph&timezone=auto'
  const d = await getJson<{
    current: {
      time: string
      temperature_2m: number
      relative_humidity_2m: number
      precipitation: number
      weather_code: number
      wind_speed_10m: number
    }
    daily: {
      time: string[]
      temperature_2m_max: (number | null)[]
      temperature_2m_min: (number | null)[]
      precipitation_sum: (number | null)[]
      precipitation_probability_max: (number | null)[]
      weather_code: (number | null)[]
    }
    hourly: { time: string[]; soil_temperature_6cm: (number | null)[] }
  }>(url)

  return parseForecast(d)
}

export function parseForecast(d: {
  current: {
    time: string
    temperature_2m: number
    relative_humidity_2m: number
    precipitation: number
    weather_code: number
    wind_speed_10m: number
  }
  daily: {
    time: string[]
    temperature_2m_max: (number | null)[]
    temperature_2m_min: (number | null)[]
    precipitation_sum: (number | null)[]
    precipitation_probability_max: (number | null)[]
    weather_code: (number | null)[]
  }
  hourly: { time: string[]; soil_temperature_6cm: (number | null)[] }
}): Forecast {
  // Daily mean soil temperature from the hourly series.
  const soil = new Map<string, { sum: number; n: number }>()
  d.hourly.time.forEach((t, i) => {
    const v = d.hourly.soil_temperature_6cm[i]
    if (v == null) return
    const day = t.slice(0, 10)
    const s = soil.get(day) ?? { sum: 0, n: 0 }
    s.sum += v
    s.n++
    soil.set(day, s)
  })
  const days: ForecastDay[] = []
  d.daily.time.forEach((date, i) => {
    const tmax = d.daily.temperature_2m_max[i]
    const tmin = d.daily.temperature_2m_min[i]
    if (tmax == null || tmin == null) return
    const s = soil.get(date)
    days.push({
      date,
      tmax,
      tmin,
      precipIn: d.daily.precipitation_sum[i] ?? 0,
      precipProb: d.daily.precipitation_probability_max[i],
      code: d.daily.weather_code[i] ?? 0,
      soilF: s && s.n >= 12 ? s.sum / s.n : null,
    })
  })
  const today = d.current.time.slice(0, 10)
  const todayIndex = Math.max(0, days.findIndex((x) => x.date === today))
  return {
    current: {
      tempF: d.current.temperature_2m,
      humidity: d.current.relative_humidity_2m,
      precipIn: d.current.precipitation,
      code: d.current.weather_code,
      windMph: d.current.wind_speed_10m,
      time: d.current.time,
    },
    days,
    todayIndex,
  }
}

/** WMO weather code -> short description. */
export function describeCode(code: number): string {
  if (code === 0) return 'Clear'
  if (code <= 2) return 'Partly cloudy'
  if (code === 3) return 'Overcast'
  if (code <= 48) return 'Fog'
  if (code <= 57) return 'Drizzle'
  if (code <= 67) return 'Rain'
  if (code <= 77) return 'Snow'
  if (code <= 82) return 'Showers'
  if (code <= 86) return 'Snow showers'
  return 'Thunderstorms'
}
