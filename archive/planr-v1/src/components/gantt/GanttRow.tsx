import { RefObject, useRef, useCallback } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Row, ViewColumn, MonthGroup, ZoomLevel } from '@/types/planning'
import { usePlanningStore } from '@/store/planningStore'
import { useViewStore } from '@/store/viewStore'
import { RowItem } from '@/components/sidebar/RowItem'
import { RowTrack } from './RowTrack'
import { rowTotals, fmtCost, fmtEtp } from '@/lib/taskCost'
import styles from './GanttRow.module.css'

interface Props {
  row: Row
  zoom: ZoomLevel
  viewColumns: ViewColumn[]
  monthGroups: MonthGroup[]
  colCount: number
  labelW: number
  recapW: number
  scrollRef: RefObject<HTMLDivElement>
}

export function GanttRow({ row, zoom, viewColumns, monthGroups, colCount, labelW, recapW, scrollRef }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({
      id: row.id,
      data: { type: 'row', rowId: row.id },
    })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const { totalCost, avgEtp } = rowTotals(row)

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={styles.row}
      {...attributes}
    >
      {/* Label cell — sticky left */}
      <div className={styles.labelCell} style={{ width: labelW, minWidth: labelW }}>
        <RowItem row={row} dragListeners={listeners} />
      </div>

      {/* Track cell */}
      <RowTrack
        row={row}
        zoom={zoom}
        viewColumns={viewColumns}
        monthGroups={monthGroups}
        colCount={colCount}
        scrollRef={scrollRef}
      />

      {/* Recap cell — sticky right */}
      <div className={styles.recapCell} style={{ width: recapW, minWidth: recapW }}>
        <span className={styles.recapEtp}>{fmtEtp(avgEtp)}</span>
        {totalCost > 0 && <span className={styles.recapCost}>{fmtCost(totalCost)}</span>}
      </div>
    </div>
  )
}
