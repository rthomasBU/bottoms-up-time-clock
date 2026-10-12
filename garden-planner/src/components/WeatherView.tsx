import { forecastAdvice } from '../lib/advice'
import type { Climate } from '../lib/climate'
import { fmtDoy } from '../lib/format'
import type { Plan } from '../lib/plan'
import { SEASON_EXTENSIONS } from '../lib/schedule'
import { describeCode, type Forecast } from '../lib/weather'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

interface Props {
  plan: Plan
  climate: Climate
  forecast: Forecast | null
  forecastError: string | null
}

export default function WeatherView({ plan, climate, forecast, forecastError }: Props) {
  const advice = forecast
    ? forecastAdvice(plan, climate, forecast, SEASON_EXTENSIONS[plan.input.extension].minBonusF)
    : []
  const upcoming = forecast ? forecast.days.slice(forecast.todayIndex) : []
  const recentSoil = forecast
    ? forecast.days
        .slice(Math.max(0, forecast.todayIndex - 3), forecast.todayIndex + 1)
        .map((d) => d.soilF)
        .filter((v): v is number => v != null)
    : []
  const soilNow = recentSoil.length ? recentSoil.reduce((a, b) => a + b, 0) / recentSoil.length : null

  return (
    <div className="stack">
      {forecastError && <div className="banner warn">Forecast unavailable right now ({forecastError}).</div>}

      {forecast && (
        <>
          <section className="card">
            <h3>This week in the garden</h3>
            <ul className="advice">
              {advice.map((a, i) => (
                <li key={i} className={`advice-item ${a.level}`}>
                  <span className="advice-tag">
                    {a.level === 'go' ? 'Go' : a.level === 'wait' ? 'Wait' : a.level === 'warn' ? 'Heads up' : 'Note'}
                  </span>
                  <div>
                    <strong>{a.title}</strong>
                    {a.detail && <div className="muted small">{a.detail}</div>}
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section className="card">
            <h3>
              Now: {Math.round(forecast.current.tempF)}°F, {describeCode(forecast.current.code).toLowerCase()}
            </h3>
            <p className="muted small">
              Humidity {forecast.current.humidity}% · wind {Math.round(forecast.current.windMph)} mph
              {soilNow != null && <> · soil at 2" depth {Math.round(soilNow)}°F (3-day average)</>}
            </p>
            <div className="forecast">
              {upcoming.map((d) => (
                <div key={d.date} className={`fc-day${d.tmin <= 32 ? ' frost' : ''}`}>
                  <div className="fc-date">
                    {new Date(d.date + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' })}
                  </div>
                  <div className="fc-desc">{describeCode(d.code)}</div>
                  <div className="fc-temp">
                    <strong>{Math.round(d.tmax)}°</strong> / {Math.round(d.tmin)}°
                  </div>
                  <div className="fc-sub">
                    {d.precipIn >= 0.01 ? `${d.precipIn.toFixed(2)}"` : 'dry'}
                    {d.precipProb != null && d.precipIn >= 0.01 ? ` · ${d.precipProb}%` : ''}
                  </div>
                  {d.soilF != null && <div className="fc-sub">soil {Math.round(d.soilF)}°</div>}
                  {d.tmin <= 32 && <div className="fc-flag">Frost</div>}
                </div>
              ))}
            </div>
          </section>
        </>
      )}

      <section className="card">
        <h3>Your climate ({climate.years[0]}–{climate.years[climate.years.length - 1]})</h3>
        <div className="tiles">
          <div className="tile">
            <div className="tile-label">Hardiness zone (approx.)</div>
            <div className="tile-value">{climate.zone}</div>
            <div className="tile-sub">avg. coldest night {Math.round(climate.avgExtremeMinF)}°F</div>
          </div>
          <div className="tile">
            <div className="tile-label">Last spring frost</div>
            <div className="tile-value">{climate.lastFrost ? fmtDoy(climate.lastFrost.median) : 'Rare'}</div>
            <div className="tile-sub">
              {climate.lastFrost ? `safe by ${fmtDoy(climate.lastFrost.safe)} (9 years in 10)` : 'frost-free most years'}
            </div>
          </div>
          <div className="tile">
            <div className="tile-label">First fall frost</div>
            <div className="tile-value">{climate.firstFrost ? fmtDoy(climate.firstFrost.median) : 'Rare'}</div>
            <div className="tile-sub">
              {climate.firstFrost ? `as early as ${fmtDoy(climate.firstFrost.safe)} (1 year in 10)` : 'frost-free most years'}
            </div>
          </div>
          <div className="tile">
            <div className="tile-label">Frost-free season</div>
            <div className="tile-value">{climate.frostFreeDays} days</div>
            <div className="tile-sub">frost in {Math.round(climate.frostYearFraction * 100)}% of years</div>
          </div>
        </div>
        <div className="table-wrap">
          <table className="compact">
            <thead>
              <tr>
                <th />
                {MONTHS.map((m) => (
                  <th key={m} className="num">
                    {m}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <th>Avg high °F</th>
                {climate.monthly.map((m, i) => (
                  <td key={i} className="num">
                    {Math.round(m.avgHigh)}
                  </td>
                ))}
              </tr>
              <tr>
                <th>Avg low °F</th>
                {climate.monthly.map((m, i) => (
                  <td key={i} className={`num${m.avgLow <= 32 ? ' cold' : ''}`}>
                    {Math.round(m.avgLow)}
                  </td>
                ))}
              </tr>
              <tr>
                <th>Rain (in)</th>
                {climate.monthly.map((m, i) => (
                  <td key={i} className="num">
                    {m.precipIn.toFixed(1)}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
        <p className="muted small">
          From daily weather reanalysis for your ZIP's coordinates. Reanalysis smooths out very local cold pockets, so
          if your garden sits in a low spot, plant tender crops a week later than shown.
        </p>
      </section>
    </div>
  )
}
