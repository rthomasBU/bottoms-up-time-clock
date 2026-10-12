// Draws the garden for a moment in the year: which crops are in the ground,
// how many plants, and where they go, at the correct spacing for the
// chosen growing style. Tall and trellised crops go on the north side so they
// don't shade the rest (northern hemisphere).

import { ANTAGONISTS, COMPANIONS, type Crop, type Family } from './crops'
import { GROW_STYLES, POT_GAP_FT, containerSize, type CropPlan, type GrowStyle } from './plan'

export type Arrangement = 'rotation' | 'companion'

export interface LayoutOptions {
  arrangement: Arrangement
  bedWidthFt: number
  bedLengthFt: number
}

export interface PlantDot {
  cropId: string
  x: number // feet
  y: number
  r: number
}

export interface Overflow {
  cropId: string
  plants: number
}

export interface BedsLayout {
  kind: 'beds'
  bedWidthFt: number
  bedLengthFt: number
  trellis: boolean
  beds: { cells: (string | null)[][]; dots: PlantDot[] }[]
  overflow: Overflow[]
}

export interface RowsLayout {
  kind: 'rows'
  lengthFt: number
  widthFt: number
  rows: { y: number; pitchFt: number; segments: { cropId: string; x0: number; x1: number }[] }[]
  dots: PlantDot[]
  overflow: Overflow[]
}

export interface ContainersLayout {
  kind: 'containers'
  lengthFt: number
  widthFt: number
  pots: { cropId: string; gal: number; plants: number; x: number; y: number; size: number }[]
  overflow: Overflow[]
}

export type Layout = BedsLayout | RowsLayout | ContainersLayout

export interface LayoutItem {
  cp: CropPlan
  plants: number
}

const ROTATION_ORDER: Family[] = ['grass', 'nightshade', 'cucurbit', 'legume', 'brassica', 'greens', 'root', 'allium']
const HEIGHT_RANK = { tall: 0, medium: 1, short: 2 }

function pairScore(a: Crop, b: Crop): number {
  const has = (list: [string, string][]) =>
    list.some(([x, y]) => (x === a.id && y === b.id) || (x === b.id && y === a.id))
  if (has(ANTAGONISTS)) return -5
  let s = has(COMPANIONS) ? 3 : 0
  if (a.family === b.family) s += 0.5
  s -= Math.abs(HEIGHT_RANK[a.height] - HEIGHT_RANK[b.height]) * 0.4
  return s
}

/** Order crops north-to-south for the chosen arrangement. */
export function orderItems(items: LayoutItem[], arrangement: Arrangement, trellisFirst = false): LayoutItem[] {
  const trellisKey = (i: LayoutItem) => (trellisFirst && i.cp.crop.vining ? 0 : 1)
  if (arrangement === 'rotation') {
    return [...items].sort(
      (a, b) =>
        trellisKey(a) - trellisKey(b) ||
        ROTATION_ORDER.indexOf(a.cp.crop.family) - ROTATION_ORDER.indexOf(b.cp.crop.family) ||
        HEIGHT_RANK[a.cp.crop.height] - HEIGHT_RANK[b.cp.crop.height],
    )
  }
  // Companion: start with the tallest, then always place the best neighbor next.
  const rest = [...items].sort(
    (a, b) => trellisKey(a) - trellisKey(b) || HEIGHT_RANK[a.cp.crop.height] - HEIGHT_RANK[b.cp.crop.height],
  )
  const out: LayoutItem[] = []
  let cur = rest.shift()
  while (cur) {
    out.push(cur)
    if (!rest.length) break
    let best = 0
    let bestScore = -Infinity
    rest.forEach((cand, i) => {
      const s = pairScore(cur!.cp.crop, cand.cp.crop) - (trellisKey(cand) - trellisKey(cur!)) * 10
      if (s > bestScore) {
        bestScore = s
        best = i
      }
    })
    cur = rest.splice(best, 1)[0]
  }
  return out
}

function dotsForCells(cropId: string, cells: [number, number][], plants: number, spacingFt: number): PlantDot[] {
  const dots: PlantDot[] = []
  if (!cells.length || plants <= 0) return dots
  if (plants >= cells.length) {
    const base = Math.floor(plants / cells.length)
    let extra = plants - base * cells.length
    for (const [cx, cy] of cells) {
      const k = base + (extra-- > 0 ? 1 : 0)
      const g = Math.ceil(Math.sqrt(k))
      const r = Math.min(0.42 / g, spacingFt / 2)
      for (let i = 0; i < k; i++) {
        dots.push({ cropId, x: cx + ((i % g) + 0.5) / g, y: cy + (Math.floor(i / g) + 0.5) / g, r })
      }
    }
  } else {
    const step = cells.length / plants
    for (let i = 0; i < plants; i++) {
      const [cx, cy] = cells[Math.floor(i * step)]
      dots.push({ cropId, x: cx + 0.5, y: cy + 0.5, r: Math.min(0.48, spacingFt / 2) })
    }
  }
  return dots
}

