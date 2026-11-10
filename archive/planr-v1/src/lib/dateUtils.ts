// ── DATE UTILITIES (ported from index.html) ──────────────────────────────────

export const MONTHS_FR   = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc']
export const MONTHS_FULL = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']
export const DAYS_FR     = ['Lu','Ma','Me','Je','Ve','Sa','Di']

export function startOfWeek(d: Date): Date {
  const r = new Date(d)
  const day = r.getDay()
  r.setDate(r.getDate() - ((day + 6) % 7))
  r.setHours(0, 0, 0, 0)
  return r
}

export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

export function startOfQuarter(d: Date): Date {
  return new Date(d.getFullYear(), Math.floor(d.getMonth() / 3) * 3, 1)
}

export function startOfYear(d: Date): Date {
  return new Date(d.getFullYear(), 0, 1)
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

export function addMonths(d: Date, n: number): Date {
  const r = new Date(d)
  r.setMonth(r.getMonth() + n)
  return r
}

export function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86400000)
}

export function toYMD(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function fromYMD(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function todayDate(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

export function snapDay(d: Date): Date {
  const r = new Date(d)
  r.setHours(0, 0, 0, 0)
  return r
}

export function snapWeek(d: Date): Date {
  return startOfWeek(d)
}

export function snapMonth(d: Date): Date {
  return startOfMonth(d)
}

export function snapToZoom(d: Date, zoom: string): Date {
  if (zoom === 'currentweek' || zoom === 'week') return snapDay(d)
  if (zoom === 'month') return snapWeek(d)
  if (zoom === 'quarter') return snapMonth(d)
  return startOfQuarter(d)
}

// French public holidays (fixed + approximate Easter-based)
export function isFrenchHoliday(d: Date): boolean {
  const m = d.getMonth() + 1
  const day = d.getDate()

  // Fixed holidays
  const fixed = [
    [1, 1], [5, 1], [5, 8], [7, 14], [8, 15],
    [11, 1], [11, 11], [12, 25]
  ]
  if (fixed.some(([fM, fD]) => fM === m && fD === day)) return true

  // Easter-based (approximate via Gauss algorithm)
  const year = d.getFullYear()
  const easter = easterDate(year)
  const easterMs = easter.getTime()
  const offsets = [1, 39, 50] // Lundi de Pâques, Ascension, Lundi de Pentecôte
  return offsets.some(off => {
    const h = new Date(easterMs + off * 86400000)
    return h.getMonth() + 1 === m && h.getDate() === day
  })
}

function easterDate(year: number): Date {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(year, month - 1, day)
}

export function workingDays(start: Date, end: Date): number {
  let count = 0
  let d = new Date(start)
  d.setHours(0, 0, 0, 0)
  const e = new Date(end)
  e.setHours(0, 0, 0, 0)
  while (d < e) {
    const dow = d.getDay()
    if (dow !== 0 && dow !== 6 && !isFrenchHoliday(d)) count++
    d = addDays(d, 1)
  }
  return count
}
