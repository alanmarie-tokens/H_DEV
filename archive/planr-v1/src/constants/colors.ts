export const TASK_COLORS = [
  '#6366f1', '#22c55e', '#f59e0b', '#ef4444',
  '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16',
  '#f97316', '#a78bfa',
]

export const TASK_STATUSES = [
  { id: 'todo',        label: 'À faire',   color: '#71717a', icon: '○' },
  { id: 'in_progress', label: 'En cours',  color: '#6366f1', icon: '◑' },
  { id: 'done',        label: 'Terminé',   color: '#22c55e', icon: '●' },
] as const

export const BATIMENT_PALETTE = [
  { bg: '#1a2e3d', fg: '#38bdf8' },
  { bg: '#1e3a5f', fg: '#60a5fa' },
  { bg: '#1a3d2e', fg: '#34d399' },
  { bg: '#2d2010', fg: '#fbbf24' },
  { bg: '#3b1f5e', fg: '#c084fc' },
  { bg: '#3d1a2a', fg: '#f472b6' },
  { bg: '#1f2f1a', fg: '#86efac' },
  { bg: '#2d1a10', fg: '#fb923c' },
  { bg: '#1e1e2e', fg: '#a5b4fc' },
  { bg: '#232323', fg: '#94a3b8' },
]

export const METIER_PALETTE = [
  { bg: '#1e3a5f', fg: '#60a5fa' },
  { bg: '#3b1f5e', fg: '#c084fc' },
  { bg: '#1a3d2e', fg: '#34d399' },
  { bg: '#3d2a10', fg: '#fb923c' },
  { bg: '#3d1a2a', fg: '#f472b6' },
  { bg: '#1f2f1a', fg: '#86efac' },
  { bg: '#1a2e3d', fg: '#38bdf8' },
  { bg: '#2d2010', fg: '#fbbf24' },
  { bg: '#1e1e2e', fg: '#a5b4fc' },
  { bg: '#232323', fg: '#94a3b8' },
]

export function batimentColor(name: string) {
  if (!name) return BATIMENT_PALETTE[0]
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = (hash * 37 + name.charCodeAt(i)) & 0xffff
  return BATIMENT_PALETTE[hash % BATIMENT_PALETTE.length]
}

export function metierColor(name: string) {
  if (!name) return null
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) & 0xffff
  return METIER_PALETTE[hash % METIER_PALETTE.length]
}
