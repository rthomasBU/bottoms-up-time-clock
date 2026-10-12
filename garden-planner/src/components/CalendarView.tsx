import { dayToDate, fmtDay } from '../lib/format'
import type { Plan } from '../lib/plan'

interface Task {
  day: number
  kind: 'indoors' | 'plant' | 'harvest'
  text: string
}

export default function CalendarView({ plan }: { plan: Plan }) {
  const now = new Date()
  const start = plan.today - (now.getDate() - 1) // first of this month
  const span = 366
  const pct = (day: number) => `${(Math.min(Math.max(day - start, 0), span) / span) * 100}%`
  const width = (a: number, b: number) =>
    `${((Math.min(Math.max(b - start, 0), span) - Math.min(Math.max(a - start, 0), span)) / span) * 100}%`

  const months = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1)
    const dayIdx = start + Math.round((d.getTime() - new Date(now.getFullYear(), now.getMonth(), 1).getTime()) / 864e5)
    return { label: d.toLocaleDateString(undefined, { month: 'short' }), day: dayIdx, year: d.getFullYear() }
  })

  const tasks: Task[] = []
  for (const cp of plan.crops) {
    for (const p of cp.plantings) {
      if (p.startIndoors != null && !p.buyTransplants)
        tasks.push({ day: p.startIndoors, kind: 'indoors', text: `Start ${p.plants} ${cp.crop.name} indoors` })
      const verb = cp.crop.method === 'transplant' ? 'Transplant' : 'Sow'
      tasks.push({
        day: p.plantDay,
        kind: 'plant',
        text: `${verb} ${p.plants} ${cp.crop.name}${p.buyTransplants ? ' (buy transplants)' : ''}`,
      })
      tasks.push({ day: p.maturityDay, kind: 'harvest', text: `Begin harvesting ${cp.crop.name}` })
    }
  }
  tasks.sort((a, b) => a.day - b.day)
  const byMonth = months.map((m, i) => ({
    ...m,
    tasks: tasks.filter((t) => t.day >= m.day && t.day < (months[i + 1]?.day ?? start + span)),
  }))

  return (
    <div className="stack">
      <section className="card">
        <h3>Planting &amp; harvest timeline</h3>
        <div className="legend">
          <span>
            <i className="swatch ph-indoors" /> Seedlings indoors
          </span>
          <span>
            <i className="swatch ph-grow" /> Growing
          </span>
          <span>
            <i className="swatch ph-harvest" /> Harvest
          </span>
        </div>
        <div className="gantt">
          <div className="gantt-head">
            <div className="gantt-label" />
            <div className="gantt-track">
              {months.map((m) => (
                <span key={m.day} className="gantt-month" style={{ left: pct(m.day) }}>
                  {m.label}
                </span>
              ))}
            </div>
          </div>
          {plan.crops.map((cp) => (
            <div key={cp.crop.id} className="gantt-row">
              <div className="gantt-label">{cp.crop.name}</div>
              <div className="gantt-track">
                {months.map((m) => (
                  <span key={m.day} className="gantt-tick" style={{ left: pct(m.day) }} />
                ))}
                <span className="gantt-today" style={{ left: pct(plan.today) }} />
                {cp.plantings.map((p, i) => (
                  <span key={i}>
                    {p.startIndoors != null && !p.buyTransplants && (
                      <span
                        className="seg ph-indoors"
                        style={{ left: pct(p.startIndoors), width: width(p.startIndoors, p.plantDay) }}
                        title={`${cp.crop.name}: start indoors ${fmtDay(plan.today, p.startIndoors)}`}
                      />
                    )}
                    <span
                      className="seg ph-grow"
                      style={{ left: pct(p.plantDay), width: width(p.plantDay, p.maturityDay) }}
                      title={`${cp.crop.name}: plant ${p.plants} on ${fmtDay(plan.today, p.plantDay)}`}
                    />
                    <span
                      className="seg ph-harvest"
                      style={{ left: pct(p.maturityDay), width: width(p.maturityDay, p.harvestEnd) }}
                      title={`${cp.crop.name}: harvest ${fmtDay(plan.today, p.maturityDay)} – ${fmtDay(plan.today, p.harvestEnd)}`}
                    />
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
        <p className="muted small">The vertical line marks today. Hover a bar for exact dates.</p>
      </section>

      <section className="card">
        <h3>Month by month</h3>
        <div className="months">
          {byMonth.map((m) => (
            <div key={m.day} className="month">
              <h4>
                {dayToDate(plan.today, m.day).toLocaleDateString(undefined, { month: 'long' })} {m.year}
              </h4>
              {m.tasks.length === 0 ? (
                <p className="muted small">Maintain, water, weed.</p>
              ) : (
                <ul className="tasks">
                  {m.tasks.map((t, i) => (
                    <li key={i} className={`task ${t.kind}`}>
                      <span className="task-date">{fmtDay(plan.today, t.day)}</span> {t.text}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
