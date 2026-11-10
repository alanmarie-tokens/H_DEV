import { useMemo, useRef, useCallback } from 'react'
import { DndContext, PointerSensor, useSensor, useSensors, DragEndEvent, DragOverlay } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { useViewStore } from '@/store/viewStore'
import { usePlanningStore } from '@/store/planningStore'
import { computeView, viewRangeStart, viewRangeEnd, getColWidth, dateToPct } from '@/lib/viewGeometry'
import { snapToZoom, toYMD, fromYMD } from '@/lib/dateUtils'
import { TimelineHeader } from './TimelineHeader'
import { GanttBody } from './GanttBody'
import { FilterBar } from '@/components/filters/FilterBar'
import { BacklogPanel } from '@/components/backlog/BacklogPanel'
import { HistogramPanel } from './HistogramPanel'
import { TaskModal } from '@/components/modals/TaskModal'
import { MilestoneModal } from '@/components/modals/MilestoneModal'
import styles from './GanttView.module.css'

const LABEL_W  = 200
const RECAP_W  = 160

export function GanttView() {
  const zoom           = useViewStore(s => s.zoom)
  const viewStart      = useViewStore(s => s.viewStart)
  const sidebarCollapsed = useViewStore(s => s.sidebarCollapsed)
  const filterVisible  = useViewStore(s => s.filterVisible)
  const histogramVisible = useViewStore(s => s.histogramVisible)
  const backlogVisible = useViewStore(s => s.backlogVisible)
  const modalState     = useViewStore(s => s.modalState)
  const milestoneModalOpen = useViewStore(s => s.milestoneModalOpen)

  const moveTask       = usePlanningStore(s => s.moveTask)
  const updateTask     = usePlanningStore(s => s.updateTask)
  const reorderRows    = usePlanningStore(s => s.reorderRows)

  const scrollRef = useRef<HTMLDivElement>(null)

  const labelW = sidebarCollapsed ? 48 : LABEL_W

  const geometry = useMemo(
    () => computeView(zoom, viewStart),
    [zoom, viewStart]
  )

  const { viewColumns, monthGroups, colCount } = geometry

  // We'll compute colWidth dynamically but need a reference width
  // Use a sensible default; actual rendering uses flex/CSS to fill
  const colWidth = 44 // will be overridden by CSS responsive calc

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } })
  )

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over, delta } = event
    if (!over) return

    const type = active.data.current?.type as string | undefined

    if (type === 'task') {
      const { taskId, rowId: fromRowId } = active.data.current as { taskId: number; rowId: number; task: any }
      const toRowId = over.data.current?.rowId as number | undefined ?? fromRowId

      // Calculate date delta from pixel delta
      const scrollEl = scrollRef.current
      if (!scrollEl) return
      const trackAreaW = scrollEl.clientWidth - labelW - RECAP_W
      const effectiveColW = getColWidth(scrollEl.clientWidth, labelW, RECAP_W, zoom, colCount)
      const totalW = effectiveColW * colCount
      const rangeStart = viewRangeStart(viewColumns)
      const rangeEnd   = viewRangeEnd(viewColumns, zoom)
      const rangeDays  = (rangeEnd.getTime() - rangeStart.getTime()) / 86400000

      const deltaDays = Math.round((delta.x / totalW) * rangeDays)

      // Get the task to compute new dates
      const { rows } = usePlanningStore.getState()
      const row = rows.find(r => r.id === fromRowId)
      const task = row?.tasks.find(t => t.id === taskId)
      if (!task) return

      const startDate = fromYMD(task.start)
      const endDate   = fromYMD(task.end)
      const duration  = (endDate.getTime() - startDate.getTime()) / 86400000

      const newStart = snapToZoom(new Date(startDate.getTime() + deltaDays * 86400000), zoom)
      const newEnd   = new Date(newStart.getTime() + duration * 86400000)

      if (toRowId !== fromRowId) {
        moveTask(taskId, fromRowId, toRowId)
      }
      updateTask(toRowId !== fromRowId ? toRowId : fromRowId, taskId, {
        start: toYMD(newStart),
        end:   toYMD(newEnd),
      })
    } else if (type === 'row') {
      const fromId = active.data.current?.rowId as number
      const toId   = over.data.current?.rowId as number
      if (fromId && toId && fromId !== toId) {
        reorderRows(fromId, toId)
      }
    }
  }, [zoom, viewColumns, colCount, labelW, moveTask, updateTask, reorderRows])

  const rows    = usePlanningStore(s => s.rows)
  const rowIds  = rows.map(r => r.id)

  return (
    <div className={styles.wrapper} style={{ '--label-w': `${labelW}px` } as React.CSSProperties}>
      {filterVisible && <FilterBar />}

      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <SortableContext items={rowIds} strategy={verticalListSortingStrategy}>
          <div className={styles.ganttScroll} ref={scrollRef}>
            <div
              className={styles.ganttInner}
              style={{ minWidth: `calc(var(--label-w) + ${colCount * 44}px + ${RECAP_W}px)` }}
            >
              <TimelineHeader
                zoom={zoom}
                viewColumns={viewColumns}
                monthGroups={monthGroups}
                labelW={labelW}
                recapW={RECAP_W}
              />
              <GanttBody
                zoom={zoom}
                viewColumns={viewColumns}
                monthGroups={monthGroups}
                colCount={colCount}
                labelW={labelW}
                recapW={RECAP_W}
                scrollRef={scrollRef}
              />
            </div>
          </div>
        </SortableContext>
        <DragOverlay />
      </DndContext>

      {histogramVisible && (
        <HistogramPanel viewColumns={viewColumns} zoom={zoom} />
      )}

      {backlogVisible && <BacklogPanel />}

      {modalState && (
        <TaskModal
          rowId={modalState.rowId!}
          editTaskId={modalState.editTaskId}
          clickPercent={modalState.clickPercent}
          viewColumns={viewColumns}
          zoom={zoom}
        />
      )}

      {milestoneModalOpen && <MilestoneModal />}
    </div>
  )
}
