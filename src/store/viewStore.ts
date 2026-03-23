import { create } from 'zustand'
import type { ZoomLevel, ActiveTab, ReportingSubTab, FilterState, ModalState } from '@/types/planning'
import { startOfMonth, startOfWeek, addMonths, addDays, startOfYear, todayDate } from '@/lib/dateUtils'

interface ViewState {
  zoom: ZoomLevel
  viewStart: Date
  activeTab: ActiveTab
  sidebarCollapsed: boolean
  filterVisible: boolean
  histogramVisible: boolean
  backlogVisible: boolean
  filterState: FilterState
  modalState: ModalState | null
  milestoneModalOpen: boolean
  reportingSubTab: ReportingSubTab
  syncStatus: 'connecting' | 'connected' | 'synced' | 'offline' | 'error'
  usersOnline: Record<string, { name: string; color: string; lastSeen: number }>
  miniCalYear: number
}

interface ViewActions {
  setZoom: (zoom: ZoomLevel) => void
  setViewStart: (d: Date) => void
  navigatePrev: () => void
  navigateNext: () => void
  goToToday: () => void
  setActiveTab: (tab: ActiveTab) => void
  toggleSidebar: () => void
  toggleFilter: () => void
  toggleHistogram: () => void
  toggleBacklog: () => void
  setFilter: (patch: Partial<FilterState>) => void
  resetFilter: () => void
  openTaskModal: (rowId: number, clickPercent: number, editTaskId?: number) => void
  closeModal: () => void
  setReportingSubTab: (tab: ReportingSubTab) => void
  openMilestoneModal: () => void
  closeMilestoneModal: () => void
  setSyncStatus: (s: ViewState['syncStatus']) => void
  setUsersOnline: (map: ViewState['usersOnline']) => void
  setMiniCalYear: (y: number) => void
}

const DEFAULT_FILTER: FilterState = {
  text: '',
  status: null,
  userStatus: null,
  batiment: null,
}

export const useViewStore = create<ViewState & ViewActions>()((set, get) => ({
  zoom: 'month',
  viewStart: startOfMonth(todayDate()),
  activeTab: 'gantt',
  sidebarCollapsed: false,
  filterVisible: false,
  histogramVisible: false,
  backlogVisible: false,
  filterState: DEFAULT_FILTER,
  modalState: null,
  milestoneModalOpen: false,
  reportingSubTab: 'categorie' as ReportingSubTab,
  syncStatus: 'connecting',
  usersOnline: {},
  miniCalYear: new Date().getFullYear(),

  setZoom(zoom) {
    set(s => {
      let viewStart = s.viewStart
      const today = todayDate()
      if (zoom === 'currentweek') viewStart = startOfWeek(today)
      else if (zoom === 'week') viewStart = startOfWeek(s.viewStart)
      else if (zoom === 'month') viewStart = startOfMonth(s.viewStart)
      else if (zoom === 'quarter' || zoom === 'year') viewStart = startOfYear(s.viewStart)
      return { zoom, viewStart }
    })
  },

  setViewStart(d) { set({ viewStart: d }) },

  navigatePrev() {
    set(s => ({ viewStart: shiftView(s.zoom, s.viewStart, -1) }))
  },

  navigateNext() {
    set(s => ({ viewStart: shiftView(s.zoom, s.viewStart, 1) }))
  },

  goToToday() {
    const today = todayDate()
    set(s => {
      let viewStart = startOfMonth(today)
      if (s.zoom === 'currentweek') viewStart = startOfWeek(today)
      else if (s.zoom === 'week') viewStart = startOfWeek(today)
      else if (s.zoom === 'quarter' || s.zoom === 'year') viewStart = startOfYear(today)
      return { viewStart }
    })
  },

  setActiveTab(tab) { set({ activeTab: tab }) },
  toggleSidebar() { set(s => ({ sidebarCollapsed: !s.sidebarCollapsed })) },
  toggleFilter() { set(s => ({ filterVisible: !s.filterVisible })) },
  toggleHistogram() { set(s => ({ histogramVisible: !s.histogramVisible })) },
  toggleBacklog() { set(s => ({ backlogVisible: !s.backlogVisible })) },

  setFilter(patch) {
    set(s => ({ filterState: { ...s.filterState, ...patch } }))
  },

  resetFilter() { set({ filterState: DEFAULT_FILTER }) },

  openTaskModal(rowId, clickPercent, editTaskId) {
    set({ modalState: { rowId, clickPercent, editTaskId: editTaskId ?? null } })
  },

  closeModal() { set({ modalState: null }) },
  setReportingSubTab(tab) { set({ reportingSubTab: tab }) },
  openMilestoneModal() { set({ milestoneModalOpen: true }) },
  closeMilestoneModal() { set({ milestoneModalOpen: false }) },

  setSyncStatus(syncStatus) { set({ syncStatus }) },

  setUsersOnline(map) { set({ usersOnline: map }) },

  setMiniCalYear(miniCalYear) { set({ miniCalYear }) },
}))

function shiftView(zoom: ZoomLevel, viewStart: Date, dir: 1 | -1): Date {
  if (zoom === 'currentweek') return viewStart  // always current week
  if (zoom === 'week') return addDays(viewStart, dir * 7 * 4)
  if (zoom === 'month') return addMonths(viewStart, dir * 3)
  if (zoom === 'quarter') return addMonths(viewStart, dir * 12)
  return addMonths(viewStart, dir * 12)  // year
}
