import { DIET_GROUPS, type DietGroup } from '../lib/crops'
import { fmtDay, fmtSqFt } from '../lib/format'
import { BUFFER, GROW_STYLES, type CropPlan, type Plan } from '../lib/plan'
import SupplyChart from './SupplyChart'

function spacingText(cp: CropPlan, style: Plan['input']['style']): string {
  const c = cp.crop
  switch (style) {
    case 'inGround':
      return `${c.spacingIn}" apart, rows ${c.rowSpacingIn}" apart`
    case 'squareFoot':
      return c.sfgPerSqFt >= 1 ? `${c.sfgPerSqFt} per sq ft` : `1 per ${Math.round(1 / c.sfgPerSqFt)} sq ft`
    case 'container':
      return cp.plantsPerContainer > 1
        ? `${cp.plantsPerContainer} per ${cp.containerGal}-gal pot`
        : `1 per ${cp.containerGal}-gal pot`
    case 'vertical':
      return `${c.spacingIn}" offset grid${c.vining ? ', on trellis' : ''}`
    default:
      return `${c.spacingIn}" offset grid`
  }
}

export default function PlanView({ plan }: { plan: Plan }) {
  const { input } = plan
  const short = plan.fullPeakAreaSqFt > plan.usableAreaSqFt * 1.001
  const fullArea = plan.fullPeakAreaSqFt / GROW_STYLES[input.style].usableFraction
  const dropped = plan.droppedForSpace
  const totalPlants = plan.crops.reduce((s, cp) => s + cp.totalPlants, 0)
  const totalLb = plan.crops.reduce((s, cp) => s + cp.expectedYieldLb, 0)

  return (
    <div className="stack">
      <div className="tiles">
        <div className="tile">
          <div className="tile-label">Expected harvest</div>
          <div className="tile-value">{Math.round(totalLb).toLocaleString()} lb/yr</div>
          <div className="tile-sub">
            {Math.round(totalLb / input.people)} lb per person · target{' '}
            {Math.round(plan.crops.reduce((s, cp) => s + cp.annualNeedLb, 0) / input.people)}
          </div>
        </div>
        <div className="tile">
          <div className="tile-label">Plants over the year</div>
          <div className="tile-value">{totalPlants.toLocaleString()}</div>
          <div className="tile-sub">{plan.crops.length} vegetables</div>
        </div>
        <div className="tile">
          <div className="tile-label">Space at peak</div>
          <div className="tile-value">{fmtSqFt(plan.peakAreaSqFt)}</div>
          <div className="tile-sub">
            of {fmtSqFt(plan.usableAreaSqFt)} growing space · busiest {fmtDay(plan.today, plan.peakDay)}
          </div>
        </div>
      </div>

      {short ? (
        <div className="banner warn">
          <strong>Your space covers about {Math.round(plan.spaceScale * 100)}% of the goal.</strong> Every crop was
          scaled down to fit{dropped.length ? ` and ${dropped.map((c) => c.name).join(', ')} didn't fit at all` : ''}. Feeding {input.people} {input.people === 1 ? 'person' : 'people'} fully as{' '}
          {GROW_STYLES[input.style].label.toLowerCase()} takes about {fmtSqFt(fullArea)} - or lower the share to grow,
          add season extension, or switch to a more intensive style.
        </div>
      ) : (
        <div className="banner ok">
          Your {fmtSqFt(input.lengthFt * input.widthFt)} fits the full plan with{' '}
          {fmtSqFt(plan.usableAreaSqFt - plan.peakAreaSqFt)} of growing space to spare at the busiest time.
        </div>
      )}

      <SupplyChart plan={plan} />

      {(Object.keys(DIET_GROUPS) as DietGroup[]).map((g) => {
        const rows = plan.crops.filter((cp) => cp.crop.group === g)
        if (!rows.length) return null
        return (
          <section key={g} className="card">
            <h3>
              {DIET_GROUPS[g].label}
              <span className="muted"> · {DIET_GROUPS[g].cupsPerWeek} cups/person/week</span>
            </h3>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Vegetable</th>
                    <th className="num">Plants</th>
                    <th>Plantings</th>
                    <th>Spacing</th>
                    <th className="num">Space</th>
                    <th className="num">Yield</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((cp) => {
                    const per = cp.plantings[0]?.plants ?? 0
                    return (
                      <tr key={cp.crop.id}>
                        <td>
                          <div className="crop-name">{cp.crop.name}</div>
                          {cp.crop.note && <div className="muted small">{cp.crop.note}</div>}
                        </td>
                        <td className="num">{cp.totalPlants.toLocaleString()}</td>
                        <td>
                          {cp.plantings.length === 1
                            ? `Once, ${fmtDay(plan.today, cp.plantings[0].plantDay)}`
                            : `${cp.plantings.length} × ${per} (${fmtDay(plan.today, cp.plantings[0].plantDay)} – ${fmtDay(
                                plan.today,
                                cp.plantings[cp.plantings.length - 1].plantDay,
                              )})`}
                        </td>
                        <td>{spacingText(cp, input.style)}</td>
                        <td className="num">{Math.ceil(per * cp.areaPerPlantSqFt)} sq ft</td>
                        <td className="num">
                          {Math.round(cp.expectedYieldLb)} lb
                          {cp.expectedYieldLb < cp.annualNeedLb * 0.95 && (
                            <div className="muted small">of {Math.round(cp.annualNeedLb)} needed</div>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )
      })}

      {plan.unsuitable.length > 0 && (
        <section className="card">
          <h3>Left out for this location</h3>
          <p className="muted small">Their share of the diet was moved to other crops in the same group.</p>
          <ul className="plain">
            {plan.unsuitable.map((u) => (
              <li key={u.crop.id}>
                <strong>{u.crop.name}</strong> - {u.reason}
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="muted small">
        "Space" is per planting, at the plant spacing above. Need includes a {Math.round(BUFFER * 100)}% buffer for pests, weather and
        spoilage. Yield assumes typical home-garden care.
      </p>
    </div>
  )
}
