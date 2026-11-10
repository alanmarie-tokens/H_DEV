import { useRef, useCallback } from 'react'
import { usePlanningStore } from '@/store/planningStore'
import { fromYMD, toYMD, addDays, snapToZoom } from '@/lib/dateUtils'
import { pctToDate, viewRangeStart, viewRangeEnd } from '@/lib/viewGeometry'
import type { Task, ZoomLevel } from '@/types/planning'
import type { ViewColumn } from '@/types/planning'

interface ResizeState {
  direction: 'left' | 'right'
  startX: number
  anchorStart: string
  anchorEnd: string
  trackWidth: number
  rangeStart: Date
  rangeEnd: Date
}

export function useTaskResize(
  task: Task,
  rowId: number,
  trackWidth: number,
  viewColumns: ViewColumn[],
  zoom: ZoomLevel,
) {
  const updateTask = usePlanningStore(s => s.updateTask)
  const stateRef = useRef<ResizeState | null>(null)

  const onMouseDown = useCallback((e: React.MouseEvent, direction: 'left' | 'right') => {
    e.preventDefault()
    e.stopPropagation()

    const rangeStart = viewRangeStart(viewColumns)
    const rangeEnd   = viewRangeEnd(viewColumns, zoom)

    stateRef.current = {
      direction,
      startX: e.clientX,
      anchorStart: task.start,
      anchorEnd: task.end,
      trackWidth,
      rangeStart,
      rangeEnd,
    }

    function onMove(ev: PointerEvent) {
      const rs = stateRef.current
      if (!rs) return

      const deltaX  = ev.clientX - rs.startX
      const deltaPct = deltaX / rs.trackWidth
      const rangeMs  = rs.rangeEnd.getTime() - rs.rangeStart.getTime()
      const deltaMs  = deltaPct * rangeMs

      const anchor = rs.direction === 'left'
        ? fromYMD(rs.anchorStart)
        : fromYMD(rs.anchorEnd)

      const newDate = snapToZoom(new Date(anchor.getTime() + deltaMs), zoom)

      if (rs.direction === 'left') {
        const end = fromYMD(rs.anchorEnd)
        if (newDate < end) {
          updateTask(rowId, task.id, { start: toYMD(newDate) })
        }
      } else {
        const start = fromYMD(rs.anchorStart)
        if (newDate > start) {
          updateTask(rowId, task.id, { end: toYMD(newDate) })
        }
      }
    }

    function onUp() {
      stateRef.current = null
      document.removeEventListener('pointermove', onMove)
    }

    document.addEventListener('pointermove', onMove)
    document.addEventListener('pointerup', onUp, { once: true })
  }, [task, rowId, trackWidth, viewColumns, zoom, updateTask])

  return { onMouseDown }
}
