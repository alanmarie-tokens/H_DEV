import { MONTHS_FR } from '@/lib/dateUtils'
import styles from './MiniCalendar.module.css'

interface Props {
  year: number
  currentYear: number
  currentMonth: number
  onSelect: (year: number, month: number) => void
  onYearChange: (year: number) => void
}

export function MiniCalendar({ year, currentYear, currentMonth, onSelect, onYearChange }: Props) {
  const thisYear  = new Date().getFullYear()
  const thisMonth = new Date().getMonth()

  return (
    <div className={styles.cal}>
      <div className={styles.yearNav}>
        <button className={styles.yearBtn} onClick={() => onYearChange(year - 1)}>‹</button>
        <span className={styles.yearLabel}>{year}</span>
        <button className={styles.yearBtn} onClick={() => onYearChange(year + 1)}>›</button>
      </div>
      <div className={styles.grid}>
        {MONTHS_FR.map((label, m) => {
          const isSelected = year === currentYear && m === currentMonth
          const isToday    = year === thisYear && m === thisMonth
          return (
            <button
              key={m}
              className={`${styles.month} ${isSelected ? styles.monthSelected : ''} ${isToday ? styles.monthToday : ''}`}
              onClick={() => onSelect(year, m)}
            >
              {label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
