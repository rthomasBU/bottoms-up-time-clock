import { useMemo, useState } from 'react'
import { CROPS_BY_ID, FAMILY_LABELS, type Family } from '../lib/crops'
import { fmtDay } from '../lib/format'
import { buildLayout, type Arrangement, type Layout, type PlantDot } from '../lib/layout'
import { inGroundOn, type Plan } from '../lib/plan'

const FAMILIES = Object.keys(FAMILY_LABELS) as Family[]
const PX_PER_FT = 28

function snapshots(plan: Plan) {
  // The busiest day, plus mid-season dates across the plan year.
  const now = new Date()
  const year = now.getFullYear()
  const seasons = [
    { label: 'Spring', m: 3 },
    { label: 'Summer', m: 6 },
    { label: 'Fall', m: 9 },
    { label: 'Winter', m: 0 },
  ].map(({ label, m }) => {
    let d = new Date(year, m, 15)
    if (d < now) d = new Date(year + 1, m, 15)
    return { label, day: plan.today + Math.round((d.getTime() - now.getTime()) / 864e5) }
  })
  return [{ label: 'Busiest', day: plan.peakDay }, ...seasons.sort((a, b) => a.day - b.day)]
}

export default function LayoutView({ plan }: { plan: Plan }) {
  const snaps = useMemo(() => snapshots(plan), [plan])
  const [snapIdx, setSnapIdx] = useState(0)
  const [arrangement, setArrangement] = useState<Arrangement>('rotation')
  const [bedWidthFt, setBedWidth] = useState(4)
  const [bedLengthFt, setBedLength] = useState(8)
  const style = plan.input.style
  const usesBeds = style === 'raisedBed' || style === 'squareFoot' || style === 'vertical'

  const snap = snaps[Math.min(snapIdx, snaps.length - 1)]
  const items = useMemo(() => inGroundOn(plan.crops, snap.day), [plan, snap.day])
  const layout = useMemo(
    () =>
      buildLayout(items, style, plan.input.lengthFt, plan.input.widthFt, { arrangement, bedWidthFt, bedLengthFt }),
    [items, style, plan.input.lengthFt, plan.input.widthFt, arrangement, bedWidthFt, bedLengthFt],
  )
  const familiesShown = FAMILIES.filter((f) => items.some((i) => i.cp.crop.family === f))

  return (
    <div className="stack">
      <section className="card">
        <div className="controls">
          <div className="segmented" role="group" aria-label="Time of year">
            {snaps.map((s, i) => (
              <button key={s.label} className={i === snapIdx ? 'active' : ''} onClick={() => setSnapIdx(i)}>
                {s.label}
                <span className="sub"> {fmtDay(plan.today, s.day)}</span>
              </button>
            ))}
          </div>
          <div className="segmented" role="group" aria-label="Arrangement">
            <button className={arrangement === 'rotation' ? 'active' : ''} onClick={() => setArrangement('rotation')}>
              Rotation blocks
            </button>
            <button className={arrangement === 'companion' ? 'active' : ''} onClick={() => setArrangement('companion')}>
              Companion mix
            </button>
          </div>
          {usesBeds && (
            <label className="inline">
              Beds
              <select
                value={`${bedWidthFt}x${bedLengthFt}`}
                onChange={(e) => {
                  const [w, l] = e.target.value.split('x').map(Number)
                  setBedWidth(w)
                  setBedLength(l)
                }}
              >
                <option value="4x8">4 × 8 ft</option>
                <option value="4x12">4 × 12 ft</option>
                <option value="3x6">3 × 6 ft</option>
                <option value="3x10">3 × 10 ft</option>
              </select>
            </label>
          )}
        </div>
        <p className="muted small">
          {arrangement === 'rotation'
            ? 'Crops grouped by plant family. Shift each block one position every year so no family grows in the same spot two years running - it breaks pest and disease cycles.'
            : 'Good neighbors side by side (e.g. carrots with onions, corn with beans and squash) and known bad pairings (beans next to onions, tomatoes next to potatoes) kept apart.'}{' '}
          North is up - tall and trellised crops sit on the north side so they don't shade the rest.
        </p>
      </section>

      {items.length === 0 ? (
        <section className="card">
          <p>Nothing is in the ground on {fmtDay(plan.today, snap.day)}. Try another time of year.</p>
        </section>
      ) : (
        <section className="card">
          <h3>
            {snap.label} · {fmtDay(plan.today, snap.day, { month: 'long', day: 'numeric', year: 'numeric' })}
          </h3>
          <div className="legend">
            {familiesShown.map((f) => (
              <span key={f}>
                <i className={`swatch fam-${f}`} /> {FAMILY_LABELS[f]}
              </span>
            ))}
          </div>
          <LayoutDrawing layout={layout} />
          {layout.overflow.length > 0 && (
            <div className="banner warn small">
              Didn't fit at this spacing:{' '}
              {layout.overflow.map((o) => `${o.plants} ${CROPS_BY_ID[o.cropId].name}`).join(', ')}.
            </div>
          )}
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Vegetable</th>
                  <th className="num">Plants now</th>
                  <th>Spacing</th>
                </tr>
              </thead>
              <tbody>
                {items.map(({ cp, plants }) => (
                  <tr key={cp.crop.id}>
                    <td>
                      <span className={`code fam-${cp.crop.family}`}>{cp.crop.abbr}</span>
                    </td>
                    <td>{cp.crop.name}</td>
                    <td className="num">{plants}</td>
                    <td>
                      {style === 'squareFoot'
                        ? cp.crop.sfgPerSqFt >= 1
                          ? `${cp.crop.sfgPerSqFt} per square`
                          : `1 per ${Math.round(1 / cp.crop.sfgPerSqFt)} squares`
                        : style === 'inGround'
                          ? `${cp.crop.spacingIn}" in row · ${cp.crop.rowSpacingIn}" between rows`
                          : style === 'container'
                            ? `${cp.containerGal}-gal pot · ${cp.plantsPerContainer} per pot`
                            : `${cp.crop.spacingIn}" apart, staggered`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}

function Dots({ dots, scale }: { dots: PlantDot[]; scale: number }) {
  return (
    <>
      {dots.map((d, i) => (
        <circle
          key={i}
          className={`dot fam-${CROPS_BY_ID[d.cropId].family}`}
          cx={d.x * scale}
          cy={d.y * scale}
          r={Math.max(1.5, d.r * scale)}
        />
      ))}
    </>
  )
}

function LayoutDrawing({ layout }: { layout: Layout }) {
  const s = PX_PER_FT
  if (layout.kind === 'beds') {
    const W = layout.bedWidthFt
    const L = layout.bedLengthFt
    const usedBeds = layout.beds.filter((b) => b.cells.some((r) => r.some(Boolean)))
    const emptyBeds = layout.beds.length - usedBeds.length
    return (
      <>
        <div className="beds">
          {usedBeds.map((bed, bi) => (
            <figure key={bi} className="bed">
              <figcaption>Bed {bi + 1}</figcaption>
              <svg viewBox={`-4 -8 ${L * s + 8} ${W * s + 12}`} width={L * s + 8}>
                {layout.trellis && <line className="trellis" x1={0} x2={L * s} y1={-4} y2={-4} />}
                <rect className="bed-frame" x={0} y={0} width={L * s} height={W * s} rx={3} />
                {bed.cells.map((row, y) =>
                  row.map((id, x) => (
                    <g key={`${x}-${y}`}>
                      <rect
                        className={id ? `cell fam-${CROPS_BY_ID[id].family}` : 'cell empty'}
                        x={x * s}
                        y={y * s}
                        width={s}
                        height={s}
                      />
                    </g>
                  )),
                )}
                <Dots dots={bed.dots} scale={s} />
                {/* One code label at the start of each crop's run. */}
                {bed.cells.map((row, y) =>
                  row.map((id, x) => {
                    const prev = x > 0 ? row[x - 1] : y > 0 ? bed.cells[y - 1][L - 1] : null
                    if (!id || id === prev) return null
                    return (
                      <text key={`l${x}-${y}`} className="cell-label" x={x * s + 3} y={y * s + 10}>
                        {CROPS_BY_ID[id].abbr}
                      </text>
                    )
                  }),
                )}
              </svg>
            </figure>
          ))}
        </div>
        <p className="muted small">
          Each square is 1 ft. {usedBeds.length} of {layout.beds.length} beds in use
          {emptyBeds > 0 ? ` - ${emptyBeds} free for cover crops or extra plantings` : ''}. Leave 18-24" paths between
          beds.{layout.trellis ? ' The heavy line on each bed is the trellis.' : ''}
        </p>
      </>
    )
  }

  if (layout.kind === 'rows') {
    const scale = Math.min(s, 900 / layout.lengthFt)
    return (
      <>
        <div className="chart-wrap">
          <svg
            viewBox={`-4 -4 ${layout.lengthFt * scale + 8} ${layout.widthFt * scale + 8}`}
            width={layout.lengthFt * scale + 8}
          >
            <rect className="bed-frame" x={0} y={0} width={layout.lengthFt * scale} height={layout.widthFt * scale} />
            {layout.rows.map((r, i) =>
              r.segments.map((seg, j) => (
                <g key={`${i}-${j}`}>
                  <rect
                    className={`row-band fam-${CROPS_BY_ID[seg.cropId].family}`}
                    x={seg.x0 * scale}
                    y={r.y * scale}
                    width={(seg.x1 - seg.x0) * scale}
                    height={r.pitchFt * scale}
                  />
                  <text className="cell-label" x={seg.x0 * scale + 3} y={r.y * scale + 10}>
                    {CROPS_BY_ID[seg.cropId].abbr}
                  </text>
                </g>
              )),
            )}
            <Dots dots={layout.dots} scale={scale} />
          </svg>
        </div>
        <p className="muted small">
          {layout.rows.length} rows running the {layout.lengthFt} ft length. Band height = row spacing (includes the
          walking path).
        </p>
      </>
    )
  }

  const scale = Math.min(s, 900 / layout.lengthFt)
  return (
    <>
      <div className="chart-wrap">
        <svg
          viewBox={`-4 -4 ${layout.lengthFt * scale + 8} ${layout.widthFt * scale + 8}`}
          width={layout.lengthFt * scale + 8}
        >
          <rect className="bed-frame" x={0} y={0} width={layout.lengthFt * scale} height={layout.widthFt * scale} />
          {layout.pots.map((p, i) => (
            <g key={i}>
              <title>
                {`${CROPS_BY_ID[p.cropId].name}: ${p.plants} in a ${p.gal}-gal pot`}
              </title>
              <circle
                className={`pot fam-${CROPS_BY_ID[p.cropId].family}`}
                cx={(p.x + p.size / 2) * scale}
                cy={(p.y + p.size / 2) * scale}
                r={(p.size / 2) * scale}
              />
              <text
                className="pot-label"
                x={(p.x + p.size / 2) * scale}
                y={(p.y + p.size / 2) * scale + 4}
                textAnchor="middle"
              >
                {CROPS_BY_ID[p.cropId].abbr}
              </text>
            </g>
          ))}
        </svg>
      </div>
      <p className="muted small">{layout.pots.length} containers, 3" apart, with an 18" aisle every 4 rows. Hover a pot for details.</p>
    </>
  )
}
