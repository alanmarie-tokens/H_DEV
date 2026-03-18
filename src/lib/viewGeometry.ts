// ── VIEW GEOMETRY (pure functions, ported from index.html) ───────────────────
import type { ZoomLevel, ViewGeometry, ViewColumn, MonthGroup } from '@/types/planning'
import {
  startOfWeek, startOfMonth, startOfYear, addDays, addMonths, daysBetween,
  todayDate, MONTHS_FR, DAYS_FR,
} from './dateUtils'

export function computeView(zoom: ZoomLevel, viewStart: Date): ViewGeometry {
  const today = todayDate()
  const viewColumns: ViewColumn[] = []
  const monthGroups: MonthGroup[] = []
  let colCount = 0

  if (zoom === 'currentweek') {
    const ws = startOfWeek(today)
    monthGroups.push({
      label: `Semaine du ${ws.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}`,
      colStart: 0,
      colSpan: 7,
      isCurrent: true,
    })
    for (let i = 0; i < 7; i++) {
      const d = addDays(ws, i)
      viewColumns.push({
        date: d,
        label: DAYS_FR[(d.getDay() + 6) % 7],
        sublabel: d.getDate(),
        isToday: daysBetween(today, d) === 0,
        isWeekend: d.getDay() === 0 || d.getDay() === 6,
        isCurrentWeek: true,
      })
    }
    colCount = 7

  } else if (zoom === 'week') {
    const ws = startOfWeek(viewStart)
    const totalDays = 8 * 7
    let colIdx = 0
    let curMonth = -1, curMonthStart = 0

    for (let i = 0; i < totalDays; i++) {
      const d = addDays(ws, i)
      const m = d.getMonth()
      if (m !== curMonth) {
        if (curMonth !== -1) {
          monthGroups[monthGroups.length - 1].colSpan = colIdx - curMonthStart
        }
        curMonth = m
        curMonthStart = colIdx
        monthGroups.push({
          label: `${MONTHS_FR[m]} ${d.getFullYear()}`,
          colStart: colIdx,
          colSpan: 0,
          isCurrent: d.getFullYear() === today.getFullYear() && m === today.getMonth(),
        })
      }
      viewColumns.push({
        date: d,
        label: DAYS_FR[(d.getDay() + 6) % 7] + ' ' + d.getDate(),
        isToday: daysBetween(today, d) === 0,
        isWeekend: d.getDay() === 0 || d.getDay() === 6,
      })
      colIdx++
    }
    if (monthGroups.length) monthGroups[monthGroups.length - 1].colSpan = colIdx - monthGroups[monthGroups.length - 1].colStart
    colCount = totalDays

  } else if (zoom === 'month') {
    const ms = startOfMonth(viewStart)
    const end = addMonths(ms, 12)
    let w = startOfWeek(ms)
    let colIdx = 0
    let curMonth = -1, curMonthStart = 0

    while (w < end) {
      const thu = addDays(w, 3)
      const tm = thu.getMonth()
      const tyr = thu.getFullYear()

      const lastGroup = monthGroups[monthGroups.length - 1]
      if (tm !== curMonth || tyr !== lastGroup?.year) {
        if (curMonth !== -1) {
          monthGroups[monthGroups.length - 1].colSpan = colIdx - curMonthStart
        }
        curMonth = tm
        curMonthStart = colIdx
        monthGroups.push({
          label: `${MONTHS_FR[tm]} ${tyr}`,
          colStart: colIdx,
          colSpan: 0,
          isCurrent: tyr === today.getFullYear() && tm === today.getMonth(),
          year: tyr,
        })
      }

      const jan1 = new Date(tyr, 0, 1)
      const wn = Math.ceil(((w.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7)
      const isToday = w <= today && today < addDays(w, 7)

      viewColumns.push({ date: new Date(w), label: `S${wn}`, isToday })
      w = addDays(w, 7)
      colIdx++
    }
    if (monthGroups.length) monthGroups[monthGroups.length - 1].colSpan = colIdx - monthGroups[monthGroups.length - 1].colStart
    colCount = colIdx

  } else if (zoom === 'quarter') {
    const ys = startOfYear(viewStart)
    colCount = 4 * 12
    for (let i = 0; i < colCount; i++) {
      const d = addMonths(ys, i)
      const m = d.getMonth()
      const yr = d.getFullYear()
      if (m % 3 === 0) {
        const q = Math.floor(m / 3) + 1
        monthGroups.push({
          label: `T${q} ${yr}`,
          colStart: i,
          colSpan: 3,
          isCurrent: yr === today.getFullYear() && Math.floor(today.getMonth() / 3) === q - 1,
        })
      }
      viewColumns.push({
        date: d,
        label: MONTHS_FR[m],
        isToday: yr === today.getFullYear() && m === today.getMonth(),
      })
    }

  } else {
    // year
    const ys = startOfYear(viewStart)
    colCount = 4 * 4
    for (let i = 0; i < colCount; i++) {
      const d = addMonths(ys, i * 3)
      const yr = d.getFullYear()
      const q = Math.floor(d.getMonth() / 3)
      if (q === 0) {
        monthGroups.push({
          label: String(yr),
          colStart: i,
          colSpan: 4,
          isCurrent: yr === today.getFullYear(),
        })
      }
      viewColumns.push({
        date: d,
        label: `T${q + 1}`,
        isToday: yr === today.getFullYear() && Math.floor(today.getMonth() / 3) === q,
      })
    }
  }

  return { viewColumns, monthGroups, colCount }
}

export function viewRangeStart(viewColumns: ViewColumn[]): Date {
  return viewColumns.length ? viewColumns[0].date : todayDate()
}

export function viewRangeEnd(viewColumns: ViewColumn[], zoom: ZoomLevel): Date {
  if (!viewColumns.length) return todayDate()
  const last = viewColumns[viewColumns.length - 1].date
  return addDays(last, unitDurationDays(zoom))
}

export function unitDurationDays(zoom: ZoomLevel): number {
  if (zoom === 'currentweek' || zoom === 'week') return 1
  if (zoom === 'month') return 7
  if (zoom === 'quarter') return 30
  return 91
}

export function dateToPct(
  d: Date,
  rangeStart: Date,
  rangeEnd: Date
): number {
  const vs = rangeStart.getTime()
  const ve = rangeEnd.getTime()
  return (d.getTime() - vs) / (ve - vs)
}

export function pctToDate(
  pct: number,
  rangeStart: Date,
  rangeEnd: Date
): Date {
  const vs = rangeStart.getTime()
  const ve = rangeEnd.getTime()
  return new Date(vs + pct * (ve - vs))
}

export function getColWidth(
  scrollContainerWidth: number,
  labelW: number,
  recapW: number,
  zoom: ZoomLevel,
  colCount: number
): number {
  const availableW = scrollContainerWidth - labelW - recapW
  const minWidths: Record<ZoomLevel, number> = {
    currentweek: 80,
    week: 36,
    month: 38,
    quarter: 44,
    year: 60,
  }
  if (zoom === 'currentweek') return Math.max(80, availableW / 7)
  return Math.max(minWidths[zoom], availableW / colCount)
}
