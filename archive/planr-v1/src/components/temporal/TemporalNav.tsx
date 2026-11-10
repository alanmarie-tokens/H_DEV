import { useState } from 'react'
import * as Popover from '@radix-ui/react-popover'
import { useViewStore } from '@/store/viewStore'
import { MiniCalendar } from './MiniCalendar'
import { MONTHS_FULL } from '@/lib/dateUtils'
import styles from './TemporalNav.module.css'

export function TemporalNav() {
  const zoom         = useViewStore(s => s.zoom)
  const viewStart    = useViewStore(s => s.viewStart)
  const navigatePrev = useViewStore(s => s.navigatePrev)
  const navigateNext = useViewStore(s => s.navigateNext)
  const goToToday    = useViewStore(s => s.goToToday)
  const setViewStart = useViewStore(s => s.setViewStart)
  const miniCalYear  = useViewStore(s => s.miniCalYear)
  const setMiniCalYear = useViewStore(s => s.setMiniCalYear)

  const [open, setOpen] = useState(false)

  const periodLabel = getPeriodLabel(zoom, viewStart)

  function handleJumpTo(year: number, month: number) {
    const d = new Date(year, month, 1)
    setViewStart(d)
    setOpen(false)
  }

  return (
    <div className={styles.nav}>
      <button className={styles.arrow} onClick={navigatePrev} title="Période précédente (←)">‹</button>

      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger asChild>
          <button className={styles.period}>{periodLabel}</button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content className={styles.popoverContent} sideOffset={8} align="center">
            <MiniCalendar
              year={miniCalYear}
              currentMonth={viewStart.getMonth()}
              currentYear={viewStart.getFullYear()}
              onSelect={handleJumpTo}
              onYearChange={setMiniCalYear}
            />
            <Popover.Arrow className={styles.popoverArrow} />
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>

      <button className={styles.arrow} onClick={navigateNext} title="Période suivante (→)">›</button>

      <button className={styles.today} onClick={goToToday} title="Aujourd'hui (T)">
        Aujourd'hui
      </button>
    </div>
  )
}

function getPeriodLabel(zoom: string, viewStart: Date): string {
  const y = viewStart.getFullYear()
  const m = viewStart.getMonth()

  if (zoom === 'currentweek') return "Cette semaine"
  if (zoom === 'week') return `${MONTHS_FULL[m]} ${y}`
  if (zoom === 'month') {
    const endMonth = (m + 11) % 12
    const endYear  = m + 11 > 11 ? y + 1 : y
    return `${MONTHS_FULL[m]} ${y} — ${MONTHS_FULL[endMonth]} ${endYear}`
  }
  if (zoom === 'quarter') return `${y} — ${y + 3}`
  return `${y} — ${y + 3}`
}
