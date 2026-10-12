import { useEffect, useMemo, useState } from 'react'
import CalendarView from './components/CalendarView'
import InputForm from './components/InputForm'
import LayoutView from './components/LayoutView'
import PlanView from './components/PlanView'
import WeatherView from './components/WeatherView'
import { doyOf, type Climate } from './lib/climate'
import { buildPlan, type PlanInput } from './lib/plan'
import { loadClimate, loadForecast, lookupZip, type Forecast, type Place } from './lib/weather'

const DEFAULT_INPUT: PlanInput = {
  people: 4,
  coverage: 1,
  zip: '',
  lengthFt: 40,
  widthFt: 25,
  style: 'raisedBed',
  extension: 'none',
  excluded: [],
}

const INPUT_KEY = 'garden:input:v1'

function loadSavedInput(): PlanInput {
  try {
    const raw = localStorage.getItem(INPUT_KEY)
    return raw ? { ...DEFAULT_INPUT, ...JSON.parse(raw) } : DEFAULT_INPUT
  } catch {
    return DEFAULT_INPUT
  }
}

type Tab = 'plan' | 'calendar' | 'layout' | 'weather'
const TABS: { id: Tab; label: string }[] = [
  { id: 'plan', label: 'What to plant' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'layout', label: 'Layout' },
  { id: 'weather', label: 'Weather' },
]

export default function App() {
  const [input, setInput] = useState<PlanInput>(loadSavedInput)
  const [place, setPlace] = useState<Place | null>(null)
  const [climate, setClimate] = useState<Climate | null>(null)
  const [forecast, setForecast] = useState<Forecast | null>(null)
  const [forecastError, setForecastError] = useState<string | null>(null)
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('plan')

  useEffect(() => {
    try {
      localStorage.setItem(INPUT_KEY, JSON.stringify(input))
    } catch {
      // Not saved - fine.
    }
  }, [input])

  async function locate(zip: string) {
    setStatus('loading')
    setError(null)
    setForecastError(null)
    try {
      const p = await lookupZip(zip)
      setPlace(p)
      const [c, f] = await Promise.allSettled([loadClimate(p), loadForecast(p)])
      if (c.status === 'rejected') throw c.reason
      setClimate(c.value)
      if (f.status === 'fulfilled') setForecast(f.value)
      else {
        setForecast(null)
        setForecastError(String(f.reason?.message ?? f.reason))
      }
      setStatus('idle')
    } catch (e) {
      setStatus('error')
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  // Re-run automatically for a saved ZIP on first load.
  useEffect(() => {
    if (input.zip) void locate(input.zip)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const today = doyOf(new Date())
  const plan = useMemo(() => (climate ? buildPlan(climate, input, today) : null), [climate, input, today])

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-inner">
          <h1>Year-Round Garden Planner</h1>
          {place && (
            <span className="place">
              {place.name}, {place.state} {place.zip}
              {climate && <> · Zone {climate.zone}</>}
            </span>
          )}
        </div>
      </header>

      <main className="layout">
        <aside className="sidebar">
          <InputForm input={input} onChange={setInput} onLocate={locate} loading={status === 'loading'} />
        </aside>

        <section className="content">
          {status === 'error' && <div className="banner error">{error}</div>}
          {status === 'loading' && <div className="banner">Loading 15 years of weather history and the forecast…</div>}
          {!plan && status !== 'loading' && (
            <div className="empty">
              <h2>Grow a balanced year of vegetables</h2>
              <p>
                Enter how many people you're feeding, your ZIP code and your garden space. The planner works out how
                many of each vegetable to plant to cover the USDA's recommended mix of dark greens, red &amp; orange
                vegetables, beans, starchy vegetables and everything else - then schedules plantings around your
                local frost history and current forecast, and lays out the beds with proper spacing.
              </p>
            </div>
          )}
          {plan && climate && (
            <>
              <nav className="tabs" role="tablist">
                {TABS.map((t) => (
                  <button
                    key={t.id}
                    role="tab"
                    aria-selected={tab === t.id}
                    className={tab === t.id ? 'tab active' : 'tab'}
                    onClick={() => setTab(t.id)}
                  >
                    {t.label}
                  </button>
                ))}
              </nav>
              {tab === 'plan' && <PlanView plan={plan} />}
              {tab === 'calendar' && <CalendarView plan={plan} />}
              {tab === 'layout' && <LayoutView plan={plan} />}
              {tab === 'weather' && (
                <WeatherView plan={plan} climate={climate} forecast={forecast} forecastError={forecastError} />
              )}
            </>
          )}
        </section>
      </main>
      <footer className="footer">
        Weather: Open-Meteo (historical ERA5 reanalysis + forecast). ZIP lookup: Zippopotam.us. Diet targets: USDA
        Dietary Guidelines 2020-2025, 2,000-calorie pattern. Yields are typical home-garden averages.
      </footer>
    </div>
  )
}
