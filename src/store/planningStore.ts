import { create } from 'zustand'
import { temporal } from 'zundo'
import type { Row, Group, Milestone, BacklogItem, Task, PlanningDocument } from '@/types/planning'
import { TASK_COLORS } from '@/constants/colors'

interface PlanningState {
  rows: Row[]
  groups: Group[]
  milestones: Milestone[]
  backlog: BacklogItem[]
  taskIdCounter: number
  groupIdCounter: number
  msIdCounter: number
  backlogIdCounter: number
}

interface PlanningActions {
  // Rows
  addRow: (groupId?: number) => void
  updateRow: (id: number, patch: Partial<Row>) => void
  deleteRow: (id: number) => void
  reorderRows: (fromId: number, toId: number) => void
  moveRowToGroup: (rowId: number, groupId: number | undefined) => void

  // Tasks
  addTask: (rowId: number, task: Omit<Task, 'id'>) => number
  updateTask: (rowId: number, taskId: number, patch: Partial<Task>) => void
  deleteTask: (rowId: number, taskId: number) => void
  moveTask: (taskId: number, fromRowId: number, toRowId: number) => void

  // Groups
  addGroup: () => void
  updateGroup: (id: number, patch: Partial<Group>) => void
  deleteGroup: (id: number) => void
  toggleGroupCollapse: (id: number) => void

  // Milestones
  addMilestone: (ms: Omit<Milestone, 'id'>) => void
  updateMilestone: (id: number, patch: Partial<Milestone>) => void
  deleteMilestone: (id: number) => void

  // Backlog
  addBacklogItem: (item: Omit<BacklogItem, 'id'>) => void
  deleteBacklogItem: (id: number) => void
  promoteBacklogItem: (backlogId: number, rowId: number, start: string, end: string) => void

  // Firebase sync
  applyRemoteData: (data: PlanningDocument) => void
  getSnapshot: () => PlanningDocument
  loadSnapshot: (doc: PlanningDocument) => void
}

const DEFAULT_GROUPS: Group[] = [
  { id: 1, name: 'Gestion courante', collapsed: false },
  { id: 2, name: 'Développement',    collapsed: false },
]

