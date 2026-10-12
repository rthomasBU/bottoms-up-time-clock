// Plan days are counted from Jan 1 of the start year; "today" anchors them to
// the real calendar.

export function dayToDate(today: number, day: number, now = new Date()): Date {
  const d = new Date(now)
  d.setHours(12, 0, 0, 0)
  d.setDate(d.getDate() + (day - today))
  return d
}

export function fmtDay(today: number, day: number, opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }) {
  return dayToDate(today, day).toLocaleDateString(undefined, opts)
}

export function fmtDoy(doy: number) {
  const d = new Date(2025, 0, 1 + doy)
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export const round1 = (n: number) => Math.round(n * 10) / 10

export function fmtSqFt(n: number) {
  return `${Math.round(n).toLocaleString()} sq ft`
}
