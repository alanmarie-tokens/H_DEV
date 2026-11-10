import type { ZoomLevel } from '@/types/planning'

export const ZOOM_CONFIG: Record<ZoomLevel, { span: number; unitType: string; unitsPerMonth: number | null }> = {
  currentweek: { span: 1,  unitType: 'day',     unitsPerMonth: null },
  week:        { span: 8,  unitType: 'day',     unitsPerMonth: null },
  month:       { span: 12, unitType: 'week',    unitsPerMonth: null },
  quarter:     { span: 12, unitType: 'month',   unitsPerMonth: 1 },
  year:        { span: 4,  unitType: 'quarter', unitsPerMonth: null },
}

export const ZOOM_LEVELS: ZoomLevel[] = ['currentweek', 'week', 'month', 'quarter', 'year']

export const ZOOM_LABELS: Record<ZoomLevel, string> = {
  currentweek: 'Semaine',
  week:        '8 sem.',
  month:       '12 mois',
  quarter:     '4 ans',
  year:        'Vue large',
}

export const MIN_COL_WIDTHS: Record<ZoomLevel, number> = {
  currentweek: 80,
  week:        36,
  month:       38,
  quarter:     44,
  year:        60,
}