export const usePlanningStore = create<PlanningState & PlanningActions>()(
  temporal(
    (set, get) => ({
      rows: [],
      groups: DEFAULT_GROUPS,
      milestones: [],
      backlog: [],
      taskIdCounter: 1,
      groupIdCounter: 3,
      msIdCounter: 1,
      backlogIdCounter: 1,

      // ── ROWS ─────────────────────────────────────────────────────────────
      addRow(groupId) {
        set(s => {
          const id = Date.now()
          const color = TASK_COLORS[s.rows.length % TASK_COLORS.length]
          return { rows: [...s.rows, { id, name: '', color, tasks: [], groupId }] }
        })
      },

      updateRow(id, patch) {
        set(s => ({ rows: s.rows.map(r => r.id === id ? { ...r, ...patch } : r) }))
      },

      deleteRow(id) {
        set(s => ({ rows: s.rows.filter(r => r.id !== id) }))
      },

      reorderRows(fromId, toId) {
        set(s => {
          const rows = [...s.rows]
          const fromIdx = rows.findIndex(r => r.id === fromId)
          const toIdx = rows.findIndex(r => r.id === toId)
          if (fromIdx === -1 || toIdx === -1) return {}
          const [item] = rows.splice(fromIdx, 1)
          rows.splice(toIdx, 0, item)
          return { rows }
        })
      },

      moveRowToGroup(rowId, groupId) {
        set(s => ({ rows: s.rows.map(r => r.id === rowId ? { ...r, groupId } : r) }))
      },

      // ── TASKS ─────────────────────────────────────────────────────────────
      addTask(rowId, task) {
        let newId = 0
        set(s => {
          newId = s.taskIdCounter
          return {
            taskIdCounter: s.taskIdCounter + 1,
            rows: s.rows.map(r => r.id === rowId
              ? { ...r, tasks: [...r.tasks, { ...task, id: newId }] }
              : r
            ),
          }
        })
        return newId
      },

      updateTask(rowId, taskId, patch) {
        set(s => ({
          rows: s.rows.map(r => r.id === rowId
            ? { ...r, tasks: r.tasks.map(t => t.id === taskId ? { ...t, ...patch } : t) }
            : r
          ),
        }))
      },

      deleteTask(rowId, taskId) {
        set(s => ({
          rows: s.rows.map(r => r.id === rowId
            ? { ...r, tasks: r.tasks.filter(t => t.id !== taskId) }
            : r
          ),
        }))
      },

      moveTask(taskId, fromRowId, toRowId) {
        set(s => {
          let task: Task | undefined
          const rows = s.rows.map(r => {
            if (r.id === fromRowId) {
              const t = r.tasks.find(t => t.id === taskId)
              if (t) task = t
              return { ...r, tasks: r.tasks.filter(t => t.id !== taskId) }
            }
            return r
          })
          if (!task) return {}
          const movedTask = task
          return {
            rows: rows.map(r => r.id === toRowId
              ? { ...r, tasks: [...r.tasks, movedTask] }
              : r
            ),
          }
        })
      },

      // ── GROUPS ────────────────────────────────────────────────────────────
      addGroup() {
        set(s => ({
          groupIdCounter: s.groupIdCounter + 1,
          groups: [...s.groups, { id: s.groupIdCounter, name: 'Nouveau groupe', collapsed: false }],
        }))
      },

      updateGroup(id, patch) {
        set(s => ({ groups: s.groups.map(g => g.id === id ? { ...g, ...patch } : g) }))
      },

      deleteGroup(id) {
        set(s => ({
          groups: s.groups.filter(g => g.id !== id),
          rows: s.rows.map(r => r.groupId === id ? { ...r, groupId: undefined } : r),
        }))
      },

      toggleGroupCollapse(id) {
        set(s => ({
          groups: s.groups.map(g => g.id === id ? { ...g, collapsed: !g.collapsed } : g),
        }))
      },

      // ── MILESTONES ────────────────────────────────────────────────────────
      addMilestone(ms) {
        set(s => ({
          msIdCounter: s.msIdCounter + 1,
          milestones: [...s.milestones, { ...ms, id: s.msIdCounter }],
        }))
      },

      updateMilestone(id, patch) {
        set(s => ({ milestones: s.milestones.map(m => m.id === id ? { ...m, ...patch } : m) }))
      },

      deleteMilestone(id) {
        set(s => ({ milestones: s.milestones.filter(m => m.id !== id) }))
      },

      // ── BACKLOG ───────────────────────────────────────────────────────────
      addBacklogItem(item) {
        set(s => ({
          backlogIdCounter: s.backlogIdCounter + 1,
          backlog: [...s.backlog, { ...item, id: s.backlogIdCounter }],
        }))
      },

      deleteBacklogItem(id) {
        set(s => ({ backlog: s.backlog.filter(b => b.id !== id) }))
      },

      promoteBacklogItem(backlogId, rowId, start, end) {
        const s = get()
        const item = s.backlog.find(b => b.id === backlogId)
        if (!item) return
        const taskId = s.taskIdCounter
        set({
          taskIdCounter: taskId + 1,
          backlog: s.backlog.filter(b => b.id !== backlogId),
          rows: s.rows.map(r => r.id === rowId
            ? {
                ...r,
                tasks: [...r.tasks, {
                  id: taskId,
                  name: item.name,
                  start,
                  end,
                  color: item.color,
                  metier: item.metier,
                }],
              }
            : r
          ),
        })
      },

      // ── FIREBASE SYNC ─────────────────────────────────────────────────────
      applyRemoteData(data) {
        if (!data || !Array.isArray(data.rows)) return
        set({
          rows: data.rows ?? [],
          groups: data.groups ?? [],
          milestones: data.milestones ?? [],
          backlog: data.backlog ?? [],
        })
      },

      getSnapshot(): PlanningDocument {
        const s = get()
        return {
          version: 2,
          rows: s.rows,
          groups: s.groups,
          milestones: s.milestones,
          backlog: s.backlog,
        }
      },

      loadSnapshot(doc) {
        set({
          rows: doc.rows ?? [],
          groups: doc.groups ?? [],
          milestones: doc.milestones ?? [],
          backlog: doc.backlog ?? [],
        })
      },
    }),
    {
      limit: 60,
      partialize: (s) => ({
        rows: s.rows,
        groups: s.groups,
        milestones: s.milestones,
        backlog: s.backlog,
      }),
    }
  )
)
