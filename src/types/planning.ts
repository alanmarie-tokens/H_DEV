// ── PLANNING DATA TYPES ──────────────────────────────────────────────────────

export type ZoomLevel = 'currentweek' | 'week' | 'month' | 'quarter' | 'year'
export type TaskStatus = 'todo' | 'in_progress' | 'done'
export type ActiveTab = 'gantt' | 'dashboard' | 'list'

export interface HistoryEntry {
  date: string      // ISO timestamp
  from: number
  to: number
  note: string
}

export interface Objective {
  id: string
  name: string
  start?: number
  current?: number
  target?: number
  history: HistoryEntry[]
}

export interface Subtask {
  id: string
  name: string
  done: boolean
}

export interface Task {
  id: number
  name: string
  start: string    // YYYY-MM-DD
  end: string      // YYYY-MM-DD
  color: string    // hex
  tjm?: number
  etp?: number
  progress?: number   // 0–100
  status?: TaskStatus | null
  notes?: string
  metier?: string
  batiments?: string[]
  objectives?: Objective[]
  subtasks?: Subtask[]
  deps?: number[]
  createdBy?: string | null
}

export interface Row {
  id: number
  name: string
  color: string
  tasks: Task[]
  groupId?: number
  metier?: string
}

export interface Group {
  id: number
  name: string
  collapsed: boolean
}

export interface Milestone {
  id: number
  name: string
  date: string    // YYYY-MM-DD
  color: string
  rowId?: number
}

export interface BacklogItem {
  id: number
  name: string
  color: string
  duration?: number  // days
  metier?: string
}

// ── VIEW GEOMETRY ────────────────────────────────────────────────────────────

export interface ViewColumn {
  date: Date
  label: string
  sublabel?: number
  isToday: boolean
  isWeekend?: boolean
  isCurrentWeek?: boolean
}

export interface MonthGroup {
  label: string
  colStart: number
  colSpan: number
  isCurrent: boolean
  year?: number
}

export interface ViewGeometry {
  viewColumns: ViewColumn[]
  monthGroups: MonthGroup[]
  colCount: number
}

// ── UI STATE ─────────────────────────────────────────────────────────────────

export interface FilterState {
  text: string
  status: string | null       // 'active' | 'upcoming' | 'done' | null
  userStatus: string | null   // TaskStatus | null
  batiment: string | null
}

export interface ModalState {
  rowId: number | null
  editTaskId: number | null
  clickPercent: number
}

// ── FIREBASE SYNC ────────────────────────────────────────────────────────────

export interface PlanningDocument {
  version: number
  rows: Row[]
  groups: Group[]
  milestones: Milestone[]
  backlog?: BacklogItem[]
  _clientId?: string
  _savedAt?: number
}

export interface UserPresence {
  name: string
  color: string
  clientId: string
  lastSeen: number
}
