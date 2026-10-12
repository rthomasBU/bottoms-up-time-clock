import { useState } from 'react'
import { CROPS, DIET_GROUPS, type DietGroup } from '../lib/crops'
import { GROW_STYLES, type GrowStyle, type PlanInput } from '../lib/plan'
import { SEASON_EXTENSIONS, type SeasonExtension } from '../lib/schedule'

interface Props {
  input: PlanInput
  onChange: (input: PlanInput) => void
  onLocate: (zip: string) => void
  loading: boolean
}

export default function InputForm({ input, onChange, onLocate, loading }: Props) {
  const [zip, setZip] = useState(input.zip)
  const set = <K extends keyof PlanInput>(key: K, value: PlanInput[K]) => onChange({ ...input, [key]: value })

  function toggleCrop(id: string) {
    set('excluded', input.excluded.includes(id) ? input.excluded.filter((x) => x !== id) : [...input.excluded, id])
  }

  return (
    <form
      className="form"
      onSubmit={(e) => {
        e.preventDefault()
        onChange({ ...input, zip })
        onLocate(zip)
      }}
    >
      <label className="field">
        <span>ZIP code</span>
        <div className="row">
          <input
            inputMode="numeric"
            pattern="\d{5}"
            maxLength={5}
            placeholder="e.g. 19103"
            value={zip}
            onChange={(e) => setZip(e.target.value.replace(/\D/g, ''))}
            required
          />
          <button type="submit" className="btn primary" disabled={loading}>
            {loading ? 'Loading…' : 'Plan'}
          </button>
        </div>
      </label>

      <label className="field">
        <span>People to feed</span>
        <NumberInput min={1} max={50} value={input.people} onCommit={(v) => set('people', v)} />
      </label>

      <label className="field">
        <span>
          Share of vegetables to grow: <strong>{Math.round(input.coverage * 100)}%</strong>
        </span>
        <input
          type="range"
          min={10}
          max={100}
          step={5}
          value={input.coverage * 100}
          onChange={(e) => set('coverage', Number(e.target.value) / 100)}
        />
      </label>

      <fieldset className="field">
        <legend>Available planting area</legend>
        <div className="row dims">
          <label>
            <span className="sub">Length (ft)</span>
            <NumberInput min={2} max={2000} value={input.lengthFt} onCommit={(v) => set('lengthFt', v)} />
          </label>
          <span className="times">×</span>
          <label>
            <span className="sub">Width (ft)</span>
            <NumberInput min={2} max={2000} value={input.widthFt} onCommit={(v) => set('widthFt', v)} />
          </label>
        </div>
        <span className="hint">{(input.lengthFt * input.widthFt).toLocaleString()} sq ft total</span>
      </fieldset>

      <fieldset className="field">
        <legend>Growing style</legend>
        <div className="choices">
          {(Object.keys(GROW_STYLES) as GrowStyle[]).map((s) => (
            <label key={s} className={input.style === s ? 'choice active' : 'choice'}>
              <input type="radio" name="style" checked={input.style === s} onChange={() => set('style', s)} />
              <span className="choice-title">{GROW_STYLES[s].label}</span>
              <span className="hint">{GROW_STYLES[s].blurb}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <label className="field">
        <span>Season extension</span>
        <select value={input.extension} onChange={(e) => set('extension', e.target.value as SeasonExtension)}>
          {(Object.keys(SEASON_EXTENSIONS) as SeasonExtension[]).map((k) => (
            <option key={k} value={k}>
              {SEASON_EXTENSIONS[k].label}
            </option>
          ))}
        </select>
        <span className="hint">Protection lets hardy crops keep growing into winter.</span>
      </label>

      <details className="field">
        <summary>Vegetables to include ({CROPS.length - input.excluded.length})</summary>
        {(Object.keys(DIET_GROUPS) as DietGroup[]).map((g) => (
          <div key={g} className="crop-group">
            <div className="sub">{DIET_GROUPS[g].label}</div>
            {CROPS.filter((c) => c.group === g).map((c) => (
              <label key={c.id} className="check">
                <input type="checkbox" checked={!input.excluded.includes(c.id)} onChange={() => toggleCrop(c.id)} />
                {c.name}
              </label>
            ))}
          </div>
        ))}
      </details>
    </form>
  )
}

/** Number box that lets you type freely and clamps when the value is usable or on blur. */
function NumberInput({ value, min, max, onCommit }: { value: number; min: number; max: number; onCommit: (v: number) => void }) {
  const [text, setText] = useState(String(value))
  const clamp = (n: number) => Math.min(max, Math.max(min, Math.round(n)))
  return (
    <input
      type="number"
      min={min}
      max={max}
      value={text}
      onChange={(e) => {
        setText(e.target.value)
        const n = Number(e.target.value)
        if (e.target.value !== '' && n >= min && n <= max) onCommit(Math.round(n))
      }}
      onBlur={() => {
        const n = clamp(Number(text) || min)
        setText(String(n))
        onCommit(n)
      }}
    />
  )
}
