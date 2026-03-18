import { useEffect, useRef, useMemo } from 'react'
import { usePlanningStore } from '@/store/planningStore'
import type { ViewColumn, ZoomLevel } from '@/types/planning'
import { fromYMD } from '@/lib/dateUtils'
import { viewRangeStart, viewRangeEnd, dateToPct } from '@/lib/viewGeometry'
import styles from './HistogramPanel.module.css'

const H = 80

interface Props {
  viewColumns: ViewColumn[]
  zoom: ZoomLevel
}

export function HistogramPanel({ viewColumns, zoom }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rows = usePlanningStore(s => s.rows)

  const rangeStart = viewRangeStart(viewColumns)
  const rangeEnd   = viewRangeEnd(viewColumns, zoom)

  // Compute ETP per column
  const etpPerCol = useMemo(() => {
    if (!viewColumns.length) return []
    return viewColumns.map(col => {
      const colStart = col.date.getTime()
      const colEnd   = colStart + 7 * 86400000  // approximate 1 week
      let etp = 0
      rows.forEach(row => {
        row.tasks.forEach(task => {
          const ts = fromYMD(task.start).getTime()
          const te = fromYMD(task.end).getTime()
          if (ts < colEnd && te > colStart) {
            etp += task.etp ?? 1
          }
        })
      })
      return etp
    })
  }, [rows, viewColumns])

  const maxEtp = Math.max(2, ...etpPerCol)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const W = canvas.offsetWidth
    ctx.canvas.width  = W
    ctx.canvas.height = H

    ctx.clearRect(0, 0, W, H)

    const n = etpPerCol.length
    if (!n) return

    const barW = W / n

    etpPerCol.forEach((etp, i) => {
      const barH = (etp / maxEtp) * (H - 10)
      const x = i * barW
      const overload = etp > 1.5

      ctx.fillStyle = overload ? 'rgba(239,68,68,0.5)' : 'rgba(99,102,241,0.4)'
      ctx.fillRect(x + 1, H - barH, barW - 2, barH)
    })

    // Reference line at 1 ETP
    const refY = H - (1 / maxEtp) * (H - 10)
    ctx.strokeStyle = 'rgba(99,102,241,0.3)'
    ctx.setLineDash([4, 4])
    ctx.beginPath()
    ctx.moveTo(0, refY)
    ctx.lineTo(W, refY)
    ctx.stroke()
  }, [etpPerCol, maxEtp])

  return (
    <div className={styles.panel}>
      <canvas ref={canvasRef} className={styles.canvas} height={H} />
    </div>
  )
}
