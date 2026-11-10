import { useRef, useCallback, RefObject } from 'react'
import { useDroppable } from '@dnd-kit/core'
import type { Row, ViewColumn, MonthGroup, ZoomLevel } from '@/types/planning'
import { useViewStore } from '@/store/viewStore'
import { dateToPct, viewRangeStart, viewRangeEnd } from '@/lib/viewGeometry'
import { todayDate } from '@/lib/dateUtils'
import { TaskBar } from './TaskBar'
import { TrackGrid } from './TrackGrid'
import styles from './RowTrack.module.css'

interface Props {
  row: Row
  zoom: ZoomLevel
  viewColumns: ViewColumn[]
  monthGroups: MonthGroup[]
  colCount: number
  scrollRef: RefObject<HTMLDivElement>
}

export function RowTrack({ row, zoom, viewColumns, monthGroups, colCount, scrollRef }: Props) {
  const openModal = useViewStore(s => s.openTaskModal)

  const trackRef = useRef<HTMLDivElement>(null)

  const { setNodeRef, isOver } = useDroppable({
    id: `row-track-${row.id}`,
    data: { rowId: row.id },
  })

  const rangeStart = viewRangeStart(viewColumns)
  const rangeEnd   = viewRangeEnd(viewColumns, zoom)

  // Click to create task
  const handleClick = useCallback((e: React.MouseEvent) => {
    // Don't create if click was on a task bar
    if ((e.target as HTMLElement).closest('[data-task-bar]')) return

    const rect = trackRef.current?.getBoundingClientRect()
    if (!rect) return
    const pct = (e.clientX - rect.left) / rect.width
    openModal(row.id, pct)
  }, [row.id, openModal])

  const today = todayDate()
  const todayPct = dateToPct(today, rangeStart, rangeEnd)
  const showTodayLine = todayPct >= 0 && todayPct <= 1

  return (
    <div
      ref={(el) => { (trackRef as any).current = el; setNodeRef(el) }}
      className={`${styles.track} ${isOver ? styles.trackDragOver : ''}`}
      onClick={handleClick}
    >
      <TrackGrid monthGroups={monthGroups} viewColumns={viewColumns} />

      {/* Today line */}
      {showTodayLine && (
        <div
          className={styles.todayLine}
          style={{ left: `${todayPct * 100}%` }}
        />
      )}

      {/* Tasks */}
      {row.tasks.map(task => {
        const startPct = dateToPct(new Date(task.start + 'T00:00:00'), rangeStart, rangeEnd)
        const endPct   = dateToPct(new Date(task.end   + 'T00:00:00'), rangeStart, rangeEnd)
        const clampedStart = Math.max(0, startPct)
        const clampedEnd   = Math.min(1, endPct)
        if (clampedEnd <= clampedStart) return null

        return (
          <TaskBar
            key={task.id}
            task={task}
            rowId={row.id}
            leftPct={clampedStart * 100}
            widthPct={(clampedEnd - clampedStart) * 100}
            viewColumns={viewColumns}
            zoom={zoom}
            trackRef={trackRef}
          />
        )
      })}
    </div>
  )
}
