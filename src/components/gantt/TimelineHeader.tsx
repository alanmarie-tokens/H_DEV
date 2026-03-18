import type { ViewColumn, MonthGroup, ZoomLevel } from '@/types/planning'
import styles from './TimelineHeader.module.css'

interface Props {
  zoom: ZoomLevel
  viewColumns: ViewColumn[]
  monthGroups: MonthGroup[]
  labelW: number
  recapW: number
}

export function TimelineHeader({ zoom, viewColumns, monthGroups, labelW, recapW }: Props) {
  return (
    <div className={styles.header}>
      {/* Label column spacer */}
      <div className={styles.labelSpacer} style={{ width: labelW, minWidth: labelW }} />

      {/* Timeline months */}
      <div className={styles.timeline}>
        {zoom === 'currentweek' ? (
          <div className={`${styles.monthGroup} ${styles.monthGroupCurrent}`}
               style={{ width: viewColumns.length * 80 }}>
            <div className={`${styles.monthLabel} ${styles.monthLabelCurrent}`}>
              {monthGroups[0]?.label}
            </div>
            <div className={styles.units}>
              {viewColumns.map((col, i) => (
                <div
                  key={i}
                  className={`${styles.unit} ${styles.unitDay}
                    ${col.isToday ? styles.unitToday : ''}
                    ${col.isWeekend ? styles.unitWeekend : ''}`}
                >
                  <span className={styles.dayName}>{col.label}</span>
                  <span className={styles.dayNum}>{col.sublabel}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          monthGroups.map((mg, mgIdx) => (
            <div
              key={mgIdx}
              className={`${styles.monthGroup}
                ${mgIdx % 2 === 0 ? styles.monthGroupEven : styles.monthGroupOdd}
                ${mg.isCurrent ? styles.monthGroupCurrent : ''}`}
            >
              <div className={`${styles.monthLabel} ${mg.isCurrent ? styles.monthLabelCurrent : ''}`}>
                {mg.label}
              </div>
              <div className={styles.units}>
                {viewColumns.slice(mg.colStart, mg.colStart + mg.colSpan).map((col, i) => (
                  <div
                    key={i}
                    className={`${styles.unit}
                      ${col.isToday ? styles.unitToday : ''}
                      ${col.isWeekend ? styles.unitWeekend : ''}`}
                  >
                    {col.label}
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Recap spacer */}
      <div className={styles.recapSpacer} style={{ width: recapW, minWidth: recapW }} />
    </div>
  )
}
