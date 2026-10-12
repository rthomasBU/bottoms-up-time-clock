import { useState } from 'react'
import { fmtDay, round1 } from '../lib/format'
import type { Plan } from '../lib/plan'

const W = 640
const H = 220
const PAD = { l: 36, r: 12, t: 12, b: 28 }

/** Stacked monthly bars: cups of vegetables per person per day, fresh vs from storage. */
export default function SupplyChart({ plan }: { plan: Plan }) {
  const [hover, setHover] = useState<number | null>(null)
  const data = plan.monthlySupply
  const max = Math.max(plan.targetCupsPerDay * 1.25, ...data.map((d) => d.fresh + d.stored))
  const yMax = Math.ceil(max)
  const innerW = W - PAD.l - PAD.r
  const innerH = H - PAD.t - PAD.b
  const slot = innerW / data.length
  const barW = Math.min(36, slot * 0.62)
  const y = (v: number) => PAD.t + innerH - (v / yMax) * innerH
  const label = (m: number) => fmtDay(plan.today, plan.today + Math.round((m * 365) / 12), { month: 'short' })
  const ticks = Array.from({ length: yMax + 1 }, (_, i) => i).filter((t) => yMax <= 6 || t % 2 === 0)
  const lowMonths = data.filter((d) => d.fresh + d.stored < plan.targetCupsPerDay * 0.6).length

  return (
    <section className="card viz">
      <h3>Year-round supply</h3>
      <p className="muted small">
        Cups of vegetables per person per day once the plan has run a full year, against the{' '}
        {round1(plan.targetCupsPerDay)}-cup target.
        {lowMonths > 0 &&
          ` ${lowMonths} month${lowMonths > 1 ? 's fall' : ' falls'} well short - the "hungry gap" before spring crops come in. Season extension or more storage crops help.`}
      </p>
      <div className="legend">
        <span>
          <i className="swatch s1" /> Fresh from the garden
        </span>
        <span>
          <i className="swatch s2" /> From storage / preserved
        </span>
        <span>
          <i className="swatch target" /> Daily target
        </span>
      </div>
      <div className="chart-wrap">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Monthly vegetable supply per person">
          {ticks.map((t) => (
            <g key={t}>
              <line className="grid" x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} />
              <text className="axis" x={PAD.l - 6} y={y(t) + 4} textAnchor="end">
                {t}
              </text>
            </g>
          ))}
          {data.map((d, i) => {
            const x = PAD.l + slot * i + (slot - barW) / 2
            const gap = d.fresh > 0 && d.stored > 0 ? 2 : 0
            const hFresh = Math.max(0, y(0) - y(d.fresh))
            const hStored = Math.max(0, y(0) - y(d.stored) - gap)
            return (
              <g key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
                <rect className="hit" x={PAD.l + slot * i} y={PAD.t} width={slot} height={innerH} />
                {hFresh > 0 && <rect className="bar s1" x={x} y={y(d.fresh)} width={barW} height={hFresh} rx={2} />}
                {hStored > 0 && (
                  <rect className="bar s2" x={x} y={y(d.fresh + d.stored)} width={barW} height={hStored} rx={2} />
                )}
                <text className="axis" x={x + barW / 2} y={H - 8} textAnchor="middle">
                  {label(i)}
                </text>
              </g>
            )
          })}
          <line
            className="target-line"
            x1={PAD.l}
            x2={W - PAD.r}
            y1={y(plan.targetCupsPerDay)}
            y2={y(plan.targetCupsPerDay)}
          />
          {hover != null && (
            <g pointerEvents="none">
              {(() => {
                const d = data[hover]
                const bx = PAD.l + slot * hover + slot / 2
                const tx = Math.min(Math.max(bx - 70, PAD.l), W - PAD.r - 140)
                return (
                  <>
                    <rect className="tip" x={tx} y={PAD.t} width={140} height={58} rx={6} />
                    <text className="tip-text strong" x={tx + 10} y={PAD.t + 17}>
                      {label(hover)} - {round1(d.fresh + d.stored)} cups/day
                    </text>
                    <text className="tip-text" x={tx + 10} y={PAD.t + 33}>
                      Fresh {round1(d.fresh)}
                    </text>
                    <text className="tip-text" x={tx + 10} y={PAD.t + 48}>
                      Stored {round1(d.stored)}
                    </text>
                  </>
                )
              })()}
            </g>
          )}
        </svg>
      </div>
    </section>
  )
}
