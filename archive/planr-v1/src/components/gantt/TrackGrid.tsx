import type { ViewColumn, MonthGroup } from '@/types/planning'
import styles from './TrackGrid.module.css'

interface Props {
  monthGroups: MonthGroup[]
  viewColumns: ViewColumn[]
}

export function TrackGrid({ monthGroups, viewColumns }: Props) {
  const total = viewColumns.length || 1
  return (
    <div className={styles.grid}>
      {monthGroups.map((mg, i) => (
        <div
          key={i}
          className={`${styles.band}
            ${i % 2 === 0 ? styles.bandEven : styles.bandOdd}
            ${mg.isCurrent ? styles.bandCurrent : ''}`}
          style={{ width: `${(mg.colSpan / total) * 100}%` }}
        />
      ))}
      {/* Weekend / today column highlights */}
      {viewColumns.map((col, i) => (
        (col.isWeekend || col.isToday) ? (
          <div
            key={`col-${i}`}
            className={`${styles.colHighlight}
              ${col.isToday ? styles.colToday : ''}
              ${col.isWeekend ? styles.colWeekend : ''}`}
            style={{
              left:  `${(i / total) * 100}%`,
              width: `${(1  / total) * 100}%`,
            }}
          />
        ) : null
      ))}
    </div>
  )
}