function bedsLayout(items: LayoutItem[], style: GrowStyle, totalAreaSqFt: number, o: LayoutOptions): BedsLayout {
  const W = o.bedWidthFt
  const L = o.bedLengthFt
  const bedCount = Math.max(1, Math.floor((totalAreaSqFt * GROW_STYLES[style].usableFraction) / (W * L)))
  const beds = Array.from({ length: bedCount }, () => ({
    cells: Array.from({ length: W }, () => Array<string | null>(L).fill(null)),
    dots: [] as PlantDot[],
  }))
  const overflow: Overflow[] = []
  let slot = 0 // running cell index across all beds, row-major, north row first
  const capacity = bedCount * W * L
  for (const { cp, plants } of orderItems(items, o.arrangement, style === 'vertical')) {
    const need = Math.max(1, Math.ceil(plants * cp.areaPerPlantSqFt - 1e-9))
    const fit = Math.min(need, capacity - slot)
    if (fit <= 0) {
      overflow.push({ cropId: cp.crop.id, plants })
      continue
    }
    const placed = fit === need ? plants : Math.floor((plants * fit) / need)
    if (placed < plants) overflow.push({ cropId: cp.crop.id, plants: plants - placed })
    const byBed = new Map<number, [number, number][]>()
    for (let i = 0; i < fit; i++, slot++) {
      const b = Math.floor(slot / (W * L))
      const within = slot % (W * L)
      const y = Math.floor(within / L)
      const x = within % L
      beds[b].cells[y][x] = cp.crop.id
      if (!byBed.has(b)) byBed.set(b, [])
      byBed.get(b)!.push([x, y])
    }
    // Split plants across beds in proportion to cells.
    let left = placed
    const entries = [...byBed.entries()]
    entries.forEach(([b, cells], idx) => {
      const n = idx === entries.length - 1 ? left : Math.round((placed * cells.length) / fit)
      left -= n
      beds[b].dots.push(...dotsForCells(cp.crop.id, cells, n, cp.crop.spacingIn / 12))
    })
  }
  return { kind: 'beds', bedWidthFt: W, bedLengthFt: L, trellis: style === 'vertical', beds, overflow }
}

function rowsLayout(items: LayoutItem[], lengthFt: number, widthFt: number, o: LayoutOptions): RowsLayout {
  // First-fit packing: a crop continues into any open row that is already at
  // least as wide as it needs (so it never widens that row); otherwise it
  // starts a new row at its own spacing on the south side.
  type OpenRow = { y: number; pitchFt: number; used: number; segments: RowsLayout['rows'][number]['segments'] }
  const rows: OpenRow[] = []
  const dots: PlantDot[] = []
  const overflow: Overflow[] = []
  let nextY = 0
  for (const { cp, plants } of orderItems(items, o.arrangement)) {
    const s = cp.crop.spacingIn / 12
    const pitch = cp.crop.rowSpacingIn / 12
    let left = plants
    while (left > 0) {
      const room = (r: OpenRow) => Math.floor((lengthFt - r.used) / s + 1e-9)
      let row = rows
        .filter((r) => r.pitchFt >= pitch - 1e-9 && r.pitchFt <= pitch * 2 && room(r) > 0)
        .sort((a, b) => a.pitchFt - b.pitchFt)[0]
      if (!row) {
        // Split the unused end of a much wider row into narrower sub-rows.
        const wide = rows.find((r) => r.pitchFt >= pitch * 2 - 1e-9 && room(r) > 0)
        if (wide) {
          const k = Math.floor(wide.pitchFt / pitch + 1e-9)
          for (let i = 0; i < k; i++) {
            rows.push({ y: wide.y + i * (wide.pitchFt / k), pitchFt: wide.pitchFt / k, used: wide.used, segments: [] })
          }
          wide.used = lengthFt
          continue
        }
      }
      if (!row) {
        if (nextY + pitch > widthFt + 1e-9) {
          overflow.push({ cropId: cp.crop.id, plants: left })
          break
        }
        row = { y: nextY, pitchFt: pitch, used: 0, segments: [] }
        rows.push(row)
        nextY += pitch
      }
      const n = Math.min(left, room(row))
      const x0 = row.used
      for (let i = 0; i < n; i++) {
        dots.push({ cropId: cp.crop.id, x: x0 + (i + 0.5) * s, y: row.y + row.pitchFt / 2, r: Math.min(s, pitch) / 2 })
      }
      row.segments.push({ cropId: cp.crop.id, x0, x1: x0 + n * s })
      row.used += n * s
      left -= n
    }
  }
  return {
    kind: 'rows',
    lengthFt,
    widthFt,
    rows: rows.map(({ y, pitchFt, segments }) => ({ y, pitchFt, segments })),
    dots,
    overflow,
  }
}

function containersLayout(items: LayoutItem[], lengthFt: number, widthFt: number, o: LayoutOptions): ContainersLayout {
  const pots: ContainersLayout['pots'] = []
  const overflow: Overflow[] = []
  const gap = POT_GAP_FT
  const aisle = 1.5 // walkway after every AISLE_EVERY rows of pots
  const AISLE_EVERY = 4
  let x = gap
  let y = gap
  let rowH = 0
  let rowCount = 0
  for (const { cp, plants } of orderItems(items, o.arrangement)) {
    const per = cp.plantsPerContainer
    const size = containerSize(cp.containerGal)
    let left = plants
    while (left > 0) {
      if (x + size > lengthFt) {
        rowCount++
        x = gap
        y += rowH + (rowCount % AISLE_EVERY === 0 ? aisle : gap)
        rowH = 0
      }
      if (y + size > widthFt) {
        overflow.push({ cropId: cp.crop.id, plants: left })
        break
      }
      const n = Math.min(per, left)
      pots.push({ cropId: cp.crop.id, gal: cp.containerGal, plants: n, x, y, size })
      x += size + gap
      rowH = Math.max(rowH, size)
      left -= n
    }
  }
  return { kind: 'containers', lengthFt, widthFt, pots, overflow }
}

export function buildLayout(
  items: LayoutItem[],
  style: GrowStyle,
  lengthFt: number,
  widthFt: number,
  o: LayoutOptions,
): Layout {
  if (style === 'inGround') return rowsLayout(items, lengthFt, widthFt, o)
  if (style === 'container') return containersLayout(items, lengthFt, widthFt, o)
  return bedsLayout(items, style, lengthFt * widthFt, o)
}
