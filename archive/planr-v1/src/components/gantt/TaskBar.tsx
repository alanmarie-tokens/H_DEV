import { RefObject } from 'react'
import { useDraggable } from '@dnd-kit/core'
import type { Task, ViewColumn, ZoomLevel } from '@/types/planning'
import { useViewStore } from '@/store/viewStore'
import { usePlanningStore } from '@/store/planningStore'
import { useTaskResize } from '@/hooks/useTaskResize'
import { taskCost } from '@/lib/taskCost'
import styles from './TaskBar.module.css'

const STATUS_COLORS: Record<string, string> = {
  todo:        '#71717a',
  in_progress: '#6366f1',
  done:        '#22c55e',
}

interface Props {
  task: Task
  rowId: number
  leftPct: number
  widthPct: number
  viewColumns: ViewColumn[]
  zoom: ZoomLevel
  trackRef: RefObject<HTMLDivElement>
}

export function TaskBar({ task, rowId, leftPct, widthPct, viewColumns, zoom, trackRef }: Props) {
  const openModal  = useViewStore(s => s.openTaskModal)
  const deleteTask = usePlanningStore(s => s.deleteTask)

  // Draggable
  const { attributes, listeners, setNodeRef, isDragging, transform } = useDraggable({
    id: `task-${task.id}`,
    data: { type: 'task', taskId: task.id, rowId, task },
  })

  // Resize
  const trackWidth = trackRef.current?.offsetWidth ?? 1000
  const { onMouseDown: onResizeMouseDown } = useTaskResize(task, rowId, trackWidth, viewColumns, zoom)

  const progress   = task.progress ?? 0
  const statusColor = task.status ? STATUS_COLORS[task.status] : undefined
  const { days } = taskCost(task)

  const style: React.CSSProperties = {
    left:  `${leftPct}%`,
    width: `${widthPct}%`,
    background: task.color,
    opacity: isDragging ? 0.4 : 1,
    transform: transform ? `translateX(${transform.x}px)` : undefined,
  }

  return (
    <div
      ref={setNodeRef}
      className={`${styles.bar} ${isDragging ? styles.barDragging : ''}`}
      style={style}
      data-task-bar="true"
      onDoubleClick={(e) => { e.stopPropagation(); openModal(rowId, 0, task.id) }}
      onContextMenu={(e) => { e.preventDefault(); deleteTask(rowId, task.id) }}
      title={`${task.name}\n${task.start} → ${task.end}\n${days} j`}
      {...attributes}
      {...listeners}
    >
      {/* Status stripe */}
      {statusColor && (
        <div className={styles.statusStripe} style={{ background: statusColor }} />
      )}

      {/* Progress bar */}
      {progress > 0 && (
        <div
          className={styles.progressBar}
          style={{ width: `${progress}%`, background: statusColor ?? task.color }}
        />
      )}

      {/* Label */}
      <span className={styles.label}>{task.name}</span>

      {/* Resize handles */}
      <div
        className={`${styles.handle} ${styles.handleLeft}`}
        onMouseDown={(e) => onResizeMouseDown(e, 'left')}
        onPointerDown={(e) => e.stopPropagation()}
      />
      <div
        className={`${styles.handle} ${styles.handleRight}`}
        onMouseDown={(e) => onResizeMouseDown(e, 'right')}
        onPointerDown={(e) => e.stopPropagation()}
      />
    </div>
  )
}
